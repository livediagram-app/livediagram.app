import { describe, expect, it } from 'vitest';
import { timerDisplayMs, type Tab } from '@livediagram/document';
import { CHAPTERS, DEMO_IDS, RESULTS, run, TIMER, VOTE } from './workshop-run';

// Run the Room (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop; "Nothing is kept"). What every
// topic must hold is in topics.test.ts.

const tab = { id: 't', name: 'Tab', elements: [], backgroundColor: '#ffffff' } as unknown as Tab;
const centre = { x: 400, y: 300 };
const layout = {
  ...run.layout({ centre, size: { width: 1440, height: 820 }, tab }),
  startedAt: 1_000_000,
};

describe('Run the Room', () => {
  it('plays Timer, Vote, Results', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['run-timer', 'run-vote', 'run-results']);
  });

  it('sets the board once: a Timer, a Dot Vote and three ideas, never changed', () => {
    expect(layout.timer).toMatchObject({
      shape: 'session-button',
      session: { tool: 'timer', minutes: 5 },
    });
    expect(layout.vote).toMatchObject({
      shape: 'session-button',
      session: { tool: 'vote', dots: 3 },
    });
    const first = run.frame(0, 0, layout).elements;
    expect(first.map((e) => e.id)).toEqual([DEMO_IDS.timer, DEMO_IDS.vote, ...DEMO_IDS.notes]);
    expect(run.frame(2, CHAPTERS[2]!.ms, layout).elements).toEqual(first);
    for (const el of [layout.timer, layout.vote, ...layout.notes])
      expect(el.y + el.height).toBeLessThanOrEqual(centre.y + 80);
  });

  it('shows nothing running until the Timer is pressed, then a five-minute countdown from the press', () => {
    expect(run.frame(0, TIMER.press - 1, layout).tab).toBeUndefined();
    const timer = run.frame(0, TIMER.press, layout).tab?.timer;
    expect(timer).toMatchObject({ mode: 'countdown', running: true, durationMs: 300_000 });
    expect(timerDisplayMs(timer!, layout.startedAt + TIMER.press)).toBe(300_000);
    expect(run.frame(1, 0, layout).tab?.timer).toEqual(timer);
  });

  it('opens a three-dot vote on the press and lands the room dots one by one', () => {
    expect(run.frame(1, VOTE.press - 1, layout).tab?.vote).toBeUndefined();
    const opened = run.frame(1, VOTE.press, layout).tab?.vote;
    expect(opened).toMatchObject({ active: true, revealed: false, votesPerPerson: 3, votes: {} });
    const count = (ms: number) =>
      Object.values(run.frame(1, ms, layout).tab?.vote?.votes ?? {}).flat().length;
    expect(count(2400)).toBe(1);
    expect(count(CHAPTERS[1]!.ms)).toBe(8);
  });

  it('ends the vote with the results shown on the strip press, Ship Sooner ahead', () => {
    expect(run.frame(2, RESULTS.press - 1, layout).tab?.vote?.active).toBe(true);
    const ended = run.frame(2, RESULTS.press, layout).tab!.vote!;
    expect(ended).toMatchObject({ active: false, revealed: true });
    expect(ended.votes[DEMO_IDS.notes[0]]).toHaveLength(4);
    expect(run.plan(2, layout)[0]).toMatchObject({
      press: true,
      to: { kind: 'find', selector: '[data-tour-id="session-tools"] button[aria-label*="Vote"]' },
    });
  });
});
