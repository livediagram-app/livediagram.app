// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement } from '@livehuddle/document';
import { serialiseElements } from '@/lib/clipboard-payload';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// While edits are blocked, element creation is: a paste creates elements, so it is refused.

const copied: StickyElement = {
  id: 'copied',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  label: 'Order placed',
};

function harness(createBlocked: boolean) {
  let elements: Element[] = [copied];
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      createBlocked,
      readSelection: () => ({ selectedId: 'copied', multiSelectedIds: new Set<string>() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements },
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      toast: { error: vi.fn(), info: vi.fn() } as never,
      ownerId: 'owner',
      documentId: null,
    }),
  );
  return { result, elements: () => elements };
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

describe('paste while creation is blocked', () => {
  it('refuses copied elements from the system clipboard', () => {
    const h = harness(true);
    paste(serialiseElements([copied]));
    expect(h.elements()).toHaveLength(1);
  });

  it('refuses the canvas menu Paste row (the in-app buffer) too', () => {
    const h = harness(true);
    act(() => h.result.current.copySelection());
    act(() => h.result.current.pasteFromClipboard());
    expect(h.elements()).toHaveLength(1);
  });

  it('pastes as before when creation is open', () => {
    const h = harness(false);
    paste(serialiseElements([copied]));
    expect(h.elements()).toHaveLength(2);
  });
});
