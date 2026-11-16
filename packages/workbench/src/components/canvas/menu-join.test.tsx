// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  joinedMenuCardWidth,
  MenuJoinBand,
  menuNaturalRight,
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

  it('joined, gives way on the left alone: the strip centres beside the sidebar, a gap from it and the edge', () => {
    expect(stripRoomBesideMenu(1000, 0, menu(228, true))).toBe(1000 - 236 - 2 * STRIP_MENU_GAP_PX);
  });

  // Work Tracker #289: at 640 to 760px with Contents docked left, a strip that fits this room clears the sidebar
  // (whose inner edge is the box's right plus the gap) and the window's right edge by the gap on each side.
  it.each([640, 700, 760])(
    'a strip that fits the joined room at %ipx clears the sidebar and the edge',
    (w) => {
      const room = stripRoomBesideMenu(w, 0, menu(228, true));
      const sidebarEdge = 228 + STRIP_MENU_GAP_PX;
      const left = sidebarEdge + (w - sidebarEdge - room) / 2;
      expect(left - sidebarEdge).toBeGreaterThanOrEqual(STRIP_MENU_GAP_PX);
      expect(w - (left + room)).toBeGreaterThanOrEqual(STRIP_MENU_GAP_PX);
    },
  );

  it('measures from the editor’s own left edge (a split view’s pane)', () => {
    expect(stripRoomBesideMenu(600, 400, menu(572, false))).toBe(600 - 2 * 180);
  });
});

// Work Tracker 1038: the strip decides where it goes from the box as it would stand uncapped, so capping the box at
// the room left of a crowded strip never un-crowds it and pulls it back over the box.
describe('menuNaturalRight', () => {
  // A box 300px wide whose tab name is drawn `shown` wide but holds `whole` (scrollWidth), its own max-width 256px.
  const capped = (
    shown: number,
    whole: number,
    opts: { joined?: boolean; scale?: number } = {},
  ) => {
    const box = document.createElement('div');
    if (opts.joined) box.setAttribute('data-menu-joined', '');
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 12, 300, 46));
    const name = document.createElement('span');
    name.setAttribute('data-tab-name-in-box', '');
    name.style.maxWidth = '256px';
    Object.defineProperty(name, 'offsetWidth', { value: shown });
    Object.defineProperty(name, 'clientWidth', { value: shown - 1 });
    Object.defineProperty(name, 'scrollWidth', { value: whole });
    vi.spyOn(name, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, shown * (opts.scale ?? 1), 20),
    );
    box.append(name);
    document.body.append(box);
    return box;
  };

  it('adds back what the cap hides of the name, up to the name’s own widest', () => {
    // 120 drawn of 199 + 1 border: 80 hidden.
    expect(menuNaturalRight(capped(120, 199))).toBe(312 + 80);
    // A name longer than 16rem would stop at 256 anyway.
    expect(menuNaturalRight(capped(120, 900))).toBe(312 + 136);
    // At a UI scale, in screen px.
    expect(menuNaturalRight(capped(120, 199, { scale: 1.5 }))).toBe(312 + 120);
    // With no max-width of its own, all of it.
    const free = capped(120, 900);
    free.querySelector<HTMLElement>('[data-tab-name-in-box]')!.style.maxWidth = '';
    expect(menuNaturalRight(free)).toBe(312 + 781);
  });

  it('is the drawn edge when nothing is hidden, joined, or with no name', () => {
    expect(menuNaturalRight(capped(120, 119))).toBe(312);
    expect(menuNaturalRight(capped(120, 199, { joined: true }))).toBe(312);
    const bare = document.createElement('div');
    vi.spyOn(bare, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 12, 300, 46));
    expect(menuNaturalRight(bare)).toBe(312);
    expect(menuNaturalRight(capped(0, 0))).toBe(312);
  });

  it('compact, goes by the whole width the box kept from its last whole form', () => {
    const box = capped(120, 119);
    box.dataset.menuNaturalWidth = '500';
    box.dataset.menuForm = 'icon';
    expect(menuNaturalRight(box)).toBe(12 + 500);
    // Whole, the box measures itself as it stands.
    box.dataset.menuForm = 'full';
    expect(menuNaturalRight(box)).toBe(312);
    // Nothing kept: its drawn edge.
    box.dataset.menuForm = 'bare';
    delete box.dataset.menuNaturalWidth;
    expect(menuNaturalRight(box)).toBe(312);
  });

  it('measures the strip’s room from the uncapped edge', () => {
    expect(stripRoomBesideMenu(1000, 0, capped(120, 199))).toBe(
      1000 - 2 * (392 + STRIP_MENU_GAP_PX),
    );
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
