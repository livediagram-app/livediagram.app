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
