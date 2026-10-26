// The service's view of Google Drive (liveworkspace/docs/specs/005-drive/drive.md "The service"): the calls a pass makes, over
// Drive's REST API v3, with an access token the caller supplies. Every call names its `fields`, since Drive's default
// subset omits parents, md5Checksum and appProperties.

import {
  DRIVE_CHANGES_PAGE_SIZE,
  DRIVE_FOLDER_MIME,
  DRIVE_MULTIPART_MAX_BYTES,
} from '../constants';
import { googleApiBase, timedFetch, type GoogleConfig } from './google';

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
  // Required with `content`: the upload's type.
  mimeType?: string;
};

export type DriveChannel = { id: string; resourceId: string; expiration: number };

export interface DriveClient {
  getStartPageToken(): Promise<string>;
  listChanges(pageToken: string): Promise<DriveChangePage>;
  // Every page of a files.list query.
  listFiles(q: string): Promise<DriveFile[]>;
  getFile(id: string, resourceKey?: string): Promise<DriveFile>;
  // The file's content as text. With `maxBytes`, a larger file is refused (DriveFileTooLarge) without reading
  // past the cap.
  download(id: string, resourceKey?: string, maxBytes?: number): Promise<string>;
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
  watchChanges(input: {
    pageToken: string;
    channelId: string;
    address: string;
    token: string;
    expiration: number;
  }): Promise<DriveChannel>;
  stopChannel(channel: { id: string; resourceId: string }): Promise<void>;
}

const RATE_LIMIT_REASONS = new Set(['userRateLimitExceeded', 'rateLimitExceeded']);

/** A non-2xx answer from Google, with its `reason` when the body names one. */
/** A download refused for being larger than the caller's cap. */
export class DriveFileTooLarge extends Error {
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    super(`Drive file is larger than ${maxBytes} bytes`);
    this.name = 'DriveFileTooLarge';
    this.maxBytes = maxBytes;
  }
}

// A response's body as text, refused once it passes `maxBytes`: a declared Content-Length over it before reading, or
// the bytes as they arrive (a body sent in chunks declares none), cancelling the rest.
async function textWithin(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get('Content-Length') ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new DriveFileTooLarge(maxBytes);
  }
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new DriveFileTooLarge(maxBytes);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

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

const FILE_FIELDS =
  'id,name,mimeType,parents,trashed,appProperties,md5Checksum,headRevisionId,ownedByMe';
const CHANGE_FIELDS = `nextPageToken,newStartPageToken,changes(fileId,removed,time,file(${FILE_FIELDS}))`;
const LIST_PAGE_SIZE = 1000;

type TokenGetter = (opts?: { force?: boolean }) => Promise<string>;

type RawFile = Partial<Omit<DriveFile, 'md5Checksum' | 'headRevisionId'>> & {
  md5Checksum?: string;
  headRevisionId?: string;
};

function toFile(raw: RawFile): DriveFile {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    mimeType: raw.mimeType ?? '',
    parents: raw.parents ?? [],
    trashed: raw.trashed ?? false,
    appProperties: raw.appProperties ?? {},
    md5Checksum: raw.md5Checksum ?? null,
    headRevisionId: raw.headRevisionId ?? null,
    ownedByMe: raw.ownedByMe ?? false,
  };
}

async function errorOf(res: Response): Promise<DriveApiError> {
  let reason: string | null = null;
  let message = `${res.status}`;
  try {
    const body = (await res.json()) as {
      error?: { message?: string; errors?: { reason?: string }[] } | string;
    };
    if (typeof body.error === 'object') {
      reason = body.error.errors?.[0]?.reason ?? null;
      message = body.error.message ?? message;
    } else if (typeof body.error === 'string') {
      reason = body.error;
    }
  } catch {
    // A body that isn't JSON keeps the status as the message.
  }
  return new DriveApiError(
    res.status,
    reason,
    `drive ${res.status} ${reason ?? ''} ${message}`.trim(),
  );
}

const thumbnailHints = (png: string | null | undefined) =>
  png ? { contentHints: { thumbnail: { image: png, mimeType: 'image/png' } } } : {};

function randomBoundary(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `lw${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function createDriveClient(
  config: Pick<GoogleConfig, 'baseUrl' | 'fetch'>,
  getAccessToken: TokenGetter,
): DriveClient {
  const API = googleApiBase(config);
  const send = timedFetch(config);

  // One retry with a fresh token on 401: an access token can lapse between the check and the call.
  async function call(
    url: string,
    init: RequestInit = {},
    resourceKey?: string,
  ): Promise<Response> {
    const attempt = async (force: boolean) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${await getAccessToken({ force })}`);
      if (resourceKey) headers.set('X-Goog-Drive-Resource-Keys', resourceKey);
      return send(url, { ...init, headers });
    };
    let res = await attempt(false);
    if (res.status === 401) res = await attempt(true);
    if (!res.ok) throw await errorOf(res);
    return res;
  }

  const json = async <T>(url: string, init?: RequestInit, resourceKey?: string): Promise<T> =>
    (await (await call(url, init, resourceKey)).json()) as T;

  const fileUrl = (id: string, query = '') =>
    `${API}/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(FILE_FIELDS)}${query}`;

  async function upload(
    method: 'POST' | 'PATCH',
    id: string | null,
    metadata: Record<string, unknown>,
    content: string,
    mimeType: string,
    query = '',
  ): Promise<DriveFile> {
    const base = `${API}/upload/drive/v3/files${id ? `/${encodeURIComponent(id)}` : ''}`;
    const fields = `fields=${encodeURIComponent(FILE_FIELDS)}${query}`;
    if (new TextEncoder().encode(content).length <= DRIVE_MULTIPART_MAX_BYTES) {
      const boundary = randomBoundary();
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
      return toFile(
        await json<RawFile>(`${base}?uploadType=multipart&${fields}`, {
          method,
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        }),
      );
    }
    // Over the multipart ceiling: a resumable session, then one PUT.
    const session = await call(`${base}?uploadType=resumable&${fields}`, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
      },
      body: JSON.stringify(metadata),
    });
    const location = session.headers.get('Location');
    if (!location) throw new DriveApiError(0, 'noUploadLocation', 'resumable upload: no Location');
    return toFile(
      await json<RawFile>(location, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: content,
      }),
    );
  }

  return {
    async getStartPageToken() {
      return (await json<{ startPageToken: string }>(`${API}/drive/v3/changes/startPageToken`))
        .startPageToken;
    },

    async listChanges(pageToken) {
      const body = await json<{
        changes?: { fileId: string; removed?: boolean; time: string; file?: RawFile }[];
        nextPageToken?: string;
        newStartPageToken?: string;
      }>(
        `${API}/drive/v3/changes?pageToken=${encodeURIComponent(pageToken)}&pageSize=${DRIVE_CHANGES_PAGE_SIZE}` +
          `&fields=${encodeURIComponent(CHANGE_FIELDS)}`,
      );
      const page: DriveChangePage = {
        changes: (body.changes ?? []).map((c) => ({
          fileId: c.fileId,
          removed: c.removed ?? false,
          time: c.time,
          file: c.file ? toFile(c.file) : null,
        })),
      };
      if (body.nextPageToken) page.nextPageToken = body.nextPageToken;
      if (body.newStartPageToken) page.newStartPageToken = body.newStartPageToken;
      return page;
    },

    async listFiles(q) {
      const out: DriveFile[] = [];
      let pageToken: string | undefined;
      do {
        const body = await json<{ files?: RawFile[]; nextPageToken?: string }>(
          `${API}/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${LIST_PAGE_SIZE}` +
            `&fields=${encodeURIComponent(`nextPageToken,files(${FILE_FIELDS})`)}` +
            (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
        );
        out.push(...(body.files ?? []).map(toFile));
        pageToken = body.nextPageToken;
      } while (pageToken);
      return out;
    },

    async getFile(id, resourceKey) {
      return toFile(
        await json<RawFile>(fileUrl(id), {}, resourceKey ? `${id}/${resourceKey}` : undefined),
      );
    },

    async download(id, resourceKey, maxBytes) {
      const res = await call(
        `${API}/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
        {},
        resourceKey ? `${id}/${resourceKey}` : undefined,
      );
      return maxBytes === undefined ? res.text() : textWithin(res, maxBytes);
    },

    async createFolder(input) {
      return toFile(
        await json<RawFile>(`${API}/drive/v3/files?fields=${encodeURIComponent(FILE_FIELDS)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: input.name,
            mimeType: DRIVE_FOLDER_MIME,
            parents: [input.parentId],
            appProperties: input.appProperties,
          }),
        }),
      );
    },

    async createFile(input) {
      return upload(
        'POST',
        null,
        {
          name: input.name,
          mimeType: input.mimeType,
          parents: [input.parentId],
          appProperties: input.appProperties ?? {},
          ...thumbnailHints(input.thumbnailPng),
        },
        input.content,
        input.mimeType,
      );
    },

    async updateFile(id, input) {
      const metadata: Record<string, unknown> = {};
      if (input.name !== undefined) metadata.name = input.name;
      if (input.trashed !== undefined) metadata.trashed = input.trashed;
      if (input.appProperties) metadata.appProperties = input.appProperties;
      let query = '';
      if (input.addParent) query += `&addParents=${encodeURIComponent(input.addParent)}`;
      if (input.removeParent) query += `&removeParents=${encodeURIComponent(input.removeParent)}`;
      if (input.content !== undefined) {
        if (!input.mimeType) throw new Error('updateFile: content needs its mimeType');
        return upload(
          'PATCH',
          id,
          { ...metadata, ...thumbnailHints(input.thumbnailPng) },
          input.content,
          input.mimeType,
          query,
        );
      }
      return toFile(
        await json<RawFile>(fileUrl(id, query), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata),
        }),
      );
    },

    async deleteFile(id) {
      await call(`${API}/drive/v3/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async watchChanges(input) {
      const body = await json<{ id: string; resourceId: string; expiration?: string }>(
        `${API}/drive/v3/changes/watch?pageToken=${encodeURIComponent(input.pageToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: input.channelId,
            type: 'web_hook',
            address: input.address,
            token: input.token,
            expiration: input.expiration,
          }),
        },
      );
      return {
        id: body.id,
        resourceId: body.resourceId,
        expiration: Number(body.expiration ?? input.expiration),
      };
    },

    async stopChannel(channel) {
      await call(`${API}/drive/v3/channels/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: channel.id, resourceId: channel.resourceId }),
      });
    },
  };
}
