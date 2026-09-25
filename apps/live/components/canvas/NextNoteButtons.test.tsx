// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ES_NOTE_GAP, type Element, type StickyElement } from '@livediagram/diagram';
import { setHoveredNoteId } from '@/lib/note-hover';
import { NextNoteButtons } from './NextNoteButtons';

// The next-note buttons (spec/139 Phase 7). At most two per note, only on the
// note you are pointing at or have selected, each naming the act it performs —
// that is what separates them from the four quick-connect pluses this board
// retired as chrome.

const event: StickyElement = {
  id: 'e',
  type: 'sticky',
  esKind: 'domain-event',
  fixedSize: true,
  x: 1000,
  y: 500,
  width: 200,
  height: 200,
} as StickyElement;

const policy: StickyElement = {
  ...event,
  id: 'p',
  esKind: 'policy',
  x: 2000,
  width: 300,
  height: 180,
} as StickyElement;

const command: StickyElement = {
  ...event,
  id: 'c',
  esKind: 'command',
  x: 1000 - ES_NOTE_GAP - 200,
} as StickyElement;

function draw(
  elements: Element[],
  over: { selectedId?: string | null; blocked?: boolean; onAdd?: () => void } = {},
) {
  return render(
    <NextNoteButtons
      elements={elements}
      selectedId={over.selectedId ?? null}
      blocked={over.blocked === true}
      zoom={1}
      onAdd={over.onAdd ?? (() => {})}
    />,
  );
}

const anchors = () => screen.queryAllByRole('button');

afterEach(() => {
  cleanup();
  setHoveredNoteId(null);
});

describe('NextNoteButtons', () => {
  it('offers nothing until a note is pointed at or selected', () => {
    draw([event]);
    expect(anchors()).toHaveLength(0);
  });

  it('offers both sides of a selected domain event', () => {
    draw([event], { selectedId: 'e' });
    expect(anchors().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add a command before this domain event',
      'Add a policy after this domain event',
    ]);
  });

  it('offers the same buttons on hover, with no selection at all', () => {
    setHoveredNoteId('e');
    draw([event]);
    expect(anchors()).toHaveLength(2);
  });

  it('offers a policy its ONE side', () => {
    draw([policy], { selectedId: 'p' });
    expect(anchors().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add a command after this policy',
    ]);
  });

  it('still offers a side that already has a note beside it', () => {
    // Two notes side by side are two notes: the add opens the board.
    draw([event, command], { selectedId: 'e' });
    expect(anchors()).toHaveLength(2);
  });

  it('offers nothing on a note with no next note', () => {
    draw([command], { selectedId: 'c' });
    expect(anchors()).toHaveLength(0);
  });

  it('offers nothing on a locked note', () => {
    draw([{ ...event, locked: true } as Element], { selectedId: 'e' });
    expect(anchors()).toHaveLength(0);
  });

  it('offers nothing when the session cannot create', () => {
    draw([event], { selectedId: 'e', blocked: true });
    expect(anchors()).toHaveLength(0);
  });

  it('does not show the same note twice when it is both hovered and selected', () => {
    setHoveredNoteId('e');
    draw([event], { selectedId: 'e' });
    expect(anchors()).toHaveLength(2);
  });

  it('adds the note the side names', () => {
    const onAdd = vi.fn();
    draw([event], { selectedId: 'e', onAdd });
    fireEvent.click(screen.getByRole('button', { name: /before/i }));
    expect(onAdd).toHaveBeenCalledWith('e', 'before');
  });

  it('sits in the gutter beside the note, on its centre line', () => {
    draw([event], { selectedId: 'e' });
    const before = screen.getByRole('button', { name: /before/i });
    // Gutter centre = 8px left of the note, and the note's vertical middle.
    const style = before.getAttribute('style')!;
    expect(style).toContain(`left: ${1000 - ES_NOTE_GAP / 2 - 12}px`);
    expect(style).toContain('top: 588px');
  });
});
