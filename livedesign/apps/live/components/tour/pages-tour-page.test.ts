// @vitest-environment jsdom
// The tour page (docs/specs/007-editor/pages-tour.md "Where it appears"): of the pages on screen whose kind is
// still owed a track, unlocked and with their cog showing, the one showing the most of itself.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickTourPage } from './pages-tour-page';

vi.mock('./tour-dom', () => ({
  isOnScreen: (selector: string) => document.querySelector(selector) !== null,
}));

afterEach(() => {
  document.body.innerHTML = '';
});

// A drawn page at `rect` (left, top, width, height), with its cog unless `cog` is false.
function drawPage(
  id: string,
  kind: string,
  [left, top, width, height]: [number, number, number, number],
  { cog = true, locked = false } = {},
) {
  const el = document.createElement('div');
  el.dataset.pageId = id;
  el.dataset.pageKind = kind;
  if (locked) el.dataset.pageLocked = '';
  if (cog) el.innerHTML = '<button data-tour-id="page-cog"></button>';
  el.getBoundingClientRect = () =>
    ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;
  document.body.append(el);
}

const all = () => true;

describe('pickTourPage', () => {
  it('picks the page showing the most of itself in the window', () => {
    drawPage('a', 'infographic', [-500, 0, 600, 300]);
    drawPage('b', 'infographic', [120, 0, 600, 300]);
    expect(pickTourPage(all)).toEqual({ pageId: 'b', kind: 'infographic' });
  });

  it('passes over a kind already toured', () => {
    drawPage('a', 'infographic', [0, 0, 800, 450]);
    drawPage('b', 'logo', [820, 0, 100, 140]);
    expect(pickTourPage((kind) => kind !== 'infographic')).toEqual({ pageId: 'b', kind: 'logo' });
  });

  it('passes over a locked page and one too small to show its cog', () => {
    drawPage('a', 'infographic', [0, 0, 800, 450], { locked: true });
    drawPage('b', 'logo', [0, 0, 300, 300], { cog: false });
    expect(pickTourPage(all)).toBeNull();
  });

  it('finds nothing with no page in the window', () => {
    drawPage('a', 'infographic', [5000, 0, 800, 450]);
    expect(pickTourPage(all)).toBeNull();
  });
});
