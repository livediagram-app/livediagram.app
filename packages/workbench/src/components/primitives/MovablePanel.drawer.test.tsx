// @vitest-environment jsdom
// A popover off a button is a drawer on a phone (liveworkspace/docs/specs/011-workbench/phone-drawers.md): Layers, Tidy
// Up, Collaborate, Timer, Vote and Poll alike, through the one shared MovablePanel. On a desktop it is the popover it
// was, hung from its button with its arrow; a panel that opens as a sheet of its own (the Explorer) stays that sheet.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { timerHeroArt } from '@liveworkspace/ui/dialog-hero-art/timer';
import { createMovablePanel } from './MovablePanel';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

function phone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

const MovablePanel = createMovablePanel<string>({
  HelpArticleLink: ({ article }) => <a href={`#${article}`}>Help</a>,
  usePopoverTopClearance: () => 0,
});

// A cluster button's popover, risen from the bottom-right.
const fromBottom = { left: 200, top: 0, bottom: 56, arrowOffset: 20 };

function renderPanel(over: Partial<Parameters<typeof MovablePanel>[0]> = {}) {
  const onPopoverClose = vi.fn();
  render(
    <MovablePanel
      title="Layers"
      dataTourId="layers"
      hero={{ art: timerHeroArt }}
      helpArticle="layers"
      position={null}
      defaultCorner="bottom-right"
      onMoveTo={() => {}}
      asPopover
      popoverOpen
      popoverAnchor={fromBottom}
      popoverWidth="w-[22rem]"
      onPopoverClose={onPopoverClose}
      dismissOnOutside
      {...over}
    >
      <button type="button">New Layer</button>
    </MovablePanel>,
  );
  const panel = document.querySelector<HTMLElement>('[data-tour-id="layers"]')!;
  return { onPopoverClose, panel };
}

describe('MovablePanel as a phone drawer', () => {
  it('opens as a drawer on a phone: a named modal sheet with a handle over a scrim, no arrow, no width', () => {
    phone(true);
    const { panel } = renderPanel();
    expect(panel.hasAttribute('data-phone-drawer')).toBe(true);
    expect(panel.hasAttribute('data-floating-panel')).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Layers' })).toBe(panel);
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.querySelector('[data-sheet-handle]')).not.toBeNull();
    expect(panel.previousElementSibling?.hasAttribute('data-phone-drawer-scrim')).toBe(true);
    expect(panel.className).not.toContain('w-[22rem]');
    expect(panel.className).toContain('z-[var(--z-modal)]');
    expect(panel.querySelector('.rotate-45')).toBeNull();
    // A toast stands on it rather than covering it.
    expect(panel.getAttribute('data-toast-floor')).not.toBeNull();
    // The hero's band runs up under the handle; its close and help stay.
    expect(panel.querySelector('[data-dialog-hero-art]')?.className).toContain('max-sm:top-');
    expect(screen.getByRole('link', { name: 'Help' })).toBeTruthy();
  });

  it('closes on the scrim, once, and on Escape; a press inside never closes it', () => {
    phone(true);
    const { onPopoverClose, panel } = renderPanel();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'New Layer' }));
    expect(onPopoverClose).not.toHaveBeenCalled();
    const scrim = panel.previousElementSibling as HTMLElement;
    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim);
    expect(onPopoverClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onPopoverClose).toHaveBeenCalledTimes(2);
  });

  it('wears the slim title band in a drawer when it has no hero', () => {
    phone(true);
    const { panel } = renderPanel({ hero: undefined, title: 'Vote' });
    expect(screen.getByRole('dialog', { name: 'Vote' })).toBe(panel);
    expect(panel.querySelector('[data-dialog-hero]')).toBeNull();
    expect(panel.textContent).toContain('Vote');
  });

  it('is the popover it was on a desktop: hung from its button with its arrow, no scrim', () => {
    phone(false);
    const { onPopoverClose, panel } = renderPanel();
    expect(panel.hasAttribute('data-phone-drawer')).toBe(false);
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.className).toContain('w-[22rem]');
    expect(panel.style.bottom).toBe('68px');
    expect(panel.querySelector('.rotate-45')).not.toBeNull();
    expect(document.querySelector('[data-phone-drawer-scrim]')).toBeNull();
    expect(panel.querySelector('[data-dialog-hero-art]')?.className).not.toContain('max-sm:top-');
    // A press outside closes it, as before.
    fireEvent.pointerDown(document.body);
    expect(onPopoverClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a panel that opens as a sheet of its own (the Explorer) that sheet on a phone', () => {
    phone(true);
    const { panel } = renderPanel({
      popoverSheet: true,
      popoverAnchor: { left: 16, top: 40, arrowOffset: 20 },
    });
    expect(panel.hasAttribute('data-phone-drawer')).toBe(false);
    expect(panel.style.top).toBe('52px');
    expect(document.querySelector('[data-phone-drawer-scrim]')).toBeNull();
  });
});
