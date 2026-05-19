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
  version: '1.0.1',
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
    SourceIntents.SETTINGS_UI,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cleanHost(raw: string): string {
  let h = (raw ?? '').trim().replace(/\/+$/, '')
  if (!h.startsWith('http://') && !h.startsWith('https://')) h = 'http://' + h
  return h
}

// ─── Source Class ─────────────────────────────────────────────────────────────
export class KaizenManga extends Source {
  readonly requestManager: RequestManager
  private _stateManager?: SourceStateManager

  constructor(cheerio: CheerioAPI) {
    super(cheerio)
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 5,
      requestTimeout: 20000,
    })
  }

  private get stateManager(): SourceStateManager {
    if (!this._stateManager) {
      this._stateManager = App.createSourceStateManager()
    }
    return this._stateManager
  }

  private async creds(): Promise<{ host: string; token: string }> {
    const host  = ((await this.stateManager.retrieve('host')) as string) ?? ''
    const token = ((await this.stateManager.retrieve('token')) as string) ?? ''
    return { host: cleanHost(host), token: token.trim() }
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
    const { host } = await this.creds()
    const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)

    const tags: Tag[] = (raw.genres ?? []).map((g: string) =>
      App.createTag({ id: g, label: g })
    )
    const tagSections: TagSection[] = tags.length
      ? [App.createTagSection({ id: 'genres', label: 'Géneros', tags })]
      : []

    return App.createSourceManga({
      id: mangaId,
      mangaInfo: App.createMangaInfo({
        titles: [raw.title ?? 'Sin título'],
        image: raw.coverUrl ?? '',
        author: raw.author ?? raw.artist ?? 'Desconocido',
        artist: raw.artist ?? '',
        desc: raw.description ?? 'Sin descripción.',
        tags: tagSections,
        status: 'Ongoing',
      }),
    })
  }

  // ─── getChapters ──────────────────────────────────────────────────────────
  async getChapters(mangaId: string): Promise<Chapter[]> {
    const { host } = await this.creds()
    const raw = await this.apiFetch(`${host}/api/v1/mangas/${mangaId}`)
    return (raw.chapters ?? []).map((ch: any) =>
      App.createChapter({
        id: String(ch.id),
        mangaId,
        chapNum: ch.index ?? 0,
        name: ch.name ?? `Capítulo ${ch.index}`,
        langCode: '🇪🇸',
        time: ch.createdAt ? new Date(ch.createdAt) : undefined,
      })
    )
  }

  // ─── getChapterDetails ────────────────────────────────────────────────────
  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const { host, token } = await this.creds()
    const raw = await this.apiFetch(
      `${host}/api/v1/mangas/${mangaId}/chapters/${chapterId}/pages`
    )
    const pages: string[] = (raw.pages ?? []).map(
      (p: any) => `${host}${p.url}?token=${encodeURIComponent(token)}`
    )
    return App.createChapterDetails({ id: chapterId, mangaId, pages, longStrip: false })
  }

  // ─── getSearchResults ─────────────────────────────────────────────────────
  async getSearchResults(query: SearchRequest, _metadata: any): Promise<PagedResults> {
    const { host } = await this.creds()
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
          image: m.coverUrl ?? '',
          subtitle: m.readingStatus
            ? `${m.readingStatus.readChapters}/${m.readingStatus.totalChapters} cap.`
            : undefined,
        })
      ),
    })
  }

  // ─── getHomePageSections ──────────────────────────────────────────────────
  async getHomePageSections(
    sectionCallback: (section: HomeSection) => void
  ): Promise<void> {
    const { host } = await this.creds()
    const raw: any[] = await this.apiFetch(`${host}/api/v1/mangas`)

    // Recently added
    const recentSection: HomeSection = App.createHomeSection({
      id: 'recent',
      title: 'Recientemente Añadidos',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
    })
    sectionCallback(recentSection)
    recentSection.items = [...raw]
      .sort((a, b) => b.id - a.id)
      .slice(0, 20)
      .map((m) =>
        App.createPartialSourceManga({
          mangaId: String(m.id),
          title: m.title ?? 'Sin título',
          image: m.coverUrl ?? '',
        })
      )
    sectionCallback(recentSection)

    // Unread chapters
    const unreadSection: HomeSection = App.createHomeSection({
      id: 'unread',
      title: 'Capítulos Sin Leer',
      containsMoreItems: true,
      type: HomeSectionType.singleRowNormal,
    })
    sectionCallback(unreadSection)
    unreadSection.items = raw
      .filter((m) => m.readingStatus && m.readingStatus.unreadChapters > 0)
      .slice(0, 20)
      .map((m) =>
        App.createPartialSourceManga({
          mangaId: String(m.id),
          title: m.title ?? 'Sin título',
          image: m.coverUrl ?? '',
          subtitle: `${m.readingStatus.unreadChapters} sin leer`,
        })
      )
    sectionCallback(unreadSection)
  }

  async getViewMoreItems(
    homepageSectionId: string,
    _metadata: any
  ): Promise<PagedResults> {
    const { host } = await this.creds()
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
          image: m.coverUrl ?? '',
        })
      ),
    })
  }

  // ─── Settings UI ──────────────────────────────────────────────────────────
  async getSourceMenu() {
    return App.createDUISection({
      id: 'settings',
      header: 'Configuración de Kaizen Downloader',
      footer:
        'Introduce la URL de tu instancia de Kaizen y tu API Token para conectarte.',
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
    })
  }
}
