export interface KaizenReadingStatus {
  totalChapters: number;
  readChapters: number;
  unreadChapters: number;
  percentageComplete: number;
  isFullyRead: boolean;
}

export interface KaizenManga {
  id: number;
  title: string;
  author?: string;
  artist?: string;
  description?: string;
  coverUrl?: string;
  genres: string[];
  status?: string;
  readingStatus?: KaizenReadingStatus;
  chapters?: KaizenChapter[];
}

export interface KaizenChapter {
  id: number;
  mangaId: number;
  index: number;
  fileName: string;
  name?: string;
  size: number;
  isRead: boolean;
  createdAt: string;
}

export interface KaizenPage {
  index: number;
  name: string;
  url: string; // The URL to retrieve the page binary image
}

export interface KaizenChapterPagesResponse {
  chapterId: number;
  totalPages: number;
  pages: KaizenPage[];
}
