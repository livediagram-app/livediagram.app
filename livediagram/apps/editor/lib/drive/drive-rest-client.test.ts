import { describe, expect, it } from 'vitest';
import { FakeGoogle, fakePngBase64Url } from '@livediagram/fake-google';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { DRIVE_MULTIPART_MAX_BYTES } from './cadence';
import { DriveApiError } from './drive-client';
import { createDriveRestClient } from './drive-rest-client';

// The REST client against the fake Google (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "DriveClient").

function setup() {
  const fake = new FakeGoogle();
  let token = fake.issueAccessToken('me');
  let forced = 0;
  const client = createDriveRestClient({
    fetch: fake.fetch,
    getAccessToken: async (opts) => {
      if (opts?.force) {
        forced += 1;
        token = fake.issueAccessToken('me');
      }
      return token;
    },
  });
  return { fake, client, forced: () => forced };
}

describe('createDriveRestClient', () => {
  it('creates a folder and a file with appProperties, parents, md5 and a thumbnail', async () => {
    const { fake, client } = setup();
    const root = await client.createFolder({
      name: 'livediagram',
      parentId: 'root',
      appProperties: { ldRoot: 'h' },
    });
    const file = await client.createFile({
      name: 'A.livediagram',
      parentId: root.id,
      mimeType: DRIVE_FILE_MIME,
      content: '{"a":1}',
      thumbnailPng: fakePngBase64Url(400),
      appProperties: { ldDocumentId: 'd1' },
    });
    expect(file).toMatchObject({
      name: 'A.livediagram',
      parents: [root.id],
      trashed: false,
      ownedByMe: true,
      appProperties: { ldDocumentId: 'd1' },
    });
    expect(file.md5Checksum).toMatch(/^[0-9a-f]{32}$/);
    expect(fake.get(file.id)!.thumbnail).toMatchObject({ mimeType: 'image/png' });
    expect(await client.download(file.id)).toBe('{"a":1}');
  });

  it('updates metadata, moves, bins and rewrites content', async () => {
    const { client } = setup();
    const a = await client.createFolder({ name: 'a', parentId: 'root', appProperties: {} });
    const b = await client.createFolder({ name: 'b', parentId: 'root', appProperties: {} });
    const file = await client.createFile({
      name: 'F',
      parentId: a.id,
      mimeType: DRIVE_FILE_MIME,
      content: 'one',
      thumbnailPng: null,
    });
    const moved = await client.updateFile(file.id, {
      name: 'G',
      addParent: b.id,
      removeParent: a.id,
    });
    expect(moved).toMatchObject({ name: 'G', parents: [b.id] });
    const rewritten = await client.updateFile(file.id, { content: 'two', thumbnailPng: null });
    expect(rewritten.md5Checksum).not.toBe(file.md5Checksum);
    expect((await client.updateFile(file.id, { trashed: true })).trashed).toBe(true);
    await client.deleteFile(file.id);
    await expect(client.getFile(file.id)).rejects.toMatchObject({ status: 404, isNotFound: true });
  });

  it('uploads over 5 MB through a resumable session', async () => {
    const { fake, client } = setup();
    const big = 'x'.repeat(DRIVE_MULTIPART_MAX_BYTES + 10);
    const file = await client.createFile({
      name: 'Big',
      parentId: 'root',
      mimeType: DRIVE_FILE_MIME,
      content: big,
      thumbnailPng: null,
    });
    expect(fake.get(file.id)!.content.length).toBe(big.length);
    expect(fake.requests.some((r) => r.method === 'PUT')).toBe(true);
    const updated = await client.updateFile(file.id, { content: `${big}y`, thumbnailPng: null });
    expect(fake.get(updated.id)!.content.endsWith('y')).toBe(true);
  });

  it('reads changes with their file state and new start token', async () => {
    const { fake, client } = setup();
    const start = await client.getStartPageToken();
    const f = await client.createFolder({
      name: 'x',
      parentId: 'root',
      appProperties: { ldFolderId: 'f1' },
    });
    fake.userRename(f.id, 'y');
    const page = await client.listChanges(start);
    expect(page.newStartPageToken).toBeDefined();
    expect(page.changes.at(-1)).toMatchObject({
      fileId: f.id,
      removed: false,
      file: { name: 'y', appProperties: { ldFolderId: 'f1' } },
    });
  });

  it('lists files by query', async () => {
    const { client } = setup();
    await client.createFolder({ name: 'r', parentId: 'root', appProperties: { ldRoot: 'host' } });
    const found = await client.listFiles(
      "appProperties has { key='ldRoot' and value='host' } and trashed = false",
    );
    expect(found.map((f) => f.name)).toEqual(['r']);
  });

  it('retries once with a fresh token on 401', async () => {
    const { fake, client, forced } = setup();
    fake.expireAccessTokens();
    expect(await client.getStartPageToken()).toBeTruthy();
    expect(forced()).toBe(1);
  });

  it('names rate limits, 429 and a 404', async () => {
    const { fake, client } = setup();
    fake.fail({ status: 403, reason: 'userRateLimitExceeded' });
    const limited = await client.getStartPageToken().catch((e: unknown) => e);
    expect(limited).toBeInstanceOf(DriveApiError);
    expect((limited as DriveApiError).isRateLimit).toBe(true);
    fake.fail({ status: 429, reason: 'rateLimitExceeded' });
    expect(
      ((await client.getStartPageToken().catch((e: unknown) => e)) as DriveApiError).isRateLimit,
    ).toBe(true);
    fake.fail({ status: 403, reason: 'insufficientFilePermissions' });
    expect(
      ((await client.getStartPageToken().catch((e: unknown) => e)) as DriveApiError).isRateLimit,
    ).toBe(false);
  });

  it('sends the resource key header when given', async () => {
    const { fake, client } = setup();
    const f = await client.createFolder({ name: 'x', parentId: 'root', appProperties: {} });
    const seen: string[] = [];
    const spyClient = createDriveRestClient({
      fetch: async (input, init) => {
        seen.push(new Headers(init?.headers).get('X-Goog-Drive-Resource-Keys') ?? '');
        return fake.fetch(input, init);
      },
      getAccessToken: async () => fake.issueAccessToken('me'),
    });
    await spyClient.getFile(f.id, 'rk-1');
    expect(seen).toEqual([`${f.id}/rk-1`]);
  });
});
