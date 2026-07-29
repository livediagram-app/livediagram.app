import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the api-client boundary BEFORE importing the module under
// test so the dynamic apiUploadImage import resolves to the spy.
// The whole module is mocked because pulling in the real
// api-client drags fetch + dedupe state we don't want in a pure
// unit test.
vi.mock('./api-client', () => ({
  apiUploadImage: vi.fn(),
  // Stand-in for the real ApiError (lib/api/core.ts): same shape so
  // `e instanceof ApiError` + `e.code` in uploadImageFile work under
  // the mock. Lets us exercise the error-token → friendly-message map
  // without dragging the real fetch/dedupe plumbing in.
  ApiError: class ApiError extends Error {
    readonly status: number;
    readonly code: string | null;
    constructor(action: string, status: number, code: string | null) {
      super(`${action} failed: ${status}`);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  },
}));

import { ApiError, apiUploadImage } from './api-client';
import { ImageUploadError, UPLOAD_MAX_BYTES, uploadImageFile } from './upload-image';

const apiUploadImageMock = vi.mocked(apiUploadImage);

// Minimal stub for the global `Image` constructor: readImageDimensions
// listens for `onload` to resolve width/height. The fake fires
// onload on the next microtask so the surrounding promise machinery
// works the same way it does in a real browser.
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(_url: string) {
    // Queue the load so subscribers can attach their handlers
    // before we fire (matches HTMLImageElement scheduling).
    queueMicrotask(() => this.onload?.());
  }
}

// Likewise, URL.createObjectURL doesn't exist in the Node test env
// by default. Stub it (and the matching revoke) so the dimension
// reader's lifecycle calls don't throw. The exact URL value doesn't
// matter; FakeImage ignores it.
function stubBrowserGlobals(opts: { width: number; height: number }) {
  // A real class rather than `vi.fn(() => …)`. The code under test does
  // `new Image()`, and an arrow function is not a constructor: vitest 3
  // happened to wrap mock implementations in a constructible function, so
  // returning an object from one worked; vitest 4 does not, and `new` on the
  // arrow throws. A subclass carrying this test's dimensions is what the stub
  // always meant anyway.
  vi.stubGlobal(
    'Image',
    class StubImage extends FakeImage {
      override naturalWidth = opts.width;
      override naturalHeight = opts.height;
    },
  );
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });
}

function makeFile(bytes: number[], type: string, name = 'pic.png'): File {
  return new File([new Uint8Array(bytes).buffer], name, { type });
}

beforeEach(() => {
  stubBrowserGlobals({ width: 640, height: 480 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('uploadImageFile, validation', () => {
  it('rejects an unsupported MIME type with a security-flavoured message (SVG, plain text, etc.)', async () => {
    const file = makeFile([0x3c, 0x73, 0x76, 0x67], 'image/svg+xml', 'evil.svg');
    const err = await uploadImageFile('owner-a', file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImageUploadError);
    expect((err as ImageUploadError).message).toContain('SVG is rejected for security');
    expect(apiUploadImageMock).not.toHaveBeenCalled();
  });

  it('rejects a file exceeding UPLOAD_MAX_BYTES so the picker never POSTs an oversized body', async () => {
    // Forge a File whose `size` exceeds the cap without actually
    // allocating 10 MB of bytes. `Object.defineProperty` overrides
    // the read-only `size` getter that File's constructor sets.
    const file = makeFile([1, 2, 3], 'image/png');
    Object.defineProperty(file, 'size', { value: UPLOAD_MAX_BYTES + 1 });
    const err = await uploadImageFile('owner-a', file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImageUploadError);
    expect((err as ImageUploadError).message).toContain(
      `Limit is ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB`,
    );
    expect(apiUploadImageMock).not.toHaveBeenCalled();
  });

  it('rejects an empty file (size === 0) before any hashing happens', async () => {
    const file = makeFile([], 'image/png');
    Object.defineProperty(file, 'size', { value: 0 });
    const err = await uploadImageFile('owner-a', file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImageUploadError);
    expect((err as ImageUploadError).message).toBe('Empty file.');
    expect(apiUploadImageMock).not.toHaveBeenCalled();
  });
});

describe('uploadImageFile, happy path', () => {
  it('hashes the bytes with SHA-256, reads dimensions, and forwards everything to apiUploadImage', async () => {
    apiUploadImageMock.mockResolvedValueOnce({
      image: {
        id: 'img-1',
        contentType: 'image/png',
        byteSize: 8,
        width: 640,
        height: 480,
        originalName: 'pic.png',
        createdAt: 1,
      },
      deduped: false,
    });

    // Eight bytes whose SHA-256 is well-known so the call can
    // assert the exact hex digest. crypto.subtle.digest is
    // available in Node 22+ via the same Web Crypto API the
    // browser exposes.
    const file = makeFile([0, 1, 2, 3, 4, 5, 6, 7], 'image/png');
    const result = await uploadImageFile('owner-a', file);

    expect(result.image.id).toBe('img-1');
    expect(apiUploadImageMock).toHaveBeenCalledTimes(1);
    const [ownerArg, fileArg] = apiUploadImageMock.mock.calls[0]!;
    expect(ownerArg).toBe('owner-a');
    expect(fileArg.contentType).toBe('image/png');
    expect(fileArg.width).toBe(640);
    expect(fileArg.height).toBe(480);
    expect(fileArg.originalName).toBe('pic.png');
    // The hex digest must be a 64-char string of hex chars: the
    // exact hash isn't what matters here, the question is "did we
    // actually run bytes through crypto.subtle and forward the
    // result?" Format + length catches a future bug where the
    // hash got truncated, double-encoded, or skipped.
    expect(fileArg.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Bytes round-trip into the request.
    expect(fileArg.bytes.byteLength).toBe(8);
  });

  it('wraps a thrown apiUploadImage error in ImageUploadError so callers can render the message inline', async () => {
    apiUploadImageMock.mockRejectedValue(new Error('upload image failed: 413'));
    const file = makeFile([1, 2, 3, 4], 'image/png');
    const err = await uploadImageFile('owner-a', file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImageUploadError);
    expect((err as ImageUploadError).message).toContain('413');
  });

  it('maps a gallery_full ApiError token to the friendly cap message (the payoff of surfacing error codes)', async () => {
    // The client-side gate can't see the per-owner gallery cap
    // (spec/19) — only the server knows. Now that ApiError carries the
    // worker's snake_case error token, uploadImageFile turns it into a
    // human message instead of a raw "failed: 403".
    apiUploadImageMock.mockRejectedValue(new ApiError('upload image', 403, 'gallery_full'));
    const file = makeFile([1, 2, 3, 4], 'image/png');
    const err = await uploadImageFile('owner-a', file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImageUploadError);
    expect((err as ImageUploadError).message).toContain('gallery is full');
  });

  it('returns null-dimension failure as a friendly ImageUploadError, not as a thrown raw error', async () => {
    // Override the global Image to fire onerror instead of onload
    // so readImageDimensions resolves null.
    // A class for the same reason as the happy-path stub: `new Image()` needs
    // a constructor, which an arrow function is not.
    vi.stubGlobal(
      'Image',
      class FailingImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const file = makeFile([1, 2, 3, 4], 'image/png');
    const err = await uploadImageFile('owner-a', file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImageUploadError);
    expect((err as ImageUploadError).message).toBe('Could not read image dimensions.');
    expect(apiUploadImageMock).not.toHaveBeenCalled();
  });
});
