// The server's hearing check (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Trust", #483; "Share roles",
// #495): who may receive whom from what the room knows, conservative at every edge.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { CallLevel, CallStage, CallZone } from '@livehuddle/document';
import {
  EDGE_MARGIN_PX,
  HEARING_MARGIN_PX,
  hearingVerdict,
  mayLetSpeakNow,
  speaksFromStage,
  type HearingWorld,
  type Placed,
  type TabCalls,
} from './call-hearing';

const zone = (id: string, x0: number, y0: number, x1: number, y1: number): CallZone => ({
  id,
  x0,
  y0,
  x1,
  y1,
  area: (x1 - x0) * (y1 - y0),
});
const stage = (over: Partial<CallStage> = {}): CallStage => ({
  ...zone('stage', 1000, 1000, 1400, 1100),
  zone: null,
  speakers: 'edit',
  cameras: false,
  ...over,
});

// A boardroom with a phone booth inside it, a second room beside it, and the open floor round them.
const BOARDROOM = zone('board', 0, 0, 1000, 600);
const BOOTH = zone('booth', 100, 100, 300, 300);
const KITCHEN = zone('kitchen', 1000, 0, 1600, 600);
const TAB: TabCalls = { zones: [BOARDROOM, BOOTH, KITCHEN], stages: [] };

function world(
  placed: Record<string, [number, number, string?]>,
  over: {
    levels?: Record<string, CallLevel>;
    letBy?: Record<string, string>;
    tab?: TabCalls;
    grace?: boolean;
  } = {},
): HearingWorld {
  const at = new Map<string, Placed>();
  for (const [id, [x, y, tabId]] of Object.entries(placed))
    at.set(id, { tabId: tabId ?? 't', at: { x, y } });
  return {
    placed: at,
    levels: new Map(Object.entries(over.levels ?? {})),
    letBy: new Map(Object.entries(over.letBy ?? {})),
    tab: (tabId) => (tabId === 't' ? (over.tab ?? TAB) : { zones: [], stages: [] }),
    grace: over.grace ?? false,
  };
}

describe('hearingVerdict', () => {
  it('lets a shared room hear whatever the distance, and nobody through a wall', () => {
    const w = world({ a: [500, 500], b: [950, 50], c: [1300, 300], d: [200, 200] });
    expect(hearingVerdict(w, 'a', 'b')).toBe('heard');
    // The kitchen beside the boardroom, and the booth inside it, are calls of their own.
    expect(hearingVerdict(w, 'a', 'c')).toBe('apart');
    expect(hearingVerdict(w, 'a', 'd')).toBe('apart');
    expect(hearingVerdict(w, 'd', 'a')).toBe('apart');
  });

  it('hears the open floor by distance, with a margin past the release radius', () => {
    const near = 300 + HEARING_MARGIN_PX;
    const w = world({ a: [2000, 2000], b: [2000 + near, 2000], c: [2000 + near + 1, 2000] });
    expect(hearingVerdict(w, 'a', 'b')).toBe('heard');
    expect(hearingVerdict(w, 'a', 'c')).toBe('apart');
  });

  it('counts someone within the edge margin of a wall on either side of it', () => {
    // Just outside the boardroom's bottom wall, and just inside it: the margin lets them meet.
    const outside = 600 + EDGE_MARGIN_PX - 1;
    const beyond = 600 + EDGE_MARGIN_PX + 1;
    const w = world({ a: [500, outside], b: [500, 590], c: [500, beyond], deep: [500, 300] });
    expect(hearingVerdict(w, 'a', 'b')).toBe('heard');
    expect(hearingVerdict(w, 'a', 'deep')).toBe('heard');
    // Beyond the margin, only someone near the wall inside might be in the open with them.
    expect(hearingVerdict(w, 'c', 'deep')).toBe('apart');
    expect(hearingVerdict(w, 'c', 'b')).toBe('heard');
  });

  it('keeps a booth private from the room around it beyond the margin', () => {
    const w = world({ inBooth: [200, 200], onFloor: [600, 400] });
    expect(hearingVerdict(w, 'onFloor', 'inBooth')).toBe('apart');
  });

  it('refuses another tab, and an unknown position unless the room has just started', () => {
    const w = world({ a: [10, 10], b: [12, 12, 'other'] });
    expect(hearingVerdict(w, 'a', 'b')).toBe('apart');
    expect(hearingVerdict(w, 'a', 'nobody')).toBe('unplaced');
    expect(hearingVerdict(w, 'nobody', 'a')).toBe('unplaced');
    expect(hearingVerdict(world({ a: [10, 10] }, { grace: true }), 'a', 'nobody')).toBe('heard');
  });

  it('lets a stage speaker reach the whole tab, only when the stage lets their level speak', () => {
    const tab: TabCalls = { zones: [KITCHEN], stages: [stage()] };
    const placed = { speaker: [1200, 1050], far: [1300, 300] } as Record<string, [number, number]>;
    expect(
      hearingVerdict(world(placed, { tab, levels: { speaker: 'edit' } }), 'far', 'speaker'),
    ).toBe('heard');
    expect(
      hearingVerdict(world(placed, { tab, levels: { speaker: 'participate' } }), 'far', 'speaker'),
    ).toBe('apart');
    const takePart = { zones: [KITCHEN], stages: [stage({ speakers: 'take-part' })] };
    expect(
      hearingVerdict(
        world(placed, { tab: takePart, levels: { speaker: 'participate' } }),
        'far',
        'speaker',
      ),
    ).toBe('heard');
  });

  it('lets a hand let speak reach the tab while whoever let it still may', () => {
    const placed = { hand: [3000, 3000], far: [10, 10], ed: [5, 5], pt: [6, 6] } as Record<
      string,
      [number, number]
    >;
    const levels = { ed: 'edit', pt: 'participate' } as const;
    expect(hearingVerdict(world(placed, { levels, letBy: { hand: 'ed' } }), 'far', 'hand')).toBe(
      'heard',
    );
    // A Participant off every stage can no longer let anyone speak.
    expect(hearingVerdict(world(placed, { levels, letBy: { hand: 'pt' } }), 'far', 'hand')).toBe(
      'apart',
    );
  });
});

describe('who may let a hand speak (#495)', () => {
  const tab: TabCalls = { zones: [], stages: [stage({ speakers: 'take-part' })] };
  it('is an Editor anywhere, or someone on a stage that lets them speak', () => {
    const w = world(
      { ed: [0, 0], onStage: [1200, 1050], offStage: [0, 0], viewer: [1200, 1050] },
      {
        tab,
        levels: { ed: 'edit', onStage: 'participate', offStage: 'participate', viewer: 'view' },
      },
    );
    expect(mayLetSpeakNow(w, 'ed')).toBe(true);
    expect(mayLetSpeakNow(w, 'onStage')).toBe(true);
    expect(mayLetSpeakNow(w, 'offStage')).toBe(false);
    expect(mayLetSpeakNow(w, 'viewer')).toBe(false);
    expect(mayLetSpeakNow(w, 'nobody')).toBe(false);
  });

  it('counts the stage edge margin, and no stage at all as none', () => {
    const w = world(
      { edge: [1200, 1100 + EDGE_MARGIN_PX - 1], beyond: [1200, 1100 + EDGE_MARGIN_PX + 1] },
      { tab, levels: { edge: 'participate', beyond: 'participate' } },
    );
    expect(speaksFromStage(w, 'edge')).toBe(true);
    expect(speaksFromStage(w, 'beyond')).toBe(false);
    expect(speaksFromStage(world({ a: [0, 0] }, { levels: { a: 'edit' } }), 'a')).toBe(false);
  });
});

describe('cost', () => {
  it('answers a full subscribe batch in a crowded Space well inside a millisecond each', () => {
    // 100 walkers, 30 rooms and 4 stages: one subscribe's 16 tracks, as the room answers them.
    const zones = Array.from({ length: 30 }, (_, i) =>
      zone(`r${i}`, i * 300, 0, i * 300 + 280, 400),
    );
    const stages = Array.from({ length: 4 }, (_, i) =>
      stage({ id: `s${i}`, x0: i * 500, x1: i * 500 + 300, y0: 2000, y1: 2100 }),
    );
    const placed: Record<string, [number, number]> = {};
    for (let i = 0; i < 100; i++) placed[`p${i}`] = [(i * 97) % 9000, (i * 53) % 2400];
    const w = world(placed, { tab: { zones, stages } });
    const ms = cpuMsOf(() => {
      for (let n = 0; n < 100; n++) for (let i = 1; i <= 16; i++) hearingVerdict(w, 'p0', `p${i}`);
    });
    // 1,600 verdicts. Measured about 3 ms on a laptop (about 2 µs each).
    expect(ms).toBeLessThan(cpuBudgetMs(60));
  });
});
