import { describe, expect, it } from 'vitest';
import { FakeGoogle, fakePngBase64Url } from '@liveworkspace/fake-google';
import { sentUrl } from '@liveworkspace/vitest-config/sent-request';
import { DRIVE_FOLDER_MIME, DRIVE_MULTIPART_MAX_BYTES } from '../constants';
import { APP_FILE_FORMATS } from '../formats';
import { createDriveClient, DriveApiError } from './drive-client';

// The service's Drive client against the fake Google (liveworkspace/docs/drive.md "The service").

const MIME = APP_FILE_FORMATS.liveplanner.mimeType;

function setup() {
  const fake = new FakeGoogle();
  let token = fake.issueAccessToken('me');
  let forced = 0;
  const client = createDriveClient({ fetch: fake.fetch }, async (opts) => {
    if (opts?.force) {
      forced += 1;
      token = fake.issueAccessToken('me');
    }
    return token;
  });
  return { fake, client, forced: () => forced };
}

describe('createDriveClient', () => {
  it('creates a folder and a file with appProperties, parents, md5, its MIME type and a thumbnail', async () => {
    const { fake, client } = setup();
    const root = await client.createFolder({
      name: 'liveworkspace',
      parentId: 'root',
      appProperties: { lwRoot: 'https://liveworkspace.test' },
    });
    expect(root).toMatchObject({
      name: 'liveworkspace',
      mimeType: DRIVE_FOLDER_MIME,
      parents: ['mydrive-me'], // The fake's id for My Drive, as Google answers 'root' with its real id.
    });
    const file = await client.createFile({
      name: 'A.liveplanner',
      parentId: root.id,
      mimeType: MIME,
      content: '{"a":1}',
      thumbnailPng: fakePngBase64Url(440),
      appProperties: { lwItemId: 'i1', lwApp: 'liveplanner' },
    });
    expect(file).toMatchObject({
      name: 'A.liveplanner',
      mimeType: MIME,
      parents: [root.id],
      trashed: false,
      ownedByMe: true,
      appProperties: { lwItemId: 'i1', lwApp: 'liveplanner' },
    });
    expect(file.md5Checksum).toMatch(/^[0-9a-f]{32}$/);
    expect(file.headRevisionId).toBeTruthy();
    expect(fake.get(file.id)!.thumbnail).toMatchObject({ mimeType: 'image/png' });
    expect(await client.download(file.id)).toBe('{"a":1}');
  });

  it('creates a file with no appProperties or thumbnail', async () => {
    const { fake, client } = setup();
    const file = await client.createFile({
      name: 'B',
      parentId: 'root',
      mimeType: MIME,
      content: 'x',
      thumbnailPng: null,
    });
    expect(file.appProperties).toEqual({});
    expect(fake.get(file.id)!.thumbnail).toBeNull();
  });

  it('updates metadata, moves, bins and rewrites content', async () => {
    const { fake, client } = setup();
    const a = await client.createFolder({ name: 'a', parentId: 'root', appProperties: {} });
    const b = await client.createFolder({ name: 'b', parentId: 'root', appProperties: {} });
    const file = await client.createFile({
      name: 'F',
      parentId: a.id,
      mimeType: MIME,
      content: 'one',
      thumbnailPng: null,
    });
    const moved = await client.updateFile(file.id, {
      name: 'G',
      addParent: b.id,
      removeParent: a.id,
    });
    expect(moved).toMatchObject({ name: 'G', parents: [b.id] });
    expect(moved.md5Checksum).toBe(file.md5Checksum);
    const rewritten = await client.updateFile(file.id, {
      content: 'two',
      mimeType: MIME,
      thumbnailPng: fakePngBase64Url(440),
      name: 'H',
    });
    expect(rewritten).toMatchObject({ name: 'H', parents: [b.id] });
    expect(rewritten.md5Checksum).not.toBe(file.md5Checksum);
    expect(rewritten.headRevisionId).not.toBe(file.headRevisionId);
    expect(fake.get(file.id)!.thumbnail).toMatchObject({ mimeType: 'image/png' });
    expect(await client.download(file.id)).toBe('two');
    const binned = await client.updateFile(file.id, { trashed: true });
    expect(binned.trashed).toBe(true);
    expect((await client.updateFile(file.id, { trashed: false })).trashed).toBe(false);
    await client.deleteFile(file.id);
    await expect(client.getFile(file.id)).rejects.toMatchObject({ status: 404, isNotFound: true });
  });

  it('moves a file with content in the same upload', async () => {
    const { client } = setup();
    const a = await client.createFolder({ name: 'a', parentId: 'root', appProperties: {} });
    const file = await client.createFile({
      name: 'F',
      parentId: 'root',
      mimeType: MIME,
      content: '1',
      thumbnailPng: null,
    });
    const out = await client.updateFile(file.id, {
      content: '2',
      mimeType: MIME,
      addParent: a.id,
      removeParent: file.parents[0]!,
    });
    expect(out.parents).toEqual([a.id]);
  });

  it('sets and clears appProperties', async () => {
    const { client } = setup();
    const file = await client.createFile({
      name: 'F',
      parentId: 'root',
      mimeType: MIME,
      content: '1',
      thumbnailPng: null,
      appProperties: { lwItemId: 'i1' },
    });
    const out = await client.updateFile(file.id, { appProperties: { lwApp: 'liveplanner' } });
    expect(out.appProperties).toEqual({ lwItemId: 'i1', lwApp: 'liveplanner' });
  });

  it('refuses a content update without its MIME type before calling Google', async () => {
    const { fake, client } = setup();
    const file = await client.createFile({
      name: 'F',
      parentId: 'root',
      mimeType: MIME,
      content: '1',
      thumbnailPng: null,
    });
    const before = fake.requests.length;
    await expect(client.updateFile(file.id, { content: '2' })).rejects.toThrow(/mimeType/);
    expect(fake.requests.length).toBe(before);
  });

  it('uploads over 5 MB through a resumable session, with the item’s MIME type', async () => {
    const { fake, client } = setup();
    const big = 'x'.repeat(DRIVE_MULTIPART_MAX_BYTES + 10);
    const file = await client.createFile({
      name: 'Big',
      parentId: 'root',
      mimeType: MIME,
      content: big,
      thumbnailPng: null,
    });
    expect(fake.get(file.id)!.content.length).toBe(big.length);
    expect(fake.get(file.id)!.mimeType).toBe(MIME);
    expect(fake.requests.some((r) => r.method === 'PUT')).toBe(true);
    const updated = await client.updateFile(file.id, {
      content: `${big}y`,
      mimeType: MIME,
      thumbnailPng: null,
    });
    expect(fake.get(updated.id)!.content.endsWith('y')).toBe(true);
  });

  it('measures the multipart ceiling in bytes, not characters', async () => {
    const { fake, client } = setup();
    // Under the ceiling in characters, over it in UTF-8 bytes.
    const wide = 'é'.repeat(DRIVE_MULTIPART_MAX_BYTES / 2 + 10);
    await client.createFile({
      name: 'Wide',
      parentId: 'root',
      mimeType: MIME,
      content: wide,
      thumbnailPng: null,
    });
    expect(fake.requests.some((r) => r.method === 'PUT')).toBe(true);
  });

  it('reads changes with their file state and new start token', async () => {
    const { fake, client } = setup();
    const start = await client.getStartPageToken();
    const f = await client.createFolder({
      name: 'x',
      parentId: 'root',
      appProperties: { lwFolderId: 'f1' },
    });
    fake.userRename(f.id, 'y');
    const page = await client.listChanges(start);
    expect(page.newStartPageToken).toBeDefined();
    expect(page.nextPageToken).toBeUndefined();
    expect(page.changes.at(-1)).toMatchObject({
      fileId: f.id,
      removed: false,
      file: {
        name: 'y',
        appProperties: { lwFolderId: 'f1' },
        md5Checksum: null,
        headRevisionId: null,
      },
    });
    expect(Date.parse(page.changes.at(-1)!.time)).not.toBeNaN();
  });

  it('reads a removed file as removed with no file', async () => {
    const { fake, client } = setup();
    const f = await client.createFile({
      name: 'F',
      parentId: 'root',
      mimeType: MIME,
      content: '1',
      thumbnailPng: null,
    });
    const start = await client.getStartPageToken();
    fake.userDeleteForever(f.id);
    const page = await client.listChanges(start);
    expect(page.changes).toEqual([
      expect.objectContaining({ fileId: f.id, removed: true, file: null }),
    ]);
  });

  it('lists files by query', async () => {
    const { client } = setup();
    await client.createFolder({ name: 'r', parentId: 'root', appProperties: { lwRoot: 'origin' } });
    await client.createFolder({ name: 's', parentId: 'root', appProperties: { lwRoot: 'other' } });
    const found = await client.listFiles(
      "appProperties has { key='lwRoot' and value='origin' } and trashed = false",
    );
    expect(found.map((f) => f.name)).toEqual(['r']);
  });

  it('reads every page of a list', async () => {
    const { fake, client } = setup();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push(
        (await client.createFolder({ name: `f${i}`, parentId: 'root', appProperties: {} })).id,
      );
    }
    // The fake pages at the size asked; a client asking for 1000 reads one page here, so check by token by hand.
    const seen: string[] = [];
    const paging = createDriveClient(
      {
        fetch: async (input, init) => {
          const url = new URL(sentUrl(input));
          if (url.pathname === '/drive/v3/files') url.searchParams.set('pageSize', '2');
          seen.push(url.searchParams.get('pageToken') ?? '');
          return fake.fetch(url, init);
        },
      },
      async () => fake.issueAccessToken('me'),
    );
    const all = await paging.listFiles('trashed = false');
    expect(all.map((f) => f.id).toSorted()).toEqual(ids.toSorted());
    expect(seen).toEqual(['', '2']);
  });

  it('retries once with a fresh token on 401', async () => {
    const { fake, client, forced } = setup();
    fake.expireAccessTokens();
    expect(await client.getStartPageToken()).toBeTruthy();
    expect(forced()).toBe(1);
  });

  it('gives up after the one retry, naming the auth failure', async () => {
    const fake = new FakeGoogle();
    const asked: (boolean | undefined)[] = [];
    const client = createDriveClient({ fetch: fake.fetch }, async (opts) => {
      asked.push(opts?.force);
      return 'ya29.not-a-token';
    });
    const err = await client.getStartPageToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DriveApiError);
    expect((err as DriveApiError).isAuth).toBe(true);
    expect(asked).toEqual([false, true]);
    expect(fake.requests.length).toBe(2);
  });

  it('names rate limits, 429 and a 404', async () => {
    const { fake, client } = setup();
    fake.fail({ status: 403, reason: 'userRateLimitExceeded' });
    const limited = await client.getStartPageToken().catch((e: unknown) => e);
    expect(limited).toBeInstanceOf(DriveApiError);
    expect(limited).toMatchObject({
      status: 403,
      reason: 'userRateLimitExceeded',
      isRateLimit: true,
    });
    fake.fail({ status: 429, reason: 'rateLimitExceeded' });
    expect(
      ((await client.getStartPageToken().catch((e: unknown) => e)) as DriveApiError).isRateLimit,
    ).toBe(true);
    fake.fail({ status: 403, reason: 'insufficientFilePermissions' });
    expect(
      ((await client.getStartPageToken().catch((e: unknown) => e)) as DriveApiError).isRateLimit,
    ).toBe(false);
    await expect(client.getFile('nope')).rejects.toMatchObject({
      isNotFound: true,
      isRateLimit: false,
    });
  });

  it('keeps the status when the error body is not JSON', async () => {
    const client = createDriveClient(
      { fetch: async () => new Response('Service Unavailable', { status: 503 }) },
      async () => 't',
    );
    const err = (await client.getStartPageToken().catch((e: unknown) => e)) as DriveApiError;
    expect(err).toMatchObject({ status: 503, reason: null, isRateLimit: false });
    expect(err.message).toContain('503');
  });

  it('reads a string error body as its reason', async () => {
    const client = createDriveClient(
      {
        fetch: async () =>
          new Response(JSON.stringify({ error: 'rateLimitExceeded' }), { status: 403 }),
      },
      async () => 't',
    );
    expect(await client.getStartPageToken().catch((e: unknown) => e)).toMatchObject({
      isRateLimit: true,
    });
  });

  it('sends the resource key header when given', async () => {
    const { fake, client } = setup();
    const f = await client.createFile({
      name: 'F',
      parentId: 'root',
      mimeType: MIME,
      content: 'c',
      thumbnailPng: null,
    });
    const seen: string[] = [];
    const spyClient = createDriveClient(
      {
        fetch: async (input, init) => {
          seen.push(new Headers(init?.headers).get('X-Goog-Drive-Resource-Keys') ?? '');
          return fake.fetch(input, init);
        },
      },
      async () => fake.issueAccessToken('me'),
    );
    await spyClient.getFile(f.id, 'rk-1');
    expect(await spyClient.download(f.id, 'rk-2')).toBe('c');
    await spyClient.getFile(f.id);
    expect(seen).toEqual([`${f.id}/rk-1`, `${f.id}/rk-2`, '']);
  });

  it('calls the base URL it is given', async () => {
    const fake = new FakeGoogle();
    const urls: string[] = [];
    const client = createDriveClient(
      {
        baseUrl: 'http://localhost:3010/',
        fetch: async (input, init) => {
          urls.push(sentUrl(input));
          return fake.fetch(input, init);
        },
      },
      async () => fake.issueAccessToken('me'),
    );
    await client.getStartPageToken();
    expect(urls).toEqual(['http://localhost:3010/drive/v3/changes/startPageToken']);
  });
});

describe('watchChanges / stopChannel', () => {
  it('opens a changes channel from a page token, then stops it', async () => {
    const { fake, client } = setup();
    const pageToken = await client.getStartPageToken();
    const expiration = Date.now() + 3_600_000;
    const channel = await client.watchChanges({
      pageToken,
      channelId: 'chan-1',
      address: 'https://liveworkspace.test/api/drive/push',
      token: 'secret-token',
      expiration,
    });
    expect(channel).toEqual({ id: 'chan-1', resourceId: expect.any(String), expiration });
    expect(fake.channels.get('chan-1')).toMatchObject({
      type: 'web_hook',
      address: 'https://liveworkspace.test/api/drive/push',
      token: 'secret-token',
      resourceId: channel.resourceId,
    });
    await client.stopChannel({ id: channel.id, resourceId: channel.resourceId });
    expect(fake.channels.has('chan-1')).toBe(false);
  });

  it('fails on a bad page token or an unknown channel', async () => {
    const { client } = setup();
    await expect(
      client.watchChanges({
        pageToken: '999999',
        channelId: 'c',
        address: 'https://liveworkspace.test/api/drive/push',
        token: 't',
        expiration: 1,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(client.stopChannel({ id: 'nope', resourceId: 'r' })).rejects.toMatchObject({
      status: 404,
      isNotFound: true,
    });
  });

  it('keeps the expiration it asked for when Google answers none', async () => {
    const client = createDriveClient(
      {
        fetch: async () =>
          new Response(JSON.stringify({ id: 'c', resourceId: 'r' }), { status: 200 }),
      },
      async () => 't',
    );
    const channel = await client.watchChanges({
      pageToken: '1',
      channelId: 'c',
      address: 'https://x',
      token: 't',
      expiration: 42,
    });
    expect(channel).toEqual({ id: 'c', resourceId: 'r', expiration: 42 });
  });
});
