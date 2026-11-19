// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CORNER_CARD_EVENT,
  cornerCardClear,
  cornerCardCompact,
  joinedMenuCardWidth,
  MenuJoinBand,
  menuNaturalRight,
  STRIP_MENU_GAP_PX,
  STRIP_SIDE_SPACE_PX,
  stripLeftClear,
  stripRoomBesideMenu,
  stripSitsBetween,
  stripShiftsLeft,
  stripTakesGap,
  STRIP_BETWEEN,
  STRIP_SHIFTS_LEFT,
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
    expect(stripRoomBesideMenu(1000, 0, menu(172, false))).toBe(
      1000 - 2 * (172 + STRIP_SIDE_SPACE_PX),
    );
  });

  it('joined, gives way on the left alone: the strip centres beside the sidebar, a gap from it and the edge', () => {
    expect(stripRoomBesideMenu(1000, 0, menu(228, true))).toBe(
      1000 - 236 - 2 * STRIP_SIDE_SPACE_PX,
    );
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
    expect(stripRoomBesideMenu(600, 400, menu(572, false))).toBe(
      600 - 2 * (172 + STRIP_SIDE_SPACE_PX),
    );
  });
});

// Work Tracker 1038: the strip decides where it goes from the box as it stands whole, so a compact box never
// un-crowds it and pulls it back over the box.
describe('menuNaturalRight', () => {
  // A box 300px wide, 12px in.
  const menu = (opts: { joined?: boolean } = {}) => {
    const box = document.createElement('div');
    if (opts.joined) box.setAttribute('data-menu-joined', '');
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 12, 300, 46));
    document.body.append(box);
    return box;
  };

  it('is the drawn edge, whole or joined', () => {
    expect(menuNaturalRight(menu())).toBe(312);
    const joined = menu({ joined: true });
    joined.dataset.menuNaturalWidth = '500';
    joined.dataset.menuForm = 'icon';
    expect(menuNaturalRight(joined)).toBe(312);
  });

  it('compact, goes by the whole width the box kept from its last whole form', () => {
    const box = menu();
    box.dataset.menuNaturalWidth = '500';
    box.dataset.menuForm = 'icon';
    expect(menuNaturalRight(box)).toBe(12 + 500);
    // Never narrower than it is drawn.
    box.dataset.menuNaturalWidth = '100';
    expect(menuNaturalRight(box)).toBe(312);
    // Whole, the box measures itself as it stands.
    box.dataset.menuNaturalWidth = '500';
    box.dataset.menuForm = 'full';
    expect(menuNaturalRight(box)).toBe(312);
    // Nothing kept: its drawn edge.
    box.dataset.menuForm = 'bare';
    delete box.dataset.menuNaturalWidth;
    expect(menuNaturalRight(box)).toBe(312);
  });

  it('measures the strip’s room from the whole edge', () => {
    const box = menu();
    box.dataset.menuNaturalWidth = '380';
    box.dataset.menuForm = 'icon';
    expect(stripRoomBesideMenu(1000, 0, box)).toBe(1000 - 2 * (392 + STRIP_SIDE_SPACE_PX));
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

// Experiment (no header bar): the Share and account card at the top right, which the strip keeps clear of.
describe('the corner card', () => {
  const box = (el: HTMLElement, left: number, width: number) =>
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(left, 12, width, 36));
  const corner = (width: number) => {
    const card = document.createElement('div');
    card.setAttribute('data-corner-actions', '');
    box(card, window.innerWidth - 12 - width, width);
    document.body.append(card);
    return card;
  };
  const menuBox = (right: number, joined = false) => {
    const el = document.createElement('div');
    el.setAttribute('data-toolbar-menu', '');
    if (joined) el.setAttribute('data-menu-joined', '');
    box(el, 12, right - 12);
    document.body.append(el);
    return el;
  };
  const strip = (named: string) => {
    const region = document.createElement('div');
    region.setAttribute('data-region', 'palette');
    const el = document.createElement('div');
    el.dataset.stripNaturalWidth = named;
    region.append(el);
    document.body.append(region);
    return el;
  };
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('is named so the strip measures again when it changes', () => {
    expect(CORNER_CARD_EVENT).toBe('corner-card-change');
  });

  it('clears nothing with no card, or one not over this editor or not drawn', () => {
    expect(cornerCardClear(window.innerWidth, 0)).toBe(0);
    corner(120);
    // A split's left pane: the card stands over the right one.
    expect(cornerCardClear(window.innerWidth / 2, 0)).toBe(0);
    document.body.replaceChildren();
    corner(0);
    expect(cornerCardClear(window.innerWidth, 0)).toBe(0);
  });

  it('clears its width, its inset and the strip’s space at the window’s right', () => {
    corner(119.5);
    expect(cornerCardClear(window.innerWidth, 0)).toBe(120 + 12 + STRIP_SIDE_SPACE_PX);
  });

  it('keeps a centred strip clear of the card on both sides where it is wider than the box', () => {
    corner(200);
    const right = 200 + 12 + STRIP_SIDE_SPACE_PX;
    expect(stripRoomBesideMenu(1024, 0, null)).toBe(1024 - 2 * right);
    const menu = menuBox(100);
    expect(stripRoomBesideMenu(1024, 0, menu)).toBe(1024 - 2 * right);
  });

  it('gives a strip taking the gap everything between the box and the card', () => {
    corner(100);
    const menu = menuBox(172);
    expect(stripRoomBesideMenu(1024, 0, menu, true)).toBe(
      1024 - (172 + STRIP_SIDE_SPACE_PX) - (100 + 12 + STRIP_SIDE_SPACE_PX),
    );
    document.body.replaceChildren();
    // No card: the editor's right edge, kept the box's inset away.
    expect(stripRoomBesideMenu(1024, 0, menuBox(172), true)).toBe(
      1024 - (172 + STRIP_SIDE_SPACE_PX) - 12,
    );
  });

  it('starts a strip at the left past the box, or joined, past the sidebar it heads', () => {
    expect(stripLeftClear(null, 0)).toBe(0);
    expect(stripLeftClear(menuBox(172), 0)).toBe(172 + STRIP_SIDE_SPACE_PX);
    expect(stripLeftClear(menuBox(228, true), 0)).toBe(
      228 + STRIP_MENU_GAP_PX + STRIP_SIDE_SPACE_PX,
    );
    // Never before the editor's own left edge.
    expect(stripLeftClear(menuBox(100), 400)).toBe(0);
  });

  it('starts past the box as it stands whole while the box is compact, so it never squeezes the box smaller', () => {
    const el = menuBox(112);
    el.dataset.menuForm = 'bare';
    el.dataset.menuNaturalWidth = '179';
    expect(stripLeftClear(el, 0)).toBe(12 + 179 + STRIP_SIDE_SPACE_PX);
  });

  it('reads whether a strip shifts left, sits between, or takes the gap either way', () => {
    const shifts = document.createElement('div');
    shifts.setAttribute(STRIP_SHIFTS_LEFT, '');
    const a = document.createElement('div');
    shifts.append(a);
    const between = document.createElement('div');
    between.setAttribute(STRIP_BETWEEN, '');
    const b = document.createElement('div');
    between.append(b);
    const plain = document.createElement('div');
    expect([stripShiftsLeft(a), stripSitsBetween(a), stripTakesGap(a)]).toEqual([
      true,
      false,
      true,
    ]);
    expect([stripShiftsLeft(b), stripSitsBetween(b), stripTakesGap(b)]).toEqual([
      false,
      true,
      true,
    ]);
    expect(stripTakesGap(plain)).toBe(false);
  });

  it('drops its names first, once the named palette no longer fits beside it', () => {
    // Nothing to judge by: no width, no strip, or a strip with no named width yet.
    expect(cornerCardCompact(0)).toBe(false);
    expect(cornerCardCompact(150)).toBe(false);
    const el = strip('0');
    expect(cornerCardCompact(150)).toBe(false);
    menuBox(172);
    const room = window.innerWidth - (172 + STRIP_SIDE_SPACE_PX) - (150 + 12 + STRIP_SIDE_SPACE_PX);
    el.dataset.stripNaturalWidth = String(room);
    expect(cornerCardCompact(150)).toBe(false);
    el.dataset.stripNaturalWidth = String(room + 1);
    expect(cornerCardCompact(150)).toBe(true);
  });

  it('judges with no menu box from the editor’s left edge', () => {
    strip(String(window.innerWidth - (150 + 12 + STRIP_SIDE_SPACE_PX) + 1));
    expect(cornerCardCompact(150)).toBe(true);
  });
});
