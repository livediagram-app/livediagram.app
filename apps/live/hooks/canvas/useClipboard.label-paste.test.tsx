// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/diagram';
import { serialiseElements } from '@/lib/clipboard-payload';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// Pasting copied ELEMENTS while a note on the canvas is open for typing. The
// clipboard holds them as JSON text, so the label editor used to type that
// JSON into the note. They belong on the canvas instead.

const copied: StickyElement = {
  id: 'copied',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  label: 'Activity cancelled',
} as StickyElement;

function harness(editingId: string | null) {
  let elements: Element[] = [{ ...copied, id: 'open', label: '' } as Element];
  const setEditingId = vi.fn();
  renderHook(() =>
    useClipboard({
      isReadOnly: false,
      embedMode: false,
      selectedId: 'open',
      multiSelectedIds: new Set(),
      editingId,
      setEditingId,
      activeTab: { id: 't', name: 'Board', elements } as Tab,
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      diagramId: 'd',
      toast: { error: vi.fn() } as never,
    }),
  );
  return { elements: () => elements, setEditingId };
}

// A contentEditable label editor, inside the canvas or not.
function editor(insideCanvas: boolean): HTMLElement {
  const root = document.createElement('div');
  if (insideCanvas) root.setAttribute('data-canvas-a11y-root', '');
  const el = document.createElement('div');
  el.contentEditable = 'true';
  // jsdom does not implement isContentEditable; every browser does.
  Object.defineProperty(el, 'isContentEditable', { value: true });
  root.appendChild(el);
  document.body.appendChild(root);
  return el;
}

function paste(target: HTMLElement, text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text, files: [], items: [] },
  });
  target.dispatchEvent(event);
  return event;
}

// Linux browsers paste the primary selection on a middle-button release. That
// is never a request to paste on the canvas, however the clipboard looks.
describe('middle-click paste on the canvas', () => {
  function middleClickPaste(text: string): Event {
    window.dispatchEvent(new MouseEvent('pointerup', { button: 1 }));
    return paste(document.body, text);
  }

  it('does not paste the in-app buffer when the selection is empty', () => {
    const h = harness(null);
    paste(document.body, serialiseElements([copied]));
    expect(h.elements()).toHaveLength(2);
    const event = middleClickPaste('');
    expect(event.defaultPrevented).toBe(false);
    expect(h.elements()).toHaveLength(2);
  });

  it('does not paste elements held in the primary selection', () => {
    const h = harness(null);
    middleClickPaste(serialiseElements([copied]));
    expect(h.elements()).toHaveLength(1);
  });

  it('still pastes on the keyboard shortcut straight after', async () => {
    const h = harness(null);
    middleClickPaste('');
    await new Promise((r) => setTimeout(r, 0));
    paste(document.body, serialiseElements([copied]));
    expect(h.elements()).toHaveLength(2);
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('pasting copied elements into a note open for typing', () => {
  it('pastes the elements on the canvas instead of typing their JSON', () => {
    const h = harness('open');
    const event = paste(editor(true), serialiseElements([copied]));
    expect(event.defaultPrevented).toBe(true);
    expect(h.elements()).toHaveLength(2);
    expect((h.elements()[1] as StickyElement).label).toBe('Activity cancelled');
  });

  it('stops typing in the note, so the pasted elements take the selection', () => {
    const h = harness('open');
    paste(editor(true), serialiseElements([copied]));
    expect(h.setEditingId).toHaveBeenCalledWith(null);
  });

  it('leaves ordinary text to the note', () => {
    const h = harness('open');
    const event = paste(editor(true), 'Activity cancelled');
    expect(event.defaultPrevented).toBe(false);
    expect(h.elements()).toHaveLength(1);
    expect(h.setEditingId).not.toHaveBeenCalled();
  });

  it('ignores a middle-click paste of copied elements', () => {
    const h = harness('open');
    window.dispatchEvent(new MouseEvent('pointerup', { button: 1 }));
    const event = paste(editor(true), serialiseElements([copied]));
    expect(h.elements()).toHaveLength(1);
    expect(h.setEditingId).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves a text field outside the canvas alone', () => {
    const h = harness('open');
    const event = paste(editor(false), serialiseElements([copied]));
    expect(event.defaultPrevented).toBe(false);
    expect(h.elements()).toHaveLength(1);
  });
});
