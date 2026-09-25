// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ES_NOTE_GAP, type Element, type StickyElement } from '@livediagram/diagram';
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
});

describe('NextNoteButtons', () => {
  it('offers nothing until a note is selected', () => {
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

  it('adds the note the side names', () => {
    const onAdd = vi.fn();
    draw([event], { selectedId: 'e', onAdd });
    fireEvent.click(screen.getByRole('button', { name: /before/i }));
    expect(onAdd).toHaveBeenCalledWith('e', 'before');
  });

  it('is a tab in the colour of the NEXT note, sized from the height of this one', () => {
    const c = draw([event], { selectedId: 'e' });
    const tab = c.container.querySelector<HTMLElement>('[data-next-note-tab="before"]')!;
    // A command is blue; the event is 200 tall, so the tab is 50 x 12.
    expect(tab.style.background).toBe('rgb(147, 197, 253)');
    expect(tab.style.height).toBe('50px');
    expect(tab.style.width).toBe('12px');
  });

  it('keeps the plus as large as the first design, 6% of the height of the note', () => {
    const c = draw([event], { selectedId: 'e' });
    const plus = c.container.querySelector('[data-next-note-tab="before"] svg')!;
    expect(plus.getAttribute('width')).toBe('12');
  });

  it('is quiet until pointed at', () => {
    const c = draw([event], { selectedId: 'e' });
    const tab = c.container.querySelector('[data-next-note-tab="before"]')!;
    expect(tab.className).toContain('opacity-50');
    expect(tab.className).toContain('group-hover:opacity-100');
  });

  it('scales the tab with the note', () => {
    const c = draw([policy], { selectedId: 'p' });
    const tab = c.container.querySelector<HTMLElement>('[data-next-note-tab="after"]')!;
    // A policy is 180 tall.
    expect(tab.style.height).toBe('45px');
    expect(parseFloat(tab.style.width)).toBeCloseTo(10.8, 6);
  });

  it('peeks from the edge of the note, on its centre line', () => {
    const c = draw([event], { selectedId: 'e' });
    const after = c.container.querySelector<HTMLElement>('[data-next-note="after"]')!;
    // Starts at the note's right edge and is centred on its middle (y 600).
    expect(parseFloat(after.style.left)).toBe(1200);
    expect(parseFloat(after.style.top) + parseFloat(after.style.height) / 2).toBe(600);
  });

  it('fits inside the gutter, clear of a note beside it', () => {
    const c = draw([event, command], { selectedId: 'e' });
    const tab = c.container.querySelector<HTMLElement>('[data-next-note-tab="before"]')!;
    const button = tab.parentElement!;
    // The command sits one gutter to the left (its right edge at 984); the
    // tab's left edge must stay right of it.
    const tabLeft =
      parseFloat(button.style.left) +
      parseFloat(button.style.width) -
      parseFloat(tab.style.width) -
      parseFloat(tab.style.marginRight || '0');
    expect(tabLeft).toBeGreaterThan(984);
  });

  it('keeps a hit target of at least 24 screen px when zoomed out', () => {
    const c = render(
      <NextNoteButtons
        elements={[event]}
        selectedId="e"
        blocked={false}
        zoom={0.25}
        onAdd={() => {}}
      />,
    );
    const button = c.container.querySelector<HTMLElement>('[data-next-note="after"]')!;
    // 24 screen px at zoom 0.25 is 96 canvas px.
    expect(parseFloat(button.style.width)).toBeGreaterThanOrEqual(96);
    expect(parseFloat(button.style.height)).toBeGreaterThanOrEqual(96);
  });

  it('shows no preview until a tab is pointed at', () => {
    const c = draw([event], { selectedId: 'e' });
    expect(c.container.querySelector('[data-testid="next-note-ghost"]')).toBeNull();
  });

  it('previews the note-to-be where it will land while the tab is hovered', () => {
    const c = draw([event], { selectedId: 'e' });
    const after = screen.getByRole('button', { name: /after/i });
    fireEvent.pointerEnter(after);
    const ghost = c.container.querySelector<HTMLElement>('[data-testid="next-note-ghost"]')!;
    expect(ghost).not.toBeNull();
    expect(ghost.textContent).toContain('Policy');
    // One gutter right of the event, centred on it: 1216, 510, 300 x 180.
    expect(ghost.style.left).toBe('1216px');
    expect(ghost.style.top).toBe('510px');
    expect(ghost.style.width).toBe('300px');
    expect(ghost.style.height).toBe('180px');
    fireEvent.pointerLeave(after);
    expect(c.container.querySelector('[data-testid="next-note-ghost"]')).toBeNull();
  });

  it('previews on keyboard focus too', () => {
    const c = draw([event], { selectedId: 'e' });
    fireEvent.focus(screen.getByRole('button', { name: /before/i }));
    expect(c.container.querySelector('[data-testid="next-note-ghost"]')?.textContent).toContain(
      'Command',
    );
  });

  it('previews without moving anything, even when the spot is taken', () => {
    const onAdd = vi.fn();
    draw([event, command], { selectedId: 'e', onAdd });
    fireEvent.pointerEnter(screen.getByRole('button', { name: /before/i }));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
