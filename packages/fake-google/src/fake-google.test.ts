import { describe, expect, it } from 'vitest';
import { FakeGoogle } from './fake-google';
import { FOLDER_MIME } from './drive-store';
import { fakePngBase64Url } from './thumbnail';

// The fake behaves like the slice of Google the mirror relies on
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md).

const API = 'https://www.googleapis.com';
const FILE_FIELDS = 'id,name,parents,trashed,md5Checksum,headRevisionId,appProperties,mimeType';

type Body = {
  id?: string;
  parents?: string[];
  md5Checksum?: string;
  headRevisionId?: string;
  startPageToken?: string;
  nextPageToken?: string;
  newStartPageToken?: string;
  files?: unknown[];
  changes?: { fileId: string; removed: boolean; file?: { name: string } }[];
  error?: { errors: { reason: string }[] };
  [key: string]: unknown;
};

function setup(options: ConstructorParameters<typeof FakeGoogle>[0] = {}) {
  let now = 1_700_000_000_000;
  const fake = new FakeGoogle({ now: () => now, ...options });
  const token = fake.issueAccessToken('me');
  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await fake.fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && typeof body !== 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status,
      headers: res.headers,
      body: text ? (JSON.parse(text) as Body) : null,
    };
  };
  return { fake, call, tick: (ms: number) => (now += ms) };
}

async function createFolder(
  call: ReturnType<typeof setup>['call'],
  name: string,
  parent = 'root',
): Promise<{ id: string; parents: string[] }> {
  return (
    await call('POST', `/drive/v3/files?fields=${FILE_FIELDS}`, {
      name,
      mimeType: FOLDER_MIME,
      parents: [parent],
      appProperties: { ldFolderId: name },
    })
  ).body as { id: string; parents: string[] };
}

function multipart(meta: unknown, media: string) {
  const b = 'bnd';
  return {
    body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/vnd.livediagram+json\r\n\r\n${media}\r\n--${b}--`,
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
  };
}

describe('auth', () => {
  it('refuses a missing or revoked token with 401', async () => {
    const { fake, call } = setup();
    const res = await fake.fetch(`${API}/drive/v3/changes/startPageToken`);
    expect(res.status).toBe(401);
    fake.revokeGrant('me');
    expect((await call('GET', '/drive/v3/changes/startPageToken')).status).toBe(401);
  });

  it('exchanges a code for tokens, refreshes, and answers invalid_grant once revoked', async () => {
    const fake = new FakeGoogle();
    const code = fake.consent('me');
    const form = (o: Record<string, string>) => ({
      method: 'POST',
      body: new URLSearchParams(o).toString(),
    });
    const first = (await (
      await fake.fetch(
        'https://oauth2.googleapis.com/token',
        form({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'https://x/drive/connected',
          client_id: 'c',
          client_secret: 's',
        }),
      )
    ).json()) as Record<string, string>;
    expect(first.refresh_token).toMatch(/^1\/\//);
    const refreshed = await fake.fetch(
      'https://oauth2.googleapis.com/token',
      form({ grant_type: 'refresh_token', refresh_token: first.refresh_token! }),
    );
    expect(refreshed.status).toBe(200);
    // A code redeems once.
    expect(
      (
        await fake.fetch(
          'https://oauth2.googleapis.com/token',
          form({ grant_type: 'authorization_code', code, redirect_uri: 'u', client_secret: 's' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await fake.fetch(
          'https://oauth2.googleapis.com/revoke',
          form({ token: first.refresh_token! }),
        )
      ).status,
    ).toBe(200);
    const dead = await fake.fetch(
      'https://oauth2.googleapis.com/token',
      form({ grant_type: 'refresh_token', refresh_token: first.refresh_token! }),
    );
    expect(dead.status).toBe(400);
    expect(await dead.json()).toMatchObject({ error: 'invalid_grant' });
  });
});

describe('files', () => {
  it('creates folders and multipart files, honouring fields', async () => {
    const { call } = setup();
    const root = await createFolder(call, 'livediagram');
    expect(root.parents).toEqual(['mydrive-me']);
    const up = multipart(
      {
        name: 'A.livediagram',
        parents: [root.id],
        mimeType: 'application/vnd.livediagram+json',
        appProperties: { ldDocumentId: 'd1' },
        contentHints: { thumbnail: { image: fakePngBase64Url(400), mimeType: 'image/png' } },
      },
      '{"x":1}',
    );
    const file = await call(
      'POST',
      `/upload/drive/v3/files?uploadType=multipart&fields=${FILE_FIELDS}`,
      up.body,
      up.headers,
    );
    expect(file.status).toBe(200);
    expect(file.body).toMatchObject({
      name: 'A.livediagram',
      parents: [root.id],
      trashed: false,
      appProperties: { ldDocumentId: 'd1' },
    });
    expect(file.body!.md5Checksum).toMatch(/^[0-9a-f]{32}$/);
    // Without fields: Drive's default subset only.
    const bare = await call('GET', `/drive/v3/files/${file.body!.id}`);
    expect(Object.keys(bare.body!).sort()).toEqual(['id', 'kind', 'mimeType', 'name']);
    const media = await call('GET', `/drive/v3/files/${file.body!.id}?alt=media`);
    expect(media.body).toEqual({ x: 1 });
  });

  it('refuses a thumbnail narrower than 220px, or not a PNG', async () => {
    const { call } = setup();
    const up = multipart(
      {
        name: 'A',
        contentHints: { thumbnail: { image: fakePngBase64Url(100), mimeType: 'image/png' } },
      },
      '{}',
    );
    expect(
      (await call('POST', '/upload/drive/v3/files?uploadType=multipart', up.body, up.headers))
        .status,
    ).toBe(400);
    const svg = multipart(
      { name: 'A', contentHints: { thumbnail: { image: 'PHN2Zz4', mimeType: 'image/svg+xml' } } },
      '{}',
    );
    expect(
      (await call('POST', '/upload/drive/v3/files?uploadType=multipart', svg.body, svg.headers))
        .status,
    ).toBe(400);
  });

  it('updates content (new md5 and revision) and moves with add/removeParents', async () => {
    const { call } = setup();
    const a = await createFolder(call, 'a');
    const b = await createFolder(call, 'b');
    const up = multipart({ name: 'F', parents: [a.id] }, 'one');
    const file = (
      await call(
        'POST',
        `/upload/drive/v3/files?uploadType=multipart&fields=${FILE_FIELDS}`,
        up.body,
        up.headers,
      )
    ).body!;
    const next = multipart({}, 'two');
    const updated = (
      await call(
        'PATCH',
        `/upload/drive/v3/files/${file.id}?uploadType=multipart&fields=${FILE_FIELDS}`,
        next.body,
        next.headers,
      )
    ).body!;
    expect(updated.md5Checksum).not.toBe(file.md5Checksum);
    expect(updated.headRevisionId).not.toBe(file.headRevisionId);
    const moved = (
      await call(
        'PATCH',
        `/drive/v3/files/${file.id}?addParents=${b.id}&removeParents=${a.id}&fields=${FILE_FIELDS}`,
        {},
      )
    ).body!;
    expect(moved.parents).toEqual([b.id]);
    expect(moved.md5Checksum).toBe(updated.md5Checksum);
  });

  it('runs a resumable upload through its session URI', async () => {
    const { call } = setup();
    const start = await call(
      'POST',
      '/upload/drive/v3/files?uploadType=resumable',
      { name: 'Big' },
      { 'X-Upload-Content-Type': 'application/vnd.livediagram+json' },
    );
    expect(start.status).toBe(200);
    const location = start.headers.get('Location')!;
    expect(location).toContain('upload_id=');
    const done = await call(
      'PUT',
      `${new URL(location).pathname}${new URL(location).search}&fields=${FILE_FIELDS}`,
      'x'.repeat(10),
    );
    expect(done.body).toMatchObject({ name: 'Big' });
  });

  it('404s a file the app cannot see (drive.file)', async () => {
    const { fake, call } = setup();
    const hidden = fake.userCreateFolder('me', 'Mine');
    expect((await call('GET', `/drive/v3/files/${hidden}`)).status).toBe(404);
    fake.grantAccess('me', hidden);
    expect((await call('GET', `/drive/v3/files/${hidden}`)).status).toBe(200);
  });

  it('lists files matching q, across pages', async () => {
    const { call } = setup();
    for (const n of ['a', 'b', 'c']) await createFolder(call, n);
    const page1 = await call(
      'GET',
      `/drive/v3/files?q=${encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false")}&pageSize=2&fields=nextPageToken,files(id,name)`,
    );
    expect(page1.body!.files).toHaveLength(2);
    const page2 = await call(
      'GET',
      `/drive/v3/files?q=${encodeURIComponent('trashed = false')}&pageSize=2&pageToken=${page1.body!.nextPageToken}&fields=nextPageToken,files(id,name)`,
    );
    expect(page2.body!.files).toHaveLength(1);
    expect(page2.body!.nextPageToken).toBeUndefined();
  });
});

describe('changes', () => {
  it('lists changes from a page token and hands back a new start token', async () => {
    const { fake, call } = setup();
    const start = (await call('GET', '/drive/v3/changes/startPageToken')).body!
      .startPageToken as string;
    const f = await createFolder(call, 'x');
    fake.userRename(f.id, 'y');
    const page = (
      await call(
        'GET',
        `/drive/v3/changes?pageToken=${start}&pageSize=1000&fields=nextPageToken,newStartPageToken,changes(fileId,removed,time,file(id,name,trashed))`,
      )
    ).body!;
    expect(page.changes!.map((c) => c.file!.name)).toEqual(['y', 'y']);
    const again = (await call('GET', `/drive/v3/changes?pageToken=${page.newStartPageToken}`))
      .body!;
    expect(again.changes).toEqual([]);
  });

  it('pages when there are more changes than the page size', async () => {
    const { call } = setup();
    const start = (await call('GET', '/drive/v3/changes/startPageToken')).body!
      .startPageToken as string;
    for (const n of ['a', 'b', 'c']) await createFolder(call, n);
    const first = (await call('GET', `/drive/v3/changes?pageToken=${start}&pageSize=2`)).body!;
    expect(first.changes).toHaveLength(2);
    expect(first.nextPageToken).toBeDefined();
    const second = (
      await call('GET', `/drive/v3/changes?pageToken=${first.nextPageToken}&pageSize=2`)
    ).body!;
    expect(second.changes).toHaveLength(1);
    expect(second.newStartPageToken).toBeDefined();
  });

  it('never shows changes to files the app cannot see', async () => {
    const { fake, call } = setup();
    const start = (await call('GET', '/drive/v3/changes/startPageToken')).body!
      .startPageToken as string;
    fake.userCreateFolder('me', 'Invisible');
    expect((await call('GET', `/drive/v3/changes?pageToken=${start}`)).body!.changes).toEqual([]);
  });

  it('bins a folder with its descendants, and restores them', async () => {
    const { fake, call } = setup();
    const folder = await createFolder(call, 'f');
    const child = await createFolder(call, 'c', folder.id);
    fake.userTrash(folder.id);
    expect(fake.get(child.id)).toMatchObject({ trashed: true, explicitlyTrashed: false });
    fake.userRestore(folder.id);
    expect(fake.get(child.id)!.trashed).toBe(false);
  });

  it('can bin a folder without emitting changes for its descendants', async () => {
    const { fake, call } = setup({ emitDescendantChanges: false });
    const folder = await createFolder(call, 'f');
    await createFolder(call, 'c', folder.id);
    const start = (await call('GET', '/drive/v3/changes/startPageToken')).body!
      .startPageToken as string;
    fake.userTrash(folder.id);
    const changes = (await call('GET', `/drive/v3/changes?pageToken=${start}`)).body!.changes;
    expect(changes!.map((c) => c.fileId)).toEqual([folder.id]);
  });

  it('reports a permanent delete, and a lost access, as removed', async () => {
    const { fake, call } = setup();
    const a = await createFolder(call, 'a');
    const b = await createFolder(call, 'b');
    const start = (await call('GET', '/drive/v3/changes/startPageToken')).body!
      .startPageToken as string;
    fake.userTrash(a.id);
    fake.userEmptyTrash('me');
    fake.loseAccess('me', b.id);
    const changes = (
      await call('GET', `/drive/v3/changes?pageToken=${start}&fields=changes(fileId,removed)`)
    ).body!.changes;
    // Every entry carries the CURRENT state, so the bin entry reads removed too.
    expect(changes).toEqual([
      { fileId: a.id, removed: true },
      { fileId: a.id, removed: true },
      { fileId: b.id, removed: true },
    ]);
  });

  it('refuses a page token it never issued', async () => {
    const { call } = setup();
    expect((await call('GET', '/drive/v3/changes?pageToken=99999')).status).toBe(400);
  });
});

describe('failures', () => {
  it('answers a request it cannot handle with a Drive-shaped 400, without the thrown message', async () => {
    const fake = new FakeGoogle({ now: () => 0 });
    const token = fake.issueAccessToken('u');
    const res = await fake.fetch(
      'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent('bogus query'),
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; errors: { reason: string }[] } };
    expect(body.error.errors[0]!.reason).toBe('badRequest');
    expect(body.error.message).toBe('Bad request');
  });

  it('injects rate limits with Drive-shaped bodies, once', async () => {
    const { fake, call } = setup();
    fake.fail({ status: 403, reason: 'userRateLimitExceeded' });
    const limited = await call('GET', '/drive/v3/changes/startPageToken');
    expect(limited.status).toBe(403);
    expect(limited.body!.error!.errors[0]!.reason).toBe('userRateLimitExceeded');
    expect((await call('GET', '/drive/v3/changes/startPageToken')).status).toBe(200);
  });

  it('records every request for quota assertions', async () => {
    const { fake, call } = setup();
    await call('GET', '/drive/v3/changes/startPageToken');
    expect(fake.requests).toEqual([{ method: 'GET', path: '/drive/v3/changes/startPageToken' }]);
  });
});

describe('userCopy', () => {
  it('makes a new file beside the original, keeping contents and appProperties, seen once opened with the app', async () => {
    const { fake, call } = setup();
    const folder = await createFolder(call, 'f');
    const up = multipart(
      { name: 'Plan.livediagram', parents: [folder.id], appProperties: { ldDocumentId: 'd1' } },
      'body',
    );
    const file = (
      await call(
        'POST',
        `/upload/drive/v3/files?uploadType=multipart&fields=${FILE_FIELDS}`,
        up.body,
        up.headers,
      )
    ).body!;
    const copyId = fake.userCopy(file.id!);
    // Invisible to the app under drive.file until Open with grants it.
    expect((await call('GET', `/drive/v3/files/${copyId}`)).status).toBe(404);
    fake.openWithState('me', copyId);
    const copy = (await call('GET', `/drive/v3/files/${copyId}?fields=${FILE_FIELDS}`)).body!;
    expect(copy).toMatchObject({
      name: 'Copy of Plan.livediagram',
      parents: [folder.id],
      appProperties: { ldDocumentId: 'd1' },
      md5Checksum: file.md5Checksum,
    });
  });

  it('can make a copy without appProperties, or one the app sees at once', async () => {
    const { fake, call } = setup();
    const f = await createFolder(call, 'f');
    expect(fake.get(fake.userCopy(f.id, { keepAppProperties: false }))!.appProperties).toEqual({});
    const shown = fake.userCopy(f.id, { visibleToApp: true });
    expect((await call('GET', `/drive/v3/files/${shown}`)).status).toBe(200);
  });
});

describe('a root the user moves and renames', () => {
  it('stays visible to the app by id and by its appProperties, with children in place', async () => {
    const { fake, call } = setup();
    const root = (
      await call('POST', `/drive/v3/files?fields=${FILE_FIELDS}`, {
        name: 'livediagram',
        mimeType: FOLDER_MIME,
        parents: ['root'],
        appProperties: { ldRoot: 'host' },
      })
    ).body as { id: string };
    const child = await createFolder(call, 'child', root.id);
    const mine = fake.userCreateFolder('me', 'Mine');
    fake.userRename(root.id, 'Renamed');
    fake.userMove(root.id, mine);
    expect(
      (await call('GET', `/drive/v3/files/${root.id}?fields=${FILE_FIELDS}`)).body,
    ).toMatchObject({
      name: 'Renamed',
      parents: [mine],
    });
    const found = await call(
      'GET',
      `/drive/v3/files?q=${encodeURIComponent("appProperties has { key='ldRoot' and value='host' } and trashed = false")}&fields=files(id)`,
    );
    expect(found.body!.files).toEqual([{ id: root.id }]);
    expect(fake.get(child.id)!.parents).toEqual([root.id]);
  });
});
