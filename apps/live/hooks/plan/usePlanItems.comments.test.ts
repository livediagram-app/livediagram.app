// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentThread } from '@livediagram/document';
import type { Item } from '@livediagram/items';

// A card's comments in the editor (docs/specs/026-plan/items.md "Comments"): shown at once, settled on the
// api's answer, our own author ids kept when the room's copy lands, a refusal said and the store refetched.

const api = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  writeItem: vi.fn(),
  writeItemComment: vi.fn(),
}));
vi.mock('@/lib/api/items', () => api);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { usePlanItems } from './usePlanItems';

const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const card = (fields: Item['fields'] = { title: 'A' }, rev = 1): Item => ({
  id: 'item-one',
  type: 'task',
  key: 1,
  rank: 'i',
  fields,
  rev,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const thread = (item: Item | undefined) => item?.fields['comments'] as unknown as CommentThread;

function setup() {
  const onError = vi.fn();
  const hook = renderHook(() =>
    usePlanItems({
      documentId: 'doc',
      ready: true,
      ownerId: 'owner-me',
      name: 'Me',
      color: '#2563eb',
      shareCode: null,
      tabScope: null,
      pushUndo: () => {},
      onError,
    }),
  );
  return { ...hook, onError };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchItems.mockResolvedValue({ items: [card()], rev: 1, nextKey: 2 });
});

describe('usePlanItems comments', () => {
  it('shows a new comment at once and settles on the answer', async () => {
    const stored = card(
      {
        title: 'A',
        comments: {
          comments: [
            {
              id: 'srv',
              text: 'Hi',
              createdAt: 1,
              authorName: 'Me',
              authorColor: '#2563eb',
              authorId: 'owner-me',
            },
          ],
          resolved: false,
        },
      },
      2,
    );
    let answer!: (v: unknown) => void;
    api.writeItemComment.mockReturnValue(new Promise((r) => (answer = r)));
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.self).not.toBeNull());
    let done!: Promise<boolean>;
    act(() => {
      done = result.current.comment('item-one', { kind: 'add', text: 'Hi' });
    });
    // Shown before the api answers, as this person wrote it.
    expect(thread(result.current.items.get('item-one')).comments[0]).toMatchObject({
      text: 'Hi',
      authorId: 'owner-me',
    });
    expect(track).toHaveBeenCalledWith('Comment', 'Added', 'Item');
    await act(async () => {
      answer({ upserts: [stored], removed: [], rev: 2 });
      expect(await done).toBe(true);
    });
    expect(thread(result.current.items.get('item-one')).comments.map((c) => c.id)).toEqual(['srv']);
    expect(api.writeItemComment).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc' }),
      'item-one',
      { kind: 'add', text: 'Hi' },
      expect.objectContaining({ ownerId: 'owner-me' }),
    );
  });

  it('keeps our own author id when the room’s copy lands after the answer', async () => {
    const mine = {
      id: 'srv',
      text: 'Hi',
      createdAt: 1,
      authorName: 'Me',
      authorColor: '#2563eb',
    };
    api.fetchItems.mockResolvedValue({
      items: [
        card(
          {
            title: 'A',
            comments: { comments: [{ ...mine, authorId: 'owner-me' }], resolved: false },
          },
          2,
        ),
      ],
      rev: 2,
      nextKey: 2,
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() =>
      result.current.receive({
        kind: 'items',
        upserts: [card({ title: 'B', comments: { comments: [mine], resolved: false } }, 3)],
        removed: [],
        rev: 3,
      }),
    );
    const now = result.current.items.get('item-one')!;
    expect(now.fields['title']).toBe('B');
    expect(thread(now).comments[0]!.authorId).toBe('owner-me');
  });

  it('says a refusal, refetches, and tracks deletes and resolves', async () => {
    api.writeItemComment.mockRejectedValueOnce(
      Object.assign(new Error('full'), { code: 'comments_full' }),
    );
    const { result, onError } = setup();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.self).not.toBeNull());
    await act(async () => {
      expect(await result.current.comment('item-one', { kind: 'add', text: 'x' })).toBe(false);
    });
    expect(onError).toHaveBeenCalledWith('This card holds the most comments it can');
    await waitFor(() => expect(api.fetchItems).toHaveBeenCalledTimes(2));
    api.writeItemComment.mockRejectedValueOnce(new Error('down'));
    await act(async () => {
      await result.current.comment('item-one', { kind: 'delete', commentId: 'c1' });
    });
    expect(onError).toHaveBeenLastCalledWith("Couldn't save that comment");
    api.writeItemComment.mockResolvedValue(null);
    await act(async () => {
      expect(await result.current.comment('item-one', { kind: 'resolve', resolved: true })).toBe(
        true,
      );
      await result.current.comment('item-one', { kind: 'resolve', resolved: false });
    });
    expect(track).toHaveBeenCalledWith('Comment', 'Deleted', 'Item');
    expect(track).toHaveBeenCalledWith('Comment', 'Resolved', 'Item');
    expect(track).toHaveBeenCalledWith('Comment', 'Unresolved', 'Item');
    expect(result.current.ownerId).toBe('owner-me');
  });
});
