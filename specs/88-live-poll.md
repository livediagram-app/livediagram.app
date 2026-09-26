# 88 — Live poll (ephemeral pulse-check)

A facilitator-run **poll**: ask the room a question, everyone viewing the
diagram gets a prompt, answers tally live, and when the host ends it the whole
thing evaporates. Sits beside the timer and dot-vote in the tab menu's session
band (spec/39) but is deliberately **not** built like them.

## Why it is NOT a session tool on the Tab

The timer and vote live as `Tab` fields, which is exactly why they survive a
reload and reach late joiners: they ride the tab-sync pipeline into D1
(spec/39). A poll wants the **opposite** guarantee — "no trace of the poll
(question, options, or responses) is left on the diagram afterward". Storing it
on the tab would `PUT` the question and every response to D1 for the duration
and rely on a delete to clean up.

So a poll lives **only in the realtime room**. It is carried by three new
`RoomOp` kinds and held in connected clients' memory. Nothing is written to
D1, nothing enters the change log, nothing is undoable, and no migration or
schema change is needed anywhere.

**The room remembers it while it runs** (spec/152). The Durable Object keeps
the running poll and every answer in its own storage (never D1) and replays
them to each session on hello, so:

- **A late joiner is prompted**, and sees the answers so far.
- **A reload keeps your prompt and your answer**: yours comes back keyed by
  your collab key.
- **A host who refreshes can still end it**: the poll carries its starter's
  collab key (`hostKey`).

This used to be memory-only in the clients, and all three were accepted costs
("present-at-trigger-time only"). Ending the poll still removes every trace of
it, from the room too.

## Op vocabulary

Three additions to `RoomOp` (`packages/api-schema/src/room-messages.ts`). The
Durable Object keeps `op: unknown` and just relays, so the room needs no
knowledge of any of them.

- `{ kind: 'poll-start'; poll: LivePoll }` — the question, style, and options.
- `{ kind: 'poll-answer'; pollId: string; value: string | null; key?: string }`
  — one participant's answer; `null` means they skipped. Keyed by `key`, the
  answerer's collab key (the sender's presence id only for an old client), so
  re-sending replaces their previous answer, across a reconnect too.
- `{ kind: 'poll-end'; pollId: string }` — tear it down everywhere.

None of them touches the diagram. `poll-answer` relays unordered like cursor /
select / laser (it is open to view-role); `poll-start` / `poll-end` are
edit-role mutations. What a joiner needs comes from the room's replay on
hello, not from the op log. Two polls started in the same moment converge on
the newer (`pollSupersedes`): the room and every client apply the same rule,
since a starter never receives its own poll-start back.

## Roles

The room drops non-presence ops from view-role senders (spec/11). Polls split
across that line:

- **`poll-answer` is allowed from any role.** A presenter pulse-checking an
  audience is the main use for this, and audiences are usually on view links.
  `'poll-answer'` therefore joins the room's any-role op allowlist
  (`PRESENCE_OP_KINDS` in `@livediagram/api-schema`).
- **`poll-start` / `poll-end` stay edit-role only**, via the existing gate. An
  audience member on a view link can answer, but cannot start a poll or end
  someone else's.

## Answer styles

`LivePoll.style`, all reducing to a single string `value` on the wire so one
tally path serves them all:

| Style           | Options                           |
| --------------- | --------------------------------- |
| `yesNo`         | Yes / No                          |
| `yesNoAbstain`  | Yes / No / Abstain                |
| `choice`        | 2–10 creator-defined options      |
| `collaborators` | everyone currently in the diagram |
| `rating`        | 1–5                               |
| `text`          | free text                         |

### `collaborators` — vote for a person

"Who chose this movie?", "who should take this?", "who explained that best?" —
the answers are the people in the room, and typing their names into a `choice`
poll by hand is both tedious and wrong by the time somebody joins.

It is a **snapshot, not a live list.** The roster is read once, when the poll
starts, and stored in the poll's own `options` exactly as a `choice` poll's
are. Everything downstream — the wire op, the tally, the bars — is then
identical to `choice`, which is the point: a poll whose answers moved while
people were voting would re-target votes already cast, and late joiners would
see a different ballot from everyone else.

So the style is an **authoring** convenience, not a new answer shape. It earns
its place in the union rather than being a button that fills the `choice` list
because the composer has to show the roster it is about to freeze, and because
a Session button ([spec/105](105-session-button.md)) can be configured with it
long before the room it will run in exists.

Names are de-duplicated before they are frozen (`poll-collaborators.ts`): two
guests both called "Guest" would otherwise be one token and their votes would
merge into a single bar. Repeats are suffixed — `Guest`, `Guest (2)`. The
roster is capped at `POLL_OPTIONS_MAX` like any other option list, and the
composer previews exactly what will be sent, so a room bigger than the cap
shows the truncation before it is asked rather than after.

Precedent: the Picker ([spec/107](107-picker.md)) already draws candidates from
`participants`, and this is the same idea pointed at a poll.

The union lives in **`@livediagram/diagram`** (`poll-style.ts`), not beside
`LivePoll` here, because a Session button ([spec/105](105-session-button.md))
STORES a style on the element and so needs it in a `Tab` field — and
api-schema depends on diagram, never the reverse. `PollStyle` is re-exported
from api-schema so existing imports keep resolving. The fixed answer sets
(`Yes / No`, `1-5`) moved down with it, which is what lets the authoring menus
preview a style's answers before any poll exists: `pollOptionTokens(poll)` is
now `pollStyleTokens(style, options)` applied to a running poll.

Caps (the issue's other open question), enforced at the input and re-checked
when an op arrives so a hand-crafted frame can't blow up a peer's panel:

- question ≤ 200 chars
- ≤ 10 options, each ≤ 60 chars, minimum 2 — for `choice` AND `collaborators`, which are the two styles carrying their own list (`POLL_OPTIONS_MAX`; was 6, which ran out on ordinary polls like the people in the room or a film shortlist — nothing downstream is keyed to the count, the results bars come off the list)
- free-text answer ≤ 280 chars

## Lifecycle

1. **Compose.** Tab menu → **Collaborate → Poll** (the Session Studio,
   spec/39): question, answer style picked from drawn tiles, answers if the
   style needs them (Enter moves to the next, making one at the end), then
   **Ask everyone** (or Enter in the question). A **What people see** card
   previews the exact prompt, built from the same `pollStyleTokens` the real
   prompt reads, so a typo is caught before it lands on every screen. The
   button names what is missing while it can't ask ("Write a question to
   ask", "Add at least 2 answers") instead of sitting greyed out. Edit-role
   only. A diagram that isn't shared or on a team does NOT block a poll: it
   runs locally, just for the host (rehearsing one, or asking a room you are
   presenting to), and the composer shows a note that only you will get it.
   The canvas Session button behaves the same way.
2. **Prompt.** Every connected participant gets a **sheet rising from the
   bottom of the screen** (`PollPromptSheet`), with the question and a **Skip**
   escape. Answering or skipping both count as responding, and the sheet is
   keyed on the poll id so a second poll never inherits the first one's
   half-typed free-text answer.

   **Not a modal, deliberately.** It was one — a centred dialog with a backdrop
   — and that stopped the room dead. A poll is a question asked DURING the work,
   and the thing people most want while answering "which of these?" is to look
   at the thing being asked about; the scrim covered exactly that. The canvas
   now stays live behind the sheet: you can pan, point, read the board, and
   answer without dismissing anything.

   What follows from not blocking:
   - **No focus trap and no autofocus.** Focus stays where the person was
     working. Stealing it would be the modal's rudeness without the modal.
   - **Escape still skips**, because the keyboard way out of a prompt should not
     depend on whether it happens to be modal — except while a text field or
     label editor has focus, where Escape belongs to the field, and when the
     work behind the sheet already claimed the press (cancelling a label edit,
     the format painter, a pending draw, a deselect, or a dialog over the
     canvas). One Escape does one thing; it never answers the poll by accident.
   - **There is still no close button.** Skip IS the escape, and it is a real
     answer (counted separately) rather than a silent dodge. There is no
     backdrop left to click, so Skip and Escape are the whole of it.

3. **Results.** A **`PollPanel`** built on the shared `MovablePanel`, like
   Collaborate / Layers / Activity: draggable, resettable, and dockable
   into a corner stack, homed **top-right directly under the Palette**
   (the corner the panels you act on live in). It registers as a real
   `PanelId` rather than floating outside the panel system, but it is the
   only panel that isn't always present — it joins and leaves its corner
   stack with the poll. In the dock layout (a phone, or the minimal panel
   preference on desktop) it lives under the dock's **Poll** button like
   every other panel and closes with it, and it **opens by itself** when a
   poll starts or when you answer one (keyed on the poll id, so it opens
   once per poll rather than fighting you after you close it). The Vote
   panel follows the same rule for its **Vote** button. Shown to the host and to anyone who has responded — so
   answering is what buys you the tally, and a participant who hasn't yet
   can't be nudged by the running numbers. The panel updates live and reports
   how many people skipped, separately from the answer counts.
4. **Copy.** While the poll runs, the host can **copy the results** to the
   clipboard as plain text. Keeping the outcome is a deliberate act, which is
   what lets the panel vanish completely at the end without anyone losing work.
5. **End.** Host only. Removes the question, the answers, and the panel for
   everyone. Non-hosts additionally get a local **Dismiss** that hides their
   own panel without ending the poll (and rescues them if the host vanished).

## Anonymity — what is and isn't guaranteed

**No answer is ever attributed to a person anywhere in the product.** The
results panel shows counts and free-text answers with no names, no colours, and
no ordering that tracks the presence list.

**It is not anonymous on the wire.** Every op the room relays carries the
sender's per-connection presence id, and the presence frame maps that id to a
display name — so a participant with devtools open can attribute answers. The
client even relies on the sender id, to key answers so a person changing their
mind replaces their earlier answer rather than stacking a second one.

This is a deliberate v1 limit, and the UI is worded to match: where it says
anything at all it says answers **aren't shown against names**, never that the
poll is anonymous. It says it **once**, on the prompt (plus the compose form),
where it informs the decision a participant is about to make. The results
panel does not repeat it: by then the answer is in, and the line was just
chrome on a panel whose footer should read `N answered · N skipped`. Closing the
gap means the room stripping the sender id on `poll-answer` before rebroadcast,
which costs the per-sender dedupe (a client could then answer repeatedly). See
"Out of scope".

## Telemetry (spec/22)

`track('Tab', 'Started', 'Poll')` on start, `track('Tab', 'Ended', 'Poll')` on
end, and `track('Tab', 'Voted', 'Poll')` when the local participant submits an
answer (a skip included — the interaction is "responded"). No question text or
answer content is ever emitted; `type` stays the fixed `'Poll'` token.

## Out of scope (v1)

- **Wire-level anonymity** (stripping the sender id in the DO) — see above.
- **Late-joiner prompting and reload survival**, both consequences of the
  no-persistence rule, not oversights.
- **A saved history of past polls.** Nothing is stored, so there is nothing to
  browse; the clipboard copy is the export path.
- **Multiple concurrent polls.** One poll at a time per diagram; starting a
  second replaces the first, matching the one-timer-per-tab rule in spec/39.
- **Per-tab scoping.** A poll goes to everyone on the diagram, not just the
  people on the host's tab — a pulse-check is about the room, not the canvas.
