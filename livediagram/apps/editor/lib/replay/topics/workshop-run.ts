import type { ShapeElement, StickyElement, TabTimer, TabVote } from '@livediagram/document';
import { frameOf, type Chapter, type Topic, type Waypoint } from '../topic';
import { placed, SESSION_STRIP, STRIP_VOTE, viewWidth } from './workshop-shared';

// Run the Room (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop; "Nothing is kept"): a board with
// three ideas, a Timer button and a Dot Vote button. Example presses the Timer (it counts down on its face and the
// Session strip), then Dot Vote (the room's dots land on the ideas), then ends the vote from the strip (the winners
// light up). The timer and the vote are the replay's, drawn through `frame.tab` (ReplayScope): nothing is started, so
// the room never sees them and the tab's own `timer` and `vote` are untouched.

// The ids are read by the telemetry dashboard (computed-emitters.ts TOUR_STEP_SOURCE) as `TourStep<Id>`.
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'run-timer',
    name: 'Timer',
    shortName: 'Timer',
    ms: 6500,
    say: 'Click a Timer to start it for everyone; it shows on the Session strip too.',
    sayTouch: 'Tap a Timer to start it for everyone; it shows on the Session strip too.',
  },
  {
    id: 'run-vote',
    name: 'Vote',
    shortName: 'Vote',
    ms: 7500,
    say: 'Click Dot Vote and everyone gets dots to put on the ideas they back.',
    sayTouch: 'Tap Dot Vote and everyone gets dots to put on the ideas they back.',
  },
  {
    id: 'run-results',
    name: 'Results',
    shortName: 'Wins',
    ms: 6000,
    say: 'End the vote from the Session strip and the top ideas light up.',
    sayTouch: 'End the vote from the Session strip and the top ideas light up.',
  },
];

export const DEMO_IDS = {
  notes: ['wib-run-1', 'wib-run-2', 'wib-run-3'],
  timer: 'wib-run-timer',
  vote: 'wib-run-vote',
} as const;

export const NOTES = ['Ship sooner', 'More demos', 'Pair up'] as const;

export const TIMER = { press: 1200, strip: 3200 } as const;
export const VOTE = { press: 1000, strip: 2600, look: 5600 } as const;
export const RESULTS = { press: 1200, look: 3000 } as const;

// The room's dots as they land, in ms into Vote: [when, which idea, who]. Ship Sooner ends with the most.
export const DOTS: readonly (readonly [number, number, string])[] = [
  [2000, 0, 'wib-room-1'],
  [2500, 1, 'wib-room-2'],
  [3000, 0, 'wib-room-3'],
  [3500, 2, 'wib-room-1'],
  [4000, 0, 'wib-room-2'],
  [4500, 1, 'wib-room-3'],
  [5000, 0, 'wib-room-4'],
  [5500, 2, 'wib-room-4'],
];

export type RunLayout = {
  readonly notes: readonly StickyElement[];
  readonly timer: ShapeElement;
  readonly vote: ShapeElement;
  // The wall clock when the replay began. A running timer counts against the clock (session.ts timerDisplayMs), so its
  // end is set from here and the face and the strip tick on their own.
  readonly startedAt: number;
};

const FIVE_MINUTES = 5 * 60_000;

/** The countdown the Timer press starts, as startTimer would set it (session.ts TabTimer). */
export function runningTimer(layout: RunLayout): TabTimer {
  const at = layout.startedAt + TIMER.press;
  return {
    mode: 'countdown',
    running: true,
    durationMs: FIVE_MINUTES,
    anchorAt: at + FIVE_MINUTES,
    startedAt: at,
  };
}

/** The dots cast by `ms` into Vote, by idea. */
export function votesAt(layout: RunLayout, ms: number): Record<string, string[]> {
  const votes: Record<string, string[]> = {};
  for (const [at, note, who] of DOTS) {
    if (ms < at) continue;
    const id = layout.notes[note]!.id;
    votes[id] = [...(votes[id] ?? []), who];
  }
  return votes;
}

// A three-dot vote, as the Dot Vote button starts it (its session config's `dots`), open to every layer and with no
// host named, so the strip treats it as ours to end.
const voteOf = (votes: Record<string, string[]>, active: boolean): TabVote => ({
  active,
  revealed: !active,
  votesPerPerson: 3,
  votes,
});

export const run: Topic<RunLayout> = {
  id: 'workshop-run',
  chapters: CHAPTERS,

  layout(env) {
    const { centre, tab } = env;
    // The Timer (224 x 64) and Dot Vote (104 x 96) buttons on top, as a tap lands them; the ideas under them.
    const top = centre.y - 290;
    const timer = placed<ShapeElement>(
      tab,
      DEMO_IDS.timer,
      { type: 'shape', kind: 'session-button', session: 'timer' },
      centre.x - 64,
      top + 16,
    );
    const vote = placed<ShapeElement>(
      tab,
      DEMO_IDS.vote,
      { type: 'shape', kind: 'session-button', session: 'vote' },
      centre.x + 124,
      top,
    );
    const room = Math.min(560, viewWidth(env) - 40);
    const size = Math.max(96, Math.min(140, Math.floor((room - 48) / 3)));
    const left = centre.x - (size * 3 + 48) / 2;
    const notes = NOTES.map((label, i) => ({
      ...placed<StickyElement>(
        tab,
        DEMO_IDS.notes[i]!,
        { type: 'sticky' },
        left + i * (size + 24) + size / 2,
        centre.y - 170,
        { width: size, height: size },
      ),
      label,
    }));
    return { notes, timer, vote, startedAt: Date.now() };
  },

  frame(index, ms, layout) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    const els = [layout.timer, layout.vote, ...layout.notes];
    if (i === 0) {
      return frameOf(els, ms >= TIMER.press ? { tab: { timer: runningTimer(layout) } } : {});
    }
    const timer = runningTimer(layout);
    if (i === 1) {
      return frameOf(
        els,
        ms >= VOTE.press
          ? { tab: { timer, vote: voteOf(votesAt(layout, ms), true) } }
          : { tab: { timer } },
      );
    }
    const all = votesAt(layout, Infinity);
    return frameOf(els, { tab: { timer, vote: voteOf(all, ms < RESULTS.press) } });
  },

  plan(index) {
    const i = Math.max(0, Math.min(index, CHAPTERS.length - 1));
    const plans: Waypoint[][] = [
      [
        { at: TIMER.press, to: { kind: 'element', id: DEMO_IDS.timer }, press: true },
        { at: TIMER.strip, to: SESSION_STRIP },
      ],
      [
        { at: VOTE.press, to: { kind: 'element', id: DEMO_IDS.vote }, press: true },
        { at: VOTE.strip, to: STRIP_VOTE },
        { at: VOTE.look, to: { kind: 'element', id: DEMO_IDS.notes[0], at: 'top' } },
      ],
      [
        { at: RESULTS.press, to: STRIP_VOTE, press: true },
        { at: RESULTS.look, to: { kind: 'element', id: DEMO_IDS.notes[0] } },
      ],
    ];
    return plans[i]!;
  },
};
