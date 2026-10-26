// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement } from '@livedocuments/document';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/008-canvas/canvas-and-palette.md "Clipboard": a Cut takes what its delete takes. A locked element, or
// one on a locked layer, stays where it is, so a Cut copies none of it: copied, a paste doubled what stayed.

const box = (id: string, extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});

afterEach(() => {
  cleanup();
});

function copyThenPaste(start: Element[], cut: boolean, layerLockedIds = new Set<string>()) {
  let elements = start;
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      embedMode: false,
      readSelection: () => ({
        selectedId: null,
        multiSelectedIds: new Set(start.map((el) => el.id)),
      }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements: start },
      layerLockedIds,
      commit: (m) => {
        elements = m(start);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      documentId: 'd',
      toast: { error: vi.fn(), info: vi.fn() } as never,
    }),
  );
  // The copy alone (the Cut's delete is the selection actions'), then a paste: what it adds is what was copied.
  act(() => result.current.copySelection(cut ? { cut: true } : undefined));
  act(() => result.current.pasteFromClipboard());
  return elements.slice(start.length);
}

describe('a Cut of a selection holding locked elements', () => {
  it('copies only what the delete takes: no locked element, none on a locked layer', () => {
    const els = [box('free'), box('pinned', { locked: true }), box('onLockedLayer')];
    const pasted = copyThenPaste(els, true, new Set(['onLockedLayer']));
    expect(pasted).toHaveLength(1);
  });

  it('a Copy still copies every selected element', () => {
    const els = [box('free'), box('pinned', { locked: true })];
    expect(copyThenPaste(els, false)).toHaveLength(2);
  });
});
