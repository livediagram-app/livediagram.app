import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';

// An editor's upload with Pro on (liveworkspace/docs/specs/006-media/media.md "With Pro on"): a picked file passes up
// to what any tier takes, the item it is for travels with it, and the server's refusal reaches the picker with its
// numbers. With Pro off the cap, the words and the request are as they were.

vi.mock('./api-client', () => ({
  apiUploadImage: vi.fn(),
  ApiError: class ApiError extends Error {
    readonly status: number;
    readonly code: string | null;
    readonly body: unknown;
    constructor(action: string, status: number, code: string | null, body: unknown = null) {
      super(`${action} failed: ${status}`);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.body = body;
    }
  },
}));
vi.mock('./offline/offline-store', () => ({ isOfflineIdSync: () => false }));

import { ApiError, apiUploadImage } from './api-client';
import { addImageFileForDesign, ImageUploadError, uploadImageFile } from './upload-image';

const upload = vi.mocked(apiUploadImage);
const png = (size: number) =>
  new File([new Uint8Array(size)], 'site-plan.png', { type: 'image/png' });
const TEN_MIB = 10 * 1024 * 1024;

beforeEach(() => {
  setProForTests(true);
  upload.mockReset();
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      naturalWidth = 4;
      naturalHeight = 3;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
  );
});
afterEach(() => {
  setProForTests(null);
  vi.unstubAllGlobals();
});

describe('an upload with Pro on', () => {
  it('lets a file past the old cap through, naming the item it is for', async () => {
    upload.mockResolvedValue({ image: { id: 'i1' }, deduped: false } as never);
    await addImageFileForDesign('user_a', 'design-1', png(TEN_MIB + 1));
    expect(upload).toHaveBeenCalledWith('user_a', expect.objectContaining({ itemId: 'design-1' }));
    await uploadImageFile('user_a', png(8));
    expect(upload).toHaveBeenLastCalledWith('user_a', expect.objectContaining({ itemId: null }));
  });

  it('stops a file no tier takes before it is read', async () => {
    await expect(uploadImageFile('user_a', png(25_000_001))).rejects.toThrow(
      'That image is over 25 MB, the largest that can be uploaded.',
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it('hands the picker the limit the server said, in the server’s numbers', async () => {
    upload.mockRejectedValue(
      new ApiError('upload image', 413, 'file_too_large', {
        error: 'file_too_large',
        limitBytes: 5_000_000,
        limit: 5_000_000,
        current: 7_200_000,
        owner: 'p:user_a',
      }),
    );
    const refused = await uploadImageFile('user_a', png(8)).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ImageUploadError);
    expect((refused as ImageUploadError).limit).toEqual({
      kind: 'too_large',
      limit: 5_000_000,
      current: 7_200_000,
      owner: 'p:user_a',
    });
    expect((refused as ImageUploadError).message).toBe(
      'This image is over 5 MB, the largest that can be uploaded here.',
    );
  });
});

describe('an upload with Pro off', () => {
  beforeEach(() => setProForTests(false));

  it('keeps the 10 MB cap and its words, and reads no limit from a refusal', async () => {
    await expect(uploadImageFile('user_a', png(TEN_MIB + 1))).rejects.toThrow(
      'Too large. Limit is 10 MB.',
    );
    upload.mockRejectedValue(
      new ApiError('upload image', 413, 'file_too_large', {
        error: 'file_too_large',
        limitBytes: TEN_MIB,
      }),
    );
    const refused = await uploadImageFile('user_a', png(8)).catch((e: unknown) => e);
    expect((refused as ImageUploadError).limit).toBeNull();
    expect((refused as ImageUploadError).message).toBe('Too large. Limit is 10 MB.');
  });
});
