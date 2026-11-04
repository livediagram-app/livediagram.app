import { describe, expect, it } from 'vitest';
import {
  BUBBLE_VIEW_MARGIN_PX,
  MAX_SCREEN_BUBBLES,
  MAX_VIDEO_BUBBLES,
  onView,
  pickSeen,
  type SeenInput,
} from './bubbles';

const cam = { sessionId: 's', trackName: 'cam', token: 't' };
const screen = { sessionId: 's', trackName: 'screen', token: 't' };

// Ten people in a row to the right of you, 20 canvas px apart, every one heard, on camera and sharing.
function crowd(over: Partial<SeenInput> = {}): SeenInput {
  const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
  return {
    self: { x: 0, y: 0 },
    heard: new Set(ids),
    walkers: new Map(ids.map((id, i) => [id, { x: (i + 1) * 20, y: 0 }])),
    peers: new Map(ids.map((id) => [id, { video: cam, screen }])),
    view: { x: -500, y: -500, width: 1000, height: 1000 },
    visible: true,
    allowVideo: true,
    allowScreen: true,
    maximised: null,
    ...over,
  };
}

// docs/specs/012-collaboration/video-and-screen-bubbles.md "Who sees what".
describe('pickSeen', () => {
  it('takes the nearest cameras and screens, capped', () => {
    const seen = pickSeen(crowd());
    expect(seen.video).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
    expect(seen.video).toHaveLength(MAX_VIDEO_BUBBLES);
    expect(seen.screen).toEqual(['p0', 'p1']);
    expect(seen.screen).toHaveLength(MAX_SCREEN_BUBBLES);
  });

  it('only from people heard, walking, with that media on', () => {
    const seen = pickSeen(
      crowd({
        heard: new Set(['p0', 'p1', 'p2', 'gone']),
        peers: new Map([
          ['p0', { video: cam, screen: null }],
          ['p1', { video: null, screen }],
          ['gone', { video: cam, screen }],
        ]),
      }),
    );
    expect(seen).toEqual({ video: ['p0'], screen: ['p1'] });
  });

  it('nothing while the page is hidden or before you walk', () => {
    expect(pickSeen(crowd({ visible: false }))).toEqual({ video: [], screen: [] });
    expect(pickSeen(crowd({ self: null }))).toEqual({ video: [], screen: [] });
  });

  it('nothing the kill switch pauses', () => {
    const seen = pickSeen(crowd({ allowVideo: false, allowScreen: false }));
    expect(seen).toEqual({ video: [], screen: [] });
  });

  it('nobody off screen, with a margin; everybody before the canvas is measured', () => {
    const view = { x: 1000, y: 0, width: 500, height: 500 };
    expect(pickSeen(crowd({ view })).video).toEqual([]);
    expect(onView({ x: 1000 - BUBBLE_VIEW_MARGIN_PX, y: 0 }, view)).toBe(true);
    expect(onView({ x: 1000 - BUBBLE_VIEW_MARGIN_PX - 1, y: 0 }, view)).toBe(false);
    expect(onView({ x: 1200, y: 500 + BUBBLE_VIEW_MARGIN_PX + 1 }, view)).toBe(false);
    expect(onView({ x: 9999, y: 9999 }, null)).toBe(true);
    expect(pickSeen(crowd({ view: null })).video).toHaveLength(MAX_VIDEO_BUBBLES);
  });

  it('keeps the maximised bubble whatever the cap and the viewport say, while heard', () => {
    const far = crowd({ maximised: { id: 'p9', media: 'video' } });
    // p9, the furthest, walks far off screen: still received, first.
    const seen = pickSeen({
      ...far,
      walkers: new Map([...far.walkers, ['p9', { x: 5000, y: 0 }]]),
    });
    expect(seen.video[0]).toBe('p9');
    expect(seen.video).toHaveLength(MAX_VIDEO_BUBBLES);
    expect(pickSeen(crowd({ maximised: { id: 'p9', media: 'screen' } })).screen).toEqual([
      'p9',
      'p0',
    ]);
    // Not heard any more: let go.
    const left = crowd({ maximised: { id: 'p9', media: 'video' }, heard: new Set(['p0']) });
    expect(pickSeen(left).video).toEqual(['p0']);
  });

  it('breaks a tie in distance by id, so the pick is stable', () => {
    const seen = pickSeen(
      crowd({
        walkers: new Map([
          ['b', { x: 10, y: 0 }],
          ['a', { x: -10, y: 0 }],
        ]),
        heard: new Set(['b', 'a']),
        peers: new Map([
          ['a', { video: cam }],
          ['b', { video: cam }],
        ]),
      }),
    );
    expect(seen.video).toEqual(['a', 'b']);
  });
});
