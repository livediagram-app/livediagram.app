// Recent: the 12 most recently opened, under a Home › Recent breadcrumb, and Hide from Recent / Show in Recent
// from any item's menu (liveplanner/docs/specs/013-workspace/hide-from-recent.md).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';

function page(index: ReturnType<typeof createFakeIndex>, view: ExplorerView) {
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(item) => `/plan/${item.id}`}
      onCreate={() => {}}
      viewerId="user_me"
      heroHidden
    />,
  );
  return onNavigate;
}

const titles = () =>
  [...document.querySelectorAll('[data-item-row] a')].map((a) => a.textContent ?? '');

async function choose(menuName: string, action: string) {
  fireEvent.click((await screen.findAllByRole('button', { name: menuName }))[0]!);
  fireEvent.click(await screen.findByRole('menuitem', { name: action }));
}

describe('Recent', () => {
  beforeEach(() => localStorage.setItem('liveworkspace:explorer-view-mode', 'list'));

  it('lists the 12 latest opened; hiding one lets the next in, and the index hears it', async () => {
    const items = Array.from({ length: 14 }, (_, i) =>
      makeItem(i + 1, { lastOpenedAt: 1_000_000 - i }),
    );
    const index = createFakeIndex({ items });
    page(index, { kind: 'recent' });
    await waitFor(() => expect(titles()).toHaveLength(12));
    expect(titles()).not.toContain('Item 13');
    await choose('Menu for Item 1', 'Hide from Recent');
    await waitFor(() => expect(titles()).not.toContain('Item 1'));
    expect(titles()).toHaveLength(12);
    expect(titles()).toContain('Item 13');
    expect(index.calls.some((c) => c.method === 'hideFromRecent' && c.args[0] === 'item-1')).toBe(
      true,
    );
  });

  it('leads back to Home', async () => {
    const onNavigate = page(createFakeIndex(), { kind: 'recent' });
    const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    fireEvent.click(within(crumbs).getByRole('button', { name: 'Home' }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'home' }, '/explorer/home');
  });

  it('offers Show in Recent on an item hidden from it, and leaves it everywhere else', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { lastOpenedAt: 5, hiddenFromRecent: true })],
    });
    page(index, { kind: 'all' });
    await waitFor(() => expect(titles()).toEqual(['Item 1']));
    await choose('Menu for Item 1', 'Show in Recent');
    await waitFor(() => expect(index.calls.some((c) => c.method === 'showInRecent')).toBe(true));
  });
});
