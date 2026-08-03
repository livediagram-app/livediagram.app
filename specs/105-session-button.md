# 105 — Session button

Status: **implemented**.

A canvas element that **starts a session tool when pressed**: a countdown timer, a dot vote ([spec/39](39-session-tools.md)), or a live poll ([spec/88](88-live-poll.md)). The third member of the palette's **Behaviour** group, beside the [Selection Mode button](103-mode-button.md) and the [Portal](104-portal-element.md).

## Why

The session tools are facilitation, and facilitation is a script someone has to remember: start a five-minute timer, then vote three dots each, then poll the room. Today that script lives in a menu and in the facilitator's head, which means the board only works when the person who built it is the one running it.

Putting the tools ON the board makes the board self-facilitating. A retro template can ship with a "5 minutes" button over the writing column and a "Vote — 3 dots" button over the results column, and anyone can run it. It is the same instinct as the Selection Mode button: put the affordance where the user already is.

## The element

- A **shape kind**, `session-button`, sharing the Selection Mode button's face and rules: a fixed-size tile, the tool's glyph in a chip over the action's name, a light button surface, pressable inside the pointer-inert Avatar / Spotlight / Isometric layers.
- What it starts lives in **`ShapeElement.session`**, one small object rather than a scatter of fields:
  - `{ tool: 'timer', minutes }` — a countdown of that many minutes (default 5).
  - `{ tool: 'vote', dots }` — a dot vote with that many dots each (default 3).
  - `{ tool: 'poll', question, options }` — a live poll, pre-written.
- Absent `session` means a timer, so a button authored by an older client (or hand-written through the API) still does something sensible.

## Pressing it

- The press routes through the **same entry points the menus use** (`startTimer`, `startVote`, `startPoll`), so every rule those already enforce still applies: the edit-role gate, the "one vote at a time" rule, the change-log entry, the telemetry.
- **It starts the tool for the room**, unlike the Selection Mode button, which only ever changes the presser's own mode. That asymmetry is the point: a timer nobody else can see is not a timer. The tooltip says so.
- **A timer is not pressed at all any more**, so the rest of this section is about Vote and Poll. On any surface that can drive a timer, the element renders the countdown with its own pause / resume / reset / remove controls (see "The Timer element IS the timer" below); there is no whole-face press to interpret. The press-to-pause face it replaced — "Start 5 min timer" / "Pause the timer" / "Continue the timer", from `sessionButtonText` — is still what a surface WITHOUT timer controls draws, which today means a read-only one, so it reads as a live control and correctly refuses like every other read-only press.
- **A read-only visitor's press does nothing**, and the face says why rather than looking live: starting a timer or a vote is an edit-role action ([spec/39](39-session-tools.md) "Roles"). Answering the poll it starts is not — an audience on a view link can still take part.
- **Dragging it does not press it** (`usePressWithoutDrag`), same as every other Behaviour element.

## Configuring it

Right-click → **Tools › Session**: pick the tool (Timer / Vote / Poll), then its one setting — minutes for a timer, dots for a vote, the question and options for a poll.

For **Vote and Poll**, the face's derived label follows that setting ("Vote — 3 dots each", "Ask the room"), and an author's own label wins over it, like any shape. A **Timer** has no label to win: `SessionTimerFace` draws the clock, showing the configured minutes until a timer is actually running and the live countdown after. The setting still drives what you see, just as the digits rather than as a sentence about them.

## Telemetry

Per [spec/22](22-telemetry.md): adding one emits `Element·Added·SessionButton`, reconfiguring emits `Element·Changed·SessionButton`. The press itself is NOT tracked separately — it reports as the tool it starts (`Tab·Started·Timer` / `Vote` / `Poll`) through the shared entry point, because a press IS starting that tool.

## Out of scope

- Buttons that STOP a tool (the timer and vote already have their own controls, owned by whoever started them).
- Chaining several tools behind one press ("start the timer AND the vote"). One button, one action; put two buttons on the board.
- Scheduling ("start this in 10 minutes"). A board is not a cron.

## One tile per tool in the palette

The palette offers **Timer**, **Dot vote** and **Poll** as separate tiles,
collapsed behind a **Session** accordion in Behaviour, the way Media does for
embed providers (spec/121).

The three have nothing in common at the moment of choosing: you know whether
you want a countdown or a vote before you reach for the palette, so a single
button you place and then reconfigure is two steps for something already
decided. Flattened out beside the reactions they would also have buried the
six single-purpose Behaviour elements, which is why both groups collapse.

They remain ONE shape kind with a `session` config, not three kinds. The
element, its face and its menu are identical; only the config differs, and
three kinds would be three registrations to keep in step for a field that
already exists.

The choice rides the draw intent (`PendingDraw.session`) and is applied at
commit through `defaultSessionConfig`, which fills in a working default per
tool. That matters most for the poll: `sessionPlan` refuses a poll with fewer
than two answers, so dropping one with an empty config would place a button
that cannot be pressed.

## No tooltip on the button

Removed. The button is small and usually sits near the top of a board, so its
hover card landed over the **element toolbar directly above it** and blocked
the controls the user was reaching for.

Nothing was lost that the button does not already say: its face states the tool
and the setting ("Start · 5 min timer"), and the fuller explanation is in the
element menu. The accessible names still carry the tool, the setting and, on a
disabled button, why it is disabled.

## The Timer element IS the timer

A session element whose tool is `timer` no longer renders a button that starts
a timer somewhere else. It renders the timer.

It is the **same timer as the pill in the top chrome**, in every sense worth
having: the same `TabTimer` on the same tab field, the same pure
`timerDisplayMs`, and — since the look was extracted into
`components/chrome/timer-pill.tsx` — literally the same clock, drain and
controls. Pausing on the board pauses in the chrome. Every client computes the
value locally off an absolute anchor, so there is no per-second network traffic
and no drift between machines.

Only the furniture differs: a floating banner in the chrome, the element's own
box on the canvas.

- **Controls**: pause / resume, reset, and remove, plus a start when no timer
  is running. Reset returns the timer to its starting value; remove is what
  actually gets it off the board, which is why both exist.
- The controls **swallow pointer-down**. The canvas reads a press on an element
  as select-and-maybe-drag, so without that the element moves whenever somebody
  tries to pause it. The element's face is otherwise inert, so the control row
  opts back into pointer events explicitly.
- A tapped timer lands **224×64**, the pill's proportions. The session button's
  square-ish default clipped the kicker off one end and the remove control off
  the other. Only on a tap — a deliberate drag is the user saying what size
  they want.
- A **read-only** surface renders the clock and the drain and withholds the
  controls, rather than hiding the timer.

Vote and poll keep the ordinary button face: they start something that lives
elsewhere (a dot vote over the whole canvas, a poll in a panel), so there is
nothing for the element itself to become.

## Settings on the element itself

Each session element carries a `…` menu on its own face, so the setting you
most want to change is one press away rather than three levels into the
right-click menu (Tools › Session).

| Tool      | Menu                                               |
| --------- | -------------------------------------------------- |
| **Timer** | Length presets (1 to 30 minutes)                   |
| **Vote**  | Dots each (1, 2, 3, 5, 8)                          |
| **Poll**  | The question, and the answers, with add and remove |

A vote is a single number, so it is a list of presets: one tap and done. A poll
is text, so it is a small form. The asymmetry is deliberate rather than an
inconsistency — a menu of presets for a question nobody has written would be a
menu of nothing. The poll form will not go below **two** answers, because
`sessionPlan` refuses a poll with fewer and removing one would leave a button
nobody can press.

The full range stays in the right-click menu, which has room for a proper
number input; these are the common values.

### The menu is portalled

`ElementEllipsisMenu` renders its popover through a portal, positioned from the
trigger's rect at open time.

It was inline first, reasoning that a portalled menu would have to track a
canvas element through pan and zoom. It does not: any pan or zoom begins with a
pointer-down, which dismisses the menu, so the position only has to hold while
it is open. Inline was wrong for a more immediate reason anyway — every element
that wants this menu **clips its own contents** (the collab panel, the timer's
drain fill, the element box's rounded corners), so the popover was cut off at
the element's edge and mostly invisible.

The dismiss listener checks the trigger **and** the popover, since the portalled
menu is not inside the trigger's subtree and a single containment test closed
the menu on every click inside it.

The trigger draws three dots rather than using the `…` character: an ellipsis
sits on the baseline, so in a 20px button it rode the bottom edge however the
box was aligned.
