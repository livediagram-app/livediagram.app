// DriveClient over Google's Drive REST API v3, straight from the browser
// (CORS verified, research A7 / E-1). Every call names its `fields`, since
// Drive's default subset omits parents, md5Checksum and appProperties.

import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { DRIVE_CHANGES_PAGE_SIZE, DRIVE_MULTIPART_MAX_BYTES } from './cadence';
import {
  DriveApiError,
  type DriveChangePage,
  type DriveClient,
  type DriveFile,
  type DriveFileUpdate,
  type DriveFileWrite,
} from './drive-client';

const API = 'https://www.googleapis.com';
export const DRIVE_FILE_FIELDS =
  'id,name,mimeType,parents,trashed,appProperties,md5Checksum,headRevisionId,ownedByMe';
export const DRIVE_CHANGE_FIELDS = `nextPageToken,newStartPageToken,changes(fileId,removed,time,file(${DRIVE_FILE_FIELDS}))`;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const LIST_PAGE_SIZE = 1000;

export type TokenGetter = (opts?: { force?: boolean }) => Promise<string>;

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
    // A body that is not JSON keeps the status as the message.
  }
  return new DriveApiError(
    res.status,
    reason,
    `drive ${res.status} ${reason ?? ''} ${message}`.trim(),
  );
}

function thumbnailHints(png: string | null | undefined) {
  return png ? { contentHints: { thumbnail: { image: png, mimeType: 'image/png' } } } : {};
}

function randomBoundary(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `ld${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function createDriveRestClient(deps: {
  fetch: typeof fetch;
  getAccessToken: TokenGetter;
}): DriveClient {
  // One retry with a fresh token on 401: an access token can lapse between
  // the engine's check and the call.
  async function call(
    url: string,
    init: RequestInit = {},
    resourceKey?: string,
  ): Promise<Response> {
    const send = async (force: boolean) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${await deps.getAccessToken({ force })}`);
      if (resourceKey) headers.set('X-Goog-Drive-Resource-Keys', resourceKey);
      return deps.fetch(url, { ...init, headers });
    };
    let res = await send(false);
    if (res.status === 401) res = await send(true);
    if (!res.ok) throw await errorOf(res);
    return res;
  }

  async function json<T>(url: string, init?: RequestInit, resourceKey?: string): Promise<T> {
    return (await (await call(url, init, resourceKey)).json()) as T;
  }

  const fileUrl = (id: string, query = '') =>
    `${API}/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(DRIVE_FILE_FIELDS)}${query}`;

  async function upload(
    method: 'POST' | 'PATCH',
    id: string | null,
    metadata: Record<string, unknown>,
    content: string,
    query = '',
  ): Promise<DriveFile> {
    const base = `${API}/upload/drive/v3/files${id ? `/${encodeURIComponent(id)}` : ''}`;
    const fields = `fields=${encodeURIComponent(DRIVE_FILE_FIELDS)}${query}`;
    if (new TextEncoder().encode(content).length <= DRIVE_MULTIPART_MAX_BYTES) {
      const boundary = randomBoundary();
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: ${DRIVE_FILE_MIME}\r\n\r\n${content}\r\n--${boundary}--`;
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
        'X-Upload-Content-Type': DRIVE_FILE_MIME,
      },
      body: JSON.stringify(metadata),
    });
    const location = session.headers.get('Location');
    if (!location) throw new DriveApiError(0, 'noUploadLocation', 'resumable upload: no Location');
    return toFile(
      await json<RawFile>(location, {
        method: 'PUT',
        headers: { 'Content-Type': DRIVE_FILE_MIME },
        body: content,
      }),
    );
  }

  return {
    async getStartPageToken() {
      const body = await json<{ startPageToken: string }>(`${API}/drive/v3/changes/startPageToken`);
      return body.startPageToken;
    },

    async listChanges(pageToken) {
      const body = await json<{
        changes?: { fileId: string; removed?: boolean; time: string; file?: RawFile }[];
        nextPageToken?: string;
        newStartPageToken?: string;
      }>(
        `${API}/drive/v3/changes?pageToken=${encodeURIComponent(pageToken)}&pageSize=${DRIVE_CHANGES_PAGE_SIZE}` +
          `&fields=${encodeURIComponent(DRIVE_CHANGE_FIELDS)}`,
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
            `&fields=${encodeURIComponent(`nextPageToken,files(${DRIVE_FILE_FIELDS})`)}` +
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

    async download(id, resourceKey) {
      const res = await call(
        `${API}/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
        {},
        resourceKey ? `${id}/${resourceKey}` : undefined,
      );
      return res.text();
    },

    async createFolder(input) {
      return toFile(
        await json<RawFile>(
          `${API}/drive/v3/files?fields=${encodeURIComponent(DRIVE_FILE_FIELDS)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: input.name,
              mimeType: FOLDER_MIME,
              parents: [input.parentId],
              appProperties: input.appProperties,
            }),
          },
        ),
      );
    },

    async createFile(input: DriveFileWrite & { name: string; parentId: string; mimeType: string }) {
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
      );
    },

    async updateFile(id, input: DriveFileUpdate) {
      const metadata: Record<string, unknown> = {};
      if (input.name !== undefined) metadata.name = input.name;
      if (input.trashed !== undefined) metadata.trashed = input.trashed;
      if (input.appProperties) metadata.appProperties = input.appProperties;
      let query = '';
      if (input.addParent) query += `&addParents=${encodeURIComponent(input.addParent)}`;
      if (input.removeParent) query += `&removeParents=${encodeURIComponent(input.removeParent)}`;
      if (input.content !== undefined) {
        return upload(
          'PATCH',
          id,
          { ...metadata, ...thumbnailHints(input.thumbnailPng) },
          input.content,
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
  };
}
