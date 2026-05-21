import {
  BadgeColor,
  ContentRating,
  Chapter,
  ChapterDetails,
  HomeSection,
  HomeSectionType,
  PagedResults,
  SearchRequest,
  Source,
  SourceInfo,
  SourceIntents,
  SourceManga,
  Tag,
  TagSection,
  RequestManager,
  SourceStateManager,
  DUIForm,
  DUISection,
  DUINavigationButton,
  DUIButton,
  MangaProgressProviding,
  MangaProgress,
  TrackerActionQueue,
  Request as PBRequest,
  Response as PBResponse,
  SourceInterceptor,
} from '@paperback/types'
import { CheerioAPI } from 'cheerio'

// ─── Declare runtime globals (injected by Paperback app) ─────────────────────
// These are NOT available at bundle-evaluation time in Node; they are
// provided by the iOS JavaScriptCore runtime when Paperback loads the source.
declare const App: any

// ─── SourceInfo ───────────────────────────────────────────────────────────────
// This object is evaluated in Node by the toolchain to generate versioning.json.
// It must be plain data — no runtime globals.
export const KaizenMangaInfo: SourceInfo = {
  version: '1.4.7',
  name: 'Kaizen Manga',
  icon: 'icon.png',
  author: 'D4nj3s (DanielJNavas)',
  authorWebsite: 'https://github.com/d4nj3s',
  description:
    'Accede a tu biblioteca local de Kaizen Manga Downloader directamente desde Paperback.',
  contentRating: ContentRating.EVERYONE,
  websiteBaseURL: 'http://localhost:3333',
  sourceTags: [
    {
      text: 'Local',
      type: BadgeColor.BLUE,
    },
  ],
  intents:
    SourceIntents.MANGA_CHAPTERS |
    SourceIntents.HOMEPAGE_SECTIONS |
    SourceIntents.SETTINGS_UI |
    SourceIntents.MANGA_TRACKING,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cleanHost(raw: string): string {
  let h = (raw ?? '').trim().replace(/\/+$/, '')
  if (!h || h === 'http:/' || h === 'https:/' || h === 'http:' || h === 'https:') return ''
  if (!h.startsWith('http://') && !h.startsWith('https://')) h = 'http://' + h
  return h
}

function getCoverUrl(metadata: any, host: string, token: string): string {
  const cover = metadata?.cover
  if (!cover) {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'
  }
  if (cover.startsWith('http://') || cover.startsWith('https://')) {
    return cover
  }
  const cleanCover = cover.startsWith('/') ? cover : '/' + cover
  return `${host}${cleanCover}?token=${encodeURIComponent(token)}`
}

class KaizenInterceptor implements SourceInterceptor {
  stateManager: SourceStateManager

  constructor(stateManager: SourceStateManager) {
    this.stateManager = stateManager
  }

  async interceptRequest(request: PBRequest): Promise<PBRequest> {
    let url = request.url
    if (url.startsWith('FAKE*')) {
      url = url.split('*REAL*').pop() ?? ''
    }

    const token = ((await this.stateManager.retrieve('token')) as string) ?? ''
    const headers = { ...(request.headers ?? {}) }
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`
    }

    return App.createRequest({
      url,
      method: request.method,
      headers,
      data: request.data,
      param: request.param,
      cookies: request.cookies,
    })
  }

  async interceptResponse(response: PBResponse): Promise<PBResponse> {
    return response
  }
}

// ─── Source Class ─────────────────────────────────────────────────────────────
export class KaizenManga extends Source implements MangaProgressProviding {
  requestManager: RequestManager
  stateManager: SourceStateManager
  private _mangasCache?: { data: any[]; timestamp: number }

  constructor(cheerio: CheerioAPI) {
    super(cheerio)
    this.stateManager = App.createSourceStateManager()
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 5,
      requestTimeout: 20000,
      interceptor: new KaizenInterceptor(this.stateManager),
    })
  }

  private async getCachedMangasIfValid(): Promise<any[] | null> {
    const now = Date.now()
    const CACHE_TTL = 10 * 60 * 1000 // 10 minutes cache TTL

    // Memory cache check
    if (this._mangasCache && (now - this._mangasCache.timestamp < CACHE_TTL)) {
      return this._mangasCache.data
    }

    // Persistent storage cache check
    try {
      const persistedStr = ((await this.stateManager.retrieve('mangas_cache')) as string) ?? ''
      const persistedTimeStr = ((await this.stateManager.retrieve('mangas_cache_time')) as string) ?? ''
      if (persistedStr && persistedTimeStr) {
        const persistedTime = parseInt(persistedTimeStr, 10)
        if (!isNaN(persistedTime) && (now - persistedTime < CACHE_TTL)) {
          const parsed = JSON.parse(persistedStr)
          if (Array.isArray(parsed) && parsed.length > 0) {
            this._mangasCache = { data: parsed, timestamp: persistedTime }
            return parsed
          }
        }
      }
    } catch (_) {}

    return null
  }

  private async getCachedMangas(host: string): Promise<any[]> {
    const cached = await this.getCachedMangasIfValid()
    if (cached) return cached

    const data: any[] = await this.apiFetch(`${host}/api/v1/mangas`)
    const now = Date.now()
    this._mangasCache = { data, timestamp: now }
    try {
      await this.stateManager.store('mangas_cache', JSON.stringify(data))
      await this.stateManager.store('mangas_cache_time', String(now))
    } catch (_) {}
    return data
  }

  private async refreshMangasCacheInBackground(host: string): Promise<any[]> {
    try {
      const data: any[] = await this.apiFetch(`${host}/api/v1/mangas`)
      const now = Date.now()
      this._mangasCache = { data, timestamp: now }
      await this.stateManager.store('mangas_cache', JSON.stringify(data))
      await this.stateManager.store('mangas_cache_time', String(now))
      return data
    } catch (_) {
      return []
    }
  }

  private async creds(): Promise<{ host: string; token: string }> {
    const host = ((await this.stateManager.retrieve('host')) as string) ?? ''
    const token = ((await this.stateManager.retrieve('token')) as string) ?? ''
    const cleaned = cleanHost(host)
    if (!cleaned) {
      throw new Error('Host no configurado')
    }
    return { host: cleaned, token: token.trim() }
  }

  private async apiFetch(url: string, method = 'GET', body?: any): Promise<any> {
    const { token } = await this.creds()
    const req = App.createRequest({
      url,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: typeof body === 'string' ? JSON.parse(body) : body,
    })
    const resp = await this.requestManager.schedule(req, 1)
    if (resp.status >= 400) {
      let errorMessage = `HTTP ${resp.status} – ${url}`
      try {
        if (resp.data) {
          const parsed = JSON.parse(resp.data)
          if (parsed && typeof parsed.error === 'string') {
            errorMessage = `${parsed.error} (HTTP ${resp.status})`
          }
        }
      } catch (_) {}
      throw new Error(errorMessage)
    }
    return JSON.parse(resp.data ?? '{}')
  }

  // ─── getMangaDetails ───────────────────────────────────────────────────────
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    if (mangaId === 'setup_help') {
      return App.createSourceManga({
        id: 'setup_help',
        mangaInfo: App.createMangaInfo({
          titles: ['Cómo configurar Kaizen Manga'],
          image: '',
          author: 'D4nj3s (DanielJNavas)',
          desc: 'Para usar esta extensión, ve a la pestaña "Ajustes" de Paperback -> "Extensiones" -> toca "Kaizen Manga" -> introduce la dirección IP/Host de tu servidor (ej. http://192.168.1.50:3333) y tu API Token de Kaizen.',
          status: 'Completed',
        }),
      })
    }
    try {
      const { host, token } = await this.creds()
      const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)

      const tags: Tag[] = (raw.metadata?.genres ?? []).map((g: string) =>
        App.createTag({ id: g, label: g })
      )
      const tagSections: TagSection[] = tags.length
        ? [App.createTagSection({ id: 'genres', label: 'Genres', tags })]
        : []

      return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
          titles: [raw.title ?? 'Sin título'],
          image: getCoverUrl(raw.metadata, host, token),
          author: raw.metadata?.authors?.join(', ') || 'Desconocido',
          artist: '',
          desc: raw.metadata?.summary || 'Sin descripción.',
          tags: tagSections,
          status: raw.metadata?.status === 'ONGOING' ? 'Ongoing' : 'Completed',
        }),
      })
    } catch (e: any) {
      throw new Error(`Error obteniendo detalles del manga: ${e.message}`)
    }
  }

  // ─── getChapters ──────────────────────────────────────────────────────────
  async getChapters(mangaId: string): Promise<Chapter[]> {
    if (mangaId === 'setup_help') {
      return []
    }
    try {
      const { host } = await this.creds()
      const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)
      return (raw.chapters ?? []).map((ch: any) =>
        App.createChapter({
          id: String(ch.id),
          mangaId,
          chapNum: ch.index ?? 0,
          name: ch.name ?? `Capítulo ${ch.index}`,
          langCode: '🇬🇧',
          time: ch.createdAt ? new Date(ch.createdAt) : undefined,
        })
      )
    } catch (e: any) {
      throw new Error(`Error obteniendo capítulos: ${e.message}`)
    }
  }

  // ─── getChapterDetails ────────────────────────────────────────────────────
  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    if (mangaId === 'setup_help') {
      return App.createChapterDetails({ id: chapterId, mangaId, pages: [] })
    }
    try {
      const { host } = await this.creds()
      const raw = await this.apiFetch(
        `${host}/api/v1/mangas/${mangaId}/chapters/${chapterId}/pages`
      )
      const pages: string[] = (raw.pages ?? []).map((p: any) => {
        return `FAKE*/page_${p.index}.png?*REAL*${host}${p.url}`
      })
      return App.createChapterDetails({ id: chapterId, mangaId, pages })
    } catch (e: any) {
      if (e.message?.includes('404')) {
        throw new Error('Error 404: ¿Tu servidor Kaizen Manga está actualizado a v1.12+ y el archivo .cbz existe?')
      }
      throw new Error(`Error obteniendo detalles del capítulo: ${e.message}`)
    }
  }

  // ─── getSearchResults ─────────────────────────────────────────────────────
  async getSearchResults(query: SearchRequest, _metadata: any): Promise<PagedResults> {
    try {
      const { host, token } = await this.creds()
      const raw: any[] = await this.getCachedMangas(host)
      let results = raw

      // Filter by text term
      const term = (query.title ?? '').toLowerCase().trim()
      if (term) {
        results = results.filter((m) => (m.title ?? '').toLowerCase().includes(term))
      }

      // Filter by tags (genres)
      const selectedTags = (query.includedTags ?? []).map((t) => t.id)
      if (selectedTags.length > 0) {
        results = results.filter((m) =>
          (m.metadata?.genres ?? []).some((g: string) => selectedTags.includes(g))
        )
      }

      return App.createPagedResults({
        results: results.map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
            subtitle: m.readingStatus
              ? `${m.readingStatus.readChapters}/${m.readingStatus.totalChapters} cap.`
              : undefined,
          })
        ),
      })
    } catch (err) {
      return App.createPagedResults({ results: [] })
    }
  }

  // ─── getSearchTags ────────────────────────────────────────────────────────
  async getSearchTags(): Promise<TagSection[]> {
    try {
      const { host } = await this.creds()
      const raw: any[] = await this.getCachedMangas(host)
      const genreSet = new Set<string>()
      for (const m of raw) {
        for (const g of m.metadata?.genres ?? []) {
          if (g) genreSet.add(g)
        }
      }
      const tags = Array.from(genreSet).sort().map((g) =>
        App.createTag({ id: g, label: g })
      )
      return [
        App.createTagSection({
          id: 'genres',
          label: 'Genres',
          tags,
        })
      ]
    } catch (err) {
      return []
    }
  }

  // ─── getHomePageSections ──────────────────────────────────────────────────
  async getHomePageSections(
    sectionCallback: (section: HomeSection) => void
  ): Promise<void> {
    try {
      const { host, token } = await this.creds()
      
      // Try to load cached mangas from memory or storage
      const cached = await this.getCachedMangasIfValid()
      
      if (cached && cached.length > 0) {
        // Render instantly using cached data (no flicker, no skeletons!)
        this.renderSections(sectionCallback, cached, host, token)
        
        // Trigger a background refresh to keep data updated
        this.refreshMangasCacheInBackground(host).then((newData) => {
          if (newData && newData.length > 0) {
            this.renderSections(sectionCallback, newData, host, token)
          }
        }).catch(() => {})
        return
      }
    } catch (_) {}

    // Fallback: No cache available (first run). Render skeleton loaders, then fetch blocking.
    const onDeckSection: HomeSection = App.createHomeSection({
      id: 'on_deck',
      title: 'En Curso (On Deck)',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: [],
    })
    sectionCallback(onDeckSection)

    const recentSection: HomeSection = App.createHomeSection({
      id: 'recent',
      title: 'Recientemente Añadidos',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: [],
    })
    sectionCallback(recentSection)

    const unreadSection: HomeSection = App.createHomeSection({
      id: 'unread',
      title: 'Capítulos Sin Leer',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: [],
    })
    sectionCallback(unreadSection)

    try {
      const { host, token } = await this.creds()
      const raw: any[] = await this.apiFetch(`${host}/api/v1/mangas`)
      
      // Update cache
      const now = Date.now()
      this._mangasCache = { data: raw, timestamp: now }
      await this.stateManager.store('mangas_cache', JSON.stringify(raw))
      await this.stateManager.store('mangas_cache_time', String(now))

      // Populate sections
      this.renderSections(sectionCallback, raw, host, token)
    } catch (err) {
      // Clear main sections if they failed
      onDeckSection.items = []
      sectionCallback(onDeckSection)
      recentSection.items = []
      sectionCallback(recentSection)
      unreadSection.items = []
      sectionCallback(unreadSection)

      const setupSection: HomeSection = App.createHomeSection({
        id: 'setup',
        title: 'Configuración Requerida',
        containsMoreItems: false,
        type: HomeSectionType.singleRowNormal,
        items: [],
      })
      sectionCallback(setupSection)
      setupSection.items = [
        App.createPartialSourceManga({
          mangaId: 'setup_help',
          title: 'Toca aquí para ver cómo configurar la extensión',
          image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>',
        })
      ]
      sectionCallback(setupSection)
    }
  }

  private renderSections(
    sectionCallback: (section: HomeSection) => void,
    raw: any[],
    host: string,
    token: string
  ): void {
    // On Deck (mangas started but not fully read)
    const onDeckSection: HomeSection = App.createHomeSection({
      id: 'on_deck',
      title: 'En Curso (On Deck)',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: raw
        .filter((m) => m.readingStatus && m.readingStatus.readChapters > 0 && !m.readingStatus.isFullyRead)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
            subtitle: `${m.readingStatus.readChapters}/${m.readingStatus.totalChapters} leídos`,
          })
        ),
    })
    sectionCallback(onDeckSection)

    // Recently added
    const recentSection: HomeSection = App.createHomeSection({
      id: 'recent',
      title: 'Recientemente Añadidos',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: [...raw]
        .sort((a, b) => b.id - a.id)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
          })
        ),
    })
    sectionCallback(recentSection)

    // Unread chapters
    const unreadSection: HomeSection = App.createHomeSection({
      id: 'unread',
      title: 'Capítulos Sin Leer',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: raw
        .filter((m) => m.readingStatus && m.readingStatus.unreadChapters > 0)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
            subtitle: `${m.readingStatus.unreadChapters} sin leer`,
          })
        ),
    })
    sectionCallback(unreadSection)

    // Group by library dynamically
    const libraryMap = new Map<string, any[]>()
    for (const m of raw) {
      const libName = m.library?.name?.trim() || 'Library'
      if (!libraryMap.has(libName)) {
        libraryMap.set(libName, [])
      }
      libraryMap.get(libName)!.push(m)
    }

    for (const [libName, libMangas] of libraryMap.entries()) {
      const libId = `lib_${libName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      const libSection: HomeSection = App.createHomeSection({
        id: libId,
        title: libName,
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal,
        items: libMangas.slice(0, 20).map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
          })
        ),
      })
      sectionCallback(libSection)
    }
  }

  async getViewMoreItems(
    homepageSectionId: string,
    _metadata: any
  ): Promise<PagedResults> {
    try {
      const { host, token } = await this.creds()
      const raw: any[] = await this.getCachedMangas(host)
      let results = raw
      if (homepageSectionId === 'recent') {
        results = [...raw].sort((a, b) => b.id - a.id)
      } else if (homepageSectionId === 'unread') {
        results = raw.filter(
          (m) => m.readingStatus && m.readingStatus.unreadChapters > 0
        )
      } else if (homepageSectionId === 'on_deck') {
        results = raw.filter(
          (m) => m.readingStatus && m.readingStatus.readChapters > 0 && !m.readingStatus.isFullyRead
        )
      } else if (homepageSectionId.startsWith('lib_')) {
        results = raw.filter((m) => {
          const libName = m.library?.name?.trim() || 'Library'
          const libId = `lib_${libName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
          return libId === homepageSectionId
        })
      }
      return App.createPagedResults({
        results: results.map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
          })
        ),
      })
    } catch (err) {
      return App.createPagedResults({ results: [] })
    }
  }

  // ─── Settings UI ──────────────────────────────────────────────────────────
  async getSourceMenu(): Promise<DUISection> {
    return App.createDUISection({
      id: 'settings',
      header: 'Configuración de Kaizen Downloader',
      isHidden: false,
      rows: async () => [
        App.createDUIInputField({
          id: 'host',
          label: 'Host del Servidor',
          value: App.createDUIBinding({
            get: async () =>
              ((await this.stateManager.retrieve('host')) as string) ?? '',
            set: async (v: string) => this.stateManager.store('host', v),
          }),
        }),
        App.createDUISecureInputField({
          id: 'token',
          label: 'API Token',
          value: App.createDUIBinding({
            get: async () =>
              ((await this.stateManager.retrieve('token')) as string) ?? '',
            set: async (v: string) => this.stateManager.store('token', v),
          }),
        }),
        App.createDUIInputField({
          id: 'status',
          label: 'Resultado',
          value: App.createDUIBinding({
            get: async () =>
              ((await this.stateManager.retrieve('status')) as string) ?? 'Sin verificar',
            set: async (v: string) => { },
          }),
        }),
        App.createDUIButton({
          id: 'test_connection',
          label: 'Probar Conexión',
          onTap: async () => {
            const host = ((await this.stateManager.retrieve('host')) as string) ?? ''
            const token = ((await this.stateManager.retrieve('token')) as string) ?? ''
            const cleaned = cleanHost(host)
            if (!cleaned) {
              await this.stateManager.store('status', 'Error: Host vacío')
              return
            }

            await this.stateManager.store('status', 'Probando conexión...')

            try {
              const testRequest = App.createRequest({
                url: `${cleaned}/api/v1/mangas`,
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                }
              })
              const resp = await this.requestManager.schedule(testRequest, 1)
              if (resp.status >= 400) {
                await this.stateManager.store('status', `Error HTTP: ${resp.status}`)
                return
              }
              const data = JSON.parse(resp.data ?? '[]')
              if (!Array.isArray(data)) {
                await this.stateManager.store('status', 'Error: JSON inválido')
                return
              }
              await this.stateManager.store('status', `¡Éxito! (${data.length} mangas)`)
            } catch (err: any) {
              await this.stateManager.store('status', `Error: ${err.message || String(err)}`)
            }
          }
        })
      ],
    })
  }

  // ─── Tracking ──────────────────────────────────────────────────────────────
  async getMangaProgress(mangaId: string): Promise<MangaProgress | undefined> {
    try {
      const { host } = await this.creds()
      const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)
      if (!raw || !raw.chapters) return undefined

      const readChapters = (raw.chapters ?? []).filter((ch: any) => ch.isRead)
      let lastReadChapterNumber = 0
      if (readChapters.length > 0) {
        lastReadChapterNumber = Math.max(...readChapters.map((ch: any) => ch.index ?? 0))
      }

      return App.createMangaProgress({
        mangaId,
        lastReadChapterNumber,
        lastReadVolumeNumber: 0,
        trackedListName: 'Kaizen',
        lastReadTime: new Date(),
      })
    } catch (err) {
      return undefined
    }
  }

  async getMangaProgressManagementForm(mangaId: string): Promise<DUIForm> {
    return App.createDUIForm({
      sections: async () => {
        try {
          const { host } = await this.creds()
          const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)
          const reading = raw.readingStatus ?? { readChapters: 0, totalChapters: 0 }
          return [
            App.createDUISection({
              id: 'info',
              header: 'Progreso de Lectura en Kaizen',
              isHidden: false,
              rows: async () => [
                App.createDUILabel({
                  id: 'progress',
                  label: 'Capítulos Leídos',
                  value: `${reading.readChapters} / ${reading.totalChapters}`,
                }),
              ],
            }),
          ]
        } catch (err: any) {
          return [
            App.createDUISection({
              id: 'error_section',
              header: 'Error',
              isHidden: false,
              rows: async () => [
                App.createDUILabel({
                  id: 'error_msg',
                  label: 'No se pudo conectar con el servidor',
                  value: err.message || String(err),
                }),
              ],
            }),
          ]
        }
      },
      onSubmit: async () => {
        // No values to submit/edit directly on progress form
      },
    })
  }

  async processChapterReadActionQueue(actionQueue: TrackerActionQueue): Promise<void> {
    try {
      const chapterReadActions = await actionQueue.queuedChapterReadActions()
      const { host } = await this.creds()

      for (const readAction of chapterReadActions) {
        try {
          const mangaId = parseInt(readAction.sourceMangaId)
          const chapterId = parseInt(readAction.sourceChapterId)
          if (isNaN(mangaId) || isNaN(chapterId)) {
            await actionQueue.discardChapterReadAction(readAction)
            continue
          }

          const body = {
            chapters: [
              {
                id: chapterId,
                isRead: true,
              },
            ],
          }
          await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`, 'PATCH', body)
          await actionQueue.discardChapterReadAction(readAction)
        } catch (err) {
          await actionQueue.retryChapterReadAction(readAction)
        }
      }
    } catch (err) {
      // If credentials or root call fails, retry everything
    }
  }
}
