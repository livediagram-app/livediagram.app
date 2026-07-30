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
- **A timer button is the timer's control, not a reset.** With a timer already on the tab, pressing PAUSES it; pressing again CONTINUES it from where it stopped. Only a tab with no timer starts a fresh countdown. Someone pressing it mid-session means "hold on", and silently restarting five minutes is the one behaviour nobody wants. The face follows the state — "Start 5 min timer" / "Pause the timer" / "Continue the timer" — so the board says what the next press will do. Clearing a timer stays with the timer's own controls ([spec/39](39-session-tools.md)), because that is the destructive one.
- **A read-only visitor's press does nothing**, and the face says why rather than looking live: starting a timer or a vote is an edit-role action ([spec/39](39-session-tools.md) "Roles"). Answering the poll it starts is not — an audience on a view link can still take part.
- **Dragging it does not press it** (`usePressWithoutDrag`), same as every other Behaviour element.

## Configuring it

Right-click → **Tools › Session**: pick the tool (Timer / Vote / Poll), then its one setting — minutes for a timer, dots for a vote, the question and options for a poll. The face's derived label follows the setting ("Start 5-minute timer", "Vote — 3 dots each", "Ask the room"), and an author's own label wins over it, like any shape.

## Telemetry

Per [spec/22](22-telemetry.md): adding one emits `Element·Added·SessionButton`, reconfiguring emits `Element·Changed·SessionButton`. The press itself is NOT tracked separately — it reports as the tool it starts (`Tab·Started·Timer` / `Vote` / `Poll`) through the shared entry point, because a press IS starting that tool.

## Out of scope

- Buttons that STOP a tool (the timer and vote already have their own controls, owned by whoever started them).
- Chaining several tools behind one press ("start the timer AND the vote"). One button, one action; put two buttons on the board.
- Scheduling ("start this in 10 minutes"). A board is not a cron.
