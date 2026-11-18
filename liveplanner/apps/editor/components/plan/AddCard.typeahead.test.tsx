// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@liveplanner/items';
import { AddCardButton } from './AddCardButton';
import { ItemPanel } from './ItemPanel';
import { planPalette } from './plan-palette';
import { armFreshTitleKeys, takeFreshTitleKeys } from './fresh-title-keys';
import type { NewCard } from './AddCardPopover';

// docs/specs/026-plan/plan-board.md "A card just made opens at once" (Work Tracker 1233): typing that starts the
// moment a card type is chosen in Add Card, before the new card's panel has opened, all lands in its title.

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.mobile,
}));

afterEach(() => {
  cleanup();
  takeFreshTitleKeys();
  viewport.mobile = false;
});

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const cardOf = ({ type, fields }: NewCard): Item => ({
  id: 'made',
  type,
  key: 14,
  rank: 'i',
  fields: { title: 'New task', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

// A cell's Add card and the panel a card just made opens in, as the board wires them: choosing a type adds the card
// and opens it fresh (openNewItem, which arms the typing ahead), the panel a render later.
function Board({ onSave }: { onSave: (field: string, value: unknown) => void }) {
  const [made, setMade] = useState<Item | null>(null);
  const noop = () => {};
  return (
    <>
      <AddCardButton
        palette={planPalette('light', {})}
        types={ITEM_TYPES}
        onAdd={(card) => {
          armFreshTitleKeys();
          setMade(cardOf(card));
        }}
      />
      {made ? (
        <ItemPanel
          item={made}
          types={ITEM_TYPES}
          statuses={[]}
          people={[]}
          labels={[]}
          canEdit
          onSave={onSave}
          onPatch={noop}
          onType={noop}
          onOpenItem={noop}
          onTrash={noop}
          onDuplicate={noop}
          onFlag={noop}
          onArchive={noop}
          onClose={noop}
          trail={[made]}
          statusNames={new Map()}
          fresh
        />
      ) : null}
    </>
  );
}

// The menu's first card type (a row on a desktop, in the bottom sheet on a phone).
const firstChoice = () => document.querySelector<HTMLElement>('[data-option]')!;

const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

// Keys as a fast typist sends them: each to whatever has focus, before the title has taken it.
const typeFast = (text: string) => {
  for (const key of text) fireEvent.keyDown(document.activeElement ?? document.body, { key });
};

describe('typing into Add Card straight after choosing a type', () => {
  it('keeps every character of the title, however fast the typing starts', async () => {
    const onSave = vi.fn();
    render(<Board onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    fireEvent.click(firstChoice());
    // Typed in the same moment as the pick: the title has not taken focus yet.
    const title = screen.getByLabelText<HTMLTextAreaElement>('Title');
    expect(document.activeElement).not.toBe(title);
    typeFast('Fix login bug');
    await nextFrame();
    expect(document.activeElement).toBe(title);
    expect(title.value).toBe('Fix login bug');
    expect(title.selectionStart).toBe('Fix login bug'.length);
    // It saves as typing does: on the pause, or here as the field is left.
    fireEvent.blur(title);
    expect(onSave).toHaveBeenCalledWith('title', 'Fix login bug');
  });

  it('keeps the new card’s title selected when nothing was typed ahead', async () => {
    render(<Board onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    fireEvent.click(firstChoice());
    await nextFrame();
    const title = screen.getByLabelText<HTMLTextAreaElement>('Title');
    // The type's own new title ("New project"), selected so typing replaces it.
    expect(title.value).toBe(ITEM_TYPES[0].newTitle);
    expect(title.selectionStart).toBe(0);
    expect(title.selectionEnd).toBe(title.value.length);
  });

  it('holds nothing back on a phone, where the title takes no focus', async () => {
    viewport.mobile = true;
    render(<Board onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    fireEvent.click(firstChoice());
    await nextFrame();
    // The panel let go as it opened: a key now reaches the page.
    const reached = vi.fn();
    document.addEventListener('keydown', reached);
    fireEvent.keyDown(document.body, { key: 'a' });
    document.removeEventListener('keydown', reached);
    expect(reached).toHaveBeenCalledTimes(1);
  });
});
