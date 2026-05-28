import { KaizenManga, KaizenChapterPagesResponse } from './types';

export type Fetcher = (url: string, options: {
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<{
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
}>;

export class KaizenClient {
  private fetcher: Fetcher;

  constructor(customFetcher?: Fetcher) {
    // Fallback to standard global fetch if no custom fetcher is provided
    if (customFetcher) {
      this.fetcher = customFetcher;
    } else {
      this.fetcher = async (url, options) => {
        const response = await fetch(url, {
          method: options.method,
          headers: options.headers,
          body: options.body,
        });
        return {
          status: response.status,
          json: () => response.json(),
          text: () => response.text(),
        };
      };
    }
  }

  private cleanHost(host: string): string {
    let clean = host.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    // Remove trailing slash
    return clean.replace(/\/+$/, '');
  }

  private getHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Validates the connection with the Kaizen server
   */
  async testConnection(host: string, token: string): Promise<boolean> {
    try {
      const url = `${this.cleanHost(host)}/api/v1/info`;
      const response = await this.fetcher(url, {
        method: 'GET',
        headers: this.getHeaders(token),
      });

      if (response.status === 200) {
        // Also verify auth by hitting /mangas
        const authUrl = `${this.cleanHost(host)}/api/v1/mangas`;
        const authResponse = await this.fetcher(authUrl, {
          method: 'GET',
          headers: this.getHeaders(token),
        });
        return authResponse.status === 200;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetches all manga in the user's library with optional filter querying
   */
  async getMangas(host: string, token: string, search?: string): Promise<KaizenManga[]> {
    const baseUrl = `${this.cleanHost(host)}/api/v1/mangas`;
    const response = await this.fetcher(baseUrl, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch mangas: Status ${response.status}`);
    }

    let mangas: KaizenManga[] = await response.json();

    // Perform client-side fuzzy name filtering if query is supplied
    if (search && search.trim() !== '') {
      const query = search.toLowerCase().trim();
      mangas = mangas.filter(
        (manga) =>
          manga.title.toLowerCase().includes(query) ||
          (manga.author && manga.author.toLowerCase().includes(query)) ||
          (manga.genres && manga.genres.some((genre) => genre.toLowerCase().includes(query)))
      );
    }

    return mangas;
  }

  /**
   * Fetches detailed information of a manga, including all its chapters
   */
  async getMangaDetails(host: string, token: string, id: number): Promise<KaizenManga> {
    const url = `${this.cleanHost(host)}/api/v1/mangas/${id}`;
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch manga details for ID ${id}: Status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetches the page list inside a chapter (from .cbz archive)
   */
  async getChapterPages(
    host: string,
    token: string,
    mangaId: number,
    chapterId: number
  ): Promise<KaizenChapterPagesResponse> {
    const url = `${this.cleanHost(host)}/api/v1/mangas/${mangaId}/chapters/${chapterId}/pages`;
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch chapter pages: Status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Sends a read status PATCH update to Kaizen to mark specific chapter as read/unread
   */
  async updateChapterReadStatus(
    host: string,
    token: string,
    mangaId: number,
    chapterId: number,
    isRead: boolean,
    lastReadPage?: number
  ): Promise<boolean> {
    const url = `${this.cleanHost(host)}/api/v1/mangas/${mangaId}`;
    const payload: any = {
      id: chapterId,
      isRead: isRead,
    };
    if (lastReadPage !== undefined) {
      payload.lastReadPage = lastReadPage;
    }

    const response = await this.fetcher(url, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        chapters: [payload],
      }),
    });

    return response.status === 200;
  }
}
export default KaizenClient;
