// The host's verbs on an item's menu (an app's Take Offline and Sync, say), before the destructive ones.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import type { ItemMenuHost } from './types';

function page(itemMenu?: ItemMenuHost) {
  render(
    <Explorer
      app="liveplanner"
      client={createFakeIndex({ items: [makeItem(1)] }).client}
      view={{ kind: 'all' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      {...(itemMenu ? { itemMenu } : {})}
    />,
  );
}

const openMenu = async () =>
  fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 1' }))[0]!);

describe("The host's verbs on an item's menu", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('liveworkspace:explorer-view-mode', 'details');
  });

  it('adds them before Delete, for that item, and runs one on select', async () => {
    const takeOffline = vi.fn();
    const itemMenu = vi.fn<ItemMenuHost>(() => [
      { id: 'offline', label: 'Take Offline', onSelect: takeOffline },
    ]);
    page(itemMenu);
    await openMenu();
    const rows = (await screen.findAllByRole('menuitem')).map((r) => r.textContent);
    const at = rows.indexOf('Take Offline');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(rows.findIndex((r) => r?.startsWith('Delete')));
    expect(itemMenu).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Take Offline' }));
    expect(takeOffline).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull();
  });

  it('adds none without a host', async () => {
    page();
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Take Offline' })).toBeNull();
  });
});
