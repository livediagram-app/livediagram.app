# 39 — Session tools (timer + voting)

Live, facilitator-run **workshop tools** that make the collaborative templates
(retro, brainstorm, planning) interactive: a per-tab **timer** and per-tab
**dot-voting**, both driven from the Current Tab settings and synced to every
participant in real time.

## Why they need no new infrastructure

Both tools store their state as optional **`Tab` fields** — `tab.timer` and
`tab.vote` (`packages/diagram/src/index.ts`, helpers in `session.ts`). That
means they ride the **existing tab-sync pipeline** with zero realtime / API
changes: a control mutates the tab via `commitTabs` → autosave (`useAutosave`,
600 ms debounce) `PUT`s the tab to D1 → the `{kind:'tab'}` RoomOp broadcasts it
to peers (`useRoomConnection` merges it). So **late-joiners and reloads see
current state for free**, and persistence is automatic.

`commitTabs` does **not** push undo history — starting a timer or placing a dot
isn't undoable. The facilitator lifecycle actions emit a one-shot Activity-log
line (`emitTabMeta`); the high-frequency vote casts deliberately don't log.

## Roles

The realtime room already **drops view-role mutations** (spec/11). So every
control + every dot cast is naturally **edit-role only** — the facilitator and
participants share an edit link; **view-role visitors watch** the timer and
live counts but can't control or vote. No extra gating code.

## Timer

`tab.timer: { mode: 'countdown' | 'stopwatch'; running; durationMs?; anchorAt?; frozenMs? }`.

- Controlled from **Tab Settings → Session → Timer**: pick Countdown (with a
  duration: 1 / 3 / 5 / 10 min presets) or Stopwatch, then **Start / Pause /
  Resume / Reset / Clear** (`useTabSession`).
- Clients tick **locally off an absolute wall-clock anchor** (`anchorAt` =
  countdown end-time or stopwatch start instant), so there is **no per-second
  network chatter** — every client computes the same value via the pure
  `timerDisplayMs(timer, now)`. Pausing freezes the value into `frozenMs`;
  resuming re-anchors. Minor cross-client clock skew is acceptable for a
  workshop timer (out of scope: a server-authoritative clock).
- A floating **`TimerWidget`** pill (top-centre, `CanvasChrome`) shows the
  live clock, ticking ~4×/sec while running; it flashes when a countdown hits
  0:00. Edit-role sees inline pause/resume + reset; view-role sees a read-only
  clock.

## Voting (dot-voting)

`tab.vote: { active; revealed; votesPerPerson; votes: Record<elementId, participantId[]> }`
— one participant id per dot, so stacking N dots on one element is N entries.

- Controlled from **Tab Settings → Session → Vote**: a **dots-per-person**
  stepper, then **Start vote** → **End vote** → **Show results** → **Clear**,
  with a live "N cast" readout.
- **Votable targets** (`isVotable`): shapes, sticky notes, and images — **not**
  the `frame` shape (a section backdrop) and not text / freehand / table /
  arrow / annotation.
- **Casting**: while `vote.active`, pressing a votable element places one of
  your dots (`BoxedElementView` intercepts the pointer-down before
  select/drag); your budget (`votesPerPerson`) is enforced via `votesSpentBy`.
  Non-votable elements still select normally so the board stays editable.
  Counts are **live** — every element with dots shows a tally pill (brand-filled
  when it holds your dots; click it to retract one). A floating **`VoteBanner`**
  tells each participant how many dots they have left.
- **End vote** closes casting (tallies stay). **Show results** sets
  `revealed`, ringing the top element(s) (`voteWinners`); the pill flags joint
  winners by comparing to the tab-wide max (`voteMax`). **Clear** removes the
  session.

## Telemetry (spec/22)

`track('Tab', 'Started', 'CountdownTimer' | 'StopwatchTimer' | 'Vote')`,
`track('Tab', 'Ended', 'Vote')`, `track('Tab', 'Revealed', 'Vote')`, and
`track('Element', 'Voted')` on each dot. The `Started` / `Ended` / `Revealed`
/ `Voted` actions were added to the closed `TELEMETRY_ACTIONS` enum.

## Out of scope (v1)

Poll-style voting (options rather than dots), anonymous voting, a
server-authoritative clock, a timer-end sound, and view-role casting.
