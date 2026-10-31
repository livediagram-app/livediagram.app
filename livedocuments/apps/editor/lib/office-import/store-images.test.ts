import { describe, expect, it, vi } from 'vitest';
import type { ImportImageSession } from '../import-images';
import { OfficeImportError } from './errors';
import { pictureMimeType, storePictures } from './store-images';

const picture = (path: string) => ({ path, widthPx: 100, heightPx: 50 });

function fakeSession(): ImportImageSession & { store: ReturnType<typeof vi.fn> } {
  let n = 0;
  return {
    store: vi.fn(async (source: Parameters<ImportImageSession['store']>[0]) => {
      n += 1;
      expect(source.kind).toBe('blob');
      return {
        ok: true as const,
        imageId: `img-${n}`,
        width: 10,
        height: 5,
        kind: 'uploaded' as const,
      };
    }),
  };
}

describe('storePictures', () => {
  it('stores each picture part once, with its type and size, reporting progress', async () => {
    const session = fakeSession();
    const read = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const progress: [number, number][] = [];
    const out = await storePictures(
      { readBytes: read },
      [picture('word/media/a.png'), picture('word/media/b.JPG'), picture('Word/Media/A.png')],
      session,
      (done, total) => progress.push([done, total]),
    );
    expect(read).toHaveBeenCalledTimes(2);
    expect(session.store).toHaveBeenCalledTimes(2);
    const [source, hint] = session.store.mock.calls[1]!;
    expect((source as { blob: Blob }).blob.type).toBe('image/jpeg');
    expect((source as { name: string }).name).toBe('b.JPG');
    expect(hint).toEqual({ width: 100, height: 50 });
    expect([...out.keys()]).toEqual(['word/media/a.png', 'word/media/b.jpg']);
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('names a missing part, an unreadable one and one too large, and gives no hint without a size', async () => {
    const session = fakeSession();
    const out = await storePictures(
      {
        readBytes: async (path) => {
          if (path.endsWith('gone.png')) return null;
          if (path.endsWith('big.png')) throw new OfficeImportError('unpacks-too-large');
          if (path.endsWith('bad.png')) throw new OfficeImportError('not-a-package');
          return new Uint8Array([1]);
        },
      },
      [
        picture('gone.png'),
        picture('big.png'),
        picture('bad.png'),
        { path: 'ok.emf', widthPx: 0, heightPx: 0 },
      ],
      session,
    );
    expect(out.get('gone.png')).toEqual({ ok: false, failure: 'missing-bytes' });
    expect(out.get('big.png')).toEqual({ ok: false, failure: 'too-large' });
    expect(out.get('bad.png')).toEqual({ ok: false, failure: 'missing-bytes' });
    expect(session.store.mock.calls[0]![1]).toBeUndefined();
  });

  it('stores at most 100, the rest over the cap, never more than three at once', async () => {
    let inFlight = 0;
    let most = 0;
    const session: ImportImageSession = {
      store: async () => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        return { ok: true, imageId: 'x', width: 1, height: 1, kind: 'uploaded' };
      },
    };
    const pictures = Array.from({ length: 103 }, (_, i) => picture(`m/${i}.png`));
    const out = await storePictures(
      { readBytes: async () => new Uint8Array([1]) },
      pictures,
      session,
    );
    expect([...out.values()].filter((o) => o === 'over-cap')).toHaveLength(3);
    expect(most).toBe(3);
  });

  it('knows picture types by extension', () => {
    expect(pictureMimeType('a.svg')).toBe('image/svg+xml');
    expect(pictureMimeType('a.wmf')).toBe('image/x-wmf');
    expect(pictureMimeType('noext')).toBe('application/octet-stream');
  });
});
