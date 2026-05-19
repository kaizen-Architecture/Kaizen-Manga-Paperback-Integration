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
  version: '1.1.0',
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
    const token = ((await this.stateManager.retrieve('token')) as string) ?? ''
    if (token) {
      const headers = { ...(request.headers ?? {}) }
      headers['Authorization'] = `Bearer ${token.trim()}`
      return App.createRequest({
        url: request.url,
        method: request.method,
        headers,
        data: request.data,
        param: request.param,
        cookies: request.cookies,
      })
    }
    return request
  }

  async interceptResponse(response: PBResponse): Promise<PBResponse> {
    return response
  }
}

// ─── Source Class ─────────────────────────────────────────────────────────────
export class KaizenManga extends Source implements MangaProgressProviding {
  requestManager: RequestManager
  stateManager: SourceStateManager

  constructor(cheerio: CheerioAPI) {
    super(cheerio)
    this.stateManager = App.createSourceStateManager()
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 5,
      requestTimeout: 20000,
      interceptor: new KaizenInterceptor(this.stateManager),
    })
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

  private async apiFetch(url: string, method = 'GET', body?: string): Promise<any> {
    const { token } = await this.creds()
    const req = App.createRequest({
      url,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: body,
    })
    const resp = await this.requestManager.schedule(req, 1)
    if (resp.status >= 400) throw new Error(`HTTP ${resp.status} – ${url}`)
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
    const { host, token } = await this.creds()
    const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)

    const tags: Tag[] = (raw.metadata?.genres ?? []).map((g: string) =>
      App.createTag({ id: g, label: g })
    )
    const tagSections: TagSection[] = tags.length
      ? [App.createTagSection({ id: 'genres', label: 'Géneros', tags })]
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
  }

  // ─── getChapters ──────────────────────────────────────────────────────────
  async getChapters(mangaId: string): Promise<Chapter[]> {
    if (mangaId === 'setup_help') {
      return []
    }
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
  }

  // ─── getChapterDetails ────────────────────────────────────────────────────
  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    if (mangaId === 'setup_help') {
      return App.createChapterDetails({ id: chapterId, mangaId, pages: [] })
    }
    const { host, token } = await this.creds()
    const raw = await this.apiFetch(
      `${host}/api/v1/mangas/${mangaId}/chapters/${chapterId}/pages`
    )
    const pages: string[] = (raw.pages ?? []).map((p: any) => {
      const separator = p.url.includes('?') ? '&' : '?'
      return `${host}${p.url}${separator}token=${encodeURIComponent(token)}`
    })
    return App.createChapterDetails({ id: chapterId, mangaId, pages })
  }

  // ─── getSearchResults ─────────────────────────────────────────────────────
  async getSearchResults(query: SearchRequest, _metadata: any): Promise<PagedResults> {
    try {
      const { host, token } = await this.creds()
      const raw: any[] = await this.apiFetch(`${host}/api/v1/mangas`)
      const term = (query.title ?? '').toLowerCase().trim()
      const filtered = term
        ? raw.filter((m) => (m.title ?? '').toLowerCase().includes(term))
        : raw

      return App.createPagedResults({
        results: filtered.map((m) =>
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

  // ─── getHomePageSections ──────────────────────────────────────────────────
  async getHomePageSections(
    sectionCallback: (section: HomeSection) => void
  ): Promise<void> {
    try {
      const { host, token } = await this.creds()
      const raw: any[] = await this.apiFetch(`${host}/api/v1/mangas`)

      // Recently added
      const recentSection: HomeSection = App.createHomeSection({
        id: 'recent',
        title: 'Recientemente Añadidos',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal,
        items: [],
      })
      sectionCallback(recentSection)
      recentSection.items = [...raw]
        .sort((a, b) => b.id - a.id)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
          })
        )
      sectionCallback(recentSection)

      // Unread chapters
      const unreadSection: HomeSection = App.createHomeSection({
        id: 'unread',
        title: 'Capítulos Sin Leer',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal,
        items: [],
      })
      sectionCallback(unreadSection)
      unreadSection.items = raw
        .filter((m) => m.readingStatus && m.readingStatus.unreadChapters > 0)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? 'Sin título',
            image: getCoverUrl(m.metadata, host, token),
            subtitle: `${m.readingStatus.unreadChapters} sin leer`,
          })
        )
      sectionCallback(unreadSection)
    } catch (err) {
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

  async getViewMoreItems(
    homepageSectionId: string,
    _metadata: any
  ): Promise<PagedResults> {
    try {
      const { host, token } = await this.creds()
      const raw: any[] = await this.apiFetch(`${host}/api/v1/mangas`)
      let results = raw
      if (homepageSectionId === 'recent') {
        results = [...raw].sort((a, b) => b.id - a.id)
      } else if (homepageSectionId === 'unread') {
        results = raw.filter(
          (m) => m.readingStatus && m.readingStatus.unreadChapters > 0
        )
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
        App.createDUINavigationButton({
          id: 'server_settings',
          label: 'Configuración del Servidor',
          form: App.createDUIForm({
            sections: async () => [
              App.createDUISection({
                id: 'connection',
                header: 'Detalles del Servidor Kaizen',
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
                ],
              }),
              App.createDUISection({
                id: 'testing',
                header: 'Prueba de Conexión',
                isHidden: false,
                rows: async () => [
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
                ]
              })
            ]
          })
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

          const body = JSON.stringify({
            chapters: [
              {
                id: chapterId,
                isRead: true,
              },
            ],
          })
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
