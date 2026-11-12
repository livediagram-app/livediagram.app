// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import { DialogCloseButton } from './DialogCloseButton';
import { useDialogDismiss } from './dialog-dismiss';
import { SHEET_EXIT_FADE_MS, SHEET_EXIT_MAX_MS } from '../useSheetDrag';

// docs/specs/007-editor/editor-app.md "Menus are bottom sheets on a phone": a phone sheet closed any way (its swipe,
// the backdrop, Escape, its close or a Done) slides out first and only then calls onClose, once; one that asks first
// (beforeClose) springs back; a card on a wide screen closes at once.

let reduce = false;
const stubPhone = (phone: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    (q: string) =>
      ({
        matches: q.includes('reduced-motion') ? reduce : phone && q.includes('max-width'),
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );

beforeEach(() => {
  vi.useFakeTimers();
  reduce = false;
  stubPhone(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Done({ onDone }: { onDone: () => void }) {
  const dismiss = useDialogDismiss();
  return (
    <button type="button" onClick={() => dismiss(onDone)}>
      Done
    </button>
  );
}

function sheet(over: { beforeClose?: () => boolean; onDone?: () => void } = {}) {
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} ariaLabel="Sheet" phoneSheet beforeClose={over.beforeClose}>
      <DialogCloseButton onClick={onClose} />
      <Done onDone={over.onDone ?? onClose} />
    </Dialog>,
  );
  const panel = screen.getByRole('dialog');
  return { onClose, panel, backdrop: panel.parentElement! };
}

describe('a phone sheet closing', () => {
  it('slides out from the backdrop, then closes once on its transitionend', () => {
    const { onClose, panel, backdrop } = sheet();
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('translateY(calc(100% + 24px))');
    expect(panel.style.transition).toContain(`${SHEET_EXIT_MAX_MS}ms`);
    expect(backdrop.style.opacity).toBe('0');
    // A second press while it slides changes nothing.
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    act(() => {
      panel.dispatchEvent(new Event('transitionend', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes after the timeout when no transitionend comes (Escape)', () => {
    const { onClose } = sheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(SHEET_EXIT_MAX_MS + 100);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs the close button’s and a Done’s own handler once it is gone', () => {
    const onDone = vi.fn();
    const { onClose } = sheet({ onDone });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(SHEET_EXIT_MAX_MS + 100);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    act(() => {
      vi.advanceTimersByTime(SHEET_EXIT_MAX_MS + 100);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fades out under reduced motion instead of sliding', () => {
    reduce = true;
    const { onClose, panel, backdrop } = sheet();
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(panel.style.opacity).toBe('0');
    expect(panel.style.transition).toContain(`opacity ${SHEET_EXIT_FADE_MS}ms`);
    act(() => {
      vi.advanceTimersByTime(SHEET_EXIT_FADE_MS + 100);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks beforeClose first and stays, never sliding away under the question', () => {
    const beforeClose = vi.fn(() => false);
    const { onClose, panel, backdrop } = sheet({ beforeClose });
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(beforeClose).toHaveBeenCalledTimes(2);
    expect(panel.style.transform).toBe('');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('slides out from where a swipe let go, at its pace, and springs back from a short one', () => {
    const { onClose, panel } = sheet();
    const handle = panel.firstElementChild as HTMLElement;
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ height: 400 } as DOMRect);
    fireEvent.pointerDown(handle, { clientY: 300, timeStamp: 0 });
    // 12 px: short of a flick and of the close's 80 px, whatever the pace.
    fireEvent.pointerMove(handle, { clientY: 312, timeStamp: 100 });
    fireEvent.pointerUp(handle, { clientY: 312, timeStamp: 400 });
    expect(panel.style.transform).not.toContain('calc');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(handle, { clientY: 300, timeStamp: 1000 });
    fireEvent.pointerMove(handle, { clientY: 500, timeStamp: 1100 });
    fireEvent.pointerUp(handle, { clientY: 500, timeStamp: 1100 });
    expect(panel.style.transform).toBe('translateY(calc(100% + 24px))');
    act(() => {
      vi.advanceTimersByTime(SHEET_EXIT_MAX_MS + 100);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('a card on a wide screen', () => {
  it('closes at once, still asking beforeClose', () => {
    stubPhone(false);
    const beforeClose = vi.fn(() => true);
    const { onClose, backdrop } = sheet({ beforeClose });
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(beforeClose).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    beforeClose.mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
