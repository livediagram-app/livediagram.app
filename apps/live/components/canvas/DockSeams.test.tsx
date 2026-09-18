// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ES_DOCK_SEAM_PX, type Element, type StickyElement } from '@livediagram/diagram';
import { setDockCandidate } from '@/lib/dock-preview';
import { DockSeams } from './DockSeams';
import type { InsertShift } from '@/hooks/canvas/useInsertShift';

// Two magnets, never a connector (spec/139 Phase 7). What is asserted here is
// the count and the position — the geometry itself is pinned beside the model.

const NO_SHIFT: InsertShift = { xFor: () => undefined, animates: false };

const host: StickyElement = {
  id: 'h',
  type: 'sticky',
  esKind: 'domain-event',
  fixedSize: true,
  x: 1000,
  y: 500,
  width: 200,
  height: 200,
} as StickyElement;

const docked: StickyElement = {
  ...host,
  id: 'd',
  esKind: 'command',
  x: 1000 - ES_DOCK_SEAM_PX - 200,
  esDock: { hostId: 'h', side: 'before' },
} as StickyElement;

function draw(elements: Element[], shift: InsertShift = NO_SHIFT) {
  const { container } = render(
    <DockSeams elements={elements} tabThemeId="brand" insertShift={shift} />,
  );
  return container;
}

const dots = (c: HTMLElement) => [...c.querySelectorAll('circle')];

afterEach(() => {
  cleanup();
  setDockCandidate(null);
});

describe('DockSeams', () => {
  it('draws nothing on a board with no docked pairs', () => {
    expect(draw([host]).querySelector('svg')).toBeNull();
  });

  it('draws one dot on each facing edge, and no line between them', () => {
    const c = draw([host, docked]);
    expect(dots(c)).toHaveLength(2);
    expect(dots(c).map((d) => Number(d.getAttribute('cx')))).toEqual([984, 1000]);
    expect(dots(c).map((d) => Number(d.getAttribute('cy')))).toEqual([600, 600]);
    expect(c.querySelector('line')).toBeNull();
    expect(c.querySelector('path')).toBeNull();
  });

  it('draws nothing for a dock whose host has gone', () => {
    expect(draw([docked]).querySelector('svg')).toBeNull();
  });

  it('stands the seam aside with the cluster it belongs to', () => {
    const shift: InsertShift = { xFor: (id) => (id === 'h' ? 272 : undefined), animates: true };
    const g = draw([host, docked], shift).querySelector('g')!;
    expect(g.getAttribute('style')).toContain('translateX(272px)');
  });

  it('lights the pair a drag is offering, in the guides’ accent', () => {
    setDockCandidate({
      hostId: 'h',
      side: 'after',
      bounds: { x: 1216, y: 510, width: 300, height: 180 },
    });
    const c = draw([host]);
    expect(dots(c)).toHaveLength(2);
    // Stronger than a settled seam: this one is an offer, not a fact.
    expect(Number(dots(c)[0]!.getAttribute('fill-opacity'))).toBeGreaterThan(0.55);
  });

  it('never takes a pointer event from the drag it describes', () => {
    const svg = draw([host, docked]).querySelector('svg')!;
    expect(svg.getAttribute('style')).toContain('pointer-events: none');
  });
});

describe('DockSeams — the offer and the fact together', () => {
  it('draws both while a second note is being dragged onto the free face', () => {
    setDockCandidate({
      hostId: 'h',
      side: 'after',
      bounds: { x: 1216, y: 510, width: 300, height: 180 },
    });
    expect(dots(draw([host, docked]))).toHaveLength(4);
  });
});
