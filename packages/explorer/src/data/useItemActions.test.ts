import { describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { createItemOverlay } from './overlay';
import { createItemActions } from './useItemActions';

function setup() {
  const item = makeItem(1);
  const index = createFakeIndex({ items: [item] });
  const overlay = createItemOverlay();
  const toast = { show: vi.fn(), error: vi.fn() };
  const reloadLists = vi.fn();
  const actions = createItemActions({ client: index.client, overlay, toast, reloadLists });
  return { item, index, overlay, toast, reloadLists, actions };
}

describe('item actions: optimistic, with rollback', () => {
  it('renames at once and keeps it when the index agrees', async () => {
    const { item, index, overlay, actions } = setup();
    const done = actions.rename(item, '  New name ');
    expect(overlay.apply(item).title).toBe('New name');
    await expect(done).resolves.toBe(true);
    expect(overlay.apply(item).title).toBe('New name');
    expect(index.calls.at(-1)).toEqual({
      method: 'updateItem',
      args: [item.id, { title: 'New name' }],
    });
  });

  it('takes a rename back and says why when the index refuses', async () => {
    const { item, index, overlay, toast, actions } = setup();
    index.fail.set('updateItem', new IndexError(403, 'forbidden'));
    const done = actions.rename(item, 'Nope');
    expect(overlay.apply(item).title).toBe('Nope');
    await expect(done).resolves.toBe(false);
    expect(overlay.apply(item).title).toBe('Item 1');
    expect(toast.error).toHaveBeenCalledWith('You can’t change that here.');
  });

  it('does not call the index for an unchanged or empty name', async () => {
    const { item, index, actions } = setup();
    await actions.rename(item, 'Item 1');
    await actions.rename(item, '   ');
    expect(index.count('updateItem')).toBe(0);
  });

  it('stars and unstars, rolling back a refused star', async () => {
    const { item, index, overlay, actions } = setup();
    await actions.setFavourite(item, true);
    expect(overlay.apply(item).favourite).toBe(true);
    expect(index.count('favourite')).toBe(1);

    index.fail.set('unfavourite', new IndexError(500, 'unknown'));
    const done = actions.setFavourite(overlay.apply(item), false);
    expect(overlay.apply(item).favourite).toBe(false);
    await done;
    expect(overlay.apply(item).favourite).toBe(true);
  });

  it('moves into a folder at once, sending the team only when it changes', async () => {
    const { item, index, overlay, actions } = setup();
    await actions.move(item, { folderId: 'f1', teamId: null });
    expect(overlay.apply(item).folderId).toBe('f1');
    expect(index.calls.at(-1)!.args).toEqual([item.id, { folderId: 'f1' }]);
    await actions.move(overlay.apply(item), { folderId: null, teamId: 'team-1' });
    expect(index.calls.at(-1)!.args).toEqual([item.id, { folderId: null, teamId: 'team-1' }]);
  });

  it('takes a refused move back to the old folder and team', async () => {
    const { item, index, overlay, actions } = setup();
    index.fail.set('updateItem', new IndexError(409, 'not_team_member'));
    await actions.move(item, { folderId: null, teamId: 'team-1' });
    expect(overlay.apply(item)).toMatchObject({ folderId: null, teamId: null });
  });

  it('trashes at once with an Undo that restores it', async () => {
    const { item, overlay, toast, actions } = setup();
    await actions.trash(item);
    expect(overlay.apply(item).trashedAt).not.toBeNull();
    const [, options] = toast.show.mock.calls[0]!;
    options.action.run();
    expect(overlay.apply(item).trashedAt).toBeNull();
  });

  it('leaves an item the host handles to the host: no index call, no patch', async () => {
    const { item, index, overlay, toast } = setup();
    const hostTrash = vi.fn((it: typeof item) =>
      it.id === item.id ? Promise.resolve(true) : null,
    );
    const actions = createItemActions({
      client: index.client,
      overlay,
      toast,
      reloadLists: vi.fn(),
      hostTrash,
    });
    await expect(actions.trash(item)).resolves.toBe(true);
    expect(hostTrash).toHaveBeenCalledWith(item);
    expect(index.count('deleteItem')).toBe(0);
    expect(overlay.apply(item).trashedAt).toBeFalsy();
  });

  it('says so when the host could not trash its item', async () => {
    const { item, index, overlay, toast } = setup();
    const actions = createItemActions({
      client: index.client,
      overlay,
      toast,
      reloadLists: vi.fn(),
      hostTrash: () => Promise.resolve(false),
    });
    await expect(actions.trash(item)).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('reloads the lists after a copy, which cannot be guessed', async () => {
    const { item, reloadLists, actions } = setup();
    const copy = await actions.duplicate(item, 'Item 1 (copy)');
    expect(copy?.title).toBe('Item 1 (copy)');
    expect(reloadLists).toHaveBeenCalledTimes(1);
  });
});

describe('item actions: what the toasts say', () => {
  it('names the item and where a move took it', async () => {
    const { item, index, overlay, toast, reloadLists } = setup();
    const actions = createItemActions({
      client: index.client,
      overlay,
      toast,
      reloadLists,
      placeName: (to) => (to.folderId ? 'Q3' : 'My Work'),
    });
    await actions.move(item, { folderId: 'f1', teamId: null });
    expect(toast.show.mock.calls.at(-1)![0]).toBe('Moved “\u2068Item 1\u2069” to \u2068Q3\u2069.');
    // Its Undo moves it back.
    toast.show.mock.calls.at(-1)![1].action.run();
    await vi.waitFor(() =>
      expect(index.calls.at(-1)).toEqual({
        method: 'updateItem',
        args: [item.id, { folderId: null }],
      }),
    );
    index.fail.set('updateItem', new IndexError(500, 'unknown'));
    await actions.move(item, { folderId: null, teamId: null });
    expect(toast.error).toHaveBeenLastCalledWith('Couldn’t move “\u2068Item 1\u2069”. Try again.');
  });

  it('isolates a name holding a bidi override, so the words after it still read forwards', async () => {
    const { item, toast, actions } = setup();
    await actions.trash({ ...item, title: 'Budget \u202eevil' });
    // The override stays inside FSI … PDI: " to the Trash." is not turned around.
    expect(toast.show.mock.calls.at(-1)![0]).toBe(
      'Moved “\u2068Budget \u202eevil\u2069” to the Trash.',
    );
  });

  it('offers Undo on a delete, and says the item is back once Undo restores it', async () => {
    const { item, toast, actions } = setup();
    await actions.trash(item);
    const [text, options] = toast.show.mock.calls.at(-1)!;
    expect(text).toBe('Moved “\u2068Item 1\u2069” to the Trash.');
    options.action.run();
    await vi.waitFor(() =>
      expect(toast.show).toHaveBeenLastCalledWith('“\u2068Item 1\u2069” restored.', {
        tone: 'success',
      }),
    );
  });

  it('says a failed restore left it in the Trash, and confirms a permanent delete', async () => {
    const { item, index, toast, actions } = setup();
    index.fail.set('restoreItem', new IndexError(500, 'unknown'));
    await actions.restore(item);
    expect(toast.error).toHaveBeenLastCalledWith(
      'Couldn’t restore “\u2068Item 1\u2069”. It is still in the Trash.',
    );
    await actions.purge(item);
    expect(toast.show).toHaveBeenLastCalledWith('“\u2068Item 1\u2069” deleted for good.');
  });
});
