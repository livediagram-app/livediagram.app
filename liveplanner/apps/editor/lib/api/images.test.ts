// @vitest-environment jsdom
// The Image field's client (docs/specs/026-plan/item-types.md "Image fields"): the gate before anything is sent, the
// upload for a plan with the index's grant (none for a This Browser plan), each refusal in the panel's own words, and
// the read that hands an <img> one shared blob URL per picture, or null when it can't be shown.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES } from '@liveworkspace/media';
import { resetDisplayCacheForTests } from '@liveworkspace/workbench/lib/image-display';
import { __setOfflineBackend, offlinePutRecord } from '../offline/offline-store';
import { memBackend, testRecord } from '../offline/offline-test-utils';

const grants = vi.hoisted(() => ({ planGrant: vi.fn() }));
vi.mock('./plan-grants', async (importActual) => ({
  ...(await importActual<typeof import('./plan-grants')>()),
  planGrant: grants.planGrant,
  withPlanGrant: async (_base: string, _input: string, init?: RequestInit) => init,
}));

const {
  apiImageUrl,
  apiUploadImage,
  checkImageFile,
  IMAGE_ACCEPT,
  IMAGE_THUMB_EDGE,
  IMAGE_UPLOAD_MESSAGES,
  ImageUploadError,
  releaseImageUrl,
} = await import('./images');
const { API_BASE, setSessionSharePassword } = await import('./core');

const SCOPE = { ownerId: 'guest_me', projectId: 'p1', shareCode: null };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const png = (
  bytes: Uint8Array<ArrayBuffer> = PNG,
  name = 'Screenshot 9.41 PM.png',
  type = 'image/png',
) => new File([bytes], name, { type });

type Call = { url: string; init: RequestInit };
let calls: Call[];
let answer: () => Response;

// jsdom decodes no image: the size comes from a stand-in createImageBitmap, or a stand-in <img>.
function decodesAs(size: { width: number; height: number } | null) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => {
      if (!size) throw new Error('not an image');
      return { ...size, close: () => {} };
    }),
  );
}

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

beforeEach(() => {
  __setOfflineBackend(memBackend());
  resetDisplayCacheForTests();
  setSessionSharePassword(null);
  grants.planGrant.mockReset();
  grants.planGrant.mockResolvedValue({ grant: 'G1', level: 'edit', tabId: null, expiresAt: 9e12 });
  calls = [];
  answer = () =>
    Response.json({
      image: {
        id: 'img-1',
        contentType: 'image/png',
        byteSize: 7,
        width: 4,
        height: 3,
        createdAt: 1,
      },
      deduped: false,
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return answer();
    }),
  );
  decodesAs({ width: 4, height: 3 });
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  __setOfflineBackend(null);
});

describe('checkImageFile', () => {
  it('refuses another type, a file over 10 MB and an empty one, in the panel’s words', () => {
    const refused = (file: Blob) => {
      try {
        checkImageFile(file);
        return null;
      } catch (err) {
        expect(err).toBeInstanceOf(ImageUploadError);
        return (err as InstanceType<typeof ImageUploadError>).message;
      }
    };
    expect(refused(png(PNG, 'a.svg', 'image/svg+xml'))).toBe('Use a PNG, JPEG, WebP or GIF image.');
    expect(refused(png(new Uint8Array(MAX_IMAGE_BYTES + 1)))).toBe('That image is over 10 MB.');
    expect(refused(png(new Uint8Array()))).toBe(IMAGE_UPLOAD_MESSAGES.empty_file);
    expect(refused(png())).toBeNull();
    expect(IMAGE_ACCEPT).toBe('image/png,image/jpeg,image/webp,image/gif');
  });
});

describe('apiUploadImage', () => {
  it('uploads the bytes for the plan with its grant, size, hash and encoded name', async () => {
    const out = await apiUploadImage(SCOPE, png());
    expect(out).toMatchObject({ image: { id: 'img-1' }, deduped: false });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe(`${API_BASE}/images?p=p1`);
    expect(call!.init.method).toBe('POST');
    expect(header(call!, 'X-Index-Grant')).toBe('G1');
    expect(header(call!, 'Content-Type')).toBe('image/png');
    expect(header(call!, 'Content-Length')).toBe(String(PNG.byteLength));
    expect(header(call!, 'X-Image-Width')).toBe('4');
    expect(header(call!, 'X-Image-Height')).toBe('3');
    expect(header(call!, 'X-Image-Sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect(header(call!, 'X-Image-Original-Name')).toBe(
      encodeURIComponent('Screenshot 9.41 PM.png'),
    );
    expect(grants.planGrant).toHaveBeenCalledWith('p1', null);
  });

  it('asks the grant for the link it came in by, with its password, and sends no name for a nameless file', async () => {
    setSessionSharePassword('pw');
    grants.planGrant.mockResolvedValue(null);
    await apiUploadImage({ ...SCOPE, shareCode: 'C1' }, png(PNG, ''));
    expect(grants.planGrant).toHaveBeenCalledWith('p1', { code: 'C1', password: 'pw' });
    expect(header(calls[0]!, 'X-Share-Code')).toBe('C1');
    expect(header(calls[0]!, 'X-Index-Grant')).toBeNull();
    expect(header(calls[0]!, 'X-Image-Original-Name')).toBeNull();
  });

  it('names no plan for a This Browser plan, and asks no grant', async () => {
    await offlinePutRecord(testRecord({ id: 'p1' }));
    await apiUploadImage(SCOPE, png());
    expect(calls[0]!.url).toBe(`${API_BASE}/images`);
    expect(grants.planGrant).not.toHaveBeenCalled();
  });

  it('refuses before sending: a file the gate refuses, or one that does not decode', async () => {
    await expect(apiUploadImage(SCOPE, png(PNG, 'a.txt', 'text/plain'))).rejects.toMatchObject({
      code: 'unsupported_type',
    });
    decodesAs(null);
    await expect(apiUploadImage(SCOPE, png())).rejects.toMatchObject({
      code: 'unreadable',
      message: "That image can't be read.",
    });
    expect(calls).toEqual([]);
  });

  it('reads the size from an <img> where the browser has no createImageBitmap', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    let fails = false;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 640;
        naturalHeight = 480;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => (fails ? this.onerror?.() : this.onload?.()));
        }
      },
    );
    await apiUploadImage(SCOPE, png());
    expect(header(calls[0]!, 'X-Image-Width')).toBe('640');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    fails = true;
    await expect(apiUploadImage(SCOPE, png())).rejects.toMatchObject({ code: 'unreadable' });
  });

  it('words each refusal from the api as the panel shows it', async () => {
    const cases: [number, string, string][] = [
      [409, 'gallery_full', 'Your image gallery is full. Delete some images and try again.'],
      [503, 'images_unavailable', "Image uploads aren't available here."],
      [415, 'unsupported_type', 'Use a PNG, JPEG, WebP or GIF image.'],
      [413, 'file_too_large', 'That image is over 10 MB.'],
      [403, 'forbidden', IMAGE_UPLOAD_MESSAGES.upload_failed],
    ];
    for (const [status, error, message] of cases) {
      answer = () => Response.json({ error }, { status });
      await expect(apiUploadImage(SCOPE, png())).rejects.toMatchObject({ message });
    }
  });

  it('a network failure is a failed upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(apiUploadImage(SCOPE, png())).rejects.toMatchObject({ code: 'upload_failed' });
  });
});

describe('apiImageUrl', () => {
  beforeEach(() => {
    answer = () => new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
    // The shown copy is the picture itself where the browser can't decode one (image-display.ts).
    vi.stubGlobal('createImageBitmap', undefined);
  });

  it('reads the picture through the plan with its grant, once for every view of it', async () => {
    const [a, b] = await Promise.all([
      apiImageUrl(SCOPE, 'img 1', { maxEdge: IMAGE_THUMB_EDGE }),
      apiImageUrl(SCOPE, 'img 1', { maxEdge: IMAGE_THUMB_EDGE }),
    ]);
    expect(a).toMatch(/^blob:/);
    expect(b).toBe(a);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${API_BASE}/images/img%201?p=p1`);
    expect(header(calls[0]!, 'X-Index-Grant')).toBe('G1');
    releaseImageUrl(a!);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    releaseImageUrl(b!);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(a);
  });

  it('reads a This Browser plan’s picture as its uploader, naming no plan', async () => {
    await offlinePutRecord(testRecord({ id: 'p1' }));
    expect(await apiImageUrl(SCOPE, 'img-2')).toMatch(/^blob:/);
    expect(calls[0]!.url).toBe(`${API_BASE}/images/img-2`);
  });

  it('answers null when it cannot be shown, and asks again next time', async () => {
    answer = () => Response.json({ error: 'not_found' }, { status: 404 });
    expect(await apiImageUrl(SCOPE, 'gone')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await apiImageUrl(SCOPE, 'gone')).toBeNull();
  });
});
