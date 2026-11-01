// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  joinedMenuCardWidth,
  MenuJoinBand,
  STRIP_MENU_GAP_PX,
  stripRoomBesideMenu,
} from './menu-join';

// docs/specs/007-editor/pages-mode.md "Joined to the menu box" (livedocuments, livedesign): pinned left, the Contents
// sidebar rises to the top and the menu box heads it as its top row.
afterEach(cleanup);

describe('joinedMenuCardWidth', () => {
  it('reaches across the sidebar from the box’s 12px inset to the strip’s gap short of its edge', () => {
    expect(joinedMenuCardWidth(236, 1)).toBe(236 - 12 - STRIP_MENU_GAP_PX);
  });

  it('is in the toolbar’s surface px, so it lands the same on screen at any UI scale', () => {
    expect(joinedMenuCardWidth(236, 1.15) * 1.15).toBeCloseTo(216);
    // A sidebar drawn bigger (the panels’ scale) gives a wider box.
    expect(joinedMenuCardWidth(236 * 1.2, 1)).toBeCloseTo(236 * 1.2 - 20);
  });

  it('never goes below nothing', () => {
    expect(joinedMenuCardWidth(10, 1)).toBe(0);
  });
});

describe('stripRoomBesideMenu', () => {
  const menu = (right: number, joined: boolean) => {
    const el = document.createElement('div');
    if (joined) el.setAttribute('data-menu-joined', '');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 12, right - 12, 46));
    return el;
  };

  it('is the whole editor with no menu box', () => {
    expect(stripRoomBesideMenu(1000, 0, null)).toBe(1000);
  });

  it('gives way on both sides of a centred strip to the box and its gap', () => {
    expect(stripRoomBesideMenu(1000, 0, menu(172, false))).toBe(1000 - 2 * 180);
  });

  it('joined, gives way on the left alone: the strip centres beside the sidebar', () => {
    expect(stripRoomBesideMenu(1000, 0, menu(228, true))).toBe(1000 - 236 - STRIP_MENU_GAP_PX);
  });

  it('measures from the editor’s own left edge (a split view’s pane)', () => {
    expect(stripRoomBesideMenu(600, 400, menu(572, false))).toBe(600 - 2 * 180);
  });
});

describe('MenuJoinBand', () => {
  it('holds the menu box’s row, hidden from assistive tech, with a hairline at its foot', () => {
    render(<MenuJoinBand height={68} />);
    const band = document.querySelector<HTMLElement>('[data-menu-join-band]')!;
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.style.height).toBe('68px');
    expect(band.className).toContain('border-b');
  });
});
