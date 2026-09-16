// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ES_DOCK_SEAM_PX, type Element, type StickyElement } from '@livediagram/diagram';
import { setDockHoveredId } from '@/lib/dock-preview';
import { DockAnchors } from './DockAnchors';

// The affordances on a host's free faces (spec/139 Phase 7). At most two per
// host, only on the host you are pointing at or have selected, each naming the
// act it performs — that is what separates them from the four quick-connect
// pluses this board retired as chrome.

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
  x: 1000 - ES_DOCK_SEAM_PX - 200,
  esDock: { hostId: 'e', side: 'before' },
} as StickyElement;

function draw(
  elements: Element[],
  over: { selectedId?: string | null; blocked?: boolean; onAdd?: () => void } = {},
) {
  return render(
    <DockAnchors
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
  setDockHoveredId(null);
});

describe('DockAnchors', () => {
  it('offers nothing until a host is pointed at or selected', () => {
    draw([event]);
    expect(anchors()).toHaveLength(0);
  });

  it('offers both free faces of a selected domain event', () => {
    draw([event], { selectedId: 'e' });
    expect(anchors().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add a command before domain event',
      'Add a policy after domain event',
    ]);
  });

  it('offers the same faces on hover, with no selection at all', () => {
    setDockHoveredId('e');
    draw([event]);
    expect(anchors()).toHaveLength(2);
  });

  it('offers a policy its ONE face', () => {
    draw([policy], { selectedId: 'p' });
    expect(anchors().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add a command after policy',
    ]);
  });

  it('withdraws a face that is already taken', () => {
    draw([event, command], { selectedId: 'e' });
    expect(anchors().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add a policy after domain event',
    ]);
  });

  it('offers nothing on a note that hosts nothing', () => {
    draw([command], { selectedId: 'c' });
    expect(anchors()).toHaveLength(0);
  });

  it('offers nothing on a locked host', () => {
    draw([{ ...event, locked: true } as Element], { selectedId: 'e' });
    expect(anchors()).toHaveLength(0);
  });

  it('offers nothing when the session cannot create', () => {
    draw([event], { selectedId: 'e', blocked: true });
    expect(anchors()).toHaveLength(0);
  });

  it('does not show the same host twice when it is both hovered and selected', () => {
    setDockHoveredId('e');
    draw([event], { selectedId: 'e' });
    expect(anchors()).toHaveLength(2);
  });

  it('adds the note the face names', () => {
    const onAdd = vi.fn();
    draw([event], { selectedId: 'e', onAdd });
    fireEvent.click(screen.getByRole('button', { name: /before/i }));
    expect(onAdd).toHaveBeenCalledWith('e', 'before');
  });

  it('sits in the seam, on the pair’s centre line', () => {
    draw([event], { selectedId: 'e' });
    const before = screen.getByRole('button', { name: /before/i });
    // Seam centre = 8px left of the host, and the host's vertical middle.
    const style = before.getAttribute('style')!;
    expect(style).toContain(`left: ${1000 - ES_DOCK_SEAM_PX / 2 - 12}px`);
    expect(style).toContain('top: 588px');
  });
});
