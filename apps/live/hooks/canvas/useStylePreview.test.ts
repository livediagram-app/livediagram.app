import { describe, it, expect, vi } from 'vitest';

// useStylePreview keeps one piece of React state — a `useRef` holding the
// pre-hover snapshot. The test runner is the Node environment (no React
// renderer; see vitest.config.ts), so we stub `useRef` with a plain mutable
// box. The hook is invoked once per harness and reuses that single box across
// the closures it returns, which is exactly the per-instance behaviour we want.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useRef: <T>(init: T) => ({ current: init }) };
});

import { createShape, type Element, type Tab } from '@livediagram/diagram';
import type { ShapeColorPreset } from '@/lib/themes';
import { useStylePreview } from './useStylePreview';

const PRESET_A: ShapeColorPreset = {
  id: 'a',
  name: 'A',
  fill: '#aa0000',
  stroke: '#aa0000',
  text: '#aa0000',
  borderStroke: 'thick',
  borderStyle: 'solid',
};
const PRESET_B: ShapeColorPreset = {
  id: 'b',
  name: 'B',
  fill: '#00bb00',
  stroke: '#00bb00',
  text: '#00bb00',
  borderStroke: 'thin',
  borderStyle: 'dashed',
};

// Model the production wiring's defining quirk: `tabsRef` is a LIVE MIRROR that
// only re-syncs to React state inside a post-render effect, so a synchronous
// tickTabs does NOT update it — it lags by a render. `tickTabs` here mutates the
// committed tabs (React state); `render()` is that lagging effect copying the
// committed value back into the ref. A fast pointer sweep fires
// pointerleave→pointerenter with NO render in between, which is the window the
// bug lived in.
function harness() {
  const a = createShape('square', 0, 0);
  let committed: Tab[] = [{ id: 'tab1', name: 'Tab', elements: [a] }];
  const tabsRef = { current: committed };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const preview = useStylePreview({
    editsBlocked: false,
    activeId: 'tab1',
    currentSelectionIds: () => new Set([a.id]),
    tabsRef: tabsRef as React.MutableRefObject<Tab[]>,
    tickTabs: (map) => {
      committed = map(committed);
    },
    commitTabs: (map) => {
      committed = map(committed);
    },
    emitChange: () => {},
    previewingRef: { current: false } as React.MutableRefObject<boolean>,
  });
  return {
    preview,
    a,
    el: () => committed[0]!.elements[0] as Element & { fillColor?: string; colorPreset?: string },
    // The lagging effect: copy committed React state into the live mirror.
    render: () => {
      tabsRef.current = committed;
    },
  };
}

function isPristine(el: { fillColor?: string; colorPreset?: string }) {
  return el.fillColor === undefined && el.colorPreset === undefined;
}

describe('useStylePreview hover snapshot integrity', () => {
  it('reverts to the true original after a single hover + leave', () => {
    const h = harness();
    h.preview.previewShapeColorPreset(PRESET_A);
    expect(h.el().fillColor).toBe('#aa0000'); // preview live
    h.preview.clearPreview();
    expect(isPristine(h.el())).toBe(true); // back to default
  });

  it('reverts to the true original after a fast tile-to-tile sweep, NOT to a hovered preset', () => {
    const h = harness();

    // Hover tile A and pause long enough for a render to land the preview in the
    // live mirror (this is what made the next snapshot read stale state).
    h.preview.previewShapeColorPreset(PRESET_A);
    h.render();

    // Sweep A -> B with no render in between (leave A, immediately enter B).
    h.preview.clearPreview();
    h.preview.previewShapeColorPreset(PRESET_B);
    h.render();
    expect(h.el().fillColor).toBe('#00bb00'); // B is previewing now

    // Leave the menu entirely.
    h.preview.clearPreview();
    h.render();

    // The bug left the element stuck on PRESET_A (the snapshot had captured A's
    // preview as the "original"). It must land on the pristine default instead.
    expect(isPristine(h.el())).toBe(true);
  });

  it('a click after a fast sweep commits exactly the clicked preset, uncontaminated', () => {
    const h = harness();

    h.preview.previewShapeColorPreset(PRESET_A);
    h.render();
    h.preview.clearPreview();
    h.preview.previewShapeColorPreset(PRESET_B);
    h.render();

    // Click commits B from the true original base, not B-stacked-on-A.
    h.preview.commitShapeColorPreset(PRESET_B);
    const el = h.el();
    expect(el.fillColor).toBe('#00bb00');
    expect(el.colorPreset).toBe('b');
  });
});
