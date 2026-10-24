// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';
import { coveredKeyRole, type EditorKeyboardShortcutsDeps } from './editor-shortcut-keys';
import { isCanvasCovered, setPlanCover } from '@/hooks/plan/plan-cover-store';
import { getSheetZoom, setSheetZoom } from '@/hooks/sheets/sheet-zoom';

// Cmd/Ctrl + / - / 0 on a Sheet tab zoom the Sheet's cells (docs/specs/029-sheets/sheet.md "Zoom"), as the corner
// zoom controls do; on a Board, Dashboard or Form tab there is nothing to zoom, so they stay swallowed.

function deps(overrides: Partial<EditorKeyboardShortcutsDeps> = {}) {
  const target: Record<string, unknown> = {
    editingId: null,
    isReadOnly: false,
    participant: false,
    canvasTool: 'select',
    enabled: true,
    zenMode: false,
    canvasCovered: isCanvasCovered,
    readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
    canGrowMindNode: () => false,
    onEscapeMindNode: () => false,
    ...overrides,
  };
  // Every other callback in the bag is a harmless no-op.
  return new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : () => {}),
  }) as unknown as EditorKeyboardShortcutsDeps;
}

function press(key: string, init: KeyboardEventInit = { metaKey: true }) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(e);
  return e;
}

afterEach(() => {
  cleanup();
  setPlanCover({ fillTabId: null, fillTabKind: null, planKind: null });
  setSheetZoom(1);
});

describe('the zoom chords on a Plan tab', () => {
  it('zoom the Sheet filling a Sheet tab, never the canvas', () => {
    setPlanCover({ fillTabId: 'sheet-1', fillTabKind: 'Sheet', planKind: 'sheet' });
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomReset = vi.fn();
    renderHook(() => useEditorKeyboardShortcuts(deps({ onZoomIn, onZoomOut, onZoomReset })));
    expect(press('=').defaultPrevented).toBe(true);
    expect(getSheetZoom()).toBe(1.1);
    press('+', { ctrlKey: true });
    expect(getSheetZoom()).toBe(1.2);
    press('-');
    expect(getSheetZoom()).toBe(1.1);
    press('0');
    expect(getSheetZoom()).toBe(1);
    expect(onZoomIn).not.toHaveBeenCalled();
    expect(onZoomOut).not.toHaveBeenCalled();
    expect(onZoomReset).not.toHaveBeenCalled();
  });

  it('do nothing on a Board tab, and keep the browser from zooming the page', () => {
    setPlanCover({ fillTabId: 'board-1', fillTabKind: 'Board', planKind: 'board' });
    const onZoomIn = vi.fn();
    renderHook(() => useEditorKeyboardShortcuts(deps({ onZoomIn })));
    expect(press('=').defaultPrevented).toBe(true);
    expect(onZoomIn).not.toHaveBeenCalled();
    expect(getSheetZoom()).toBe(1);
  });

  it('are run only while a Sheet covers the canvas', () => {
    const chord = {
      key: '=',
      code: 'Equal',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(coveredKeyRole(chord, true)).toBe('run');
    expect(coveredKeyRole(chord, false)).toBe('swallow');
  });
});
