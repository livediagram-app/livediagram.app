import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuActionRow, PortalMenu, placeMenu } from './Menu';

// A 1280 x 720 window, the e2e suite's Desktop Chrome, and a 224 px wide menu (w-56).
const VIEW = { width: 1280, height: 720 };
const trigger = (top: number) => ({ top, bottom: top + 28, right: 609 });

describe('placeMenu', () => {
  it('opens below its trigger, right edges aligned', () => {
    expect(placeMenu(trigger(100), { width: 224, height: 300 }, VIEW)).toEqual({
      left: 385,
      top: 132,
    });
  });

  it('opens upward when there is no room below', () => {
    expect(placeMenu(trigger(600), { width: 224, height: 300 }, VIEW)).toEqual({
      left: 385,
      top: 296,
    });
  });

  // The Explorer's flaky e2e: a card's 420 px menu from a trigger at 374 px ran off the bottom, so its last verb
  // (Delete) could not be reached.
  it('slides up over its trigger until its last row is on screen when it fits on neither side', () => {
    const at = placeMenu({ top: 346, bottom: 374, right: 609 }, { width: 224, height: 420 }, VIEW);
    expect(at).toEqual({ left: 385, top: 292 });
    expect(at.top + 420).toBeLessThanOrEqual(VIEW.height - 8);
  });

  it('keeps to the window and scrolls when taller than it', () => {
    expect(placeMenu(trigger(100), { width: 224, height: 900 }, VIEW)).toEqual({
      left: 385,
      top: 8,
      maxHeight: 704,
    });
  });

  it('stays inside the side margins, measuring 224 px before it has a width', () => {
    expect(placeMenu({ top: 10, bottom: 38, right: 40 }, { width: 0, height: 0 }, VIEW)).toEqual({
      left: 8,
      top: 42,
    });
    expect(
      placeMenu({ top: 10, bottom: 38, right: 2000 }, { width: 224, height: 0 }, VIEW).left,
    ).toBe(1048);
  });
});

describe('PortalMenu', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scrolls a menu taller than the window', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(5000);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(224);
    const anchor = document.createElement('button');
    document.body.append(anchor);
    render(
      <PortalMenu anchor={anchor} onClose={() => {}} label="Actions">
        <MenuActionRow label="Open" icon={null} onClick={() => {}} />
      </PortalMenu>,
    );
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(menu.style.maxHeight).toBe(`${window.innerHeight - 16}px`);
    expect(menu.style.overflowY).toBe('auto');
    expect(menu.style.top).toBe('8px');
    anchor.remove();
  });

  it('places a menu that fits without a scroll', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    const anchor = document.createElement('button');
    document.body.append(anchor);
    render(
      <PortalMenu anchor={anchor} onClose={() => {}} label="Actions">
        <MenuActionRow label="Open" icon={null} onClick={() => {}} />
      </PortalMenu>,
    );
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(menu.style.top).toBe('4px');
    expect(menu.style.maxHeight).toBe('');
    anchor.remove();
  });
});
