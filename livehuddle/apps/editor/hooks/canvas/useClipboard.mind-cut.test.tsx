// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArrowElement, Element, ShapeElement } from '@livediagram/document';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/009-elements/mind-node.md "Deleting": a Cut takes a mind node's branch, so it copies the branch too;
// a plain Copy copies only what is selected.

const mind = (id: string, parent?: string): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'mind-node',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...(parent ? { mindParentId: parent } : {}),
});

const link = (id: string, from: string, to: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 'e' },
  to: { kind: 'pinned', elementId: to, anchor: 'w' },
});

const map: Element[] = [
  mind('root'),
  mind('a', 'root'),
  mind('a1', 'a'),
  link('root-a', 'root', 'a'),
  link('a-a1', 'a', 'a1'),
];

let written = '';

beforeEach(() => {
  written = '';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn(async (text: string) => {
        written = text;
      }),
    },
  });
});

afterEach(() => {
  cleanup();
});

function copied(
  opts?: { cut: boolean },
  { selected = 'a', layerLockedIds }: { selected?: string; layerLockedIds?: Set<string> } = {},
): string[] {
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      embedMode: false,
      readSelection: () => ({ selectedId: selected, multiSelectedIds: new Set() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements: map },
      ...(layerLockedIds ? { layerLockedIds } : {}),
      commit: () => {},
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      documentId: 'd',
      toast: { error: vi.fn(), info: vi.fn() } as never,
    }),
  );
  act(() => result.current.copySelection(opts));
  return (JSON.parse(written) as { elements: Element[] }).elements.map((el) => el.id).sort();
}

describe('copying a mind node', () => {
  it('a Cut copies the branch under it, with its connectors', () => {
    expect(copied({ cut: true })).toEqual(['a', 'a-a1', 'a1']);
  });

  it('a plain Copy copies only the selected node', () => {
    expect(copied()).toEqual(['a']);
  });

  it('a Cut copies only what its delete takes: a node on a locked layer stays, and its branch', () => {
    // The delete takes root (and, as with any box, the connector pinned to it); a, on a locked layer, stays with
    // everything under it, so none of that is copied to be pasted twice.
    expect(copied({ cut: true }, { selected: 'root', layerLockedIds: new Set(['a']) })).toEqual([
      'root',
    ]);
  });
});
