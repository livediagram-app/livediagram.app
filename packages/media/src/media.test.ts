import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_IMAGE_TYPES,
  createMediaClient,
  isGuestOwner,
  isMediaApp,
  MEDIA_APPS,
  MEDIA_DOCUMENT_HEADER,
  mediaGuestOwner,
  sniffImageType,
} from './index';

describe('MEDIA_APPS', () => {
  it('lists every app site, so a new app cannot be left out of the gallery', () => {
    expect([...MEDIA_APPS].sort()).toEqual(APP_SITES.map((s) => s.id).sort());
  });

  it('knows its own apps only', () => {
    expect(isMediaApp('livediagram.app')).toBe(true);
    expect(isMediaApp('liveworkspace.app')).toBe(false);
    expect(isMediaApp(undefined)).toBe(false);
  });
});

describe('ACCEPTED_IMAGE_TYPES', () => {
  it('never accepts SVG', () => {
    expect(ACCEPTED_IMAGE_TYPES).not.toContain('image/svg+xml');
  });
});

describe('sniffImageType', () => {
  const pad = (bytes: number[]) =>
    new Uint8Array([...bytes, ...Array.from({ length: 16 }, () => 0)]);

  it('reads each accepted format by its first bytes', () => {
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImageType(pad([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(sniffImageType(pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
    const webp = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageType(webp)).toBe('image/webp');
  });

  it('refuses an SVG and anything too short to tell', () => {
    expect(
      sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')),
    ).toBe(null);
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(null);
  });
});

describe('mediaGuestOwner', () => {
  it('hashes the guest id with its app, so the id never leaves the app', async () => {
    const owner = await mediaGuestOwner('livediagram.app', 'guest-123');
    expect(owner).toMatch(/^guest:[0-9a-f]{64}$/);
    expect(owner).not.toContain('guest-123');
    expect(isGuestOwner(owner)).toBe(true);
    expect(await mediaGuestOwner('livedesign.app', 'guest-123')).not.toBe(owner);
    expect(await mediaGuestOwner('livediagram.app', 'guest-123')).toBe(owner);
  });

  it('never reads an account id as a guest', () => {
    expect(isGuestOwner('user_2abc')).toBe(false);
  });
});

describe('createMediaClient', () => {
  it('names its app and carries its key on every call', async () => {
    const seen: Request[] = [];
    const client = createMediaClient({
      app: 'livedesign.app',
      key: 'secret',
      url: 'http://localhost:8792/api/media',
      fetch: async (input, init) => {
        seen.push(new Request(input, init));
        return Response.json({ images: [] });
      },
    });
    const out = await client.list('user_1');
    expect(out).toEqual({ ok: true, value: { images: [] } });
    expect(seen[0]!.url).toBe('http://localhost:8792/api/media/app/images?owner=user_1');
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer secret');
    expect(seen[0]!.headers.get('X-Media-App')).toBe('livedesign.app');
  });

  it('hands back a refusal as it came, for the app to pass on', async () => {
    const client = createMediaClient({
      app: 'livediagram.app',
      key: 'k',
      fetch: async () =>
        Response.json(
          { error: 'gallery_full', reason: 'count', limit: 100, current: 100 },
          { status: 403 },
        ),
    });
    const out = await client.upload({
      owner: 'user_1',
      bytes: new ArrayBuffer(4),
      contentType: 'image/png',
      byteSize: 4,
      width: 1,
      height: 1,
    });
    expect(out).toEqual({
      ok: false,
      status: 403,
      body: { error: 'gallery_full', reason: 'count', limit: 100, current: 100 },
    });
  });

  it('names the document an upload is for, and leaves it out when there is none', async () => {
    const seen: Headers[] = [];
    const client = createMediaClient({
      app: 'liveplanner.app',
      key: 'k',
      fetch: async (_input, init) => {
        seen.push(new Headers(init?.headers));
        return Response.json({ image: {}, deduped: false });
      },
    });
    const file = { owner: 'user_1', contentType: 'image/png', byteSize: 4, width: 1, height: 1 };
    await client.upload({ ...file, bytes: new ArrayBuffer(4), document: 'plan-1' });
    await client.upload({ ...file, bytes: new ArrayBuffer(4) });
    expect(seen[0]!.get(MEDIA_DOCUMENT_HEADER)).toBe('plan-1');
    expect(seen[1]!.has(MEDIA_DOCUMENT_HEADER)).toBe(false);
  });
});
