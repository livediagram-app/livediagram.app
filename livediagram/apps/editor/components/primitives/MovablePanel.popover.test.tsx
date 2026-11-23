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
import { layersHeroArt } from '@/components/panels/LayersHeroArt';

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

  it('is a region named by its title, as a panel at rest is', () => {
    const { popover } = renderPopover();
    expect(popover.getAttribute('role')).toBe('region');
    expect(popover.getAttribute('aria-label')).toBe('Explorer');
    cleanup();
    const view = render(
      <MovablePanel title="Layers" position={null} defaultCorner="top-left" onMoveTo={() => {}}>
        <p>body</p>
      </MovablePanel>,
    );
    expect(view.getByRole('region', { name: 'Layers' })).toBeTruthy();
  });

  // dialog-hero-header.md: a popover that hangs from a button wears the hero header in place of its slim title band.
  it('wears the hero header as a popover: the art’s band and mark, the title, the help link and a close', () => {
    const { popover, onPopoverClose } = renderPopover({
      title: 'Layers',
      hero: { art: layersHeroArt },
      helpArticle: 'layers',
      headerActions: <button type="button">New Layer</button>,
    });
    const header = popover.querySelector<HTMLElement>('[data-dialog-hero="layers"]')!;
    expect(header).toBeTruthy();
    expect(header.querySelector('[data-dialog-hero-art="layers"]')).toBeTruthy();
    expect(header.querySelector('[data-dialog-hero-mark="layers"]')).toBeTruthy();
    expect(header.querySelector('h2')?.textContent).toBe('Layers');
    // The panel's own header controls are the hero's actions, then the close.
    expect(header.querySelector('button')?.textContent).toBe('New Layer');
    expect(header.querySelector('a[href]')).toBeTruthy();
    fireEvent.click(header.querySelector<HTMLElement>('button[aria-label="Close"]')!);
    expect(onPopoverClose).toHaveBeenCalledTimes(1);
    // Hung below its button, the arrow takes the band's paper.
    expect(popover.querySelector('.rotate-45')?.className).toContain('bg-[var(--hero-paper)]');
  });

  it('keeps the slim title band without a hero', () => {
    const { popover } = renderPopover();
    expect(popover.querySelector('[data-dialog-hero]')).toBeNull();
    expect(popover.textContent).toContain('Explorer');
  });
});
