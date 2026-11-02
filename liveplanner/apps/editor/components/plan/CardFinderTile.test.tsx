// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@liveplanner/items';
import { CardFinderPanel } from './CardFinderPanel';

// docs/specs/026-plan/items.md "Finding a card": the cards as a grid of tiles, each with its ⋯ inside the card (at
// the end of its header row), whose menu holds Open, Copy Card Link and, for an Editor alone, Move to Trash.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const card = (title: string, key: number): Item => ({
  id: `i-${title}`,
  type: 'task',
  key,
  rank: 'i',
  fields: { title },
  rev: 1,
  createdAt: 0,
  updatedAt: key,
  createdBy: SAM,
  updatedBy: SAM,
});

function open(extra: Record<string, unknown> = {}, onPopoverClose = vi.fn()) {
  for (const k of Object.keys(plan)) delete plan[k];
  const items = [card('Launch', 1), card('Write copy', 2)];
  Object.assign(plan, {
    types: ITEM_TYPES,
    items: new Map(items.map((i) => [i.id, i])),
    statusNames: new Map(),
    canEdit: true,
    openItem: vi.fn(),
    trashItem: vi.fn(),
    announce: vi.fn(),
    ...extra,
  });
  render(<CardFinderPanel onPopoverClose={onPopoverClose} />);
  return onPopoverClose;
}

const tile = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^Open ${title},`) }).closest('li')!;
const menuOf = (title: string) =>
  fireEvent.click(within(tile(title)).getByRole('button', { name: /^More for #/ }));
const rows = () => screen.getAllByRole('menuitem').map((m) => m.textContent);

describe('the Card Finder’s tiles', () => {
  it('lays the cards out two across from sm up, one on a phone', () => {
    open();
    const list = screen.getByRole('list', { name: 'Cards' });
    expect(list.className).toContain('grid-cols-1');
    expect(list.className).toContain('sm:grid-cols-2');
  });

  it('puts each card’s ⋯ inside the card, above its Open, after Open in the Tab order', () => {
    open();
    const li = tile('Write copy');
    const more = within(li).getByRole('button', { name: /^More for #/ });
    // Inside the card's own frame (the face's rounded border), not a sibling of it.
    expect(more.closest('.rounded-xl.border')).not.toBeNull();
    expect(more.parentElement!.className).toContain('z-[2]');
    const openButton = within(li).getByRole('button', { name: /^Open / });
    expect(
      openButton.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The face drawn with an action does not lift itself (its host draws the hover).
    expect(more.closest('.rounded-xl.border')!.className).not.toContain('hover:-translate-y-px');
  });

  it('opens the card from the tile, closing the popover', () => {
    const onClose = open();
    fireEvent.click(screen.getByRole('button', { name: /^Open Launch,/ }));
    expect(onClose).toHaveBeenCalled();
    expect(plan['openItem']).toHaveBeenCalledWith('i-Launch');
  });

  it('gives an Editor Open, Copy Card Link and Move to Trash, which trashes it and says so', () => {
    open({ cardLink: (id: string) => `/p#item=${id}` });
    menuOf('Launch');
    expect(rows()).toEqual(['Open', 'Copy Card Link', 'Move to Trash']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Trash' }));
    expect(plan['trashItem']).toHaveBeenCalledWith('i-Launch');
    expect(plan['announce']).toHaveBeenCalledWith('#1 moved to the Trash');
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('opens the card from its menu’s Open', () => {
    const onClose = open();
    menuOf('Launch');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(onClose).toHaveBeenCalled();
    expect(plan['openItem']).toHaveBeenCalledWith('i-Launch');
  });

  it('copies the card’s link', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    open({ cardLink: (id: string) => `/p#item=${id}`, notify: vi.fn() });
    menuOf('Launch');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Card Link' }));
    expect(writeText).toHaveBeenCalledWith('/p#item=i-Launch');
  });

  it('gives a Participant or Viewer no Move to Trash, and no Copy Card Link without an address', () => {
    open({ canEdit: false });
    menuOf('Launch');
    expect(rows()).toEqual(['Open']);
  });

  it('closes its menu when the ⋯ is pressed again', () => {
    open();
    menuOf('Launch');
    menuOf('Launch');
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('keeps a press in its menu from reaching what is under the panel', () => {
    const outer = vi.fn();
    for (const k of Object.keys(plan)) delete plan[k];
    Object.assign(plan, {
      types: ITEM_TYPES,
      items: new Map([[card('Launch', 1).id, card('Launch', 1)]]),
      statusNames: new Map(),
      canEdit: true,
    });
    render(
      <div onPointerDown={outer}>
        <CardFinderPanel onPopoverClose={() => {}} />
      </div>,
    );
    menuOf('Launch');
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Open' }));
    expect(outer).not.toHaveBeenCalled();
  });
});
