// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, keyboardBandStyles } from './Dialog';

// The shared dialog shell (docs/specs/007-editor/editor-app.md "A dialog closes from the backdrop
// only on a press that starts there").

afterEach(cleanup);

function open() {
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} ariaLabel="Test">
      <p>Body</p>
    </Dialog>,
  );
  const panel = screen.getByRole('dialog');
  return { onClose, panel, backdrop: panel.parentElement! };
}

describe('Dialog backdrop', () => {
  it('closes on a press that starts and ends on the backdrop', () => {
    const { onClose, backdrop } = open();
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when a drag from inside the panel is released over the backdrop', () => {
    const { onClose, panel, backdrop } = open();
    fireEvent.pointerDown(panel);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// A panel that morphs between sizes (liveplanner's card panel, docs/specs/026-plan/plan-board.md "Maximised"): the
// same panel, inside a View Transition for that type alone.
describe('Dialog resizeTransition', () => {
  it('draws the same panel, still the backdrop’s child', () => {
    render(
      <Dialog open onClose={vi.fn()} ariaLabel="Card" resizeTransition="item-panel-resize">
        <p>Body</p>
      </Dialog>,
    );
    const panel = screen.getByRole('dialog', { name: 'Card' });
    expect(panel.textContent).toBe('Body');
    expect(panel.parentElement!.className).toContain('fixed inset-0');
  });
});

// docs/specs/007-editor/editor-app.md "Escape closes the dialog on top alone".
describe('Dialog Escape', () => {
  it('closes an open dialog', () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the dialog on top when one is open over another', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    function Stack({ confirming }: { confirming: boolean }) {
      return (
        <Dialog open onClose={outer} ariaLabel="Settings">
          <p>Settings</p>
          <Dialog open={confirming} onClose={inner} ariaLabel="Confirm">
            <p>Sure?</p>
          </Dialog>
        </Dialog>
      );
    }
    const { rerender } = render(<Stack confirming={false} />);
    rerender(<Stack confirming />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    // With the confirm gone, Escape reaches Settings again.
    rerender(<Stack confirming={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('leaves the dialog beneath open while the one on top holds Escape back', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(
      <Dialog open onClose={outer} ariaLabel="Settings">
        <Dialog open={false} onClose={inner} ariaLabel="Busy" closeOnEscape={false}>
          <p>Saving</p>
        </Dialog>
      </Dialog>,
    );
    rerender(
      <Dialog open onClose={outer} ariaLabel="Settings">
        <Dialog open onClose={inner} ariaLabel="Busy" closeOnEscape={false}>
          <p>Saving</p>
        </Dialog>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
  });
});

// A fake on-screen keyboard: the visual viewport shrinks under the window, the window itself does not
// (docs/specs/007-editor/editor-app.md "A dialog stays above the on-screen keyboard").
type FakeViewport = EventTarget & {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;
};

function stubViewport(): FakeViewport {
  const vv = Object.assign(new EventTarget(), {
    height: window.innerHeight,
    width: window.innerWidth,
    offsetTop: 0,
    offsetLeft: 0,
  });
  vi.stubGlobal('visualViewport', vv);
  return vv;
}

function raiseKeyboard(vv: FakeViewport, height: number, offsetTop = 0) {
  act(() => {
    vv.height = height;
    vv.offsetTop = offsetTop;
    vv.dispatchEvent(new Event('resize'));
  });
}

describe('Dialog above the on-screen keyboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps its CSS placement while the whole window is visible', () => {
    stubViewport();
    const { panel, backdrop } = open();
    expect(backdrop.style.top).toBe('');
    expect(panel.style.maxHeight).toBe('');
  });

  it('covers only the visible band and caps the panel to it while the keyboard is up', () => {
    const vv = stubViewport();
    const { panel, backdrop } = open();
    raiseKeyboard(vv, 400);
    expect(backdrop.style.top).toBe('0px');
    expect(backdrop.style.height).toBe('400px');
    expect(backdrop.style.bottom).toBe('auto');
    expect(panel.style.maxHeight).toBe('calc(100% - 2rem)');
    expect(panel.style.overflowY).toBe('auto');
  });

  it('follows the visible band when the page pans under the keyboard', () => {
    const vv = stubViewport();
    const { backdrop } = open();
    raiseKeyboard(vv, 400);
    act(() => {
      vv.offsetTop = 120;
      vv.dispatchEvent(new Event('scroll'));
    });
    expect(backdrop.style.top).toBe('120px');
    expect(backdrop.style.height).toBe('400px');
  });

  it('returns to its CSS placement when the keyboard goes', () => {
    const vv = stubViewport();
    const { panel, backdrop } = open();
    raiseKeyboard(vv, 400);
    raiseKeyboard(vv, window.innerHeight);
    expect(backdrop.style.top).toBe('');
    expect(panel.style.maxHeight).toBe('');
  });

  it('keeps a dragged phone sheet capped to the band, over the drag style', () => {
    const vv = stubViewport();
    vi.stubGlobal(
      'matchMedia',
      (q: string) =>
        ({
          matches: q.includes('max-width'),
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    render(
      <Dialog open onClose={() => {}} ariaLabel="Sheet" phoneSheet size="lg">
        <p>Body</p>
      </Dialog>,
    );
    raiseKeyboard(vv, 400);
    const panel = screen.getByRole('dialog');
    const handle = panel.firstElementChild as HTMLElement;
    fireEvent.pointerDown(handle, { clientY: 300 });
    fireEvent.pointerMove(handle, { clientY: 100 });
    // The drag sets its own height (and maxHeight: none); the band's cap still wins.
    expect(panel.style.height).not.toBe('');
    expect(panel.style.maxHeight).toBe('100%');
  });

  it('scrolls the focused field into view as the band changes', () => {
    const vv = stubViewport();
    render(
      <Dialog open onClose={() => {}} ariaLabel="Form">
        <input aria-label="Name" />
      </Dialog>,
    );
    const field = screen.getByLabelText('Name');
    const reveal = vi.fn();
    field.scrollIntoView = reveal;
    act(() => field.focus());
    raiseKeyboard(vv, 400);
    expect(reveal).toHaveBeenCalledWith({ block: 'nearest' });
  });
});

describe('keyboardBandStyles', () => {
  const band = { top: 10, left: 0, width: 800, height: 300 };
  it('is empty without a band', () => {
    expect(keyboardBandStyles(null, false)).toEqual({});
  });
  it('gives a full-width phone panel the whole band', () => {
    expect(keyboardBandStyles(band, true).panel?.maxHeight).toBe('100%');
  });
});
