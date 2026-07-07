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
  DUILabel,
  DUIStepper,
  DUISelect,
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
  version: '1.5.4',
  name: 'Kaizen Manga',
  icon: 'icon.png',
  author: 'D4nj3s (DanielJNavas)',
  authorWebsite: 'https://github.com/d4nj3s',
  description:
    'Access your local Kaizen Manga Downloader library directly from Paperback. / Accede a tu biblioteca local de Kaizen Manga Downloader directamente desde Paperback.',
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

// ─── i18n Dictionaries ────────────────────────────────────────────────────────
const DICTIONARIES: Record<string, Record<string, string>> = {
  en: {
    host_unconfigured: 'Host not configured',
    setup_help_title: 'How to configure Kaizen Manga',
    setup_help_desc: 'To use this extension, go to Paperback "Settings" -> "Extensions" -> tap "Kaizen Manga" -> enter your server IP/Host (e.g. http://192.168.1.50:3333) and your Kaizen API Token.',
    untitled: 'Untitled',
    unknown_author: 'Unknown',
    no_description: 'No description.',
    ongoing: 'Ongoing',
    completed: 'Completed',
    error_manga_details: 'Error getting manga details: ',
    chapter: 'Chapter',
    chapter_short: 'ch',
    error_chapters: 'Error getting chapters: ',
    error_404: 'Error 404: Is your Kaizen Manga server updated to v1.12+ and does the .cbz file exist?',
    error_chapter_details: 'Error getting chapter details: ',
    read: 'read',
    unread_chapters: 'unread',
    on_deck: 'On Deck',
    recently_added: 'Recently Added',
    unread: 'Unread Chapters',
    setup_required: 'Setup Required',
    setup_tap: 'Tap here to see how to configure the extension',
    settings_header: 'Kaizen Downloader Configuration',
    host_label: 'Server Host',
    token_label: 'API Token',
    status_label: 'Status',
    test_connection: 'Test Connection',
    test_success: 'Success!',
    test_error_empty_host: 'Error: Empty Host',
    test_testing: 'Testing connection...',
    test_error_http: 'HTTP Error:',
    test_error_json: 'Error: Invalid JSON',
    test_error: 'Error:',
    sync_cache: 'Sync & Clear Cache',
    cache_cleared: 'Cache cleared. Return to Library to refresh.',
    unverified: 'Unverified',
    progress_header: 'Reading Progress in Kaizen',
    progress_read: 'Read Chapters',
    progress_total: 'Total Chapters',
    progress_error: 'Could not connect to the server',
    language_label: 'Language / Idioma',
    genres: 'Genres',
    mangas: 'mangas',
  },
  es: {
    host_unconfigured: 'Host no configurado',
    setup_help_title: 'Cómo configurar Kaizen Manga',
    setup_help_desc: 'Para usar esta extensión, ve a la pestaña "Ajustes" de Paperback -> "Extensiones" -> toca "Kaizen Manga" -> introduce la dirección IP/Host de tu servidor (ej. http://192.168.1.50:3333) y tu API Token de Kaizen.',
    untitled: 'Sin título',
    unknown_author: 'Desconocido',
    no_description: 'Sin descripción.',
    ongoing: 'Ongoing',
    completed: 'Completed',
    error_manga_details: 'Error obteniendo detalles del manga: ',
    chapter: 'Capítulo',
    chapter_short: 'cap',
    error_chapters: 'Error obteniendo capítulos: ',
    error_404: 'Error 404: ¿Tu servidor Kaizen Manga está actualizado a v1.12+ y el archivo .cbz existe?',
    error_chapter_details: 'Error obteniendo detalles del capítulo: ',
    read: 'leídos',
    unread_chapters: 'sin leer',
    on_deck: 'En Curso (On Deck)',
    recently_added: 'Recientemente Añadidos',
    unread: 'Capítulos Sin Leer',
    setup_required: 'Configuración Requerida',
    setup_tap: 'Toca aquí para ver cómo configurar la extensión',
    settings_header: 'Configuración de Kaizen Downloader',
    host_label: 'Host del Servidor',
    token_label: 'API Token',
    status_label: 'Resultado',
    test_connection: 'Probar Conexión',
    test_success: '¡Éxito!',
    test_error_empty_host: 'Error: Host vacío',
    test_testing: 'Probando conexión...',
    test_error_http: 'Error HTTP:',
    test_error_json: 'Error: JSON inválido',
    test_error: 'Error:',
    sync_cache: 'Sincronizar y Limpiar Caché',
    cache_cleared: 'Caché limpiada. Vuelve a la Biblioteca para refrescar.',
    unverified: 'Sin verificar',
    progress_header: 'Progreso de Lectura en Kaizen',
    progress_read: 'Capítulos Leídos',
    progress_total: 'Capítulos Totales',
    progress_error: 'No se pudo conectar con el servidor',
    language_label: 'Language / Idioma',
    genres: 'Géneros',
    mangas: 'mangas',
  }
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
    const CACHE_TTL = 1 * 60 * 1000 // 1 minute cache TTL

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

  private async getLang(): Promise<string> {
    const lang = ((await this.stateManager.retrieve('language')) as string) ?? 'es'
    return DICTIONARIES[lang] ? lang : 'es'
  }

  private async t(key: string): Promise<string> {
    const lang = await this.getLang()
    return DICTIONARIES[lang]?.[key] ?? DICTIONARIES['en']?.[key] ?? key
  }

  private async creds(): Promise<{ host: string; token: string }> {
    const host = ((await this.stateManager.retrieve('host')) as string) ?? ''
    const token = ((await this.stateManager.retrieve('token')) as string) ?? ''
    const cleaned = cleanHost(host)
    if (!cleaned) {
      throw new Error(await this.t('host_unconfigured'))
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
          titles: [await this.t('setup_help_title')],
          image: '',
          author: 'D4nj3s (DanielJNavas)',
          desc: await this.t('setup_help_desc'),
          status: 'Completed',
        }),
      })
    }

    const numericId = parseInt(mangaId, 10)
    if (isNaN(numericId)) {
      return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
          titles: ['Kaizen: Manga not found'],
          image: '',
          author: 'Kaizen',
          desc: 'This manga is not in your Kaizen Downloader database or has a mismatched ID. Please search and add it to your Kaizen server first. / Este manga no está en tu servidor Kaizen o tiene un ID incorrecto. Búscalo e impórtalo primero.',
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
        ? [App.createTagSection({ id: 'genres', label: await this.t('genres'), tags })]
        : []

      return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
          titles: [raw.title ?? await this.t('untitled')],
          image: getCoverUrl(raw.metadata, host, token),
          author: raw.metadata?.authors?.join(', ') || await this.t('unknown_author'),
          artist: '',
          desc: raw.metadata?.summary || await this.t('no_description'),
          tags: tagSections,
          status: raw.metadata?.status === 'ONGOING' ? 'Ongoing' : 'Completed',
        }),
      })
    } catch (e: any) {
      return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
          titles: ['Kaizen: Manga not found'],
          image: '',
          author: 'Kaizen',
          desc: `Could not load manga details from Kaizen. Is it added to your server? / No se pudo cargar el manga de Kaizen. ¿Está añadido a tu servidor?\n\nError: ${e.message}`,
          status: 'Completed',
        }),
      })
    }
  }

  // ─── getChapters ──────────────────────────────────────────────────────────
  async getChapters(mangaId: string): Promise<Chapter[]> {
    if (mangaId === 'setup_help') {
      return []
    }
    const numericId = parseInt(mangaId, 10)
    if (isNaN(numericId)) {
      return []
    }
    try {
      const { host } = await this.creds()
      const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)
      const chapterLabel = await this.t('chapter')
      return (raw.chapters ?? []).map((ch: any) =>
        App.createChapter({
          id: String(ch.id),
          chapNum: (ch.index ?? 0) + 1,
          name: ch.name ?? `${chapterLabel} ${(ch.index ?? 0) + 1}`,
          langCode: '🇬🇧',
          time: (() => {
            if (!ch.createdAt) return undefined
            const d = new Date(ch.createdAt)
            return isNaN(d.getTime()) ? undefined : d
          })(),
        })
      )
    } catch (e: any) {
      return []
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
        throw new Error(await this.t('error_404'))
      }
      throw new Error(`${await this.t('error_chapter_details')}${e.message}`)
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

      const chapterShortLabel = await this.t('chapter_short')
      const untitledLabel = await this.t('untitled')

      return App.createPagedResults({
        results: results.map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? untitledLabel,
            image: getCoverUrl(m.metadata, host, token),
            subtitle: m.readingStatus
              ? `${m.readingStatus.readChapters}/${m.readingStatus.totalChapters} ${chapterShortLabel}.`
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
          label: await this.t('genres'),
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
        await this.renderSections(sectionCallback, cached, host, token)
        
        // Trigger a background refresh to keep data updated
        this.refreshMangasCacheInBackground(host).then(async (newData) => {
          if (newData && newData.length > 0) {
            await this.renderSections(sectionCallback, newData, host, token)
          }
        }).catch(() => {})
        return
      }
    } catch (_) {}

    // Fallback: No cache available (first run). Render skeleton loaders, then fetch blocking.
    const onDeckSection: HomeSection = App.createHomeSection({
      id: 'on_deck',
      title: await this.t('on_deck'),
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: [],
    })
    sectionCallback(onDeckSection)

    const recentSection: HomeSection = App.createHomeSection({
      id: 'recent',
      title: await this.t('recently_added'),
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: [],
    })
    sectionCallback(recentSection)

    const unreadSection: HomeSection = App.createHomeSection({
      id: 'unread',
      title: await this.t('unread'),
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
      await this.renderSections(sectionCallback, raw, host, token)
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
        title: await this.t('setup_required'),
        containsMoreItems: false,
        type: HomeSectionType.singleRowNormal,
        items: [],
      })
      sectionCallback(setupSection)
      setupSection.items = [
        App.createPartialSourceManga({
          mangaId: 'setup_help',
          title: await this.t('setup_tap'),
          image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>',
        })
      ]
      sectionCallback(setupSection)
    }
  }

  private async renderSections(
    sectionCallback: (section: HomeSection) => void,
    raw: any[],
    host: string,
    token: string
  ): Promise<void> {
    const untitledLabel = await this.t('untitled')
    const readLabel = await this.t('read')
    const unreadLabel = await this.t('unread_chapters')

    // On Deck (mangas started but not fully read)
    const onDeckSection: HomeSection = App.createHomeSection({
      id: 'on_deck',
      title: await this.t('on_deck'),
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: raw
        .filter((m) => m.readingStatus && m.readingStatus.readChapters > 0 && !m.readingStatus.isFullyRead)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? untitledLabel,
            image: getCoverUrl(m.metadata, host, token),
            subtitle: `${m.readingStatus.readChapters}/${m.readingStatus.totalChapters} ${readLabel}`,
          })
        ),
    })
    sectionCallback(onDeckSection)

    // Recently added
    const recentSection: HomeSection = App.createHomeSection({
      id: 'recent',
      title: await this.t('recently_added'),
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: [...raw]
        .sort((a, b) => b.id - a.id)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? untitledLabel,
            image: getCoverUrl(m.metadata, host, token),
          })
        ),
    })
    sectionCallback(recentSection)

    // Unread chapters
    const unreadSection: HomeSection = App.createHomeSection({
      id: 'unread',
      title: await this.t('unread'),
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
      items: raw
        .filter((m) => m.readingStatus && m.readingStatus.unreadChapters > 0)
        .slice(0, 20)
        .map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? untitledLabel,
            image: getCoverUrl(m.metadata, host, token),
            subtitle: `${m.readingStatus.unreadChapters} ${unreadLabel}`,
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
            title: m.title ?? untitledLabel,
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

      const untitledLabel = await this.t('untitled')

      return App.createPagedResults({
        results: results.map((m) =>
          App.createPartialSourceManga({
            mangaId: String(m.id),
            title: m.title ?? untitledLabel,
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
      header: await this.t('settings_header'),
      isHidden: false,
      rows: async () => [
        App.createDUISelect({
          id: 'language',
          label: await this.t('language_label'),
          options: ['en', 'es'],
          value: App.createDUIBinding({
            get: async () => [((await this.stateManager.retrieve('language')) as string) ?? 'es'],
            set: async (v: string[]) => {
              const val = v[0] ?? 'es'
              await this.stateManager.store('language', val)
            },
          }),
          allowsMultiselect: false,
          labelResolver: async (value: string) => value === 'en' ? 'English' : 'Español'
        }),
        App.createDUIInputField({
          id: 'host',
          label: await this.t('host_label'),
          value: App.createDUIBinding({
            get: async () =>
              ((await this.stateManager.retrieve('host')) as string) ?? '',
            set: async (v: string) => this.stateManager.store('host', v),
          }),
        }),
        App.createDUISecureInputField({
          id: 'token',
          label: await this.t('token_label'),
          value: App.createDUIBinding({
            get: async () =>
              ((await this.stateManager.retrieve('token')) as string) ?? '',
            set: async (v: string) => this.stateManager.store('token', v),
          }),
        }),
        App.createDUILabel({
          id: 'status',
          label: await this.t('status_label'),
          value: ((await this.stateManager.retrieve('status')) as string) ?? await this.t('unverified'),
        }),
        App.createDUIButton({
          id: 'test_connection',
          label: await this.t('test_connection'),
          onTap: async () => {
            const host = ((await this.stateManager.retrieve('host')) as string) ?? ''
            const token = ((await this.stateManager.retrieve('token')) as string) ?? ''
            const cleaned = cleanHost(host)
            if (!cleaned) {
              await this.stateManager.store('status', await this.t('test_error_empty_host'))
              return
            }

            await this.stateManager.store('status', await this.t('test_testing'))

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
                await this.stateManager.store('status', `${await this.t('test_error_http')} ${resp.status}`)
                return
              }
              const data = JSON.parse(resp.data ?? '[]')
              if (!Array.isArray(data)) {
                await this.stateManager.store('status', await this.t('test_error_json'))
                return
              }
              await this.stateManager.store('status', `${await this.t('test_success')} (${data.length} ${await this.t('mangas')})`)
            } catch (err: any) {
              await this.stateManager.store('status', `${await this.t('test_error')} ${err.message || String(err)}`)
            }
          }
        }),
        App.createDUIButton({
          id: 'sync_cache',
          label: await this.t('sync_cache'),
          onTap: async () => {
            this._mangasCache = undefined
            await this.stateManager.store('mangas_cache', '')
            await this.stateManager.store('mangas_cache_time', '')
            await this.stateManager.store('status', await this.t('cache_cleared'))
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
        lastReadChapterNumber = Math.max(...readChapters.map((ch: any) => (ch.index ?? 0) + 1))
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

          // Initialize the temporary progress state with the current value if not already set
          let tempVal = await this.stateManager.retrieve(`temp_progress_${mangaId}`)
          if (tempVal === undefined || tempVal === null || tempVal === '') {
            tempVal = String(reading.readChapters)
            await this.stateManager.store(`temp_progress_${mangaId}`, tempVal)
          }

          return [
            App.createDUISection({
              id: 'info',
              header: await this.t('progress_header'),
              isHidden: false,
              rows: async () => [
                App.createDUIStepper({
                  id: 'progress_stepper',
                  label: await this.t('progress_read'),
                  min: 0,
                  max: reading.totalChapters,
                  step: 1,
                  value: App.createDUIBinding({
                    get: async () => {
                      const val = await this.stateManager.retrieve(`temp_progress_${mangaId}`)
                      return val !== null && val !== undefined && val !== '' ? Number(val) : reading.readChapters
                    },
                    set: async (v: number) => {
                      await this.stateManager.store(`temp_progress_${mangaId}`, String(v))
                    },
                  }),
                }),
                App.createDUILabel({
                  id: 'total_chapters',
                  label: await this.t('progress_total'),
                  value: String(reading.totalChapters),
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
                  label: await this.t('progress_error'),
                  value: err.message || String(err),
                }),
              ],
            }),
          ]
        }
      },
      onSubmit: async () => {
        try {
          const { host } = await this.creds()
          const tempValStr = await this.stateManager.retrieve(`temp_progress_${mangaId}`)
          // Clean up the temp progress state immediately
          await this.stateManager.store(`temp_progress_${mangaId}`, '')

          if (tempValStr === null || tempValStr === undefined || tempValStr === '') {
            return
          }

          const newProgress = Number(tempValStr)

          // Fetch the manga details to get the chapters list
          const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)
          const sortedChapters = (raw.chapters ?? []).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))

          // Map chapters to their new read status
          const chaptersPayload = sortedChapters.map((ch: any, idx: number) => ({
            id: ch.id,
            isRead: idx < newProgress,
            lastReadPage: idx < newProgress ? 9999 : 0,
          }))

          if (chaptersPayload.length > 0) {
            const body = { chapters: chaptersPayload }
            await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`, 'PATCH', body)
          }

          // Clear cache on success to force re-fetch on the homepage/search
          this._mangasCache = undefined
          await this.stateManager.store('mangas_cache', '')
          await this.stateManager.store('mangas_cache_time', '')
        } catch (err) {
          // Silent catch to prevent crashes in Paperback UI
        }
      },
    })
  }

  async processChapterReadActionQueue(actionQueue: TrackerActionQueue): Promise<void> {
    try {
      const chapterReadActions = await actionQueue.queuedChapterReadActions()
      const { host } = await this.creds()

      // Group actions by the tracker's mangaId (which is our local Kaizen manga ID)
      const actionsByManga = new Map<string, typeof chapterReadActions>()

      for (const readAction of chapterReadActions) {
        const mangaId = readAction.mangaId
        if (!mangaId || mangaId === 'setup_help') {
          try {
            await actionQueue.discardChapterReadAction(readAction)
          } catch (_) {}
          continue
        }

        if (!actionsByManga.has(mangaId)) {
          actionsByManga.set(mangaId, [])
        }
        actionsByManga.get(mangaId)!.push(readAction)
      }

      for (const [mangaId, actions] of actionsByManga.entries()) {
        const numericMangaId = parseInt(mangaId, 10)
        if (isNaN(numericMangaId)) {
          for (const readAction of actions) {
            try {
              await actionQueue.discardChapterReadAction(readAction)
            } catch (_) {}
          }
          continue
        }

        let raw: any = null
        let fetchFailed = false
        let isClientError = false

        try {
          raw = await this.apiFetch(`${host}/api/v1/mangas/${numericMangaId}`)
        } catch (err: any) {
          fetchFailed = true
          const errStr = String(err)
          if (errStr.includes('HTTP 404') || errStr.includes('HTTP 400') || errStr.includes('Manga not found') || errStr.includes('Invalid ID')) {
            isClientError = true
          }
        }

        if (fetchFailed) {
          for (const readAction of actions) {
            try {
              if (isClientError) {
                await actionQueue.discardChapterReadAction(readAction)
              } else {
                await actionQueue.retryChapterReadAction(readAction)
              }
            } catch (_) {}
          }
          continue
        }

        const chaptersList = raw?.chapters ?? []
        const chaptersPayload: any[] = []
        const actionsToDiscard: typeof actions = []

        for (const readAction of actions) {
          const matched = chaptersList.find((ch: any) => 
            Math.abs(((ch.index ?? 0) + 1) - readAction.chapterNumber) < 0.01
          )

          if (matched) {
            chaptersPayload.push({
              id: matched.id,
              isRead: true,
              lastReadPage: 9999, // Force Kaizen reader progress to the end
            })
          }
          // Whether matched or not, we should mark this action to be discarded 
          // because if it is not matched, it does not exist in Kaizen, so retrying won't help.
          actionsToDiscard.push(readAction)
        }

        if (chaptersPayload.length > 0) {
          let patchSuccess = false
          let patchClientError = false
          try {
            const body = { chapters: chaptersPayload }
            await this.apiFetch(`${host}/api/v1/mangas/${numericMangaId}`, 'PATCH', body)
            patchSuccess = true
          } catch (err: any) {
            const errStr = String(err)
            if (errStr.includes('HTTP 404') || errStr.includes('HTTP 400') || errStr.includes('Manga not found')) {
              patchClientError = true
            }
          }

          if (patchSuccess) {
            for (const readAction of actionsToDiscard) {
              try {
                await actionQueue.discardChapterReadAction(readAction)
              } catch (_) {}
            }
            // Clear cache on success to force re-fetch
            this._mangasCache = undefined
            try {
              await this.stateManager.store('mangas_cache', '')
              await this.stateManager.store('mangas_cache_time', '')
            } catch (_) {}
          } else {
            for (const readAction of actions) {
              try {
                if (patchClientError) {
                  await actionQueue.discardChapterReadAction(readAction)
                } else {
                  await actionQueue.retryChapterReadAction(readAction)
                }
              } catch (_) {}
            }
          }
        } else {
          // If no chapters matched, discard the actions anyway to not block the queue
          for (const readAction of actionsToDiscard) {
            try {
              await actionQueue.discardChapterReadAction(readAction)
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      // If credentials or root call fails, ignore to prevent crashes
    }
  }
}
