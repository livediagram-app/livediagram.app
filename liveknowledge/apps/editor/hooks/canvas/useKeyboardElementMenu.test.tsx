// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { isMenuKey, useKeyboardElementMenu } from './useKeyboardElementMenu';

// docs/specs/004-interface-design/canvas-accessibility.md: the Menu key or Shift+F10 on the canvas opens the
// selected element's menu beside it.

afterEach(cleanup);

const sel = (selectedId: string | null, multi: string[] = []): Selection => ({
  selectedId,
  multiSelectedIds: new Set(multi),
});

function Harness({
  selection,
  open,
  functionRef = false,
}: {
  selection: Selection;
  open?: (id: string, x: number, y: number) => void;
  functionRef?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useKeyboardElementMenu(functionRef ? () => {} : ref, () => selection, open);
  return (
    <main ref={ref} tabIndex={0} aria-label="Canvas">
      <div data-element-id="sq">square</div>
      <button type="button">inside</button>
    </main>
  );
}

const press = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { ...init, cancelable: true, bubbles: true });
  window.dispatchEvent(e);
  return e;
};

describe('isMenuKey', () => {
  it('is the Menu key or Shift+F10', () => {
    expect(isMenuKey({ key: 'ContextMenu', shiftKey: false })).toBe(true);
    expect(isMenuKey({ key: 'F10', shiftKey: true })).toBe(true);
    expect(isMenuKey({ key: 'F10', shiftKey: false })).toBe(false);
    expect(isMenuKey({ key: 'Enter', shiftKey: true })).toBe(false);
  });
});

describe('useKeyboardElementMenu', () => {
  it('opens the selected element’s menu beside it while the canvas holds focus', () => {
    const open = vi.fn();
    const { getByRole } = render(<Harness selection={sel('sq')} open={open} />);
    getByRole('main').focus();
    const e = press({ key: 'F10', shiftKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith('sq', expect.any(Number), expect.any(Number));
  });

  it('leaves the key alone off the canvas, with nothing or several selected, or none to open', () => {
    const open = vi.fn();
    const { getByRole, unmount } = render(<Harness selection={sel('sq')} open={open} />);
    getByRole('button').focus();
    expect(press({ key: 'ContextMenu' }).defaultPrevented).toBe(false);
    unmount();
    for (const selection of [sel(null), sel('sq', ['sq', 'b']), sel('gone')]) {
      const r = render(<Harness selection={selection} open={open} />);
      r.getByRole('main').focus();
      expect(press({ key: 'ContextMenu' }).defaultPrevented).toBe(false);
      r.unmount();
    }
    const r = render(<Harness selection={sel('sq')} />);
    r.getByRole('main').focus();
    expect(press({ key: 'ContextMenu' }).defaultPrevented).toBe(false);
    r.unmount();
    const f = render(<Harness selection={sel('sq')} open={open} functionRef />);
    f.getByRole('main').focus();
    expect(press({ key: 'ContextMenu' }).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('ignores another key, and one a closer handler already claimed', () => {
    const open = vi.fn();
    const { getByRole } = render(<Harness selection={sel('sq')} open={open} />);
    getByRole('main').focus();
    press({ key: 'a' });
    const claimed = new KeyboardEvent('keydown', { key: 'ContextMenu', cancelable: true });
    claimed.preventDefault();
    window.dispatchEvent(claimed);
    expect(open).not.toHaveBeenCalled();
  });
});
