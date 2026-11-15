// The index's reads for a read of what changed (liveworkspace/docs/specs/005-drive/drive.md "Cadence", "The picture"):
// the live items asked with `since` beside every folder and the whole Trash, and one item read on its own.
import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import { createIndexApi } from './index-api';

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  app: 'livediagram',
  title: `Item ${id}`,
  folderId: null,
  teamId: null,
  trashedAt: null,
  sharedVia: null,
  createdAt: 1,
  updatedAt: 2,
  ...extra,
});

function indexOf(answer: (url: URL) => Response): { env: Env; urls: URL[] } {
  const urls: URL[] = [];
  const env = {
    INDEX_KEY_DRIVE: 'index-drive-key',
    INDEX: {
      fetch: async (input: RequestInfo | URL) => {
        const url = new URL(String(input instanceof Request ? input.url : input));
        urls.push(url);
        return answer(url);
      },
    },
  } as unknown as Env;
  return { env, urls };
}

describe('a read of what changed', () => {
  it('asks the live items with since, and every folder and the whole Trash without it', async () => {
    const { env, urls } = indexOf((url) =>
      Response.json(
        url.pathname.endsWith('/folders')
          ? { folders: [], nextCursor: null }
          : { items: url.pathname.endsWith('/items') ? [item('a')] : [], nextCursor: null },
      ),
    );
    const picture = await createIndexApi(env).forPerson('user_ada').changedSince(1234);
    expect(picture.items.map((i) => i.id)).toEqual(['a']);
    const since = Object.fromEntries(
      urls.map((u) => [u.pathname.split('/').pop(), u.searchParams.get('since')]),
    );
    expect(since).toEqual({ items: '1234', folders: null, trash: null });
  });

  it('reads one item: live and their own, else null when gone, not theirs, or trashed', async () => {
    const answers: Record<string, Response | (() => Response)> = {
      live: () => Response.json({ item: item('live') }),
      binned: () => Response.json({ item: item('binned', { trashedAt: 5 }) }),
      gone: () => Response.json({ error: 'not_found' }, { status: 404 }),
      broken: () => Response.json({ error: 'internal' }, { status: 500 }),
    };
    const { env } = indexOf((url) => {
      const answer = answers[url.pathname.split('/').pop()!]!;
      return typeof answer === 'function' ? answer() : answer;
    });
    const index = createIndexApi(env).forPerson('user_ada');
    expect(await index.readItem('live')).toMatchObject({ id: 'live', name: 'Item live' });
    expect(await index.readItem('binned')).toBeNull();
    expect(await index.readItem('gone')).toBeNull();
    await expect(index.readItem('broken')).rejects.toThrow();
  });
});

// Work Tracker 425: a whole read that spans passes reads one page of one list at a time, from the cursor it kept.
describe('a page of the picture', () => {
  it("reads one page of each list from its cursor, filtered to the person's own work", async () => {
    const { env, urls } = indexOf((url) => {
      const list = url.pathname.split('/').pop();
      if (list === 'folders')
        return Response.json({
          folders: [
            { id: 'f', name: 'Work', parentId: null, teamId: null, updatedAt: 3 },
            { id: 'tf', name: 'Team', parentId: null, teamId: 'team1', updatedAt: 3 },
          ],
          nextCursor: null,
        });
      if (list === 'trash')
        return Response.json({
          items: [item('t', { trashedAt: 9 }), item('x', { trashedAt: 9, app: 'other' })],
          nextCursor: '',
        });
      return Response.json({
        items: [item('a'), item('shared', { sharedVia: 'link' })],
        nextCursor: 'next-page',
      });
    });
    const index = createIndexApi(env).forPerson('user_ada');
    const items = await index.picturePage('items', 'from-here');
    expect(items).toEqual({
      picture: {
        items: [
          {
            id: 'a',
            app: 'livediagram',
            name: 'Item a',
            folderId: null,
            updatedAt: 2,
            createdAt: 1,
          },
        ],
        folders: [],
        trash: [],
      },
      nextCursor: 'next-page',
    });
    expect(urls[0]!.searchParams.get('cursor')).toBe('from-here');
    expect(urls[0]!.searchParams.get('since')).toBeNull();
    const folders = await index.picturePage('folders', null);
    expect(folders.picture.folders).toEqual([
      { id: 'f', name: 'Work', parentId: null, updatedAt: 3 },
    ]);
    expect(folders.nextCursor).toBeNull();
    expect(urls[1]!.searchParams.has('cursor')).toBe(false);
    // An empty cursor ends the list, as null does.
    const trash = await index.picturePage('trash', null);
    expect(trash).toEqual({
      picture: {
        items: [],
        folders: [],
        trash: [{ id: 't', app: 'livediagram', name: 'Item t', trashedAt: 9 }],
      },
      nextCursor: null,
    });
  });
});
