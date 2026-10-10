// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/document';
import { serialiseElements } from '@/lib/clipboard-payload';
import { blockedLayerMessage } from '@/app/document/[id]/useLayersState';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/006-document/layers.md: while the active layer is hidden or locked,
// element creation is blocked. A paste creates elements, so it is refused, and
// says why (a keystroke has nothing else on screen to show it was ignored).

const copied: StickyElement = {
  id: 'copied',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  label: 'Order placed',
} as StickyElement;

function harness(createBlocked: boolean) {
  let elements: Element[] = [copied];
  const explainCreateBlocked = vi.fn();
  const onPastePhoto = vi.fn();
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      createBlocked,
      explainCreateBlocked,
      embedMode: false,
      readSelection: () => ({ selectedId: 'copied', multiSelectedIds: new Set<string>() }),
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
      toast: { error: vi.fn(), info: vi.fn() } as never,
      onPastePhoto,
    }),
  );
  return { result, elements: () => elements, explainCreateBlocked, onPastePhoto };
}

function paste(text: string, files: File[] = []) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text, files, items: [] },
  });
  document.body.dispatchEvent(event);
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('paste onto a hidden or locked active layer', () => {
  it('refuses copied elements from the system clipboard and explains', () => {
    const h = harness(true);
    paste(serialiseElements([copied]));
    expect(h.elements()).toHaveLength(1);
    expect(h.explainCreateBlocked).toHaveBeenCalledTimes(1);
  });

  it('refuses the canvas menu Paste row (the in-app buffer) too', () => {
    const h = harness(true);
    act(() => h.result.current.copySelection());
    act(() => h.result.current.pasteFromClipboard());
    expect(h.elements()).toHaveLength(1);
    expect(h.explainCreateBlocked).toHaveBeenCalledTimes(1);
  });

  it('refuses a pasted photo read onto the board', () => {
    const h = harness(true);
    paste('', [new File(['x'], 'wall.png', { type: 'image/png' })]);
    expect(h.onPastePhoto).not.toHaveBeenCalled();
    expect(h.explainCreateBlocked).toHaveBeenCalledTimes(1);
  });

  it('pastes as before when the layer takes elements', () => {
    const h = harness(false);
    paste(serialiseElements([copied]));
    expect(h.elements()).toHaveLength(2);
    expect(h.explainCreateBlocked).not.toHaveBeenCalled();
  });

  it('says which state paused adding', () => {
    expect(blockedLayerMessage(true)).toMatch(/hidden/);
    expect(blockedLayerMessage(false)).toMatch(/locked/);
  });
});
