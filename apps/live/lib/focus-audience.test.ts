import { describe, expect, it } from 'vitest';
import { pagesOf, layOutPages, type Tab } from '@livediagram/document';
import { focusPageAt, focusPressOutcome, viewIsCentredOn } from './focus-audience';

const SIZE = { width: 1200, height: 800 };
// A view whose middle is exactly the canvas point (400, 300) at 50% zoom.
const centred = { size: SIZE, pan: { x: 1200 / 2 - 400, y: 800 / 2 - 300 }, zoom: 0.5 };
const AT = { x: 400, y: 300 };

describe('viewIsCentredOn', () => {
  it('says yes to the view centreOn would have produced', () => {
    expect(viewIsCentredOn(centred, AT)).toBe(true);
  });

  it('says yes at any zoom, because taking it keeps your own', () => {
    expect(viewIsCentredOn({ ...centred, zoom: 2 }, AT)).toBe(true);
    expect(viewIsCentredOn({ ...centred, zoom: 0.25 }, AT)).toBe(true);
  });

  it('says no once they have panned the point away from the middle', () => {
    // 600 canvas units at 50% zoom is 300px on screen, well past the slack.
    const panned = { ...centred, pan: { x: centred.pan.x - 600, y: centred.pan.y } };
    expect(viewIsCentredOn(panned, AT)).toBe(false);
  });

  it('measures the slack on screen, not on the canvas', () => {
    // 100 canvas units: 50px at 50% zoom (inside the 80px slack), but 200px
    // at 200% zoom (outside it). Same canvas distance, different thing to see.
    const off = (zoom: number) => ({
      size: SIZE,
      pan: { x: SIZE.width / 2 - 400 - 100, y: SIZE.height / 2 - 300 },
      zoom,
    });
    expect(viewIsCentredOn(off(0.5), AT)).toBe(true);
    expect(viewIsCentredOn(off(2), AT)).toBe(false);
  });

  it('says no to an unmeasured canvas rather than guessing', () => {
    expect(viewIsCentredOn({ ...centred, size: { width: 0, height: 0 } }, AT)).toBe(false);
  });
});

describe('focusPressOutcome', () => {
  const base = { tabId: 'tab-a', at: AT };
  const view = (
    over: Partial<{
      tabId: string;
      pan: { x: number; y: number };
      zoom: number;
      size: { width: number; height: number } | undefined;
    }> = {},
  ) => ({
    tabId: 'tab-a',
    pan: centred.pan,
    zoom: 0.5,
    size: SIZE,
    ...over,
  });

  it('is alone in an empty room', () => {
    expect(focusPressOutcome({ ...base, sent: true, peerIds: [], viewports: new Map() })).toBe(
      'alone',
    );
  });

  it('is alone when the op could not go out', () => {
    expect(focusPressOutcome({ ...base, sent: false, peerIds: ['a'], viewports: new Map() })).toBe(
      'alone',
    );
  });

  it('asks when somebody is looking elsewhere', () => {
    const viewports = new Map([
      ['a', view()],
      ['b', view({ pan: { x: 0, y: 0 } })],
    ]);
    expect(focusPressOutcome({ ...base, sent: true, peerIds: ['a', 'b'], viewports })).toBe(
      'asked',
    );
  });

  it('asks when somebody is on another tab', () => {
    const viewports = new Map([['a', view({ tabId: 'tab-b' })]]);
    expect(focusPressOutcome({ ...base, sent: true, peerIds: ['a'], viewports })).toBe('asked');
  });

  it('asks for a peer we have never heard a viewport from', () => {
    // Unknown is not the same as already there, and erring towards "asked" is
    // the harmless direction.
    expect(focusPressOutcome({ ...base, sent: true, peerIds: ['a'], viewports: new Map() })).toBe(
      'asked',
    );
  });

  it('reports a room that is already looking at it, whatever their zoom', () => {
    const viewports = new Map([
      ['a', view()],
      ['b', view({ zoom: 1.5 })],
    ]);
    expect(focusPressOutcome({ ...base, sent: true, peerIds: ['a', 'b'], viewports })).toBe(
      'already-there',
    );
  });

  it("judges each peer on their own canvas, not the presser's", () => {
    // Centred for a canvas of our size, so our size would call it already
    // there. On their twice-as-wide canvas the point sits well off their
    // middle, and their own receiver puts the dialog up: so it is asked.
    const wide = { width: SIZE.width * 2, height: SIZE.height * 2 };
    const viewports = new Map([['a', view({ size: wide })]]);
    expect(focusPressOutcome({ ...base, sent: true, peerIds: ['a'], viewports })).toBe('asked');
  });

  it('asks a peer whose viewport carries no size (a client from before it was sent)', () => {
    const viewports = new Map([['a', view({ size: undefined })]]);
    expect(focusPressOutcome({ ...base, sent: true, peerIds: ['a'], viewports })).toBe('asked');
  });
});

// docs/specs/012-collaboration/bring-focus.md "On a page": on a Pages tab the press points at the page.
describe('focusPageAt', () => {
  const tab = (over: Partial<Tab> = {}): Tab => ({
    id: 'tab-a',
    name: 'Pages',
    elements: [],
    opensIn: 'pages',
    pages: [
      { id: 'p1', orientation: 'portrait' },
      { id: 'p2', orientation: 'landscape' },
    ],
    ...over,
  });
  const rects = () => layOutPages(pagesOf(tab()));
  const middleOf = (r: { x: number; y: number; width: number; height: number }) => ({
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
  });

  it('finds the page the point is on', () => {
    const [p1, p2] = rects();
    expect(focusPageAt(tab(), middleOf(p1!.rect))?.id).toBe('p1');
    expect(focusPageAt(tab(), middleOf(p2!.rect))?.id).toBe('p2');
  });

  it('is null on the surround between pages', () => {
    const [p1] = rects();
    expect(focusPageAt(tab(), { x: p1!.rect.x + p1!.rect.width + 1, y: 0 })).toBeNull();
  });

  it('is null on a tab that is not showing pages', () => {
    const [p1] = rects();
    expect(focusPageAt(tab({ opensIn: 'diagram' }), middleOf(p1!.rect))).toBeNull();
    expect(focusPageAt(undefined, middleOf(p1!.rect))).toBeNull();
  });
});

describe('viewIsCentredOn with a page', () => {
  const PAGE = { x: 0, y: 0, width: 600, height: 400 };
  // A 1200x800 canvas whose middle is the page's middle.
  const framing = (zoom: number) => ({ size: SIZE, pan: { x: 600 - 300, y: 400 - 200 }, zoom });
  const corner = { x: 10, y: 10 };

  it('is there when the page is framed, wherever the point is on it', () => {
    expect(viewIsCentredOn(framing(1.8), corner, PAGE)).toBe(true);
    expect(viewIsCentredOn(framing(0.5), corner, PAGE)).toBe(true);
  });

  it('is not there when zoomed into part of the page', () => {
    expect(viewIsCentredOn(framing(3), corner, PAGE)).toBe(false);
  });

  it('is not there when the middle of the view is off the page', () => {
    expect(viewIsCentredOn({ ...framing(1), pan: { x: 2000, y: 0 } }, corner, PAGE)).toBe(false);
  });

  it('judges a press on a page by the page, from the presser side too', () => {
    const viewports = new Map([['a', { tabId: 'tab-a', ...framing(1.5) }]]);
    expect(
      focusPressOutcome({ sent: true, peerIds: ['a'], viewports, tabId: 'tab-a', at: corner }),
    ).toBe('asked');
    expect(
      focusPressOutcome({
        sent: true,
        peerIds: ['a'],
        viewports,
        tabId: 'tab-a',
        at: corner,
        page: PAGE,
      }),
    ).toBe('already-there');
  });
});
