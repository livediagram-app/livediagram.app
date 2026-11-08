import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import type { ScreenProbe } from '../topic';
import { ask, CHAPTERS, CHECK, DEMO_IDS, TILES, VOTE } from './workshop-ask';

// Ask the Room (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop). What every topic must hold is in
// topics.test.ts.

const tab = { id: 't', name: 'Tab', elements: [], backgroundColor: '#ffffff' } as unknown as Tab;
const centre = { x: 400, y: 300 };
const base = ask.layout({ centre, tab });
const layout = { ...base, tiles: { [TILES.vote]: { x: 50, y: -200 } } };
const byId = (index: number, ms: number, id: string) =>
  ask.frame(index, ms, layout).elements.find((e) => e.id === id) as ShapeElement | undefined;

describe('Ask the Room', () => {
  it('plays Dot Vote, Poll, Check-In', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['ask-vote', 'ask-poll', 'ask-check']);
  });

  it('lays out what the Ask tiles make, above the player and inside a phone-wide view', () => {
    expect(base.vote).toMatchObject({ shape: 'session-button', session: { tool: 'vote' } });
    expect(base.poll).toMatchObject({ shape: 'session-button', session: { tool: 'poll' } });
    expect(base.check.shape).toBe('temperature');
    for (const el of [base.vote, base.poll, base.check]) {
      expect(el.y + el.height).toBeLessThanOrEqual(centre.y + 80);
      expect(el.x).toBeGreaterThanOrEqual(centre.x - 195);
      expect(el.x + el.width).toBeLessThanOrEqual(centre.x + 195);
    }
  });

  it('opens Ask for each carry and closes it once the tile is out', () => {
    const open = (ms: number) => ask.frame(0, ms, layout).open;
    expect(open(0)).toEqual([]);
    expect(open(VOTE.open)).toEqual(['bar-collab-ask']);
    expect(open(VOTE.carry[0] + 100)).toEqual(['bar-collab-ask']);
    expect(open(VOTE.carry[0] + 300)).toEqual([]);
  });

  it('carries the Dot Vote from its tile, held under the cursor, to where it lands', () => {
    expect(byId(0, VOTE.carry[0] - 1, DEMO_IDS.vote)).toBeUndefined();
    const start = byId(0, VOTE.carry[0], DEMO_IDS.vote)!;
    expect(start.x + start.width / 2).toBe(50);
    const mid = ask.frame(0, (VOTE.carry[0] + VOTE.carry[1]) / 2, layout);
    expect(mid.hold).not.toBeNull();
    expect(byId(0, VOTE.carry[1], DEMO_IDS.vote)).toEqual(base.vote);
    expect(ask.frame(0, VOTE.carry[1], layout).hold).toBeNull();
  });

  it('drops a tile it never saw where it lands, and keeps the earlier drops', () => {
    expect(byId(2, CHECK.carry[0] + 10, DEMO_IDS.check)).toEqual(base.check);
    expect(ask.frame(2, CHAPTERS[2]!.ms, layout).elements.map((e) => e.id)).toEqual([
      DEMO_IDS.vote,
      DEMO_IDS.poll,
      DEMO_IDS.check,
    ]);
  });

  it('learns a tile only while its own flyout is up before its carry', () => {
    const screen: ScreenProbe = { find: () => ({ x: 10, y: 20 }), toCanvas: (p) => p };
    expect(ask.measure!(base, 0, VOTE.open, screen)?.tiles).toEqual({
      [TILES.vote]: { x: 10, y: 20 },
    });
    expect(ask.measure!(base, 0, VOTE.carry[0] + 1, screen)).toBeNull();
  });

  it('presses Ask, then the tile, then follows the drop', () => {
    const plan = ask.plan(1, layout);
    expect(plan.map((w) => w.to)).toEqual([
      { kind: 'tour', id: 'bar-collab-ask' },
      {
        kind: 'find',
        selector: `[data-tour-id="palette-category-menu"] [aria-label="${TILES.poll}"]`,
      },
      { kind: 'element', id: DEMO_IDS.poll },
    ]);
  });
});
