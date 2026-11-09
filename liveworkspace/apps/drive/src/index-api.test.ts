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
