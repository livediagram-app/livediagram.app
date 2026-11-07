// A picture handed to the canvas (docs/specs/009-elements/images.md "Paste and drop").
import { describe, expect, it, vi } from 'vitest';
import {
  PLACED_IMAGE_MAX_PX,
  isImageFile,
  namedPastedFile,
  pastedImageFile,
  pasteHoldsFile,
  placedImage,
  uploadImageFile,
} from './image-file-place';

const upload = vi.hoisted(() => ({ addImageFileForDocument: vi.fn() }));
vi.mock('@/lib/upload-image', () => upload);

const file = (name: string, type: string) => new File(['x'], name, { type });
const transfer = (files: File[], items?: unknown[]) =>
  ({ files, items }) as unknown as DataTransfer;

describe('placedImage', () => {
  it('keeps a square picture square at the cap, centred, with no alt when the file had no name', () => {
    const el = placedImage({ id: 'a', width: 50, height: 50 }, { x: 0, y: 0 });
    expect(el).toMatchObject({
      type: 'image',
      imageId: 'a',
      width: PLACED_IMAGE_MAX_PX,
      height: PLACED_IMAGE_MAX_PX,
      x: -120,
      y: -120,
      aspectLocked: true,
    });
    expect(el).not.toHaveProperty('alt');
  });
});

describe('namedPastedFile', () => {
  it('keeps a real name, and names a nameless or "image.png" paste after the moment and its type', () => {
    const real = file('logo.svg', 'image/svg+xml');
    expect(namedPastedFile(real)).toBe(real);
    expect(namedPastedFile(file('image.png', 'image/png'), 7).name).toBe('pasted-7.png');
    expect(namedPastedFile(file('', 'image/webp'), 8).name).toBe('pasted-8.webp');
    // A type the clipboard dropped still gets an extension.
    expect(namedPastedFile(file('', ''), 9).name).toBe('pasted-9.png');
    expect(namedPastedFile(file('', 'image/jpeg')).name).toMatch(/^pasted-\d+\.jpeg$/);
  });
});

describe('which picture a paste carries', () => {
  it('takes the first image file over any other file', () => {
    const png = file('a.png', 'image/png');
    expect(pastedImageFile(transfer([file('n.txt', 'text/plain'), png]))).toBe(png);
  });

  it('finds none in no paste, a paste with no items list, or only other kinds of file', () => {
    expect(pastedImageFile(null)).toBeNull();
    expect(pastedImageFile(transfer([]))).toBeNull();
    expect(
      pastedImageFile(
        transfer(
          [],
          [
            { kind: 'file', type: 'text/plain', getAsFile: () => file('n.txt', 'text/plain') },
            { kind: 'file', type: 'image/png', getAsFile: () => null },
          ],
        ),
      ),
    ).toBeNull();
  });

  it('says whether a paste holds a file at all', () => {
    expect(pasteHoldsFile(null)).toBe(false);
    expect(pasteHoldsFile(transfer([]))).toBe(false);
    expect(pasteHoldsFile(transfer([file('n.txt', 'text/plain')]))).toBe(true);
    expect(pasteHoldsFile(transfer([], [{ kind: 'file' }]))).toBe(true);
    expect(pasteHoldsFile(transfer([], [{ kind: 'string' }]))).toBe(false);
  });

  it('tells a picture by its type', () => {
    expect(isImageFile({ type: 'image/gif' })).toBe(true);
    expect(isImageFile({ type: 'application/pdf' })).toBe(false);
  });
});

describe('uploadImageFile', () => {
  it('hands back the uploaded picture, its name only when it had one', async () => {
    upload.addImageFileForDocument.mockResolvedValueOnce({
      image: { id: 'i1', width: 10, height: 20, originalName: 'a.png', byteSize: 1 },
    });
    await expect(uploadImageFile('o', 'd', file('a.png', 'image/png'))).resolves.toEqual({
      id: 'i1',
      width: 10,
      height: 20,
      originalName: 'a.png',
    });
    upload.addImageFileForDocument.mockResolvedValueOnce({
      image: { id: 'i2', width: 1, height: 1 },
    });
    await expect(uploadImageFile('o', null, file('', 'image/png'))).resolves.toEqual({
      id: 'i2',
      width: 1,
      height: 1,
    });
    expect(upload.addImageFileForDocument).toHaveBeenLastCalledWith('o', null, expect.any(File));
  });
});
