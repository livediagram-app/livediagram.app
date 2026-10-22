// The Drive mirror's view of Google Drive (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "DriveClient"): the few calls the sync engine makes, behind an interface so
// the engine is tested against the fake Google and never against a real one.

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  trashed: boolean;
  appProperties: Record<string, string>;
  md5Checksum: string | null;
  headRevisionId: string | null;
  ownedByMe: boolean;
};

export type DriveChange = {
  fileId: string;
  removed: boolean;
  time: string;
  file: DriveFile | null;
};

export type DriveChangePage = {
  changes: DriveChange[];
  nextPageToken?: string;
  newStartPageToken?: string;
};

export type DriveFileWrite = {
  content: string;
  // URL-safe base64 PNG for contentHints.thumbnail, or null for none.
  thumbnailPng: string | null;
  appProperties?: Record<string, string>;
};

export type DriveFileUpdate = Partial<DriveFileWrite> & {
  name?: string;
  addParent?: string;
  removeParent?: string;
  trashed?: boolean;
};

export interface DriveClient {
  getStartPageToken(): Promise<string>;
  listChanges(pageToken: string): Promise<DriveChangePage>;
  // Every page of a files.list query.
  listFiles(q: string): Promise<DriveFile[]>;
  getFile(id: string, resourceKey?: string): Promise<DriveFile>;
  download(id: string, resourceKey?: string): Promise<string>;
  createFolder(input: {
    name: string;
    parentId: string;
    appProperties: Record<string, string>;
  }): Promise<DriveFile>;
  createFile(
    input: DriveFileWrite & { name: string; parentId: string; mimeType: string },
  ): Promise<DriveFile>;
  updateFile(id: string, input: DriveFileUpdate): Promise<DriveFile>;
  deleteFile(id: string): Promise<void>;
}

const RATE_LIMIT_REASONS = new Set(['userRateLimitExceeded', 'rateLimitExceeded']);

// A non-2xx answer from Google, with its `reason` when the body names one.
export class DriveApiError extends Error {
  readonly status: number;
  readonly reason: string | null;

  constructor(status: number, reason: string | null, message: string) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
    this.reason = reason;
  }

  get isRateLimit(): boolean {
    return (
      this.status === 429 || (this.status === 403 && RATE_LIMIT_REASONS.has(this.reason ?? ''))
    );
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
}
