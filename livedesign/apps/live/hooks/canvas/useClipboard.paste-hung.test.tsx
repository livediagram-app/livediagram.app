// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArrowElement, Element } from '@livedesign/design';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/008-canvas/arrow-to-arrow.md: a pasted arrow ends on an arrow that is on the tab, never on one that
// stayed on the clipboard. A connector copied without its boxes cannot land on another tab, and an arrow hung off it
// used to land anyway, its end naming the connector's clipboard id (drawn at the canvas origin, and saved).

const connector: ArrowElement = {
  id: 'x',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
  to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
};
const hung: ArrowElement = {
  id: 'y',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'on-arrow', arrowId: 'x', t: 0.5 },
};

afterEach(() => {
  cleanup();
});

function paste(source: Element[], tab: Element[]): Element[] {
  let landed: Element[] = tab;
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      embedMode: false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Other tab', elements: tab },
      commit: (map: (els: Element[]) => Element[]) => {
        landed = map(tab);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      designId: 'd',
      toast: { error: vi.fn(), info: vi.fn() } as never,
    }),
  );
  act(() => result.current.pasteFromClipboard(source));
  return landed;
}

describe('pasting an arrow hung off a connector that cannot land', () => {
  it('never lands an arrow whose end names an arrow not on the tab', () => {
    const out = paste([connector, hung], []);
    const ids = new Set(out.map((el) => el.id));
    for (const el of out) {
      if (el.type !== 'arrow') continue;
      for (const end of [el.from, el.to]) {
        if (end.kind === 'on-arrow') expect(ids.has(end.arrowId)).toBe(true);
        if (end.kind === 'pinned') expect(ids.has(end.elementId)).toBe(true);
      }
    }
  });
});
