# Session tabs

Status: **implemented** (Refinement, Sprint Planning, Bug Triage, Sprint Review, Stand-up).

A **Session tab** turns a filtered, ordered slice of the plan's cards into a **queue** the team works through one
card at a time. The first **session kind** is **Refinement**: the team reads each card, sharpens it, and marks it
**Refined**, which moves it on to the next stage.

## Why

Teams refine by staring at one big board. Everything on it competes for attention, nobody is sure which card is
next, and "is this one ready?" is decided by whoever drags first. A session tab shows one card, fully, with the
queue beside it and one clear way to say "done, next". A second kind, **Sprint Planning**, walks the top of the backlog the same way and
**commits** cards into the sprint, tallying their estimates against the team's capacity
([Sprint Planning](#sprint-planning)), and a third, **Bug Triage**, walks every new bug and gets a decision on each:
accepted, closed with a reason, skipped or flagged ([Bug Triage](#bug-triage)), and a fourth, **Sprint Review**, walks the
work finished since the last review, demoing each card and keeping the room's feedback on it
([Sprint Review](#sprint-review)), and a fifth, **Stand-up**, walks the team person by person through the cards they have in
flight, so the meeting stays about the work rather than drifting into status reports around a big board
([Stand-up](#stand-up)). It is a **view over the real cards**, never a copy: every
edit, comment and move lands on the card itself, on every board it shows on.

## Domain language

| Term             | Meaning                                                                                                                                                                       | Not                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Session tab**  | A tab of kind `session`: one queue of cards worked through together                                                                                                           | meeting tab, ceremony            |
| **session kind** | What the session is for: `refinement`, `planning`, `triage`, `review` or `standup`, stored as `session.sessionKind`                                                           | type (a card's), template        |
| **queue**        | The cards the session works through, in order: those its set-up picks, and every card it has already decided                                                                  | list, backlog                    |
| **set-up**       | What a session picks and how: its card types, its stages, its order, its target stages and its timebox                                                                        | config, filter                   |
| **stage**        | A status (a board column) the session takes cards from                                                                                                                        | column (a board's), state        |
| **target stage** | Where the kind's completing outcome (Refined, Committed, Accepted) moves a card: the next stage in its type's order, or the one the set-up names                              | destination (a form's)           |
| **close stage**  | Where Bug Triage's Closed moves a card: the type's first closing stage (Won't Fix, Cancelled), or the one the set-up names                                                    | done column                      |
| **reason**       | The short words a Close is given ("Can't reproduce"), kept with the outcome and in the card's history                                                                         | comment, note                    |
| **duplicate**    | The card a closed bug repeats, linked on Close                                                                                                                                | copy (Duplicate makes one)       |
| **outcome**      | What the session decided for a card: **Refined**, **Skipped**, **Flagged**, **Committed**, **Accepted**, **Closed**, **Reviewed** or **Discussed** (each kind offers its own) | result, verdict                  |
| **person**       | Stand-up's unit: one person and the in-flight cards assigned to them; the cards with no assignee are **Unassigned**, always last                                              | member, attendee                 |
| **people order** | The order Stand-up walks its people in: **Board Order**, **Alphabetical** or **Shuffled Daily**                                                                               | rota, sort                       |
| **blocker**      | A card marked **Blocked** in a Stand-up: flagged, with a short reason kept on the card as a comment                                                                           | impediment, issue                |
| **done range**   | Sprint Review's dates: the cards that entered a picked done stage from this day (and up to that one), "since the last review" by default                                      | period, sprint                   |
| **presenter**    | Who demos a card in Sprint Review: its assignee unless the facilitator names someone else                                                                                     | owner, speaker                   |
| **feedback**     | What the room said about a card in Sprint Review, kept as a comment on the card labelled **Review Feedback**                                                                  | note, review comment             |
| **follow-up**    | A new card made from feedback in Sprint Review, linked to the card it came from                                                                                               | child, task                      |
| **demo strip**   | Sprint Review's band over the card: its presenter, pull requests and designs, there to demo from                                                                              | header, preview                  |
| **capacity**     | Sprint Planning's optional figure, in estimate points, that the committed cards are tallied against                                                                           | budget, velocity                 |
| **tally**        | The committed cards' estimates added up, beside the capacity; cards with no estimate are counted apart, never as zero                                                         | total, burn                      |
| **current card** | The card the session is on, shown on the right for everyone                                                                                                                   | selected card                    |
| **facilitator**  | The one person who runs the session: moves it from card to card and decides outcomes                                                                                          | host, owner, driver              |
| **timebox**      | An optional length of time per card (per person, in a Stand-up)                                                                                                               | timer (that is a session tool's) |
| **fill button**  | The action button that fills with the theme's accent as it confirms (`FillActionButton`), shared by every session kind                                                        | progress button                  |

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
  as a board sorts. A card added to a picked stage mid-session joins it at the end; one dragged out of the picked
  stages on a board leaves it, unless the session already decided it.
- The order **holds**: each screen keeps the cards in the order it first queued them, so editing a queued card (its
  title, its estimate, anything the order reads, Last Edited among them) never moves it, and the room never sees the
  shown card jump from "2 of 5" to "5 of 5". Saving a changed set-up in Session Settings sorts the queue afresh.
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
  Outcome** (the facilitator's) takes the decision back: the card returns to the stage the outcome moved it from, in
  its own place in that column (in front of the card now ranked after where it was, never at the column's end), when
  it is still where the outcome put it (a card someone has moved since stays put); a flag the outcome set comes
  off, a duplicate link it made is removed, the card's history records the undo, and the outcome clears so the card
  can be decided again, the room staying on it.
- **Undo Last**: once anything is decided, the facilitator's action bar starts with a small chip naming the latest
  decision ("Closed BUG-33 · Undo"), so the last decision is one press from undone without finding its card. It
  undoes as Undo Outcome does and takes the room back to that card. On a phone the bar is one row: Undo Last, Skip,
  Flag (and Bug Triage's Close) as square icon buttons named for a screen reader, then the fill button taking the rest
  of the row, with the "Moves to" line above it.
- Keyboard, for the facilitator, when focus is not in a field: **R** Refined, **S** Skip, **F** Flag, **J** and **K**
  the next and previous card, **U** Undo Last.
- Everyone else sees the bar's place hold who is facilitating ("Sam is running this session") and, for an Editor, the
  facilitator choices below.

### When the queue is done

- With no card left to go, the right side shows **Session Complete**: how many were Refined, Skipped and Flagged, and
  for the facilitator **Undo Last** (the chip and **U**: the last decision taken back and the room back on its card, so
  the last card's decision is never final), **Review Skipped** (the first skipped card) and **Start Again** (clears
  every outcome).
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
- Undo Outcome on a committed card takes the card back to its stage and clears its outcome (the tally drops it).

## Bug Triage

A Bug Triage session walks every new bug one at a time and gets a decision on each, so none piles up untriaged. It
is the same tab, queue, sidebar, card, progress bar, timebox, facilitator and fill button as Refinement; what it
brings is below.

### Making one

- Start Planning's **Sessions** holds **Bug Triage Session** ("Walk every new bug one at a time and decide: accept
  it, close it with a reason, skip or flag it") beside Refinement and Sprint Planning, named apart from the Bug Triage
  board Start Planning's Boards offer. Choosing it opens **Set Up Bug Triage**:
  1. **Card Types** as Refinement's. It picks first the bug-like types (named Bug, Defect, Issue, Incident or
     Problem, or drawn with the bug glyph) among those with cards in an intake stage; else every type with cards in
     one; else as Refinement does.
  2. **Intake Stages** (the Stages part, named for triage): the intake-like stages (New, Under Review, Triage, Needs
     Triage, Untriaged, Inbox, Reported, Submitted, Open) picked first; else each picked type's first stage.
  3. **Order**: **Created, Oldest First** by default, so the bug that has waited longest comes first; any of a
     board's Sort Cards choices otherwise.
  4. **When Accepted**: one row per picked type, "Moves to" a stage picker starting on **Next Stage**, overridable
     with any stage of the type's, as When Refined is. Triage's Next Stage also steps past a waiting stage (Needs
     Info, Needs Detail, Waiting, On Hold, Blocked), so a New bug accepts into **Confirmed** on the Bug Tracker's
     Triage board rather than into Needs Info.
  5. **When Closed**: one row per picked type, "Moves to" a stage picker starting on **Close Stage**: the type's
     first closing stage (Won't Fix, Won't Do, Cancelled, Canceled, Declined, Rejected, Not a Bug, Invalid, Closed,
     Dropped, Abandoned, in that preference); with none, the card stays where it is. Any stage of the type's may be
     named instead.
  6. **Timebox** as Refinement's.
- Start Session names the tab **Bug Triage** while it keeps its default name.

### Running it

- **Priority** and the type's other fields (Severity, Impact) are set where they always are: inline in the card's
  **Details** panel on the right (its Details tab on a phone), for whoever may edit cards (an Editor or a
  Participant), whether or not they facilitate; a Viewer reads them. Nothing else sits between the card and the
  action bar, so the page holds the card and the decision alone.
- Each sidebar row shows the card's priority as a small pill in its colour on the right; a card with none shows a
  dashed **?** pill, so an unprioritised bug shows before it is accepted.
- The **action bar** holds **Skip** and **Flag** on the left (after **Undo Last** once there is one), where Accept
  takes the card ("Moves to **Confirmed**"), the timebox's time left when on, then **Close** and the **Accept** fill
  button (the shared fill animation) on the right. Keys: **A** Accept, **C** Close, **S** Skip, **F** Flag, **U**
  Undo Last, **J** and **K**.
- **Accept** moves the real card to its target stage (the end of that column), records **Accepted** in its history
  and on the tab, and moves the room on.
- **Close** opens the **Close dialog**, a centred dialog (a sheet on a phone) whose illustrated header names the card
  ("Close Bug", "BUG-12 · Basket empties"): a short **reason** (a text field of up to 200
  characters, with Won't Fix, Can't Reproduce, Duplicate, Works as Intended and Not a Bug as chips that fill it in),
  an optional **Duplicate Of** (**Link Duplicate** opens the plan's card picker; the picked card shows as a chip with
  a remove button, and fills an empty reason with "Duplicate of BUG-12"), a line saying where the card goes ("Moves
  to **Won't Fix**"), then **Cancel** and **Close Bug** at its foot. The dialog keeps its height as a duplicate comes
  and goes. Close Bug needs a reason; Enter in the reason presses it and
  Escape cancels. Closing moves the card to its close stage (with a duplicate linked and no close stage named in the
  set-up, to a stage of its type named Duplicate when it has one), records **Closed** with the reason and the
  duplicate in its history and on the tab, and moves the room on.
- **The duplicate link**: when the card's type has a Card field named like a duplicate (Duplicate Of, Duplicates,
  Duplicate) that links to the duplicate's type, Close writes the duplicate into it (adding to the list when the
  field holds several), so it shows in Linked Cards as any link does. With no such field the link is kept in the
  outcome and the card's history alone ("Closed this as a duplicate of BUG-12").
- **Skip** and **Flag** work as Refinement's.
- A decided card shown again reads its outcome and, for a Closed one, its duplicate and reason ("Closed by Sam ·
  Duplicate of BUG-12 · Can't reproduce", then Undo Outcome).
- **Session Complete** shows Accepted, Closed, Skipped and Flagged.

## Sprint Review

A Sprint Review session walks the work finished since the last review one card at a time, so each is demoed and the
room's feedback lands on the card rather than in somebody's notes. It is the same tab, queue, sidebar, card, progress
bar, timebox, facilitator and fill button as Refinement; what it brings is below.

### Making one

- Start Planning's **Sessions** holds **Sprint Review** ("Walk the work finished since the last review, demo each card
  and keep the room's feedback on it") beside the others. Choosing it opens **Set Up Sprint Review**:
  1. **Card Types** as Refinement's. It picks first the types with cards in a done stage (a stage in the Done phase,
     or named Done, Closed, Complete, Completed, Shipped, Released, Resolved, Fixed, Deployed, Delivered or Live);
     else every type with cards; else the first type.
  2. **Done Stages** (the Stages part, named for review): those done stages picked first; else each picked type's
     first stage.
  3. **Done Range**: which finished cards, by when they **entered** their stage (the card's own stamp, as Age reads
     it: never when it was last edited), as chips: **Since Last Review** (offered when the plan holds another Sprint
     Review session that decided a card; from the moment of its latest decision), **Last 7 Days**, **Last 14 Days**,
     **Last 30 Days** and **All Time**, then **From** and **To** dates for a range of the team's own (To is optional).
     It starts on Since Last Review when the plan has one, else Last 14 Days. The range is kept as its dates, so the
     queue stays the same while the session runs; the sidebar's set-up line says it ("since 14 Nov").
  4. **Order**: **Last Edited, Oldest First** by default (a finished card is seldom edited again, so the work reads
     roughly in the order it finished); any of a board's Sort Cards choices otherwise.
  5. **Presenter**: **Assignee** (each card's presenter is its assignee, changeable per card in the session) or
     **None** (no presenter shown).
  6. **Timebox** as Refinement's.
- There is no When Reviewed: Reviewed never moves a card.
- Start Session names the tab **Sprint Review** while it keeps its default name.

### The queue

- Sprint Review reads finished cards as they are: **archived** cards in a picked stage and range are queued too (only
  trashed ones are not), and nothing the session does reopens, restores or moves one. An archived card's panel reads
  as it does from an Archive board.

### Running it

- The **demo strip** runs across the top of the card, above its panel: the **presenter** (their disc and name; for
  the facilitator a person picker, **No one** and the plan's people, naming someone else for this card alone), the
  card's **Pull Requests** (every pull request it links, by field or by name, each with its short name, state chip
  and title, opening on GitHub), and its **Designs** (the pictures in its Image fields and its picture Attachments as
  thumbnails 64 px tall, and its Link fields as chips; a thumbnail opens the picture in a new tab). A card with none
  of these says so in a quiet line ("Nothing linked to demo"). On a phone the strip scrolls sideways in one row.
- **Feedback** sits in a strip above the action bar: one text box ("What did the room think?") and **Add Feedback**
  (Enter adds it, Shift+Enter a new line), with "2 so far" beside it. Adding saves the text as a comment on the real
  card, labelled **Review Feedback** ([Items](items.md#review-feedback)): the first starts a thread titled "Sprint
  Review feedback"; later ones reply in the newest open thread whose first comment is Review Feedback. It shows in
  the card's Comments at once, for everyone, on every board. The box is there for whoever may comment (an Editor or a
  Participant), whether or not they facilitate; a Viewer sees the count alone.
- The **action bar** holds **Undo Last**, **Skip** and **Follow-up** on the left, the line "Stays in **Done**" (Reviewed
  moves nothing), the timebox's time left when on, and the **Reviewed** fill button (the shared fill animation) on
  the right. Keys: **R** Reviewed, **S** Skip, **N** Follow-up, **U** Undo Last, **J** and **K**.
- **Reviewed** keeps the card where it is, records **Reviewed** in its history and on the tab, and moves the room on.
  **Skip** works as Refinement's.
- **Follow-up** opens the **Follow-up dialog**, a centred dialog (a sheet on a phone) whose illustrated header names
  the card it comes from ("New Follow-up", "From WI-47 · Dark mode for the dashboard"): a **Title** (filled from the
  newest Review Feedback comment on the card, whoever left it, else empty; up to 200 characters), a **Card Type** (the card's
  own first), a line saying where it goes ("Added to **Backlog**"), and **Cancel** and **Create Follow-up** at its
  foot. Create needs a title; Enter in the title presses it, Escape cancels. It makes a new card of that type in its
  first Backlog-like stage (Backlog, Icebox, Inbox, Ideas, Someday), else its Default State, else its first stage, at
  the top of that column, with the reviewed card's Priority when its type has one (so on a board laned by priority it
  sits in its source's lane), and links it to the reviewed card: through the new card's Card field named like a follow-up
  (Follow-up Of, Follow Up Of, Follows Up, Related, Related To, Relates To, See Also) that links to the reviewed
  card's type, when its type has one (it then shows in the reviewed card's Linked Cards); else its description reads
  "Follow-up from WI-47: Dark mode for the dashboard". The room stays on the reviewed card; the follow-up is kept on
  the tab against it (at most 20 per card). Several may be made per card.
- A decided card shown again reads its outcome and its follow-ups ("Reviewed by Sam · 1 follow-up", then Undo
  Outcome). Undo takes the decision back as any kind's; follow-ups stay made.
- Each sidebar row shows the card's presenter as a small disc on the right (none with Presenter set to None, or no
  presenter).
- **Session Complete** shows Reviewed and Skipped, then **Feedback**: how many Review Feedback comments the queued
  cards hold and on how many cards ("5 comments on 3 cards"), and **Follow-ups**: each made in the session, its
  number and title and the card it came from, pressing one opening it.

## Stand-up

A Stand-up session walks the team **person by person** through the cards they have in flight, so each person speaks
to their own work, what is stuck gets flagged on the card itself, and nobody reads a status report at a big board. It
is the same tab, queue, card, progress bar, timebox, facilitator and fill button as Refinement; its unit is a person
rather than a card, and what it brings is below. It must stay quick: one press per action, a key for each, nothing
asked that the card does not need.

### Making one

- Start Planning's **Sessions** holds **Stand-up** ("Walk the team person by person through their in-flight cards:
  flag what's blocked, move what moved") beside the others. Choosing it opens **Set Up Stand-up**:
  1. **Card Types** as Refinement's. It picks first the types with cards in an in-flight stage (a stage in the Doing
     phase, or named In Progress, Doing, Started, In Development, In Dev, Development, In Review, Review, Code Review,
     Testing, In Testing, QA or Blocked, never one named as ready to start: Reviewed, Ready, Refined, Ready for
     Development, Ready for Dev, Groomed, Selected or Backlog, whatever its phase); else every type with cards; else
     the first type.
  2. **In-flight Stages** (the Stages part, named for stand-up): those in-flight stages picked first; else each picked
     type's first stage.
  3. **People Order**: **Board Order** (the default: people in the order their first card sits on the board, the
     stages in the plan's column order, then each column's hand order), **Alphabetical** (by name) or **Shuffled
     Daily** (a fresh order each day, the same on every screen that day: seeded by the day, in UTC, and the tab).
     **Unassigned** always comes last. A person's own cards read in board order.
  4. **Timebox** as Refinement's, but **per person** ("min per person"); off by default.
- There is no Order and no When part: Stand-up never moves a card on its own.
- Start Session names the tab **Stand-up** while it keeps its default name.

### The queue

- The queue is every kind's (the picked types in the picked stages, live, held in the order a screen first queued
  it), **grouped by Assignee**: one **person** per assignee holding their cards, then **Unassigned** with every card
  that has none. A card's Assignee is one person, so a card sits under one person; reassigned mid-session, it moves to
  its new person.
- A card moved out of the picked stages by the session itself (Stage, below) stays in the queue, as a decided card
  does in every kind.
- The header counts **people**: "Stand-up 2 of 5 people".

### The sidebar

- One row per person, in the people order: their disc (a dashed **?** disc for Unassigned), their name, how many
  cards they hold, and a tick once they are **Done** (the row then greyed as a decided card is).
- The room's person's row is **unfolded** to their cards, each a row as in every kind (its number, title, type edge
  and outcome glyph) with its stage's name. Any other person's row unfolds and folds on this screen alone by pressing
  it (`aria-expanded`); the room's person unfolds again when the room moves on.
- Pressing a card row opens it as in every kind: the facilitator's press moves the room (to that card, and so to its
  person); anyone else's is a peek.

### The progress bar

- One segment **per person** (a single smooth bar past 40): a Done person's is the accent, the room's person's the
  accent's tint, filling as their timebox runs and amber once it is up. It names itself "Stand-up progress, 2 of 5
  people done".

### Running it

- The **timebox** counts per person: it starts when the room reaches a person and keeps running as the room moves
  between their cards; it restarts only on the next person. Time's up turns the room's segment amber and chimes once,
  as in every kind, and never moves on by itself.
- The **action bar** opens with the line "{Name} · card 1 of 3" (with "· Blocked: {reason}" when the card was marked
  blocked in this session) on a row of its own, so it reads in full (a long reason wraps to a second line). Under it,
  one row: **Undo Last**, **Blocked** and **Stage** on the left, the timebox's time left when on, and the **Done** fill
  button (the shared fill animation, labelled "Done", named "Done: {Name}") on the right; on a phone the same row,
  with Undo Last, Blocked and Stage as compact controls.
- **Blocked** (a flag; only while the card is not flagged already) opens the **Blocked dialog**, a centred dialog (a
  sheet on a phone) whose illustrated header names the card ("Mark Blocked", "WI-41 · Retry failed payments"): a short
  **reason** (a text field of up to 200 characters, with Waiting on Someone, Waiting on Review, Needs a Decision,
  External Dependency and Unclear Requirements as chips that fill it in), then **Cancel** and **Mark Blocked** at its
  foot. Mark Blocked needs a reason; Enter in the reason presses it and Escape cancels. It flags the real card
  ([Flags](items.md#flags)), saves "Blocked: {reason}" as a comment on it (in the day's stand-up thread, below),
  records **Flagged** with the reason in its history and on the tab, and keeps the room on the card.
- **Stage** is a single picker of the card's type's stages, its own picked: choosing one moves the real card there
  (to the end of that column) and keeps the move on the tab, so Undo takes it back. The room stays on the card; a card
  not decided yet is recorded **Discussed** with the move, so it stays in the queue whatever its new stage.
- **Comment** sits in a strip above the action bar: one text box ("Add a note to WI-41") and **Add Comment** (Enter
  adds it, Shift+Enter a new line). It saves the text as a comment on the real card in the day's **stand-up thread**:
  the newest open thread on the card titled "Stand-up, {day}" ("Stand-up, 28 Nov"), else a new one so titled. It is
  there for whoever may comment (an Editor or a Participant), whether or not they facilitate; a Viewer has no strip.
- **Done** finishes the room's person: each of their cards not decided yet is recorded **Discussed** in its history
  and on the tab (a card stays in its stage: Stand-up moves nothing by itself), the person is kept as Done, and the
  room moves to the first card of the next person not yet Done, wrapping round past the end; with every person Done
  the session is complete.
- A Done person's card shown again reads "{Name} done by Sam" in the action bar, with **Undo Done** for the
  facilitator; Blocked, Stage and Comment still act on the card.
- **Undo Last** takes back the latest step, one at a time (a Blocked then a Stage move on one card are two steps: the
  first Undo moves it back, the next takes the flag off): a Done (the person no longer Done, the Discussed it recorded taken
  back, the room back on their first card), a Blocked (the flag off when it set it, its comment left as said) or a
  Stage move (the card back in its own place in the stage it came from, while it is still where the move put it).
- Keys, for the facilitator outside text fields: **D** Done, **B** Blocked, **U** Undo Last, **J** and **K** the next
  and previous card (across people).

### When everyone is done

- **Session Complete** shows Discussed and Flagged, then **Blockers**: every card marked blocked in the session, each
  with its number, title, person and reason, pressing one opening it as a look on that screen alone, with **Back to
  Summary**; "No blockers today" with none. Undo Last and Start Again as in every kind.
- An empty set-up says so, as in every kind.

## Real time

- The set-up, the current card, the outcomes, the facilitator, the card's start time, Sprint Review's presenters
  named and follow-ups made and Stand-up's people Done are the tab's `session`
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
Sprint Planning session". Bug Triage's read "Sam accepted this in a Bug Triage session", "Sam closed this in a Bug
Triage session: Can't reproduce", or "Sam closed this as a duplicate of BUG-12 in a Bug Triage session: Same root
cause". Sprint Review's read "Sam reviewed this in a Sprint Review session" and "Sam skipped this in a Sprint Review
session". Stand-up's read "Sam discussed this in a Stand-up session" and "Sam flagged this in a Stand-up session:
Waiting on the API keys". An undo reads "Sam undid Closed in a Bug Triage session"; an outcome undone by the same person within the
history's grouping minute cancels out, as a flag and an unflag do. Refined, Committed, Accepted, Closed and Flagged
also record the move, the flag or the duplicate link itself, as any write does; a follow-up records as the new card's
creation and its link. The outcome is written by
`POST /items/:itemId/session` (`{ session: 'refinement' | 'planning' | 'triage' | 'review' | 'standup', outcome, reason?,
duplicateOf?, undone? }`, the outcome one the kind offers; a reason with Closed or with a Stand-up's Flagged, a duplicate
only with Closed), which writes nothing on the card, so a skip changes no Last Edited.

## Share roles

| Role            | May                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Editor**      | Make a Session tab and change its set-up; hold the facilitator baton (take it, hand it over, step down, take it over); run the session (Sprint Review's Reviewed, Follow-up and presenter picks, Stand-up's Done, Blocked and Stage the facilitator's) |
| **Participant** | Watch it live; peek at any card; edit the card's fields and comment on it, as on a board (Sprint Planning's Estimate strip, Bug Triage's priority in Details, Sprint Review's feedback box and Stand-up's comment strip included)                      |
| **Viewer**      | Watch it live; peek at any card; read it (the Estimate strip reads its value, with no chips; Details reads as on a board; Sprint Review's feedback reads as a count; Stand-up shows no comment strip)                                                  |

The outcome route asks edit access; deciding and undoing are the facilitator's alone. A locked tab reads as a
Viewer's.

## Designed to grow

Every session kind shares the tab, the queue, the sidebar, the card, the progress bar, the timebox, the facilitator
and the fill button. A kind brings only:

- its **set-up parts** (Refinement's: card types, stages, order, When Refined, timebox; Sprint Planning's add
  Capacity; Bug Triage's add When Closed and start on oldest first; Sprint Review's swap When Refined for the Done
  Range and Presenter and start on last edited, oldest first; Stand-up's swap Order and When Refined for People Order,
  its timebox per person),
- its **actions** (Refinement's: Refined, Skip, Flag; Sprint Planning's: Commit, Skip; Bug Triage's: Accept, Close,
  Skip, Flag; Sprint Review's: Reviewed, Skip, and Follow-up, which decides nothing; Stand-up's: Done, which decides
  Discussed for each of a person's cards, Blocked, which flags with a reason, and Stage), each an outcome with a label,
  glyph, key and history wording; the completing one is the fill button and moves the card to its target stage
  (a kind that **stays**, Sprint Review and Stand-up, moves nothing); a **closing** one (Bug Triage's Close) asks its reason in its
  own dialog and moves the card to its close stage,
- what its queue **reads** (Sprint Review's: archived cards too, in the done range),
- its **field strip** above the action bar when the decision needs one (Sprint Planning's Estimate strip; Bug
  Triage has none, its fields live in Details; Sprint Review's feedback box; Stand-up's comment strip), a band over the card when it demos
  (Sprint Review's demo strip), and the sidebar rows' pill (the estimate, the priority, the presenter),
- its **grouping** of the sidebar (Refinement's: none; Stand-up's by person, which makes the person its unit: the
  progress bar, the timebox, the fill button and Session Complete count people),
- its **tally** (Sprint Planning's: estimates against capacity; none for Refinement or Bug Triage), which brings the
  tally meter and the capacity set-up part.

`SESSION_KINDS` (in `@liveplanner/project`) names each kind's label, outcomes, completing outcome, grouping and tally,
and the editor's `session-kinds.tsx` its wording and set-up defaults; a kind's own parts live in their own folder
(`components/session/planning/`, `components/session/triage/`, `components/session/review/`,
`components/session/standup/`) and the page draws them only for that kind. Every kind's page is drawn in the same
frame (`SessionFrame`: the canvas cover, the sidebar or a phone's queue folding down over the card, never squeezing it, the card side) under the same header
(`SessionHeader`).

## Agents and export

- Agents see a Session tab in a plan's tabs as kind `session`; they do not run one. A changeset on it (the MCP's tab
  tools, the API's) is refused ("A Session tab is run in the editor: change its cards with the card tools instead").
- A Session tab's page is no element, so Export offers its JSON alone (its set-up and outcomes, which Import reads
  back), as a Form tab's; its cards export from their boards. Whole Plan carries it with the plan's other tabs.

## Telemetry

In the `Plan` category (the `Session` category is a visit's): `Plan · Created · SessionTab` on Start Session,
`Plan · Changed · SessionSetup` on a set-up change, `Plan · Used · SessionRefined | SessionSkipped |
SessionFlagged | SessionCommitted | SessionAccepted | SessionClosed | SessionReviewed` on each outcome
(`SessionDiscussed` once per person a Stand-up marks Done, `SessionFlagged` for a Blocked), `Plan · Used ·
SessionUndone` on an undo and `Plan · Used · SessionFollowUp` on a follow-up made (the one chart of session outcomes,
every kind's included). Feedback and a Stand-up's comment count as the comment they are (`Comment · Created · Thread`, `Comment · Added · Item`).

## Limits

- 500 cards in a queue; 50 card types and 100 stages in a set-up; a timebox of 1 to 30 minutes; a capacity of 1 to
  9 999 points; a Close reason and a Blocked reason of 200 characters; 20 follow-ups per card and a follow-up title of 200 characters.
