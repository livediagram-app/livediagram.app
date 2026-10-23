// Rename from every place an item's menu offers it: Details rows, Home's cards, and the panel's current card
// (whose new title the host's editor follows).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { ExplorerPanel } from '../panel/ExplorerPanel';
import { Explorer } from './Explorer';
import type { ExplorerView } from '../views';

function page(index: ReturnType<typeof createFakeIndex>, view: ExplorerView) {
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={view}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
    />,
  );
}

async function renameThrough(menuName: string, next: string) {
  fireEvent.click((await screen.findAllByRole('button', { name: menuName }))[0]!);
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
  const input = await screen.findByRole('textbox', { name: /^Rename / });
  fireEvent.change(input, { target: { value: next } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

const renamedTo = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.find((c) => c.method === 'updateItem')?.args;

describe('rename', () => {
  beforeEach(() => localStorage.clear());

  it('works on a Details row', async () => {
    localStorage.setItem('liveworkspace:explorer-view-mode', 'details');
    const index = createFakeIndex({ items: [makeItem(1)] });
    page(index, { kind: 'all' });
    await renameThrough('Menu for Item 1', 'Roadmap');
    await waitFor(() => expect(renamedTo(index)).toEqual(['item-1', { title: 'Roadmap' }]));
    expect(await screen.findByText('Roadmap')).toBeTruthy();
  });

  it("works on Home's cards", async () => {
    const index = createFakeIndex({ items: [makeItem(1, { lastOpenedAt: 5_000_000 })] });
    page(index, { kind: 'home' });
    await renameThrough('Menu for Item 1', 'Roadmap');
    await waitFor(() => expect(renamedTo(index)).toEqual(['item-1', { title: 'Roadmap' }]));
  });

  it("renames the panel's current item from its menu, and the host's title follows", async () => {
    const item = makeItem(1);
    const index = createFakeIndex({ items: [item] });
    const onRenameCurrent = vi.fn();
    render(
      <ExplorerPanel
        app="liveplanner"
        client={index.client}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        current={item}
        currentId={item.id}
        onRenameCurrent={onRenameCurrent}
      />,
    );
    await renameThrough('Plan menu', 'Roadmap');
    await waitFor(() => expect(onRenameCurrent).toHaveBeenCalledWith('Roadmap'));
    expect(renamedTo(index)).toEqual(['item-1', { title: 'Roadmap' }]);
    // Its pencil does the same.
    fireEvent.click(screen.getByRole('button', { name: 'Rename Roadmap' }));
    const input = screen.getByRole('textbox', { name: 'Rename Roadmap' });
    fireEvent.change(input, { target: { value: 'Launch' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onRenameCurrent).toHaveBeenLastCalledWith('Launch'));
  });

  it('does not tell the host when another item is renamed', async () => {
    const items = [1, 2].map((i) => makeItem(i, { lastOpenedAt: 5_000_000 - i }));
    const index = createFakeIndex({ items });
    const onRenameCurrent = vi.fn();
    render(
      <ExplorerPanel
        app="liveplanner"
        client={index.client}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        current={items[0]}
        currentId={items[0]!.id}
        onRenameCurrent={onRenameCurrent}
      />,
    );
    await renameThrough('Menu for Item 2', 'Other');
    await waitFor(() => expect(renamedTo(index)).toEqual(['item-2', { title: 'Other' }]));
    expect(onRenameCurrent).not.toHaveBeenCalled();
  });
});
