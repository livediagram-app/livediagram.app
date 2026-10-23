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
    const hostTrash = vi.fn((it: typeof item) => (it.id === item.id ? Promise.resolve(true) : null));
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
