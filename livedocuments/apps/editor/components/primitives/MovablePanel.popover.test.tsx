// @vitest-environment jsdom
// The Explorer panel's popover (liveworkspace/docs/specs/004-index/one-explorer.md "The editors' panel: its size and
// the scrim"): a height it fills, kept on the canvas below its button, and a scrim behind it that closes it.
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false,
}));
// jsdom has no ResizeObserver; the panel's measuring is not under test here.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

import { MovablePanel } from './MovablePanel';

afterEach(cleanup);

const anchor = { left: 16, top: 40, arrowOffset: 20 };

function renderPopover(over: Partial<Parameters<typeof MovablePanel>[0]> = {}) {
  const onPopoverClose = vi.fn();
  const view = render(
    <MovablePanel
      title="Explorer"
      dataTourId="explorer"
      position={null}
      defaultCorner="top-left"
      onMoveTo={() => {}}
      asPopover
      popoverOpen
      popoverAnchor={anchor}
      onPopoverClose={onPopoverClose}
      dismissOnOutside
      {...over}
    >
      <p>body</p>
    </MovablePanel>,
  );
  const popover = view.container.querySelector<HTMLElement>('[data-tour-id="explorer"]')!;
  const scrim = () => document.querySelector<HTMLElement>('[data-popover-scrim]');
  return { onPopoverClose, popover, scrim };
}

describe('MovablePanel popover: height and scrim', () => {
  it('fills the height it is given, clamped to the canvas below its button, its body filling it', () => {
    const { popover } = renderPopover({ popoverWidth: 'w-[60rem]', popoverHeight: '56rem' });
    // jsdom drops the calc() inside min(): the same length.
    expect(popover.style.height).toMatch(/^min\(56rem, (calc\()?100% - 64px\)?\)$/);
    expect(popover.style.maxHeight).toBe('calc(100% - 64px)');
    expect(popover.className).toContain('w-[60rem]');
    expect(popover.lastElementChild!.className).toContain('flex-1');
  });

  it('is as tall as its contents without one, and draws no scrim unless asked', () => {
    const { popover, scrim } = renderPopover();
    expect(popover.style.height).toBe('');
    expect(scrim()).toBeNull();
  });

  it('draws a scrim behind it, before it in the same layer; a click on the scrim closes it once', () => {
    const { popover, scrim, onPopoverClose } = renderPopover({ popoverScrim: true });
    const s = scrim()!;
    expect(s.compareDocumentPosition(popover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The press is not an outside press: only the click closes it, so nothing under it sees the press.
    fireEvent.pointerDown(s);
    expect(onPopoverClose).not.toHaveBeenCalled();
    fireEvent.click(s);
    expect(onPopoverClose).toHaveBeenCalledTimes(1);
  });

  it('still closes on a press outside, and never on a press inside', () => {
    const { popover, onPopoverClose } = renderPopover({ popoverScrim: true });
    fireEvent.pointerDown(popover.querySelector('p')!);
    expect(onPopoverClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onPopoverClose).toHaveBeenCalledTimes(1);
  });
});
