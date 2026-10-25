// @vitest-environment jsdom
// The Logo tour's Combine demonstration, the editor's side (docs/specs/007-editor/pages-tour.md "Logo track"): two
// overlapping shapes placed on the tour page with no history and selected, united into one, then taken away.
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCombineDemo,
  combineDemoShape,
  placeCombineDemo,
  uniteCombineDemo,
} from './logo-combine-demo';
import { useLogoCombineDemo } from './useLogoCombineDemo';

const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/design/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));
type Selection = { selectedId: string | null; multiSelectedIds: Set<string> };
const setSelection = vi.hoisted(() => vi.fn<(s: Selection) => void>());
vi.mock('@/hooks/canvas/useSelectionStore', () => ({
  useOptionalSelectionStore: () => ({ setSelection }),
}));
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  waitForSelector: async () => document.body,
}));
const combine = vi.hoisted(() => ({
  result: { ok: true, path: { id: 'united' } } as Record<string, unknown>,
}));
vi.mock('@/lib/combine/combine', () => ({ combineElements: async () => combine.result }));

afterEach(() => {
  cleanup();
  setSelection.mockClear();
});

function editor() {
  type Placed = { id: string; x: number; y: number; width: number };
  const elements: Placed[] = [];
  const tourSquare = {
    place: vi.fn((...els: Placed[]) => elements.push(...els)),
    replace: vi.fn(),
    remove: vi.fn(() => elements.splice(0).map((e) => e.id)),
  };
  ctx.current = {
    activeTab: {
      pages: [{ id: 'logo-1', kind: 'logo', size: 'logo', orientation: 'portrait' }],
      elements,
      backgroundColor: '#ffffff',
    },
    tourSquare,
  };
  return tourSquare;
}

describe('useLogoCombineDemo', () => {
  it('places two overlapping shapes low on the page and selects them', async () => {
    const square = editor();
    renderHook(() => useLogoCombineDemo());
    expect(await placeCombineDemo('logo-1')).toBe(true);
    const [a, b] = square.place.mock.calls[0]!;
    // Overlapping by half, side by side.
    expect(b!.x - a!.x).toBeCloseTo(a!.width / 2);
    expect(b!.y).toBe(a!.y);
    const selected = setSelection.mock.calls.at(-1)![0];
    expect([...selected.multiSelectedIds]).toHaveLength(2);
    expect(combineDemoShape()).toBeNull();
  });

  it('places nothing on a page that is not there', async () => {
    const square = editor();
    renderHook(() => useLogoCombineDemo());
    expect(await placeCombineDemo('gone')).toBe(false);
    expect(square.place).not.toHaveBeenCalled();
  });

  it('unites them into one shape, selected, and takes it away after', async () => {
    const square = editor();
    renderHook(() => useLogoCombineDemo());
    await placeCombineDemo('logo-1');
    expect(await uniteCombineDemo()).toBe(true);
    expect(square.replace).toHaveBeenCalledWith(expect.any(Array), combine.result.path);
    expect(combineDemoShape()).toBe('united');
    expect(setSelection.mock.calls.at(-1)![0].selectedId).toBe('united');
    clearCombineDemo();
    expect(square.remove).toHaveBeenCalled();
    expect(combineDemoShape()).toBeNull();
  });

  it('keeps the shapes as they were when uniting fails', async () => {
    const square = editor();
    combine.result = { ok: false, reason: 'no-overlap' };
    renderHook(() => useLogoCombineDemo());
    await placeCombineDemo('logo-1');
    expect(await uniteCombineDemo()).toBe(false);
    expect(square.replace).not.toHaveBeenCalled();
    combine.result = { ok: true, path: { id: 'united' } };
  });

  it('lets go when the editor goes', async () => {
    editor();
    const { unmount } = renderHook(() => useLogoCombineDemo());
    unmount();
    expect(await placeCombineDemo('logo-1')).toBe(false);
  });
});
