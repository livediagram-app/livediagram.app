# Session tabs

Status: **implemented** (Refinement, Sprint Planning). Stand-up, Bug Triage and Sprint Review are designed for here
and come later.

A **Session tab** turns a filtered, ordered slice of the plan's cards into a **queue** the team works through one
card at a time. The first **session kind** is **Refinement**: the team reads each card, sharpens it, and marks it
**Refined**, which moves it on to the next stage.

## Why

Teams refine by staring at one big board. Everything on it competes for attention, nobody is sure which card is
next, and "is this one ready?" is decided by whoever drags first. A session tab shows one card, fully, with the
queue beside it and one clear way to say "done, next". A second kind, **Sprint Planning**, walks the top of the backlog the same way and
**commits** cards into the sprint, tallying their estimates against the team's capacity
([Sprint Planning](#sprint-planning)). It is a **view over the real cards**, never a copy: every
edit, comment and move lands on the card itself, on every board it shows on.

## Domain language

| Term             | Meaning                                                                                                                                | Not                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Session tab**  | A tab of kind `session`: one queue of cards worked through together                                                                    | meeting tab, ceremony            |
| **session kind** | What the session is for: `refinement`, `planning` (later `standup`, `triage`, `review`), stored as `session.sessionKind`               | type (a card's), template        |
| **queue**        | The cards the session works through, in order: those its set-up picks, and every card it has already decided                           | list, backlog                    |
| **set-up**       | What a session picks and how: its card types, its stages, its order, its target stages and its timebox                                 | config, filter                   |
| **stage**        | A status (a board column) the session takes cards from                                                                                 | column (a board's), state        |
| **target stage** | Where the kind's completing outcome (Refined, Committed) moves a card: the next stage in its type's order, or the one the set-up names | destination (a form's)           |
| **outcome**      | What the session decided for a card: **Refined**, **Skipped**, **Flagged** or **Committed** (each kind offers its own)                 | result, verdict                  |
| **capacity**     | Sprint Planning's optional figure, in estimate points, that the committed cards are tallied against                                    | budget, velocity                 |
| **tally**        | The committed cards' estimates added up, beside the capacity; cards with no estimate are counted apart, never as zero                  | total, burn                      |
| **current card** | The card the session is on, shown on the right for everyone                                                                            | selected card                    |
| **facilitator**  | The one person who runs the session: moves it from card to card and decides outcomes                                                   | host, owner, driver              |
| **timebox**      | An optional length of time per card                                                                                                    | timer (that is a session tool's) |
| **fill button**  | The action button that fills with the theme's accent as it confirms (`FillActionButton`), shared by every session kind                 | progress button                  |

**Naming beside the session tools.** A tab already carries **session tools**, the timer and the dot vote
([Session tools](../012-collaboration/session-tools.md), `session.ts`, `Tab.timer`, `Tab.vote`). A Session tab is a
tab **kind** and keeps its state in its own field, `Tab.session`, read through `session-tab.ts`; its pure queue rules
live in `@liveplanner/items`' `session-queue.ts`. The session tools stay on every tab, a Session tab's included, and
never read `Tab.session`.

## Making one

- **Start Planning** has a **Sessions** category ([Plan mode](plan-mode.md#starting-a-board)) holding a **Refinement**
  card ("Work through cards one at a time, refining each"). An Editor's alone, like every Start Planning choice.
- Choosing it opens **Set Up Refinement**, a centred dialog with an illustrated header, in four parts:
  1. **Card Types**: every card type of the plan as a chip, the types whose cards sit in a refinement-like stage
     (Backlog, New, To Do, Ideas, Needs Detail) picked first; at least one.
  2. **Stages**: the statuses the picked types use, in the plan's column order, as chips; the picked types' first
     stage picked first; at least one. Each chip shows how many cards it holds now.
  3. **Order**: **Sort By** and **Then By**, the same choices and directions a board's Sort Cards offers
     ([Plan board](plan-board.md#the-board-set-up): `boardSortFieldsOf` over the picked types). None keeps the cards
     in their hand order (rank).
  4. **When Refined**: one row per picked type, "Moves to" a stage picker. Each starts on **Next Stage**, and may name
     one stage of the type's for every card of it instead. **Next Stage** is the first **open** stage after the card's
     own in its type's order ([Item types](item-types.md#the-statuses-a-type-uses)), stepping past a Backlog-like one
     (Backlog, Icebox, Inbox, Ideas, Someday) and never into a Done-like one (Done, Closed, Complete, Shipped,
     Released, Cancelled, or any stage in the Done phase): with none before Done, the card stays. A type that lists its
     waiting stages after Done (the Sprint Board's To Do, Doing, Done, Backlog, Ready) wraps round: a card in such a
     stage with no open stage after it goes to the type's first open stage (Ready to **To Do**). Refinement and Sprint
     Planning share the rule.
  5. **Timebox**: off by default; on, a length per card from 1 to 30 minutes (2, 3, 5, 10 offered as chips).
- The dialog previews the queue as it fills ("12 cards, highest priority first") and **Start Session** makes the tab
  a Session tab in one change and one undo step, named **Refinement** when it still has its default name.
- **Session Settings** in the tab's header reopens the same dialog for an Editor, changing the set-up in place; a
  decided card keeps its outcome.

## The queue

- The queue is **live**: the plan's cards whose type and stage the set-up picks, not archived, not in the Trash,
  sorted by the set-up's order (a card with no value for a level after those with one, rank breaking ties), exactly
  as a board sorts. A card added to a picked stage mid-session joins it; one dragged out of the picked stages on a
  board leaves it, unless the session already decided it.
- A **decided** card stays in the queue whatever its stage is now, so a Refined card does not vanish when it moves on.
  Decided cards lead the list, in the order they were decided; the cards still to go follow in the set-up's order.
- A decided card that is deleted, trashed or archived leaves the queue; its outcome is dropped with it.
- At most **500** cards are queued; a set-up that picks more shows the first 500 and says so.

## The page

A Session tab fills the tab, as a Board tab's board does, in two parts side by side.

### The sidebar

- On the left, **320 px** wide: a header with the session kind ("Refinement"), how far through it is ("4 of 9"), and
  the set-up in words ("Backlog, Needs Detail · Priority, Highest First"), then the **progress bar**, then the queue.
- Each row shows the card's position number, its card number and title, and its type's colour as a 3 px edge.
- The **current card** reads in the accent's tint with an accent edge and its number filled.
- A decided card is **greyed** (60% opacity) and its number becomes its outcome's glyph: a tick for Refined, a skip
  arrow for Skipped, a flag (in the flag colour) for Flagged, with the outcome named for a screen reader.
- **Pressing a row** opens that card on the right. The facilitator's press makes it the current card for everyone;
  anyone else's press is a **peek**: their own screen alone shows it, with a **Back to {Name}'s Card** bar over the
  detail, and the room's current card stays marked in the list.
- Up and Down move between rows; Enter opens one.

### The progress bar

- A row of segments, one per card in the queue (a single smooth bar past 40 cards): a decided card's segment is the
  accent (Refined), slate (Skipped) or the flag colour (Flagged); the current card's is the accent's tint; the rest
  are empty. It names itself "Refinement progress, 3 of 9 decided".
- With a timebox on, the current card's segment fills as its time passes. When the time is up it turns **amber**, a
  gentle two-note chime plays once on every screen that was watching that card, and the session header reads "Time's
  up". Nothing moves on by itself: the facilitator decides.

### The card

- On the right, the card in full: the same panel a card opens in from a board ([Plan board](plan-board.md#working-on-a-board)),
  its title, its type's tabs (Description, its fields, Comments), Linked Cards, Activity and Details, embedded in the
  page rather than floating over it, with no close button.
- **Everything there writes to the real card**, with the same rights as on a board: a Participant edits its fields and
  comments; a Viewer reads.
- Its **menu** keeps Duplicate, Copy Card Link and the rest, as on a board.

### The action bar

Under the card, for the facilitator:

- **Skip** (a skip arrow) and **Flag** (a flag, only when the card is not flagged already) on the left, then a line
  saying where Refined takes the card ("Moves to **Ready**", or "Stays in **Review**: no open stage comes after it"), then
  the timebox's time left when on, then the **Refined** fill button on the right.
- **Refined** is short and clear: the label and a tick. Pressed, the button **fills left to right** in the theme's
  accent (a lighter wash over the solid button), the label turns into a tick, then the fill **drains back out**: about
  700 ms in all, no confetti. Under reduced motion it swaps to the tick and back with no fill.
- Refined then: the card moves to its target stage (to the end of that column), its history records that it was
  refined in a session, its outcome is kept, and the session moves to the next card still to go.
- **Skip** and **Flag** grey the card in the sidebar, record their outcome in the card's history, and move on the
  same way. Flag also flags the card ([Flags](items.md#flags)).
- A decided card shown again reads its outcome over the action bar ("Refined by Sam · Undo Outcome"); **Undo
  Outcome** (the facilitator's) clears the outcome so it can be decided again. The card's move is undone with the
  editor's Undo as any move is.
- Keyboard, for the facilitator, when focus is not in a field: **R** Refined, **S** Skip, **F** Flag, **J** and **K**
  the next and previous card.
- Everyone else sees the bar's place hold who is facilitating ("Sam is running this session") and, for an Editor, the
  facilitator choices below.

### When the queue is done

- With no card left to go, the right side shows **Session Complete**: how many were Refined, Skipped and Flagged, and
  for the facilitator **Review Skipped** (the first skipped card) and **Start Again** (clears every outcome).
- An empty set-up (no card picked) says so, with **Session Settings** for an Editor.

## Facilitator

A session is run by one person, following the platform's facilitator model
([Facilitator](../../../../livediagram/docs/specs/012-collaboration/facilitator.md)): one baton, never held by a
Participant or a Viewer, handed on rather than fought over. A Session tab keeps its baton on the tab
(`session.facilitator`: the collab key, name and colour), so it rides the tab's sync like the vote's host does.

- **Nobody holding it**: the first Editor to open the tab takes it, without being asked. An Editor already on the tab
  when the baton comes free (the facilitator stepped down) sees **Facilitate** on the header's chip instead, so two
  people never grab it at once.
- **Held**: only the facilitator moves the session and decides outcomes. Their menu on the header's facilitator chip
  offers **Hand Over** (to an Editor in the room) and **Step Down**.
- **The facilitator leaves**: once their screen has been gone from the room for **10 seconds** on yours (long enough
  for a refresh to come back), any Editor sees **Take Over** on the chip, and one press takes the baton. It is never
  taken without a press while someone holds it, so a facilitator coming back from a dropped connection finds the
  session as they left it unless somebody chose to run it.
- A Participant or Viewer sees the chip and who holds it, never a verb.

## Sprint Planning

A Sprint Planning session walks the top of the backlog one card at a time and **commits** cards into the sprint. It is
the same tab, queue, sidebar, card, progress bar, timebox, facilitator and fill button as Refinement; what it brings
is below.

### Making one

- Start Planning's **Sessions** holds **Sprint Planning** ("Walk the top of the backlog and commit cards into the
  sprint, tallying estimates against capacity") beside Refinement. Choosing it opens **Set Up Sprint Planning**:
  1. **Card Types** and **Stages** as Refinement's. It picks first the types with cards in a ready-like stage (Reviewed,
     Ready, Refined, Ready for Development, Groomed, Selected, Backlog), and those stages; else each type's first
     stage.
  2. **Order** as Refinement's; None keeps the backlog's hand order, the top first.
  3. **When Committed**: one row per picked type, "Moves to" a stage picker, starting on **Next Stage** (the same rule
     as When Refined's: on the Sprint Board, Ready commits to To Do) and overridable with any stage of the type's, as When Refined is.
  4. **Capacity**: optional, a number of estimate points from 1 to 9 999, empty by default ("No capacity").
  5. **Timebox** as Refinement's.
- A picked type with no **Estimate** field says so under Card Types ("Bug has no Estimate field: its cards count as
  no estimate"), so nobody is surprised by the tally.
- Start Session names the tab **Sprint Planning** while it keeps its default name.

### Running it

- The **action bar** holds **Skip** on the left, where Commit takes the card ("Moves to **Selected**"), the timebox's
  time left when on, and the **Commit** fill button (the shared fill animation) on the right. Commit moves the real
  card to its target stage (the end of that column), records **Committed** in its history and on the tab, and moves
  the room on. Skip greys the card in the sidebar and moves on, as in Refinement. Keys: **C** Commit, **S** Skip,
  **J** and **K**.
- **Estimate** sits in a strip above the action bar: the story-point sizes (1, 2, 3, 5, 8, 13, 21) as chips, the card's
  own value pressed, and **None**. Pressing one writes the card's Estimate at once, as the Estimate field does. It is
  there for whoever may edit cards (an Editor or a Participant), whether or not they facilitate; a Viewer reads the
  value. The strip says what Commit would make the tally ("Commit makes it **16 of 30**"). A card whose type has no
  Estimate field says so in the strip instead of chips, and its committed card counts as no estimate.
- Each sidebar row shows the card's estimate as a small pill on the right; a card with none shows a dashed **?** pill,
  so a missing estimate shows before Commit.
- The **tally** sits under the progress bar: "Committed", then "**13** of 30 points" (or "**13** points" with no
  capacity) and a meter: the committed points in the accent, the room's card's estimate as a lighter segment after
  them (what Commit would add). The meter reads its normal accent below 85% of capacity, **amber** from 85% up to the
  capacity itself, and **red** past it, with the words "Near capacity" or "Over capacity by 4 points". It never stops a
  Commit. Committed cards with no estimate are counted apart under it ("1 committed card has no estimate, not
  counted"), never as zero.
- **Session Complete** shows Committed and Skipped, and the tally ("21 of 30 points committed").
- Undo Outcome on a committed card clears its outcome (the tally drops it); its move is undone with the editor's Undo.

## Real time

- The set-up, the current card, the outcomes, the facilitator and the card's start time are the tab's `session`
  field, written only by the facilitator (or an Editor taking the baton), so it travels as the tab's metadata does,
  persists with the tab and replays to a late joiner. The facilitator moving on reaches everyone within the
  autosave's beat.
- The cards themselves are the plan's items, live as on any board: a field changed, a comment added or a card moved
  by anyone shows at once.
- The timebox ticks on each screen from the card's start time, as the session timer does, never over the wire.

## History

A card's history ([Items](items.md#history)) records each outcome as an entry of its own, tagged **session**:
"Sam refined this in a Refinement session", "Sam skipped this in a Refinement session", "Sam flagged this in a
Refinement session". Sprint Planning's read "Sam committed this in a Sprint Planning session" and "Sam skipped this in a
Sprint Planning session". Refined, Committed and Flagged also record the move or the flag itself, as any write does.
The outcome is written by `POST /items/:itemId/session` (`{ session: 'refinement' | 'planning', outcome }`, the outcome
one the kind offers), which writes nothing on the card, so a skip changes no Last Edited.

## Share roles

| Role            | May                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Make a Session tab and change its set-up; hold the facilitator baton (take it, hand it over, step down, take it over); run the session |
| **Participant** | Watch it live; peek at any card; edit the card's fields and comment on it, as on a board (Sprint Planning's Estimate strip included)   |
| **Viewer**      | Watch it live; peek at any card; read it (the Estimate strip reads its value, with no chips)                                           |

The outcome route asks edit access. A locked tab reads as a Viewer's.

## Designed to grow

Every session kind shares the tab, the queue, the sidebar, the card, the progress bar, the timebox, the facilitator
and the fill button. A kind brings only:

- its **set-up parts** (Refinement's: card types, stages, order, When Refined, timebox; Sprint Planning's add
  Capacity),
- its **actions** (Refinement's: Refined, Skip, Flag; Sprint Planning's: Commit, Skip), each an outcome with a label,
  glyph, key and history wording; the completing one is the fill button and moves the card to its target stage,
- its **grouping** of the sidebar (Refinement's: none; Stand-up's will be by person),
- its **tally** (Sprint Planning's: estimates against capacity; none for Refinement), which brings the tally meter, the
  Estimate strip, the rows' estimate pills and the capacity set-up part.

`SESSION_KINDS` (in `@liveplanner/project`) names each kind's label, outcomes, completing outcome, grouping and tally,
and the editor's `session-kinds.tsx` its wording and set-up defaults; a tally's parts live in their own folder
(`components/session/planning/`) and the page draws them only for a kind with that tally.

## Agents and export

- Agents see a Session tab in a plan's tabs as kind `session`; they do not run one. A changeset on it (the MCP's tab
  tools, the API's) is refused ("A Session tab is run in the editor: change its cards with the card tools instead").
- A Session tab's page is no element, so Export offers its JSON alone (its set-up and outcomes, which Import reads
  back), as a Form tab's; its cards export from their boards. Whole Plan carries it with the plan's other tabs.

## Telemetry

In the `Plan` category (the `Session` category is a visit's): `Plan · Created · SessionTab` on Start Session,
`Plan · Changed · SessionSetup` on a set-up change, and `Plan · Used · SessionRefined | SessionSkipped |
SessionFlagged | SessionCommitted` on each outcome (the one chart of session outcomes, Sprint Planning's Commit
included).

## Limits

- 500 cards in a queue; 50 card types and 100 stages in a set-up; a timebox of 1 to 30 minutes; a capacity of 1 to
  9 999 points.
