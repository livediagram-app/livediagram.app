import { describe, expect, it } from 'vitest';
import { focusPressOutcome, viewIsCentredOn } from './focus-audience';

const SIZE = { width: 1200, height: 800 };
// A view whose middle is exactly the canvas point (400, 300) at 50% zoom.
const centred = { size: SIZE, pan: { x: 1200 / 2 - 400, y: 800 / 2 - 300 }, zoom: 0.5 };
const AT = { x: 400, y: 300 };

describe('viewIsCentredOn', () => {
  it('says yes to the view centreOn would have produced', () => {
    expect(viewIsCentredOn(centred, AT, 0.5)).toBe(true);
  });

  it('says no once the zoom is a different amount of board', () => {
    expect(viewIsCentredOn({ ...centred, zoom: 0.75 }, AT, 0.5)).toBe(false);
  });

  it('tolerates a nudge of the zoom slider', () => {
    expect(viewIsCentredOn({ ...centred, zoom: 0.51 }, AT, 0.5)).toBe(true);
  });

  it('says no once they have panned the point away from the middle', () => {
    // 600 canvas units at 50% zoom is 300px on screen, well past the slack.
    const panned = { ...centred, pan: { x: centred.pan.x - 600, y: centred.pan.y } };
    expect(viewIsCentredOn(panned, AT, 0.5)).toBe(false);
  });

  it('measures the slack on screen, not on the board', () => {
    // 100 canvas units: 50px at 50% zoom (inside the 80px slack), but 200px
    // at 200% zoom (outside it). Same board distance, different thing to see.
    const off = (zoom: number) => ({
      size: SIZE,
      pan: { x: SIZE.width / 2 - 400 - 100, y: SIZE.height / 2 - 300 },
      zoom,
    });
    expect(viewIsCentredOn(off(0.5), AT, 0.5)).toBe(true);
    expect(viewIsCentredOn(off(2), AT, 2)).toBe(false);
  });

  it('says no to an unmeasured canvas rather than guessing', () => {
    expect(viewIsCentredOn({ ...centred, size: { width: 0, height: 0 } }, AT, 0.5)).toBe(false);
  });
});

describe('focusPressOutcome', () => {
  const base = { size: SIZE, tabId: 'tab-a', at: AT, zoom: 0.5 };
  const view = (
    over: Partial<{ tabId: string; pan: { x: number; y: number }; zoom: number }> = {},
  ) => ({
    tabId: 'tab-a',
    pan: centred.pan,
    zoom: 0.5,
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

  it('reports a room that is already looking at it', () => {
    const viewports = new Map([
      ['a', view()],
      ['b', view()],
    ]);
    expect(focusPressOutcome({ ...base, sent: true, peerIds: ['a', 'b'], viewports })).toBe(
      'already-there',
    );
  });
});
