import {
  ContentRating,
  SourceIntents,
} from '@paperback/types'

// ─── SDK v6 / Paperback v0.9 — Work in Progress ───────────────────────────────
// The Paperback v0.9 SDK (1.0.0-alpha.87) has a completely redesigned API with
// DiscoverSection, Form, and Section primitives replacing the v0.8 patterns.
// This stub holds the SourceInfo metadata so the bundle compiles cleanly.
// Full implementation will be added once Paperback v0.9 reaches a stable iOS release.

// SourceInfo type in SDK v6 is inferred at runtime; provide a plain object.
export const KaizenMangaInfo = {
  version: '1.0.0',
  name: 'Kaizen Manga (v0.9 WIP)',
  icon: 'icon.png',
  author: 'Kaizen Architecture',
  authorWebsite: 'https://github.com/kaizen-Architecture',
  description:
    'Conector WIP para Paperback v0.9. Usa el paquete v0.8 para tu instalación actual.',
  contentRating: ContentRating.EVERYONE,
  websiteBaseURL: 'http://localhost:3333',
  intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.SETTINGS_UI,
}

// In SDK v6, sources extend a different base provided by the runtime.
// We export a minimal stub class so the toolchain can detect the source.
declare const App: any

export class KaizenManga {
  static readonly info = KaizenMangaInfo

  // Paperback v0.9 calls these methods; they will throw a clear message.
  async getMangaDetails(_id: string) {
    throw new Error('Kaizen Manga v0.9 connector not yet implemented. Please use the v0.8 repository.')
  }
  async getChapters(_id: string) { return [] }
  async getChapterDetails(_mangaId: string, _chapterId: string) { return { pages: [] } }
  async getSearchResults(_query: any, _meta: any) { return { results: [] } }
}
