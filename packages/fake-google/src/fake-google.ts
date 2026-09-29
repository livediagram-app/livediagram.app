// FakeGoogle: an in-memory stand-in for the Google endpoints the Drive mirror
// talks to (docs/specs/022-drive-mirror/blueprints/drive-mirror.md), so every
// test proves the mirror without real Google credentials.
//
//   - OAuth: POST /token (authorization_code, refresh_token) and POST /revoke.
//   - Drive v3: changes (startPageToken, list), files (list, get, alt=media,
//     create, update, delete), uploads (multipart, resumable).
//   - `fields` is honoured; `q` supports what the mirror sends.
//   - `user*` methods act as the person in Drive's own UI.
//   - `fail` injects errors; `requests` records every call.

import { DriveStore, FOLDER_MIME, type FakeFile, type StoreOptions } from './drive-store';
import { parseFields, pickFields } from './fields';
import { parseMultipartRelated } from './multipart';
import { compileQuery } from './query';
import { validateThumbnail } from './thumbnail';

const ACCESS_TOKEN_TTL_S = 3600;
const DEFAULT_FILE_FIELDS = 'kind,id,name,mimeType';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;

type Grant = { user: string; refreshToken: string; revoked: boolean };
type AccessToken = { user: string; grant: Grant; expiresAt: number };

export type Failure = {
  status: number;
  reason?: string;
  match?: (req: { method: string; path: string }) => boolean;
  times?: number;
};

export type FakeGoogleOptions = Partial<StoreOptions> & {
  now?: () => number;
  // Answer every code exchange without a refresh token, as Google does after
  // the first consent without prompt=consent.
  omitRefreshToken?: boolean;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization,content-type,x-upload-content-type,x-goog-drive-resource-keys',
  'Access-Control-Expose-Headers': 'Location',
};

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...headers },
  });
}

function driveError(status: number, reason: string, message = reason): Response {
  return jsonResponse(status, {
    error: { code: status, message, errors: [{ domain: 'global', reason, message }] },
  });
}

export class FakeGoogle {
  readonly store: DriveStore;
  readonly requests: { method: string; path: string }[] = [];
  private readonly grants: Grant[] = [];
  private readonly accessTokens = new Map<string, AccessToken>();
  private readonly codes = new Map<string, string>();
  private readonly failures: Failure[] = [];
  private readonly uploads = new Map<
    string,
    {
      user: string;
      fileId: string | null;
      metadata: Record<string, unknown>;
      query: URLSearchParams;
    }
  >();
  private counter = 0;
  private readonly now: () => number;
  omitRefreshToken: boolean;

  constructor(options: FakeGoogleOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.omitRefreshToken = options.omitRefreshToken ?? false;
    this.store = new DriveStore(this.now, {
      emitDescendantChanges: options.emitDescendantChanges ?? true,
    });
  }

  // ---- identity -----------------------------------------------------------

  // The user consents at Google's screen; the returned code is what Google
  // appends to the redirect URI.
  consent(user: string): string {
    const code = `code-${++this.counter}`;
    this.codes.set(code, user);
    return code;
  }

  // An access token for `user`, as the token model (browser-only mode) or a
  // test's arrange step would hold.
  issueAccessToken(user: string): string {
    const grant = this.grantFor(user);
    return this.mintAccess(grant);
  }

  // The user removes livediagram at myaccount.google.com: every token dies.
  revokeGrant(user: string): void {
    for (const g of this.grants) if (g.user === user) g.revoked = true;
  }

  // Let access tokens run out (the next call answers 401).
  expireAccessTokens(): void {
    for (const t of this.accessTokens.values()) t.expiresAt = 0;
  }

  private grantFor(user: string): Grant {
    const live = this.grants.find((g) => g.user === user && !g.revoked);
    if (live) return live;
    const grant = { user, refreshToken: `1//refresh-${++this.counter}`, revoked: false };
    this.grants.push(grant);
    return grant;
  }

  private mintAccess(grant: Grant): string {
    const token = `ya29.access-${++this.counter}`;
    this.accessTokens.set(token, {
      user: grant.user,
      grant,
      expiresAt: this.now() + ACCESS_TOKEN_TTL_S * 1000,
    });
    return token;
  }

  // ---- the person in Drive's UI --------------------------------------------

  private file(id: string): FakeFile {
    const f = this.store.files.get(id);
    if (!f) throw new Error(`fake-google: no file ${id}`);
    return f;
  }

  get(id: string): FakeFile | undefined {
    return this.store.files.get(id);
  }

  userRename(id: string, name: string): void {
    this.store.rename(this.file(id), name);
  }

  userMove(id: string, toParent: string): void {
    const f = this.file(id);
    this.store.move(f, [toParent], f.parents, f.owner);
  }

  userTrash(id: string): void {
    this.store.setTrashed(this.file(id), true);
  }

  userRestore(id: string): void {
    this.store.setTrashed(this.file(id), false);
  }

  userDeleteForever(id: string): void {
    this.store.remove(this.file(id));
  }

  userEmptyTrash(user: string): void {
    this.store.emptyTrash(user);
  }

  userEditContent(id: string, content: string): void {
    this.store.writeContent(this.file(id), content);
  }

  // Drive's "Make a copy" in its own UI. Modelled as what real Drive most
  // likely does (unverified, docs/specs/022-drive-mirror/drive-mirror.md,
  // "Copies made in Drive"): a new file id, "Copy of <name>" in the same
  // folder, the same contents, the appProperties kept, and the app still able
  // to see it. `keepAppProperties` / `visibleToApp` switch off the other branch.
  userCopy(
    id: string,
    options: { keepAppProperties?: boolean; visibleToApp?: boolean; content?: string } = {},
  ): string {
    const source = this.file(id);
    const copy = this.store.create({
      user: source.owner,
      name: `Copy of ${source.name}`,
      mimeType: source.mimeType,
      parents: [...source.parents],
      appProperties: options.keepAppProperties === false ? {} : { ...source.appProperties },
      content: options.content ?? source.content,
      viaApp: options.visibleToApp !== false,
    });
    return copy.id;
  }

  // A folder made in Drive's UI: livediagram cannot see it under drive.file.
  userCreateFolder(user: string, name: string, parent = 'root'): string {
    return this.store.create({
      user,
      name,
      mimeType: FOLDER_MIME,
      parents: [parent],
      viaApp: false,
    }).id;
  }

  // A file someone else owns (made by their livediagram), shared with `user`.
  otherUserFile(input: {
    owner: string;
    name: string;
    mimeType: string;
    content: string;
    appProperties: Record<string, string>;
    shareWith?: string;
  }): string {
    const f = this.store.create({
      user: input.owner,
      name: input.name,
      mimeType: input.mimeType,
      parents: ['root'],
      appProperties: input.appProperties,
      content: input.content,
      viaApp: true,
    });
    if (input.shareWith) f.sharedWith.add(input.shareWith);
    return f.id;
  }

  // Picking a file or folder in the Google Picker, or "Open with": the app
  // gains drive.file access to that one item.
  grantAccess(user: string, id: string): void {
    this.store.grantAppAccess(this.file(id), user);
  }

  // The app loses access to a file (reads as `removed` in changes).
  loseAccess(user: string, id: string): void {
    this.store.revokeAppAccess(this.file(id), user);
  }

  // Drive's own "Open with" state for one file.
  openWithState(user: string, id: string): string {
    this.grantAccess(user, id);
    return JSON.stringify({ ids: [id], action: 'open', userId: user });
  }

  // Files the app created or was given, for assertions.
  appFiles(user: string): FakeFile[] {
    return [...this.store.files.values()].filter((f) => this.store.appCanAccess(user, f));
  }

  fail(failure: Failure): void {
    this.failures.push({ times: 1, ...failure });
  }

  // ---- HTTP ------------------------------------------------------------------

  // Usable wherever code takes a `fetch`.
  readonly fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    this.handle(input instanceof Request ? input : new Request(input, init));

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    this.requests.push({ method, path: url.pathname });

    const failure = this.failures.find((f) => !f.match || f.match({ method, path: url.pathname }));
    if (failure) {
      failure.times = (failure.times ?? 1) - 1;
      if (failure.times <= 0) this.failures.splice(this.failures.indexOf(failure), 1);
      return driveError(failure.status, failure.reason ?? 'injected');
    }

    if (url.pathname === '/token' && method === 'POST') return this.token(request);
    if (url.pathname === '/revoke' && method === 'POST') return this.revoke(request);

    const auth = request.headers.get('Authorization') ?? '';
    const access = this.accessTokens.get(auth.replace(/^Bearer\s+/i, ''));
    if (!access || access.grant.revoked || access.expiresAt <= this.now()) {
      return driveError(401, 'authError', 'Invalid Credentials');
    }
    const user = access.user;
    try {
      return await this.drive(request, url, method, user);
    } catch (err) {
      return driveError(400, 'badRequest', err instanceof Error ? err.message : String(err));
    }
  }

  private async token(request: Request): Promise<Response> {
    const form = new URLSearchParams(await request.text());
    const grantType = form.get('grant_type');
    if (grantType === 'authorization_code') {
      const user = this.codes.get(form.get('code') ?? '');
      if (!user || !form.get('redirect_uri') || !form.get('client_secret')) {
        return jsonResponse(400, { error: 'invalid_grant' });
      }
      this.codes.delete(form.get('code')!);
      const grant = this.grantFor(user);
      return jsonResponse(200, {
        access_token: this.mintAccess(grant),
        expires_in: ACCESS_TOKEN_TTL_S,
        token_type: 'Bearer',
        scope:
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install',
        ...(this.omitRefreshToken ? {} : { refresh_token: grant.refreshToken }),
      });
    }
    if (grantType === 'refresh_token') {
      const grant = this.grants.find((g) => g.refreshToken === form.get('refresh_token'));
      if (!grant || grant.revoked) {
        return jsonResponse(400, {
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        });
      }
      return jsonResponse(200, {
        access_token: this.mintAccess(grant),
        expires_in: ACCESS_TOKEN_TTL_S,
        token_type: 'Bearer',
      });
    }
    return jsonResponse(400, { error: 'unsupported_grant_type' });
  }

  private async revoke(request: Request): Promise<Response> {
    const token = new URLSearchParams(await request.text()).get('token') ?? '';
    const grant =
      this.grants.find((g) => g.refreshToken === token) ?? this.accessTokens.get(token)?.grant;
    if (!grant) return jsonResponse(400, { error: 'invalid_token' });
    grant.revoked = true;
    return jsonResponse(200, {});
  }

  private shape(file: FakeFile, user: string): Record<string, unknown> {
    return {
      kind: 'drive#file',
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      parents: [...file.parents],
      trashed: file.trashed,
      explicitlyTrashed: file.explicitlyTrashed,
      appProperties: { ...file.appProperties },
      ...(file.md5Checksum ? { md5Checksum: file.md5Checksum } : {}),
      ...(file.headRevisionId ? { headRevisionId: file.headRevisionId } : {}),
      version: String(file.version),
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      ownedByMe: file.owner === user,
      capabilities: { canEdit: file.owner === user, canTrash: file.owner === user },
      ...(file.thumbnail ? { hasThumbnail: true } : {}),
    };
  }

  private respondFile(file: FakeFile, user: string, url: URL): Response {
    const fields = parseFields(url.searchParams.get('fields') ?? DEFAULT_FILE_FIELDS);
    return jsonResponse(200, pickFields(this.shape(file, user), fields));
  }

  private visible(user: string, id: string): FakeFile | null {
    const f = this.store.files.get(id);
    return f && this.store.appCanAccess(user, f) ? f : null;
  }

  private async drive(request: Request, url: URL, method: string, user: string): Promise<Response> {
    const path = url.pathname;

    if (path === '/drive/v3/changes/startPageToken' && method === 'GET') {
      return jsonResponse(200, {
        kind: 'drive#startPageToken',
        startPageToken: this.store.startPageToken(),
      });
    }

    if (path === '/drive/v3/changes' && method === 'GET') {
      const token = Number(url.searchParams.get('pageToken'));
      if (!this.store.isValidPageToken(token))
        return driveError(400, 'invalid', 'Invalid page token');
      const size = Math.min(
        Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE),
        MAX_PAGE_SIZE,
      );
      const page = this.store.changesSince(user, token, size);
      const body = {
        kind: 'drive#changeList',
        changes: page.entries.map((e) => ({
          kind: 'drive#change',
          changeType: 'file',
          fileId: e.fileId,
          time: e.time,
          removed: e.file === null,
          ...(e.file ? { file: this.shape(e.file, user) } : {}),
        })),
        ...(page.done
          ? { newStartPageToken: String(page.next) }
          : { nextPageToken: String(page.next) }),
      };
      const fields = url.searchParams.get('fields');
      return jsonResponse(200, fields ? pickFields(body, parseFields(fields)) : body);
    }

    if (path === '/drive/v3/files' && method === 'GET') {
      const match = compileQuery(url.searchParams.get('q'));
      const all = this.appFiles(user)
        .filter((f) => match(f))
        .sort((a, b) => a.id.localeCompare(b.id));
      const size = Math.min(
        Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE),
        MAX_PAGE_SIZE,
      );
      const start = Number(url.searchParams.get('pageToken') ?? 0);
      const slice = all.slice(start, start + size);
      const body = {
        kind: 'drive#fileList',
        files: slice.map((f) => this.shape(f, user)),
        ...(start + size < all.length ? { nextPageToken: String(start + size) } : {}),
      };
      const fields = parseFields(
        url.searchParams.get('fields') ?? `nextPageToken,files(${DEFAULT_FILE_FIELDS})`,
      );
      return jsonResponse(200, pickFields(body, fields));
    }

    if (path === '/drive/v3/files' && method === 'POST') {
      const meta = (await request.json()) as Record<string, unknown>;
      const file = this.createFromMetadata(user, meta, '');
      return this.respondFile(file, user, url);
    }

    const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(path);
    if (fileMatch) {
      const file = this.visible(user, fileMatch[1]!);
      if (!file) return driveError(404, 'notFound', `File not found: ${fileMatch[1]}.`);
      if (method === 'GET') {
        if (url.searchParams.get('alt') === 'media') {
          return new Response(file.content, {
            status: 200,
            headers: { 'Content-Type': file.mimeType, ...CORS },
          });
        }
        return this.respondFile(file, user, url);
      }
      if (method === 'PATCH') {
        const meta = (await request.json()) as Record<string, unknown>;
        this.applyMetadata(file, meta, url, user);
        return this.respondFile(file, user, url);
      }
      if (method === 'DELETE') {
        if (file.owner !== user) return driveError(403, 'insufficientFilePermissions');
        this.store.remove(file);
        return new Response(null, { status: 204, headers: CORS });
      }
    }

    const uploadMatch = /^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/.exec(path);
    if (uploadMatch) return this.upload(request, url, method, user, uploadMatch[1] ?? null);

    return driveError(404, 'notFound', `No route ${method} ${path}`);
  }

  private createFromMetadata(
    user: string,
    meta: Record<string, unknown>,
    content: string,
    thumbnail?: FakeFile['thumbnail'],
  ): FakeFile {
    const parents = Array.isArray(meta.parents) ? (meta.parents as string[]) : ['root'];
    for (const p of parents) {
      if (p !== 'root' && !this.visible(user, p)) throw new Error(`parent not found: ${p}`);
    }
    if (typeof meta.name !== 'string' || !meta.name) throw new Error('name required');
    return this.store.create({
      user,
      name: meta.name,
      mimeType: typeof meta.mimeType === 'string' ? meta.mimeType : 'application/octet-stream',
      parents,
      appProperties: (meta.appProperties as Record<string, string>) ?? {},
      content,
      viaApp: true,
      thumbnail: thumbnail ?? this.thumbnailOf(meta),
    });
  }

  private thumbnailOf(meta: Record<string, unknown>): FakeFile['thumbnail'] {
    const hints = meta.contentHints as
      { thumbnail?: { image?: string; mimeType?: string } } | undefined;
    if (!hints?.thumbnail) return null;
    return validateThumbnail(hints.thumbnail.image ?? '', hints.thumbnail.mimeType ?? '');
  }

  private applyMetadata(
    file: FakeFile,
    meta: Record<string, unknown>,
    url: URL,
    user: string,
  ): void {
    if (file.owner !== user && (meta.trashed !== undefined || url.searchParams.has('addParents'))) {
      throw new Error('insufficientFilePermissions');
    }
    const add = (url.searchParams.get('addParents') ?? '').split(',').filter(Boolean);
    const remove = (url.searchParams.get('removeParents') ?? '').split(',').filter(Boolean);
    for (const p of add) {
      if (p !== 'root' && !this.visible(user, p)) throw new Error(`parent not found: ${p}`);
    }
    if (typeof meta.name === 'string') this.store.rename(file, meta.name);
    if (add.length > 0 || remove.length > 0) this.store.move(file, add, remove, user);
    if (meta.appProperties && typeof meta.appProperties === 'object') {
      this.store.setAppProperties(file, meta.appProperties as Record<string, string | null>);
    }
    if (typeof meta.trashed === 'boolean' && meta.trashed !== file.trashed) {
      this.store.setTrashed(file, meta.trashed);
    }
  }

  private async upload(
    request: Request,
    url: URL,
    method: string,
    user: string,
    fileId: string | null,
  ): Promise<Response> {
    const type = url.searchParams.get('uploadType');
    const uploadId = url.searchParams.get('upload_id');

    if (uploadId && method === 'PUT') {
      const session = this.uploads.get(uploadId);
      if (!session || session.user !== user) return driveError(404, 'notFound', 'upload session');
      this.uploads.delete(uploadId);
      const content = await request.text();
      return this.finishUpload(user, session.fileId, session.metadata, content, session.query);
    }

    if (type === 'multipart') {
      const parts = parseMultipartRelated(
        request.headers.get('Content-Type') ?? '',
        await request.text(),
      );
      if (parts.length !== 2) throw new Error('multipart needs metadata and media');
      const meta = JSON.parse(parts[0]!.body) as Record<string, unknown>;
      return this.finishUpload(user, fileId, meta, parts[1]!.body, url.searchParams);
    }

    if (type === 'resumable' && (method === 'POST' || method === 'PATCH')) {
      const text = await request.text();
      const meta = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (fileId && !this.visible(user, fileId))
        return driveError(404, 'notFound', `File not found: ${fileId}.`);
      const id = `upload-${++this.counter}`;
      this.uploads.set(id, { user, fileId, metadata: meta, query: url.searchParams });
      const location = `${url.origin}${url.pathname}?uploadType=resumable&upload_id=${id}`;
      return new Response(null, { status: 200, headers: { Location: location, ...CORS } });
    }

    throw new Error(`unsupported upload ${method} uploadType=${type}`);
  }

  private finishUpload(
    user: string,
    fileId: string | null,
    meta: Record<string, unknown>,
    content: string,
    query: URLSearchParams,
  ): Response {
    const url = new URL(`https://www.googleapis.com/drive/v3/files?${query.toString()}`);
    if (!fileId) {
      const file = this.createFromMetadata(user, meta, content);
      return this.respondFile(file, user, url);
    }
    const file = this.visible(user, fileId);
    if (!file) return driveError(404, 'notFound', `File not found: ${fileId}.`);
    this.store.writeContent(file, content, this.thumbnailOf(meta));
    const { contentHints: _hints, ...rest } = meta;
    void _hints;
    this.applyMetadata(file, rest, url, user);
    return this.respondFile(file, user, url);
  }
}
