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

- Controlled from the tab menu's **Collaborate** row — a side-flyout
  parent (`MenuFlyoutSection`, the same parent/child pattern the element
  menu uses for Style / Text / Tools) that groups every live session tool
  under one entry instead of four top-level rows: **Countdown**,
  **Stopwatch**, **Vote**, and the ephemeral **Poll** (spec/88). Countdown
  carries a duration (1 / 3 / 5 / 10 min presets); both timers offer
  **Start / Pause / Resume / Reset / Clear**
  (`useTabSession`). The open category shows a live big-digit clock with a
  running/paused status and, for countdowns, a progress track.
- **One timer per tab**: `tab.timer` is a single value, so starting either
  tool replaces (resets) the other. When the other tool is running, the
  Start UI says so before it happens ("Starting resets the running
  stopwatch/countdown").
- Clients tick **locally off an absolute wall-clock anchor** (`anchorAt` =
  countdown end-time or stopwatch start instant), so there is **no per-second
  network chatter** — every client computes the same value via the pure
  `timerDisplayMs(timer, now)`. Pausing freezes the value into `frozenMs`;
  resuming re-anchors. Minor cross-client clock skew is acceptable for a
  workshop timer (out of scope: a server-authoritative clock).
- A floating **`TimerWidget`** pill shows the live clock, ticking ~4×/sec
  while running; it flashes when a countdown hits 0:00. Edit-role sees inline
  pause/resume + reset; view-role sees a read-only clock. It renders inside the
  shared **`TopCenterStack`** (`TopCenter.tsx`), which lays out every floating
  top pill — owner/role badge, mode banners, multi-selection toolbar, timer,
  vote — as one non-overlapping column. The stack centres at the top from `sm:`
  up but anchors to the top **left** on mobile, so it clears the mobile dock
  buttons (Explorer / Palette) at the top right. The timer shares a row
  with the active mode banner / selection toolbar: it sits to the **right** of
  it on desktop and **underneath** it on mobile rather than stacking on top.

## Voting (dot-voting)

`tab.vote: { active; revealed; votesPerPerson; votes: Record<elementId, participantId[]> }`
— one participant id per dot, so stacking N dots on one element is N entries.

- Controlled from **Tab menu → Collaborate → Vote**: a **dots-per-person**
  stepper, then **Start vote** → **End vote** → **Show results** → **Clear**,
  with a live "N cast" readout.
- **Votable targets** (`isVotable`): shapes, sticky notes, and images — **not**
  the `frame` shape (a section backdrop) and not text / freehand / table /
  arrow / annotation.
- **Casting**: while `vote.active`, pressing a votable element places one of
  your dots (`BoxedElementView` intercepts the pointer-down before
  select/drag); your budget (`votesPerPerson`) is enforced via `votesSpentBy`.
  Non-votable elements still select normally so the board stays editable.
  Counts are **live**. While casting is open, every votable element carries a
  **stepper** — minus, the count, plus — reading `0` before anything lands.
  Plus casts one of your dots, minus retracts one. It replaced a bare
  click-to-retract count that only appeared once an element already had a
  dot, which made the first dot on a board an act of faith: nothing on
  screen said an element was a target or how to add to it. Minus is
  disabled at zero and plus once your budget is spent, rather than
  hidden, so the row's width — and so the plus's position — never shifts
  under the pointer mid-vote. The stepper sits INSIDE the element's
  bottom-right corner (clearance from the edge, and from a neighbour's
  stepper on a packed board) and stops its own pointer events so a minus
  can't bubble into the element-body cast and re-add what it just removed.
  Once casting closes it reverts to a read-only count: a result to read,
  not a control. A floating **`VoteBanner`**
  (the same `TopCenterStack`, stacked below the timer row) tells each
  participant how many dots they have left — and **only** that. It floats
  over the canvas for the whole vote, so it carries one glanceable phrase
  ("2 of 3 dots left") rather than instructions or status chips; anything
  longer turns a status pill into a paragraph parked on the board.
- **Vote privacy** — two per-vote switches set before **Start vote** (see
  "Vote privacy" below); they live on the vote, not as a user preference.
- **End vote** closes casting (tallies stay). **Show results** sets
  `revealed`; the pill flags joint winners by comparing to the tab-wide max
  (`voteMax`). **Clear** removes the session.
- **Results walkthrough** (`useVoteReview`): revealing results starts a
  guided review of every voted element, most dots first (ties keep element
  order). The current pick pulses an amber focus highlight
  (`lvd-vote-focus`) and the viewport **centres it on screen** (always, via
  `scrollIntoView`'s `center` option, not just an edge-pull pan); the
  `VoteBanner` swaps to "Top result X of N" with **Previous** / **Next**
  buttons, and the last pick shows **Done**, which exits the walkthrough
  **and clears the vote session** (same effect as Clear in the tab menu),
  removing the banner, pills, and rings. While a walkthrough is active the
  static winner rings are suppressed so attention lands on the single
  focused pick.
- **The walkthrough position is SHARED** (`vote.reviewIndex`), and only the
  host moves it. It used to be per-participant local state — "everyone
  reviews at their own pace" — but that meant a facilitator saying "look at
  this one" had no way to actually put the room on it, which is the whole
  point of walking results together. Followers get the readout and the
  focus; the Previous / Next / Done buttons and the Vote panel's clickable
  rows are hidden for them rather than rendered as no-ops.

## The Vote panel

A **`VotePanel`** on the shared `MovablePanel` (like Poll / Collaborate /
Layers), homed **top-right under the Palette**. Present only while a vote is
on the tab, so it joins and leaves its corner stack rather than sitting in
it. Two phases, one panel:

- **While casting is open — turnout.** Dots cast against dots available, how
  many people have finished, and one row per voter showing their budget as
  filled / hollow pips. This exists because the canvas pills answer "what is
  winning" but never "is everyone done", which is the question that decides
  when to press End vote. It deliberately counts **people, not just dots**:
  "8 of 12 dots" reads as nearly finished when one person holds all four
  remaining, which is exactly when you shouldn't call it.
- **Once results are revealed — the ranked list.** Every voted element, most
  dots first, each row clickable to **jump the results walkthrough** straight
  to that element (`jumpToVoteResult`, the same clamped setter Previous /
  Next use). The list renders from the SAME `results` array the walkthrough
  steps through, so the two can never disagree about the ranking. Joint
  winners are flagged by comparing to the top count, matching the amber rings
  rather than "index 0".

**Voter rows carry no names, and can't.** Dots are keyed by the local
participant id, while the room's presence roster is keyed by a server-random
per-connection id (spec/61 §6) — the two never match, so a client has no way
to turn a voter into a person. For a dot-vote that is a happy accident, and
the turnout numbers answer the facilitator's actual question without it.
Naming voters would mean writing names alongside the dots, which would make
every dot trivially attributable in stored data — the opposite of the
direction "Vote privacy" below takes.

The panel is **read-only for view-role** (the End vote / Show results buttons
are hidden); viewers still watch turnout and results, matching the rest of
spec/39.

Turnout stays visible under **hide running counts**: it reports participation
(who has spent what budget), never which element anyone chose, so it doesn't
leak what that switch protects. The ranked list is the tallies, so it only
ever renders after the reveal.

## Who runs a vote

`vote.startedBy` records the participant that started it, and `isVoteHost`
is the single gate. **Only the host can End / Show results / Clear the vote,
or move the results focus.** Everyone else casts dots and watches.

Ending is the reason: you can always start another vote, but you cannot get
the dots back, so an accidental End by a participant costs the room the whole
round. The same gate covers reveal, clear, and the walkthrough so "whose vote
is this" has one answer rather than three.

- Enforced in `useTabSession` (the handlers no-op for a non-host) **and** in
  the UI (the controls aren't rendered for one). This is a facilitation
  guard, not a security boundary: the vote is an ordinary tab field, so any
  edit-role peer could still write it directly. That matches the rest of
  spec/39, where roles are the only real gate.
- `startedBy` is **optional**, and `isVoteHost` treats its absence as "anyone
  may drive". A vote persisted before this shipped would otherwise become
  unendable — nobody matches a missing starter.
- The host's controls live on the **Vote panel** as well as the tab menu, so
  running a vote never requires a trip back into the menu: **End vote** while
  casting, then **Show results**, then **Clear vote** once results are up.

## Vote privacy

Dot-voting is only as honest as what participants can see before it closes.
Two things leak the room's leaning while casting is open: **where everyone's
pointer is** (peer cursors and laser trails visibly converge on the sticky
they like) and **the running tallies** (a count pill that climbs tells you
what to pile onto). Two independent switches on the vote address them:

`tab.vote` carries `hideCursors?: boolean` and `hideCounts?: boolean`. Both
are **optional** so a vote persisted before this shipped decodes unchanged
and behaves as it always did (absent = off).

- **Set once, at start.** Both switches sit in **Tab menu → Collaborate →
  Vote** above **Start vote**, alongside the dots-per-person stepper, and are
  written into the `TabVote` by `startVote`. There is **no mid-vote toggle**:
  to change them, end the vote and start a new one. That keeps the rule a
  participant can rely on ("cursors were hidden for the whole of this vote")
  instead of a setting the facilitator can flip once they've seen where
  people are pointing.
- **Room-wide, not per-viewer.** The flags ride `tab.vote`, so every client
  on the tab reads the same values off the synced tab — nobody can opt back
  into seeing cursors. Late-joiners and reloads get the current setting for
  free, like the rest of the session state.
- **Any edit-role participant can start a privacy-mode vote**, exactly as
  they can start any vote. No owner-only gate (spec/39 has never had one).

### Hide participant cursors (default **on**)

While `vote.active`, peer **cursors** and peer **laser trails** are neither
drawn nor sent:

- **Render:** `usePresenceRows` returns empty `remoteCursorRows` and drops
  remote laser rows, so nothing reaches the canvas overlays.
- **Wire:** `useEditorBroadcast` stops emitting `cursor` and `laser` room ops
  altogether. Suppressing the send (not just the paint) is the point — a
  render-only gate would still put every participant's coordinates on the
  socket for anyone with devtools open. It also drops the room's busiest
  packet stream for the duration of the vote.
- Your **own** laser trail still draws on your own screen; only what peers
  send is withheld.
- **Which switches are in force is shown in the tab menu's Vote section**
  (a read-only "Cursors hidden · end the vote to change this" line), not on
  the floating banner. The banner is a status pill, and privacy state
  doesn't change during a vote — putting it there widened the pill
  permanently to restate something fixed.
- **Presence stays**: the tab avatar stack, the "who's on this tab" dots and
  the per-element **selection badges + selection lock** (spec/07) are
  untouched. You can still see who is in the room, and an element someone
  else holds still names them — silently locking an element with no
  explanation would read as a bug, and the lock is a correctness mechanism
  rather than an intent signal.
- **Restored the moment casting closes** (`vote.active` goes false), i.e. on
  **End vote** or **Clear**, not at **Show results**. Hidden is exactly
  "while the vote is open", which is the rule that's easy to state and
  impossible to get wrong.

### Hide running counts (default **off**)

While the vote is **unrevealed**, the tally pill on each element shows only
**your own** dots (so you can still see and retract what you spent); other
participants' dots are excluded from the number and no pill appears on an
element you haven't voted on. **Show results** reveals the true totals and
the winner rings as usual — the existing reveal step is the natural gate, so
this switch changes _when_ counts appear rather than adding a new phase.

It defaults **off** because live counts are load-bearing for ordinary
dot-voting (see "Counts are **live**" above); a facilitator running a blind
vote opts in.

## Telemetry (spec/22)

`track('Tab', 'Started', 'CountdownTimer' | 'StopwatchTimer' | 'Vote')`,
`track('Tab', 'Ended', 'Vote')`, `track('Tab', 'Revealed', 'Vote')`,
`track('Tab', 'Ended', 'VoteReview')` when Done exits the results
walkthrough, and `track('Element', 'Voted')` on each dot. The `Started` /
`Ended` / `Revealed` / `Voted` actions were added to the closed
`TELEMETRY_ACTIONS` enum.

## Out of scope (v1)

Poll-style voting (options rather than dots), a server-authoritative clock, a
timer-end sound, and view-role casting.

Anonymous voting was in this list until the two **Vote privacy** switches
above shipped. What's still out of scope there: **anonymity in the stored
data**. `vote.votes` remains `elementId -> participantId[]`, so the switches
hide who's pointing where and (optionally) the running totals, but a
determined participant reading the synced tab could still attribute dots.
Making casts unattributable would mean dropping the participant id, which
breaks both the per-person budget (`votesSpentBy`) and retraction — a real
design change, not a toggle.
