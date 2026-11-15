import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createShape,
  layOutPages,
  pagesOf,
  pageScreenRect,
  type Element,
  type Page,
  type ScreenLink,
  type ShapeElement,
} from '@livedesign/design';
import {
  followHotspot,
  prototypeHotspots,
  shownScreen,
  startPlayer,
  stepScreen,
} from './prototype-player';

// docs/specs/007-editor/wireframe-pages.md "Prototype mode": the player's state and the hotspots on a screen.
const wire = (id: string, name?: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  device: 'iphone',
  ...(name ? { name } : {}),
});
const pages = layOutPages(pagesOf({ pages: [wire('p1', 'Home'), wire('p2', 'Cart'), wire('p3')] }));
const screen = (i: number) => pageScreenRect(pages[i]!);
const linked = (
  id: string,
  page: number,
  link: ScreenLink,
  at = { x: 40, y: 120 },
): ShapeElement => {
  const s = screen(page);
  return { ...createShape('square', s.x + at.x, s.y + at.y), id, link };
};
const to = (pageId: string, transition?: 'slide' | 'dissolve'): ScreenLink => ({
  kind: 'page',
  pageId,
  ...(transition ? { transition } : {}),
});
const back: ScreenLink = { kind: 'back', transition: 'slide' };

describe('startPlayer', () => {
  it('starts on the screen in view, else the first', () => {
    expect(startPlayer(pages, 'p2').shownId).toBe('p2');
    expect(startPlayer(pages, null).shownId).toBe('p1');
    expect(startPlayer(pages, 'gone').shownId).toBe('p1');
    expect(startPlayer([], null).shownId).toBe('');
  });

  it('shows the first screen once the one shown is deleted', () => {
    const state = startPlayer(pages, 'p3');
    expect(shownScreen(state, pages.slice(0, 2))?.id).toBe('p1');
  });
});

describe('followHotspot', () => {
  it('goes to a linked screen with its transition, remembering where it came from', () => {
    const next = followHotspot(startPlayer(pages, 'p1'), to('p3', 'slide'), pages);
    expect(next.shownId).toBe('p3');
    expect(next.history).toEqual(['p1']);
    expect(next.change).toEqual({
      fromId: 'p1',
      transition: 'slide',
      direction: 'forward',
      seq: 1,
    });
  });

  it('reads an absent transition as instant', () => {
    expect(followHotspot(startPlayer(pages, 'p1'), to('p2'), pages).change?.transition).toBe(
      'instant',
    );
  });

  it('goes back to the screen shown before, the other way, and does nothing on the first', () => {
    const start = startPlayer(pages, 'p1');
    expect(followHotspot(start, back, pages)).toBe(start);
    const there = followHotspot(start, to('p3', 'dissolve'), pages);
    const home = followHotspot(there, back, pages);
    expect(home.shownId).toBe('p1');
    expect(home.history).toEqual([]);
    expect(home.change).toMatchObject({
      fromId: 'p3',
      transition: 'slide',
      direction: 'back',
      seq: 2,
    });
  });

  it('skips screens deleted since when going back', () => {
    const a = followHotspot(startPlayer(pages, 'p1'), to('p2'), pages);
    const b = followHotspot(a, to('p3'), pages);
    const withoutCart = pages.filter((p) => p.id !== 'p2');
    expect(followHotspot(b, back, withoutCart).shownId).toBe('p1');
  });

  it('changes nothing for a broken link or a link to the screen shown', () => {
    const start = startPlayer(pages, 'p1');
    expect(followHotspot(start, to('deleted'), pages)).toBe(start);
    expect(followHotspot(start, to('p1'), pages)).toBe(start);
    expect(followHotspot(startPlayer([], null), to('p1'), [])).toEqual(startPlayer([], null));
  });
});

describe('stepScreen', () => {
  it('steps through the screens in order, at once, and stops at the ends', () => {
    const start = startPlayer(pages, 'p1');
    expect(stepScreen(start, pages, -1)).toBe(start);
    const next = stepScreen(start, pages, 1);
    expect(next.shownId).toBe('p2');
    expect(next.change).toMatchObject({ transition: 'instant', direction: 'forward' });
    const last = stepScreen(stepScreen(next, pages, 1), pages, 1);
    expect(last.shownId).toBe('p3');
    expect(stepScreen(last, pages, -1).change?.direction).toBe('back');
    expect(stepScreen(startPlayer([], null), [], 1)).toEqual(startPlayer([], null));
  });
});

describe('prototypeHotspots', () => {
  it('lists the screen’s linked elements in paint order, named for where they go', () => {
    const a = linked('a', 0, to('p2'));
    const b = linked('b', 0, back, { x: 40, y: 300 });
    const plain = { ...createShape('square', screen(0).x + 10, screen(0).y + 10), id: 'plain' };
    const elsewhere = linked('c', 1, to('p1'));
    const spots = prototypeHotspots(
      { elements: [a, plain, b, elsewhere], layers: undefined },
      pages[0]!,
      pages,
    );
    expect(spots.map((h) => [h.elementId, h.label])).toEqual([
      ['a', 'Goes to Cart'],
      ['b', 'Goes back to the screen before'],
    ]);
    expect(spots[0]!.rect).toEqual({
      x: a.x,
      y: a.y,
      width: a.width,
      height: a.height,
    });
  });

  it('leaves out a broken link, and cuts a box to the screen', () => {
    const broken = linked('x', 0, to('deleted'));
    const s = screen(0);
    const hanging = linked('h', 0, to('p2'), { x: -30, y: 200 });
    const spots = prototypeHotspots(
      { elements: [broken, hanging], layers: undefined },
      pages[0]!,
      pages,
    );
    expect(spots.map((h) => h.elementId)).toEqual(['h']);
    expect(spots[0]!.rect.x).toBe(s.x);
  });

  it('has none on a screen without links, or with only hidden ones', () => {
    expect(prototypeHotspots({ elements: [], layers: undefined }, pages[0]!, pages)).toEqual([]);
    const hidden = { ...linked('a', 0, to('p2')), layerId: 'l1' } as Element;
    expect(
      prototypeHotspots(
        { elements: [hidden], layers: [{ id: 'l1', name: 'Hidden', visible: false }] as never },
        pages[0]!,
        pages,
      ),
    ).toEqual([]);
  });

  it('leaves out a hotspot wholly off the screen', () => {
    // Anchored on the page (inside the frame) but drawn past the screen's edge, in the bezel.
    const s = screen(0);
    const page = pages[0]!;
    const el = {
      ...createShape('square', page.rect.x + 1, page.rect.y + 1),
      id: 'bezel',
      width: Math.max(1, s.x - page.rect.x - 2),
      height: Math.max(1, s.y - page.rect.y - 2),
      link: to('p2'),
    } as Element;
    const spots = prototypeHotspots({ elements: [el], layers: undefined }, page, pages);
    expect(spots).toEqual([]);
  });
});

// The worst case: a 5,000-element tab (a plan's cap) over 50 screens, a fifth of them linked, read each time the shown
// screen changes or a collaborator's edit lands.
describe('prototypeHotspots cost', () => {
  const SCREENS = 50;
  const ELEMENTS = 5000;
  const BUDGET_MS = 25;
  it(`reads ${ELEMENTS} elements over ${SCREENS} screens inside ${cpuBudgetMs(BUDGET_MS)} ms`, () => {
    const many = layOutPages(
      pagesOf({ pages: Array.from({ length: SCREENS }, (_, i) => wire(`s${i}`)) }),
    );
    const elements = Array.from({ length: ELEMENTS }, (_, i) => {
      const s = pageScreenRect(many[i % SCREENS]!);
      return {
        ...createShape('square', s.x + (i % 7) * 20, s.y + (i % 11) * 30),
        id: `e${i}`,
        ...(i % 5 === 0 ? { link: to(`s${(i + 1) % SCREENS}`) } : {}),
      };
    });
    const tab = { elements, layers: undefined };
    for (let pass = 0; pass < 3; pass++) prototypeHotspots(tab, many[0]!, many);
    const best = Math.min(
      ...[0, 1, 2].map(() => cpuMsOf(() => void prototypeHotspots(tab, many[0]!, many))),
    );
    expect(prototypeHotspots(tab, many[0]!, many)).toHaveLength(ELEMENTS / SCREENS); // the first screen's elements are the linked fifth
    expect(best).toBeLessThan(cpuBudgetMs(BUDGET_MS));
  });
});
