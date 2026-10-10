// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArrowElement, Element, ShapeElement, Tab } from '@livediagram/document';
import {
  copyTooLargeMessage,
  IN_APP_COPY_ELSEWHERE,
  MAX_CLIPBOARD_ELEMENTS,
} from '@/lib/clipboard-payload';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/008-canvas/canvas-and-palette.md "Clipboard": a selection too large
// for the system clipboard pastes whole from the in-app buffer in the window
// that copied it, never cut short, and says it cannot leave that window.

const box = (i: number): ShapeElement =>
  ({
    id: `s${i}`,
    type: 'shape',
    shape: 'square',
    x: i,
    y: 0,
    width: 10,
    height: 10,
  }) as ShapeElement;

const link: ArrowElement = {
  id: 'arrow',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 's0', anchor: 'e' },
  to: { kind: 'pinned', elementId: `s${MAX_CLIPBOARD_ELEMENTS + 9}`, anchor: 'w' },
};

const big: Element[] = [
  ...Array.from({ length: MAX_CLIPBOARD_ELEMENTS + 10 }, (_, i) => box(i)),
  link,
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

function harness(start: Element[]) {
  let elements = start;
  const toast = { error: vi.fn(), info: vi.fn() };
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
      activeTab: { id: 't', name: 'Board', elements } as Tab,
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      documentId: 'd',
      toast: toast as never,
    }),
  );
  return { result, elements: () => elements, toast };
}

function paste(text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text, files: [], items: [] },
  });
  document.body.dispatchEvent(event);
}

describe('a copy too large for the system clipboard', () => {
  it('says so, and pastes every element and arrow in the window that copied it', async () => {
    const h = harness(big);
    await act(async () => h.result.current.copySelection());
    expect(h.toast.info).toHaveBeenCalledWith(copyTooLargeMessage(big.length));
    expect(written.length).toBeLessThan(1024);
    paste(written);
    expect(h.elements()).toHaveLength(big.length * 2);
    const arrows = h.elements().filter((el): el is ArrowElement => el.type === 'arrow');
    expect(arrows).toHaveLength(2);
    const ids = new Set(h.elements().map((el) => el.id));
    for (const a of arrows)
      for (const end of [a.from, a.to])
        expect(end.kind === 'pinned' && ids.has(end.elementId)).toBe(true);
  });

  it('pastes nothing in another window, and says why', async () => {
    const source = harness(big);
    await act(async () => source.result.current.copySelection());
    cleanup();
    const other = harness([box(0)]);
    paste(written);
    expect(other.elements()).toHaveLength(1);
    expect(other.toast.info).toHaveBeenCalledWith(IN_APP_COPY_ELSEWHERE);
  });

  it('a copy that fits still goes on the system clipboard, without a notice', async () => {
    const h = harness([box(0)]);
    await act(async () => h.result.current.copySelection());
    expect(h.toast.info).not.toHaveBeenCalled();
    expect(written).toContain('"elements":[{');
  });
});
