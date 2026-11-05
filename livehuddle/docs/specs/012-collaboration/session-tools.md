# Session tools (timer)

In livehuddle (Work Tracker #423) the Timer is one of the two light meeting tools, with Bring Focus. The Session
strip offers the **Timer** (countdown and stopwatch); Poll and the Session button left
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md), part 3), and the dot vote left after them
([Vote](../002-project-scope/not-in-livehuddle.md#the-vote)). The Poll button shows only while a stored Poll card's poll
runs, so it can be ended. What this spec says about them otherwise stands.

A live, facilitator-run **per-tab timer**, driven from the Session strip and synced to every participant in real
time.

## Why it needs no new infrastructure

The timer stores its state as an optional **`Tab` field**, `tab.timer` (`packages/document/src/index.ts`, helpers in
`session.ts`). That means it rides the **existing tab-sync pipeline** with zero realtime / API changes: a control
mutates the tab via `commitTabs` → autosave (`useAutosave`, 600 ms debounce) `PUT`s the tab to the api → the
`{kind:'tab'}` RoomOp broadcasts it to peers (`useRoomConnection` merges it). So **late-joiners and reloads see
current state for free**, and persistence is automatic.

`commitTabs` does **not** push undo history: starting a timer isn't undoable.

A tab saved with the old `vote` field still loads: `dropRetiredVote` drops it on read
([Vote](../002-project-scope/not-in-livehuddle.md#the-vote)).

## Roles

The realtime room already **drops view-role mutations** ([API app](../015-api/api.md)). So every control is
naturally **edit-role only**: the facilitator and participants share an edit link; **view-role visitors watch** the
timer but can't control it. No extra gating code.

## Starting one from the canvas

The timer could also be started by a [Session button](session-button.md): a canvas element carrying "5 minute timer", so a canvas can carry its own facilitation instead of relying on whoever built it. It pressed through the same entry points described below, so every rule here applied, the edit-role gate included.

## The session panes

Each tool has a purpose-built pane (`components/panels/session-studio/`: `TimerPane`,
`PollPane`), described under its section below and in [Live poll (ephemeral pulse-check)](live-poll.md)
for the poll. A pane shows the tool's **set-up** while it is idle and its **live** controls once it
runs. The panes open from the [Session strip](#the-session-strip) in the bottom bar, one popover per
tool. The tab menu (the tab's ⋯ and the canvas right-click menu) has **no** session tools: the strip
gives each tool its own button.

## One UI per tool, in three places

A session tool's controls are ONE component, rendered in the Session strip's
popover, in the element's `…` quick menu, and in that element's right-click
**Session** category. One implementation, not three: three would drift into different controls, different wording, and for polls a
different answer cap.

The bodies are CONTROLLED (`TimerSetupBody`,
`PollComposerBody`), which is what lets one component serve both jobs: in the
strip's popover the value is local state and means "what I am about to start"; on an
element it is the element's stored config, so setting it configures the button
AND the Start button runs it now with that value. One number doing both, so no
mode flag is needed.

The element menus read the session verbs off `EditorContext` rather than taking
them as props, because threading them would mean new props on `Canvas` and
every element face, and the faces are memoised so a canvas of a hundred
elements does not re-render on unrelated state. That is safe because of WHERE
the bodies mount: `ElementEllipsisMenu` invokes its children only while the
popover is open, so nothing subscribes until somebody asks to see it.

The element popover matches the strip popover's pane width (`w-72`). Not cosmetic: the
poll's answer tiles wrap differently at 240px, which is how a label came to be
truncated in one surface and not the other.

## Timer

`tab.timer: { mode: 'countdown' | 'stopwatch'; running; durationMs?; anchorAt?; frozenMs?; startedAt? }`.

`startedAt` is the instant the run was started, minted by `startTimer` (which
returns it) and carried unchanged through pause, resume and extend; Reset and a
length change from the Timer menu start a new run without it. It lets an
[Agenda](agenda.md#the-current-segment) segment recognise the countdown it
started.

- Controlled from the [Session strip](#the-session-strip)'s **Timer** button. Countdown and Stopwatch are one **Timer** tool with a
  mode switch, since a tab runs one timer (the telemetry types stay
  `CountdownTimer` / `StopwatchTimer`). A countdown's length is set on the
  **dial**: drag the handle round (one lap = an hour, the wedge IS the time),
  tap a preset (1 / 3 / 5 / 10 / 15 / 30 min), or step a minute with − / +,
  up to `TIMER_MINUTES_RANGE.max` (2 hours; a length past one lap draws an
  outer lap ring). The dial is a `role="slider"` and takes arrow keys (±1),
  Page Up/Down (±5), Home / End. Dragging past twelve **sticks at the pin**
  rather than wrapping 59 → 1 (`dialDragMinutes`). A press elsewhere on the dial jumps to that time; a press
  on the handle (within two minutes of it, round the dial) takes hold of it where it is (`dialPressGrabsHandle`),
  so grabbing a 1-minute handle a hair left of twelve never reads as a full lap. Running, the same dial is
  the readout: the wedge drains toward twelve, turning amber in the last
  minute and red at zero; a stopwatch sweeps a ring once a minute. Under it
  sit round transport buttons, **Reset / Pause|Resume / End** (and **Again**
  once a countdown hits zero, which restarts it at its length), plus
  **+30s / +1 min / +5 min** on a countdown (`extendTimer`: the end instant
  and the length grow together, so the wedge stays a true fraction instead of
  jumping back to full; telemetry `Changed TimerExtended`).
- **One timer per tab**: `tab.timer` is a single value. While one exists the
  Timer pane shows it instead of the set-up, so there is no way to start a
  second one by accident; ending it returns to the set-up.
- Clients tick **locally off an absolute wall-clock anchor** (`anchorAt` =
  countdown end-time or stopwatch start instant), so there is **no per-second
  network chatter**: every client computes the same value via the pure
  `timerDisplayMs(timer, now)`. Pausing freezes the value into `frozenMs`;
  resuming re-anchors. Minor cross-client clock skew is acceptable for a
  workshop timer (out of scope: a server-authoritative clock).
- The running timer is the **Timer button** of the [Session strip](#the-session-strip) in the
  bottom-right cluster. The button shows the live clock, ticking ~4×/sec while running, with the
  countdown's drain behind it, and it flashes when a countdown hits 0:00. Pressing it opens the
  live Timer pane as a popover above it: the dial, the +30s / +1 min / +5 min extensions and
  Reset / Pause or Resume / End. View-role visitors, and everyone while somebody else
  [facilitates](facilitator.md), get the dial alone. There is no timer band at the top of the canvas.

## The Session strip

The running session tools live in **one strip in the bottom-right cluster**. It sits right
after Undo and Redo. **An editor always has the Timer button**, running or not, so the timer
is one press away; the Poll button shows only while a stored Poll card's poll runs. Idle, a button is just its glyph and opens that tool's set-up pane, the same form a session
button element's menu offers; running, it opens the live tool:

- **Timer**: idle, the timer glyph, opening the Timer set-up. While the tab has a timer, the glyph
  and the live clock, so the time reads without opening anything; it opens the live Timer pane
  (see Timer above).
- **Poll**: the poll glyph, opening the poll composer. While a poll runs and its results are yours
  to see (the host, or anyone who has answered, [Live poll](live-poll.md)), the glyph carries a
  live dot and opens the **Poll panel**. Asking a poll closes the composer: the question is on
  everyone's screen, and the button carries the results from there.

**A view-role visitor**, who cannot start anything, gets only the buttons of tools that are
running, and their popovers read-only (the Timer's dial without its controls); with nothing
running they get no strip. While somebody else [facilitates](facilitator.md), an editor's set-up
panes are disabled under a note naming them.

**Which tools the strip offers** (`sessionStripTools`): the Timer, plus Poll while a stored poll runs, on every tab
([Workshop mode](workshop-mode.md)). A popover whose button leaves closes.

Order, left to right: Timer, Poll. **On a phone** the strip stays in the cluster's one row, between Undo and Redo and the theme brush: the cluster's buttons share the row's width, each from 36px up to the usual 44px (always 44px tall to tap), with 6px gaps, so Undo, Redo, the session tools, the theme brush and Fit fill the row on a 360px screen and up. On a narrower one the cluster wraps from the right, so Undo is never pushed off the screen. Each segment opens its
panel as a **popover hanging above it** with an arrow at the button, and a second press closes
it. **While a poll runs, on a desktop, nothing else closes its popover**: a press on the
canvas leaves it up, because a facilitator watches the answers come in
while the room works. Every popover closes on its own **when the activity ends** (the timer
is cleared, the poll ended), rather than turning back into the set-up under the pointer. The
**Timer**'s popover always closes on a press outside, running or not: its clock is already on the
button, so there is nothing to watch in it. So do an idle tool's popover and any popover on a
phone (where it would cover the canvas). Asking a poll keeps the popover open: it becomes the Poll panel. They share the editor's one open-popover slot with Collaborate
and the Explorer. Nothing opens on its own: a timer somebody starts lights its button and
leaves the canvas clear. It is hidden only while presenting, in the
welcome flow or in a [read-only embed](../013-workspace/embeds.md) (which offers no session to run or join), with the rest of the cluster.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`track('Tab', 'Started', 'CountdownTimer' | 'StopwatchTimer')`, and `Changed TimerExtended` (see Timer above). The
vote events left with the vote, and the `Voted` and `Revealed` actions left the closed `TELEMETRY_ACTIONS` enum
([Vote](../002-project-scope/not-in-livehuddle.md#the-vote)).

## Out of scope (v1)

A server-authoritative clock and a timer-end sound.
