// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement } from '@livedesign/design';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/008-canvas/canvas-and-palette.md "Clipboard": a Cut copies only what its delete takes. A locked element,
// or one on a locked layer, stays where it is, so copying it too pasted a second copy of it.

const sticky = (id: string, extra: Partial<StickyElement> = {}): StickyElement => ({
  id,
  type: 'sticky',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  label: id,
  ...extra,
});

function harness(elements: Element[], layerLockedIds?: ReadonlySet<string>) {
  let els = elements;
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      embedMode: false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set(['open', 'shut']) }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements: els },
      ...(layerLockedIds ? { layerLockedIds } : {}),
      commit: (m) => {
        els = m(els);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      designId: 'd',
      toast: { error: vi.fn(), info: vi.fn() } as never,
    }),
  );
  return { result, pasted: () => els.slice(elements.length) };
}

afterEach(() => {
  cleanup();
});

describe('Cut copies only what its delete takes', () => {
  it('leaves a locked element off the clipboard', () => {
    const h = harness([sticky('open'), sticky('shut', { locked: true })]);
    act(() => h.result.current.copySelection({ cut: true }));
    act(() => h.result.current.pasteFromClipboard());
    expect(h.pasted().map((el) => el.label)).toEqual(['open']);
  });

  it('leaves an element on a locked layer off the clipboard', () => {
    const h = harness([sticky('open'), sticky('shut')], new Set(['shut']));
    act(() => h.result.current.copySelection({ cut: true }));
    act(() => h.result.current.pasteFromClipboard());
    expect(h.pasted().map((el) => el.label)).toEqual(['open']);
  });

  it('still copies a locked element on a plain Copy', () => {
    const h = harness([sticky('open'), sticky('shut', { locked: true })]);
    act(() => h.result.current.copySelection());
    act(() => h.result.current.pasteFromClipboard());
    expect(h.pasted().map((el) => el.label)).toEqual(['open', 'shut']);
  });
});
