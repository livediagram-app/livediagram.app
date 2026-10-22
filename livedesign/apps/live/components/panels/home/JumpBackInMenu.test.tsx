// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Jump Back In's ⋯ menu (docs/specs/013-workspace/explorer-home.md "Jump Back In"): every card and phone tile of a
// document the Explorer has loaded carries that document's own Explorer menu, from a ⋯ button beside the card's link
// or a right-click on the card; Rename edits the name in place; a renamed document shows its new name and a gone one
// leaves; a document the Explorer has not loaded has no ⋯.

const { wide } = vi.hoisted(() => ({ wide: { value: true } }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: (p: { documentId: string }) => <span data-testid={`thumb-${p.documentId}`} />,
}));
vi.mock('@livedesign/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livedesign/ui')>()),
  useMediaQuery: () => wide.value,
}));

import { JumpBackIn } from './JumpBackIn';
import type { JumpBackInSet } from '@/app/explorer/home/home-model';
import type { DocumentEntryProps } from '@/app/explorer/explorer-view-props';
import type { DocumentEntryFor } from '@/app/explorer/useDocumentEntryFor';
import type { PaneDocument } from '@/app/explorer/views';
import { fixtureJumpItem as item } from './home-test-utils';

afterEach(cleanup);
beforeEach(() => {
  wide.value = true;
});

const set: JumpBackInSet = { mostUsed: [item('a'), item('b')], recent: [item('c')] };

function entry(id: string, over: Partial<DocumentEntryProps> = {}): DocumentEntryProps {
  return {
    document: { id, name: `Doc ${id}`, ownerId: 'me', savedAt: 1 } as unknown as PaneDocument,
    ownerId: 'me',
    renaming: false,
    onStartRename: vi.fn(),
    onCommitRename: vi.fn(),
    onCancelRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    ...over,
  };
}

function menus(entries: Record<string, DocumentEntryProps>, gone: string[] = []): DocumentEntryFor {
  return {
    entryFor: (id) => entries[id] ?? null,
    isGone: (id) => gone.includes(id),
  };
}

function renderIt(documentMenus?: DocumentEntryFor) {
  render(
    <JumpBackIn
      ownerId="me"
      set={set}
      loading={false}
      recentHref="/explorer/recent"
      onSeeMore={vi.fn()}
      documentMenus={documentMenus}
    />,
  );
}

describe('Jump Back In ⋯ menu', () => {
  it('gives every card of a loaded document a ⋯ beside its link, never inside it', () => {
    renderIt(menus({ a: entry('a'), b: entry('b'), c: entry('c') }));
    for (const id of ['a', 'b', 'c']) {
      const button = screen.getByRole('button', { name: `Menu for Doc ${id}` });
      expect(button.closest('a')).toBeNull();
      expect(button.getAttribute('aria-haspopup')).toBe('menu');
    }
  });

  it("opens the document's Explorer menu from the ⋯", () => {
    const a = entry('a');
    renderIt(menus({ a }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Doc a' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(a.onStartRename).toHaveBeenCalledOnce();
  });

  it('opens the same menu on a right-click anywhere on the card', () => {
    const b = entry('b');
    renderIt(menus({ b }));
    fireEvent.contextMenu(screen.getByRole('link', { name: 'Doc b' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(b.onDelete).toHaveBeenCalledOnce();
  });

  it('shows the name the Explorer has now, so a rename shows at once', () => {
    renderIt(
      menus({
        a: entry('a', { document: { id: 'a', name: 'Renamed' } as unknown as PaneDocument }),
      }),
    );
    expect(screen.getByRole('link', { name: 'Renamed' })).toBeTruthy();
  });

  it('edits the name in place while renaming, and the card does not open', () => {
    const a = entry('a', { renaming: true });
    renderIt(menus({ a }));
    const input = screen.getByRole('textbox', { name: 'Rename Doc a' });
    expect(input.closest('a')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Doc a' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu for Doc a' })).toBeNull();
    fireEvent.change(input, { target: { value: 'New name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(a.onCommitRename).toHaveBeenCalledWith('New name');
  });

  it('drops a document that has left the Explorer (Trash, taken off Shared With Me)', () => {
    renderIt(menus({ a: entry('a'), c: entry('c') }, ['b']));
    const ids = screen.getAllByTestId(/^thumb-/).map((t) => t.dataset.testid);
    expect(ids).toEqual(['thumb-a', 'thumb-c']);
  });

  it('has no ⋯ for a document the Explorer has not loaded, which still opens', () => {
    renderIt(menus({ a: entry('a') }));
    expect(screen.getByRole('button', { name: 'Menu for Doc a' })).toBeTruthy();
    const card = screen.getByRole('link', { name: 'Doc c' });
    expect(within(card.parentElement!).queryByRole('button')).toBeNull();
    expect(card.getAttribute('href')).toBe('/document/c');
  });

  it('draws no ⋯ at all outside the Explorer', () => {
    renderIt();
    expect(screen.queryByRole('button', { name: /^Menu for/ })).toBeNull();
  });

  it('edits a phone tile’s name in place while renaming', () => {
    wide.value = false;
    const a = entry('a', { renaming: true });
    renderIt(menus({ a }));
    const input = screen.getByRole('textbox', { name: 'Rename Doc a' });
    expect(screen.queryByRole('link', { name: 'Doc a' })).toBeNull();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(a.onCancelRename).toHaveBeenCalledOnce();
  });

  it('gives the phone strip tiles the same menu', () => {
    wide.value = false;
    const a = entry('a');
    renderIt(menus({ a }));
    const button = screen.getByRole('button', { name: 'Menu for Doc a' });
    expect(button.closest('a')).toBeNull();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(a.onDuplicate).toHaveBeenCalledOnce();
  });
});
