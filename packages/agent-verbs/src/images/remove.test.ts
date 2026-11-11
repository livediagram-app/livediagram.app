import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import { fakeApi } from '../testing/product';
import { IMAGE_REMOVE_MAX, removeFromGallery, usedInText } from './remove';

const image = (id: string, originalName?: string) => ({
  id,
  contentType: 'image/png',
  byteSize: 10,
  width: 4,
  height: 3,
  ...(originalName ? { originalName } : {}),
  createdAt: 1,
});

const USE = { id: 'doc-1', name: 'Q3 plan', app: 'livedocuments' };

// The caller's gallery: `mine` unused, `placed` on one of their items. Deletes recorded, answered as `deletes` says.
function gallery(deletes: Record<string, number> = {}) {
  const deleted: string[] = [];
  const api = fakeApi({
    '/images': { images: [image('mine', 'Logo.png'), image('placed', 'Hero.png')] },
    '/images/usage': { usage: { placed: [USE] } },
    '/images/mine': (request: Request) => {
      deleted.push(`${request.method} mine`);
      return Response.json({ ok: true }, { status: deletes.mine ?? 200 });
    },
    '/images/placed': (request: Request) => {
      deleted.push(`${request.method} placed`);
      return Response.json({ ok: true }, { status: deletes.placed ?? 200 });
    },
  });
  return { api, deleted };
}

describe('removeFromGallery', () => {
  it('removes an unused picture of the caller’s, keeps a placed one, and finds no one else’s', async () => {
    const { api, deleted } = gallery();
    const report = await removeFromGallery(api, ['mine', 'placed', 'theirs', 'mine'], {
      force: false,
    });
    expect(report).toEqual({
      results: [
        { id: 'mine', outcome: 'deleted', name: 'Logo.png' },
        { id: 'placed', outcome: 'in_use', name: 'Hero.png', usedIn: [USE] },
        { id: 'theirs', outcome: 'not_found' },
      ],
      deleted: 1,
      kept: 2,
    });
    // Only the caller's own unused picture reached the api's delete; the gallery and its usage were read once.
    expect(deleted).toEqual(['DELETE mine']);
    expect(api.calls.filter((c) => c === '/images' || c === '/images/usage')).toHaveLength(2);
  });

  it('removes a placed picture when forced, saying where it was used', async () => {
    const { api, deleted } = gallery();
    const report = await removeFromGallery(api, ['placed'], { force: true });
    expect(report.results).toEqual([
      { id: 'placed', outcome: 'deleted', name: 'Hero.png', usedIn: [USE] },
    ]);
    expect(deleted).toEqual(['DELETE placed']);
  });

  it('answers a picture gone between the listing and the delete as not found, and lets other failures through', async () => {
    expect(
      (await removeFromGallery(gallery({ mine: 404 }).api, ['mine'], { force: false })).results,
    ).toEqual([{ id: 'mine', outcome: 'not_found' }]);
    await expect(
      removeFromGallery(gallery({ mine: 403 }).api, ['mine'], { force: false }),
    ).rejects.toThrow('api 403');
  });

  it('reads an empty gallery and usage as none', async () => {
    const api = fakeApi({ '/images': {}, '/images/usage': {} });
    expect(await removeFromGallery(api, ['x'], { force: false })).toEqual({
      results: [{ id: 'x', outcome: 'not_found' }],
      deleted: 0,
      kept: 1,
    });
  });

  it('takes 1 to IMAGE_REMOVE_MAX ids a call', async () => {
    const { api } = gallery();
    for (const ids of [[], Array.from({ length: IMAGE_REMOVE_MAX + 1 }, (_, i) => `i${i}`)]) {
      await expect(removeFromGallery(api, ids, { force: false })).rejects.toBeInstanceOf(
        VerbRefusal,
      );
    }
  });
});

describe('usedInText', () => {
  it('names the items, with their apps, and counts the rest', () => {
    expect(usedInText([USE, { id: 'd2', name: '', app: 'livediagram' }])).toBe(
      '"Q3 plan" (livedocuments), "Untitled" (livediagram)',
    );
    expect(usedInText([USE, USE, USE], 2)).toBe(
      '"Q3 plan" (livedocuments), "Q3 plan" (livedocuments) and 1 more',
    );
  });
});
