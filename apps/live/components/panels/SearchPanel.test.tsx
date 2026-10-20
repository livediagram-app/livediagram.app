// @vitest-environment jsdom

// A search result for a document saved only in this browser carries the This Browser pill as a
// plain label (docs/specs/006-document/offline-mode.md#this-browser-pill).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THIS_BROWSER_DESCRIPTION } from '@/components/primitives/ThisBrowserPill';
import { SearchPanel } from './SearchPanel';

afterEach(cleanup);

describe('SearchPanel', () => {
  it('labels a document in This Browser result, with what it means', () => {
    render(
      <SearchPanel
        documents={[
          { id: 'l1', name: 'Workshop notes', localOnly: true },
          { id: 'c1', name: 'Cloud plan' },
        ]}
        folders={[]}
        onSelectDocument={vi.fn()}
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

  // docs/specs/008-canvas/canvas-and-palette.md "Search panel": an icon and a sticker can share a name.
  it('says which catalogue an icon, sticker or technology result comes from', () => {
    render(
      <SearchPanel
        documents={[]}
        folders={[]}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
        onAddPaletteItem={vi.fn()}
        paletteItems={[
          { id: 'icon:bell', name: 'Bell', keywords: '', add: { type: 'icon', iconId: 'bell' } },
          {
            id: 'sticker:bell',
            name: 'Bell',
            keywords: '',
            add: { type: 'sticker', stickerId: 'emoji-bell' },
          },
          { id: 'tech:bell', name: 'Bellows', keywords: '', add: { type: 'tech', iconId: 'b' } },
          {
            id: 'shape:bell-curve',
            name: 'Bell Curve',
            keywords: '',
            add: { type: 'shape', shapeKind: 'square' },
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search documents/), {
      target: { value: 'bell' },
    });
    const rows = screen.getAllByRole('option').map((o) => o.textContent);
    expect(rows).toContain('BellIcon');
    expect(rows).toContain('BellSticker');
    expect(rows).toContain('BellowsTechnology');
    expect(rows).toContain('Bell Curve');
  });

  it('is a modal dialog that hands focus back to what opened it when it closes', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <SearchPanel documents={[]} folders={[]} onSelectDocument={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Search' }).getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Search documents/));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  // The arrow keys move a highlight; a screen reader follows it as the combobox's active option.
  it('is a combobox whose active option follows the arrow keys, and says how many it found', () => {
    render(
      <SearchPanel
        documents={[
          { id: 'a', name: 'Alpha plan' },
          { id: 'b', name: 'Alpha notes' },
        ]}
        folders={[]}
        onSelectDocument={vi.fn()}
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
});
