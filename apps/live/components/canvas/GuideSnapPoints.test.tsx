// @vitest-environment jsdom

// docs/specs/007-editor/logo-pages.md "Drawing onto the guides": where a drawing can start.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_MIRROR, layOutIllustratePages, newLogoPage } from '@livediagram/document';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { logoGuideSnapper } from '@/lib/logo-guide-snapping';
import { pageMirrorMaps, toScreen } from './MirrorReflection';
import { drawsOntoGuides, GuideSnapPoints, SNAP_POINTS_NEAR_PX } from './GuideSnapPoints';

afterEach(() => cleanup());

const pages = layOutIllustratePages([newLogoPage('l')]);
const page = pages[0]!.rect;
const cx = page.x + page.width / 2;
const cy = page.y + page.height / 2;
const parts = new Set(['centre', 'diagonals', 'safe', 'circles', 'square', 'grid'] as const);
const tools = (guides = true) =>
  ({
    guidesOn: () => guides,
    guideParts: parts,
    snapPoint: logoGuideSnapper(pages, { on: guides, parts }),
  }) as unknown as LogoToolsView;

function show(guides: boolean, pendingDraw: Parameters<typeof drawsOntoGuides>[0]) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  vi_raf();
  render(
    <GuideSnapPoints
      pages={pages}
      tools={tools(guides)}
      pendingDraw={pendingDraw ?? null}
      wrapperRef={{ current: wrapper }}
      zoom={1}
    />,
  );
  // The pointer near the centre (canvas px = client px here).
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: cx + 4, clientY: cy + 3 }));
  });
}
// Frames run at once.
function vi_raf() {
  window.requestAnimationFrame = (cb) => {
    cb(0);
    return 1;
  };
}

describe('GuideSnapPoints', () => {
  it('shows the crossings near the pointer and rings the point a press would start from', () => {
    show(true, { type: 'freehand' });
    const dots = [...document.querySelectorAll('[data-guide-snap-points] circle')];
    expect(dots.length).toBeGreaterThan(1);
    // Only those near the pointer, not the page's every crossing.
    expect(dots.length).toBeLessThan(30);
    for (const d of dots)
      expect(
        Math.hypot(Number(d.getAttribute('cx')) - cx, Number(d.getAttribute('cy')) - cy),
      ).toBeLessThanOrEqual(SNAP_POINTS_NEAR_PX + 5);
    const ring = document.querySelector('[data-guide-snap-target]')!;
    expect(Number(ring.getAttribute('cx'))).toBeCloseTo(cx);
    expect(Number(ring.getAttribute('cy'))).toBeCloseTo(cy);
  });

  it('shows nothing while the page offers its layouts', () => {
    const card = document.createElement('div');
    card.setAttribute('data-empty-page-layouts', 'l');
    document.body.append(card);
    show(true, { type: 'freehand' });
    expect(document.querySelector('[data-guide-snap-points]')).toBeNull();
    card.remove();
  });

  it('shows nothing with no drawing tool in hand, or the guides off', () => {
    show(true, { type: 'shape', kind: 'square' });
    expect(document.querySelector('[data-guide-snap-points]')).toBeNull();
    cleanup();
    show(false, { type: 'path' });
    expect(document.querySelector('[data-guide-snap-points]')).toBeNull();
  });

  it('counts the pen, the pencil, markers and the Path tool, not the highlighter', () => {
    expect(drawsOntoGuides({ type: 'path' })).toBe(true);
    expect(drawsOntoGuides({ type: 'freehand' })).toBe(true);
    expect(
      drawsOntoGuides({
        type: 'freehand',
        variant: 'whiteboard',
        colour: null,
        width: 4,
        recognise: false,
      }),
    ).toBe(true);
    expect(drawsOntoGuides({ type: 'freehand', variant: 'highlighter' })).toBe(false);
  });
});

describe('pageMirrorMaps', () => {
  const mirrored = pages.map((p) => ({ ...p, mirror: DEFAULT_MIRROR }));
  it('reflects across the page centre line even for a stroke starting on it', () => {
    const [m] = pageMirrorMaps(mirrored, { x: cx, y: cy });
    expect(m).toMatchObject({ a: -1, e: 2 * cx });
    expect(pageMirrorMaps(mirrored, { x: page.x - 500, y: cy })).toEqual([]);
  });

  it('carries a canvas map to the screen at any origin and zoom', () => {
    const [m] = pageMirrorMaps(mirrored, { x: cx, y: cy });
    const s = toScreen(m!, { left: 40, top: 70 }, 2);
    // The screen point of canvas x maps to the screen point of its reflection.
    const x = cx + 30;
    expect(s.a * (40 + 2 * x) + s.e).toBeCloseTo(40 + 2 * (2 * cx - x));
  });
});
