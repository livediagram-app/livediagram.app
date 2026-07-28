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

The costs are real and accepted:

- **Late joiners are not prompted.** Someone opening the diagram mid-poll sees
  nothing; the poll reaches whoever is connected when it starts. (This answers
  the issue's open question: present-at-trigger-time only.)
- **A reload loses your prompt and your answer.** The poll is memory-only, so
  refreshing drops you out of it. You are not re-prompted.
- **If the host disconnects, nobody can end the poll globally.** Every
  participant can dismiss their own panel, and the poll dies with the last
  connected client, so this self-heals rather than wedging the diagram.

These are acceptable for a pulse-check that lasts a minute. They would not be
acceptable for the dot-vote, which is why the dot-vote is on the Tab.

## Op vocabulary

Three additions to `RoomOp` (`packages/api-schema/src/room-messages.ts`). The
Durable Object keeps `op: unknown` and just relays, so the room needs no
knowledge of any of them.

- `{ kind: 'poll-start'; poll: LivePoll }` — the question, style, and options.
- `{ kind: 'poll-answer'; pollId: string; value: string | null }` — one
  participant's answer; `null` means they skipped. Re-sending replaces the
  sender's previous answer (last write wins per sender).
- `{ kind: 'poll-end'; pollId: string }` — tear it down everywhere.

All three are **unordered and unlogged**, like cursor / select / laser: they
mutate no diagram state, so they carry no `seq` and are not replayed to a
reconnecting client. That is the mechanism behind "late joiners are not
prompted" above.

## Roles

The room drops non-presence ops from view-role senders (spec/11). Polls split
across that line:

- **`poll-answer` is allowed from any role.** A presenter pulse-checking an
  audience is the main use for this, and audiences are usually on view links.
  `'poll-answer'` therefore joins the room's any-role op allowlist
  (`PRESENCE_OP_KINDS` in `diagram-room.ts`).
- **`poll-start` / `poll-end` stay edit-role only**, via the existing gate. An
  audience member on a view link can answer, but cannot start a poll or end
  someone else's.

## Answer styles

`LivePoll.style`, all reducing to a single string `value` on the wire so one
tally path serves them all:

| Style          | Options                     |
| -------------- | --------------------------- |
| `yesNo`        | Yes / No                    |
| `yesNoAbstain` | Yes / No / Abstain          |
| `choice`       | 2–6 creator-defined options |
| `rating`       | 1–5                         |
| `text`         | free text                   |

Caps (the issue's other open question), enforced at the input and re-checked
when an op arrives so a hand-crafted frame can't blow up a peer's panel:

- question ≤ 200 chars
- ≤ 6 choice options, each ≤ 60 chars, minimum 2
- free-text answer ≤ 280 chars

## Lifecycle

1. **Compose.** Tab menu → **Collaborate → Poll**: question, style, options
   if the style needs them, then **Start poll**. Edit-role only. Collaborate
   is the side-flyout parent row that groups the live session tools
   (Countdown / Stopwatch / Vote / Poll) under one entry, the same
   parent/child pattern the element menu uses.
2. **Prompt.** Every connected participant gets a modal with the question and
   a **Skip** escape (Escape and a backdrop click both skip, so dismissing is
   an answer of "no opinion" rather than a silent drop). Answering or skipping
   both count as responding. The dialog is keyed on the poll id so a second
   poll never inherits the first one's half-typed free-text answer.
3. **Results.** A **`PollPanel`** built on the shared `MovablePanel`, like
   Collaborate / Layers / Activity: draggable, resettable, and dockable
   into a corner stack, homed **bottom-left**. It registers as a real
   `PanelId` rather than floating outside the panel system, but it is the
   only panel that isn't always present — it joins and leaves its corner
   stack with the poll. It carries no mobile-dock entry on purpose: the
   dock is a row of toggles for panels you go looking for, and a poll
   presents itself. Shown to the host and to anyone who has responded — so
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

This is a deliberate v1 limit, and the UI is worded to match: it says answers
**aren't shown against names**, never that the poll is anonymous. Closing the
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
