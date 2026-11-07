# Session tools (timer)

Status: **gone from livehuddle** (owner, 2026-11-05: "The Timer button should be removed, and instead have elements we
can place in rooms that are Timer or Stopwatches"). livehuddle has no Session strip and no tab timer. A meeting's clock
is a placed piece now: the [Timer and Stopwatch](../009-elements/timer-and-stopwatch.md), one per room, in the
palette's Meet category. livediagram keeps its Session strip, Timer and the rest of this spec's twin
([livediagram's Session tools](../../../../livediagram/docs/specs/012-collaboration/session-tools.md)), which stays the
one to read and change for it. The record is [Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-session-strips-timer).

## What left

- **The Session strip** in the bottom-right cluster and its one tool, the **Timer** button (countdown and stopwatch,
  its dial, its +30s / +1 min / +5 min, its live clock on the button), its popover and the session studio's Timer
  pane. The Poll button and the dot vote had gone before it ([Vote](../002-project-scope/not-in-livehuddle.md#the-vote)).
- **Its telemetry**: `Tab Started` / `Ended` `CountdownTimer` / `StopwatchTimer`, `Tab Toggled TimerPaused` /
  `TimerResumed`, `Tab Changed TimerReset` / `TimerExtended` and `UI Opened SessionTimer` are no longer sent. The
  `Started` and `Ended` actions stay in the closed list: tours, the facilitator baton and the new pieces send them.
- **Its help**: the Session Tools article and its Timer sub-article now teach the Timer and Stopwatch pieces, at the
  same addresses.

## A tab saved with a timer

A tab saved while the Session strip existed may carry `tab.timer` (`{ mode, running, durationMs?, anchorAt?,
frozenMs?, startedAt? }`). It still loads: `dropRetiredTimer` (`packages/document/src/retired-timer.ts`) drops the
field on read, in the stored-tab migration beside `dropRetiredVote`, and on a peer's `tab` op and `tab-meta` patch, so
no data migration is needed and the tab is saved without it the next time it is saved. A running old timer simply
stops showing; nothing carries it onto a piece. A tab saved with the older `vote` field loads the same way
([Vote](../002-project-scope/not-in-livehuddle.md#the-vote)).

## What stays

[Bring Focus](bring-focus.md) and the [facilitator baton](facilitator.md) it answers to. The baton no longer governs a
clock: the Timer and Stopwatch pieces belong to their rooms, and anyone who takes part may run them.
