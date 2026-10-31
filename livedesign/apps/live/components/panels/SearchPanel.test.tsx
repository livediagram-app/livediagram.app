// @vitest-environment jsdom

// A search result for a design saved only in this browser carries the This Browser pill as a
// plain label (docs/specs/006-design/offline-mode.md#this-browser-pill).

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IndexClient, Item } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THIS_BROWSER_DESCRIPTION } from '@liveworkspace/workbench/components/primitives/ThisBrowserPill';
import { SearchPanel } from './SearchPanel';

afterEach(cleanup);

describe('SearchPanel', () => {
  it('labels a design in This Browser result, with what it means', () => {
    render(
      <SearchPanel
        designs={[
          { id: 'l1', name: 'Workshop notes', localOnly: true },
          { id: 'c1', name: 'Cloud plan' },
        ]}
        folders={[]}
        onSelectDesign={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const local = screen.getByRole('option', { name: /Workshop notes/ });
    expect(local.textContent).toContain('This Browser');
    expect(local.textContent).toContain(THIS_BROWSER_DESCRIPTION);
    expect(local.querySelector('a')).toBeNull();
    expect(screen.getByRole('option', { name: /Cloud plan/ }).textContent).not.toContain(
      'This Browser',
    );
  });

  // A touch screen has no Esc key: its close button shows a × there, the Esc key cap on a keyboard's screen.
  it('closes with a button that reads Esc on a fine pointer and shows a × on a coarse one', () => {
    const onClose = vi.fn();
    render(<SearchPanel designs={[]} folders={[]} onSelectDesign={vi.fn()} onClose={onClose} />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.querySelector('kbd')!.className).toContain('pointer-coarse:hidden');
    expect(close.querySelector('svg')!.getAttribute('class')).toContain('pointer-coarse:block');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  it('is a modal dialog that hands focus back to what opened it when it closes', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <SearchPanel designs={[]} folders={[]} onSelectDesign={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Search' }).getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Search designs/));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  // The arrow keys move a highlight; a screen reader follows it as the combobox's active option.
  it('is a combobox whose active option follows the arrow keys, and says how many it found', () => {
    render(
      <SearchPanel
        designs={[
          { id: 'a', name: 'Alpha plan' },
          { id: 'b', name: 'Alpha notes' },
        ]}
        folders={[]}
        onSelectDesign={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const field = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(field, { target: { value: 'alpha' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(field.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1]!.id);
    expect(screen.getByText('2 results')).toBeTruthy();
  });

  // Work Tracker #63: the index's finds in every app, each with its app's mark and name, never twice.
  it('lists what the index finds in every app under Every App, and opens the one picked', async () => {
    const found = (id: string, title: string, app: Item['app'], sharedVia: string | null = null) =>
      ({ id, title, app, sharedVia, trashedAt: null }) as Item;
    const listItems = vi.fn(async () => ({
      items: [
        found('own', 'Road trip', 'livedesign'),
        found('x1', 'Roadmap', 'livediagram'),
        found('x2', 'Road show', 'livedesign', 'code-1'),
      ],
      nextCursor: null,
    }));
    const onSelectWorkspaceItem = vi.fn();
    render(
      <SearchPanel
        designs={[{ id: 'own', name: 'Road trip' }]}
        folders={[]}
        onSelectDesign={vi.fn()}
        workspace={{ client: { listItems } as unknown as IndexClient }}
        onSelectWorkspaceItem={onSelectWorkspaceItem}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
      target: { value: ' road ' },
    });
    const group = await screen.findByRole('group', { name: 'Every App' });
    // Every app (no app named), only what the person can open: the index's search view.
    expect(listItems).toHaveBeenCalledWith(
      { view: 'search', q: 'road', limit: 24 },
      expect.objectContaining({ signal: expect.anything() }),
    );
    const rows = within(group).getAllByRole('option');
    // The document this panel lists itself is not listed again.
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Roadmap'),
      expect.stringContaining('Road show'),
    ]);
    expect(rows[0]!.textContent).toContain('livediagram');
    expect(rows[0]!.querySelector('[data-app-mark="livediagram"]')).not.toBeNull();
    fireEvent.click(rows[1]!);
    expect(onSelectWorkspaceItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'x2', app: 'livedesign', sharedVia: 'code-1' }),
    );
  });

  it('asks the index nothing without a client, and shows nothing when it fails', async () => {
    const listItems = vi.fn(async () => {
      throw new Error('offline');
    });
    render(
      <SearchPanel
        designs={[]}
        folders={[]}
        onSelectDesign={vi.fn()}
        workspace={{ client: { listItems } as unknown as IndexClient }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
      target: { value: 'road' },
    });
    await vi.waitFor(() => expect(listItems).toHaveBeenCalled());
    expect(screen.queryByRole('group', { name: 'Every App' })).toBeNull();
  });
});
