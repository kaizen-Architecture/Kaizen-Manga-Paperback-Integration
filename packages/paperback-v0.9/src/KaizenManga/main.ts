export class KaizenManga {
  async getMangaDetails(_id: string) {
    throw new Error('Kaizen Manga v0.9 connector not yet implemented. Please use the v0.8 repository.')
  }
  async getChapters(_id: string) { return [] }
  async getChapterDetails(_mangaId: string, _chapterId: string) { return { pages: [] } }
  async getSearchResults(_query: any, _meta: any) { return { results: [] } }
}
