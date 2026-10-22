# Session button

Status: **implemented**.

A canvas element that **starts a session tool when pressed**: a countdown timer, a stopwatch or a dot vote ([Session tools (timer + voting)](session-tools.md)). Its tiles live in the palette's **Collaborate** category: the Timer and the Stopwatch under **Tools**, the Dot vote under **Ask**.

## Why

Running a session is a script someone has to remember: start a five-minute timer, then vote three dots each. Without the button that script lives in a menu and in the head of whoever runs the session, which means the canvas only works when the person who built it is the one running it.

Putting the tools ON the canvas makes the canvas run itself. A retro board can carry a "5 minutes" button over the writing column and a "Vote — 3 dots" button over the results column, and anyone can run it: the affordance sits where the user already is.

## The element

- A **shape kind**, `session-button`: a fixed-size tile (`FIXED_SIZE_SHAPES`), the tool's glyph in a chip over the action's name, a light button surface, pressable inside the pointer-inert Isometric layer.
- What it starts lives in **`ShapeElement.session`**, one small object rather than a scatter of fields:
  - `{ tool: 'timer', minutes }` — a countdown of that many minutes (default 5).
  - `{ tool: 'vote', dots }` — a dot vote with that many dots each (default 3).
- Absent `session` means a timer, so a button authored by an older client (or hand-written through the API) still does something sensible.

## Pressing it

- The press routes through the **same entry points the menus use** (`startTimer`, `startVote`), so every rule those already enforce still applies: the edit-role gate, the "one vote at a time" rule, the telemetry. A vote button pressed while a vote is already running does nothing: starting over would reset every dot cast so far ([Collaboration race hardening](collab-race-hardening.md)).
- **It starts the tool for the room**, not for the presser alone: a timer nobody else can see is not a timer. The element menu says so.
- **A timer is not pressed at all any more**, so the rest of this section is about Vote. On any surface that can drive a timer, the element renders the countdown with its own pause / resume / reset / remove controls (see "The Timer element IS the timer" below); there is no whole-face press to interpret. The press-to-pause face it replaced — "Start 5 min timer" / "Pause the timer" / "Continue the timer", from `sessionButtonText` — is still what a surface WITHOUT timer controls draws, which today means a read-only one, so it reads as a live control and correctly refuses like every other read-only press.
- **A read-only visitor's press does nothing**, and the face says why rather than looking live: starting a timer or a vote is an edit-role action ([Session tools (timer + voting)](session-tools.md) "Roles", [Share roles](../013-workspace/share-roles.md)).
- **Dragging it does not press it** (`usePressWithoutDrag`), same as every other Behaviour element.

## Configuring it

Right-click → **Session**: the button's one setting — minutes for a timer, dots for a vote.

**It does not choose the tool.** The section used to lead with a Timer / Vote tile grid, which asked a second time a question the palette already asks once: it offers a tile per tool (see "One tile per tool in the palette" below), so the button lands as the thing you picked. Wanting a different one is wanting a different element — drag it out — and the grid cost every session button a row of menu height to re-open a settled decision. `session.tool` is still a field, still validated, still what everything reads; there is simply no control that rewrites it.

### A stopwatch is its own tool, not a timer mode

`SESSION_TOOLS` is `timer | stopwatch | vote`. The Session strip keeps
one Timer tool with a Countdown / Stopwatch toggle, because its Timer set-up is where
you choose which kind of clock to run. An ELEMENT is not: it is a countdown you
placed on a canvas, with a length, and the question its `…` answers is "how
long".

Offering the toggle there offered to turn one element into a different element,
which is not a setting — and it put a control in the popover that the element's
own label then contradicted. So a stopwatch is its own palette tile and its own
element, and it has nothing to configure, which is precisely the difference: a
countdown is placed WITH a length, a stopwatch has none.

The two wear different glyphs, on the palette tile and on the placed button
alike: the timer an hourglass (it runs down), the stopwatch a stopwatch (it
counts up). Side by side in the palette, one clock face for both made the two
tiles read as the same tool.

Pressing either is the same three-way control as before (start, then pause,
then continue), because a tab runs one clock and pressing mid-run means "hold
on", never a silent restart.

For a **Vote**, the face's derived label follows that setting ("Start vote · 3 dots each"), and an author's own label wins over it, like any shape. A **Timer** has no label to win: `SessionTimerFace` draws the clock, showing the configured minutes until a timer is actually running and the live countdown after. The setting still drives what you see, just as the digits rather than as a sentence about them.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): adding one emits `Element·Added·SessionButton`, reconfiguring emits `Element·Changed·SessionButton`. The press itself is NOT tracked separately — it reports as the tool it starts (`Tab·Started·Timer` / `Vote`) through the shared entry point, because a press IS starting that tool.

## Out of scope

- Buttons that STOP a tool (the timer and vote already have their own controls, owned by whoever started them).
- Chaining several tools behind one press ("start the timer AND the vote"). One button, one action; put two buttons on the canvas.
- Scheduling ("start this in 10 minutes"). A canvas is not a cron.

## One tile per tool in the palette

The palette offers **Timer**, **Stopwatch** and **Dot Vote** as separate
tiles in Collaborate. There is no Session group: a dot vote asks the
room, so it sits in **Ask** beside the temperature check; a timer and a
stopwatch run the session, so they sit in **Tools** beside the Picker.

The three have nothing in common at the moment of choosing: you know whether
you want a countdown or a vote before you reach for the palette, so a single
button you place and then reconfigure is two steps for something already
decided.

**This is the only place the tool is chosen**, which is the other half of the
same argument: if the palette asks once and the answer is a whole element,
then the element's own menu asking again is the two-step version returning by
the back door. A session button you want to be a different tool is a different
element; drag the one you want.

They remain ONE shape kind with a `session` config, not three kinds. The
element, its face and its menu are identical; only the config differs, and
three kinds would be three registrations to keep in step for a field that
already exists.

The choice rides the draw intent (`PendingDraw.session`) and is applied at
commit through `defaultSessionConfig`, which fills in a working default per
tool (a timer's five minutes, a vote's three dots).

## No tooltip on the button

Removed. The button is small and usually sits near the top of a canvas, so its
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
controls. Pausing on the canvas pauses in the chrome. Every client computes the
value locally off an absolute anchor, so there is no per-second network traffic
and no drift between machines.

Only the furniture differs: a floating banner in the chrome, the element's own
box on the canvas.

- **Controls**: pause / resume, reset, and remove, plus a start when no timer
  is running. Reset returns the timer to its starting value; remove is what
  actually gets it off the canvas, which is why both exist.
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

Vote keeps the ordinary button face: it starts something that lives
elsewhere (a dot vote over the whole canvas), so there is nothing for the
element itself to become.

## Settings on the element itself

Each session element carries a `…` menu on its own face, so the setting you
most want to change is one press away rather than a right-click into the
Session category.

| Tool      | Menu                             |
| --------- | -------------------------------- |
| **Timer** | Length presets (1 to 30 minutes) |
| **Vote**  | Dots each (1, 2, 3, 5, 8)        |

A vote is a single number, so its menu is a list of presets: one tap and done. The full range stays in the right-click menu, which has room for a proper
number input; these are the common values.

**Changing the length of a live timer restarts it at the new one.** Leaving it
mid-run would be the one thing nobody wants: the remaining time would be a
number measured against the old length and displayed against the new one. The
running state is preserved either way — someone extending a running timer
is asking for more time, not for the session to stop, and one extending a
paused timer is setting up the next round. With no timer running the element's
config is simply the length used at the next start.

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
