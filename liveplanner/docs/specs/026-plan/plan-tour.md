# Plan tour

A hands-on tour of [Plan mode](plan-mode.md), one per kind of plan work, started from the footer's **Start Boards
Tour**, **Start Sheets Tour** or **Start Dashboards Tour** button. Each track teaches by doing, on real controls, in
a way that suits what the surface is for:

- **Boards** have three tracks, picked on the [start panel](#starting-a-tour):
  - **Using a Board**, a **Practice Sprint**: three practice cards are dealt onto the person's own board, and they add
    one, then drag them through it to Done.
  - **Card Types**: make a card type, give it a field, and add a card of it to the board.
  - **Board Setup**: rename a column, set a WIP limit, and add a widget to the board's header.
- **Sheets** run **Five Small Wins**: five short challenges on a practice sheet, each checked the moment it is right.
- **Dashboards** run **Layout View**: the dashboard shows its twelve-column grid, and the person resizes a slot and a
  row and watches them snap.

None of them is a row of step cards: each is a short list of **missions**, shown one at a time in the
[mission strip](#the-mission-strip), that tick themselves off as the person does them, however they found the way.
The footer button, the synced taken record, Settings › Getting Started and one-tour-at-a-time are the shared ones
([Editor tours](../007-editor/editor-tour.md)); where this spec is silent, those rules hold.

## Domain language

| Term               | Means                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Plan tour**      | This tour, all three tracks                                                                                           |
| **tour track**     | Which surface the tour teaches: **Boards**, **Sheets** or **Dashboards**                                              |
| **tour subject**   | The board or dashboard the tour runs on: the person's own, on the open tab                                            |
| **plan work**      | A board (`plan-board` element) or a Sheet (`plan-sheet` element) on the open tab, of any tab kind                     |
| **mission**        | One thing to do (move a card, write a total, drag a divider), checked from what the person really did                 |
| **mission strip**  | The small panel that shows the current mission, its hints and the track's progress                                    |
| **practice card**  | A card that lives on this screen alone, for the Practice Sprint ([Practice cards](#practice-cards))                   |
| **practice sheet** | The Sheets track's own sheet, in its own dialog, never saved unless kept ([Five Small Wins](#sheets-five-small-wins)) |
| **Layout View**    | The Dashboards track: the dashboard drawn with its grid, spans and heights showing                                    |

## Where it appears

- **The footer's Start Tour button.** The one way in is the button in the editor's bottom bar, immediately left of
  Settings ([Editor tours](../007-editor/editor-tour.md) "Where it appears"). It never starts, prompts or offers
  itself on its own: there is no banner. A press opens the [start panel](#starting-a-tour); nothing runs until a
  track is picked there.
- **Only while there is plan work to show.** The tour is on offer while a person may edit a tab **with a board or
  a Sheet on it**: a Board tab, a Sheet tab, or a Plan tab holding a board or Sheet. An empty Plan tab (which shows
  Start Planning) and a Dashboard tab have nothing to show, so the button names another tour or is not drawn. The
  editor has to be usable (hydrated, no welcome overlay, not read-only, not an embed), and the tab not locked.
- **One kind on the button.** The button names one kind, **Start Boards Tour** or **Start Sheets Tour**: of the
  ones with work on the tab, the first not yet taken, Boards between equals. Boards is taken once all three of its
  tracks are. Once every kind with work on the tab is taken, the Plan tour is off the button (it names another tour,
  or is not drawn). A press opens the start panel for the board or Sheet on screen (the [tour subject](#tour-subject)).
- **On the person's own board, or a practice sheet.** The Boards track runs on the board on screen (the
  [tour subject](#tour-subject)); the Sheets track opens its own practice sheet beside the person's, so a Sheet on the
  tab is what offers it, never what it changes. Neither places a board or Sheet on the tab unless the person keeps
  the practice work.
- **Taken, on every device**, through the synced `planTourTracks` user preference
  ([User preferences](../007-editor/user-preferences.md)): however a run ends (completed or skipped mid-way), the
  track it ran is taken, and it is written as the track starts too (picked on the start panel), so a reload mid-tour
  leaves it taken. **Not Now** on the start panel takes nothing. The tracks are `boards` (Using a Board),
  `card-types`, `board-setup`, `sheets` and `dashboards`. That
  record picks which track the button names, takes a taken track off the button, and feeds Settings' rows: turning
  a track's row back on puts it back on the button. Until 1 November 2026 it never hid the button (Work Tracker
  #177). The old single flag `planTourSeen` stands for no
  track on its own (`apps/editor/lib/plan-tour.ts`). Someone who had the retired
  [Power user mode](../007-editor/power-user-mode.md) on keeps every track taken: its preset's flag is folded into
  `planTourTracks` as the stored preferences are read.
- **Replayable from Settings**: in Settings' **Getting Started** category, **Plan Tours** switches every track at once, and
  one switch per track sits nested beneath it: **Boards Tour** (Using a Board), **Card Types Tour**, **Board Setup
  Tour**, **Sheets Tour** and **Dashboards Tour** (never "Plan Tour"). On means that track is not yet taken; a track's switch off marks that track alone, on forgets it
  alone. Turning one on from off and closing Settings opens the start panel straight away when the tour is on offer
  (the open tab has a board or Sheet on it); otherwise it does nothing, and the button is there once it is. Nothing is placed
  to give it something to show: an empty Plan tab already offers Start Planning, which makes a board or Sheet, and
  the switch's description says the tour needs one.
- **One tour at a time**: a press while another tour is on screen does nothing.

## Starting a tour

A press on Start Tour (or a Settings rerun) opens the **start panel** in the mission strip's place, so the person
sees what is about to happen before anything is dealt, opened or drawn:

- **Boards**: "What would you like to learn?" and one line ("Each track is a few quick missions on this board. Come
  back for the others any time."), then the three tracks as rows, each with its name, one line on what it teaches,
  and a **Done** tick once taken. Any row runs its track, a taken one again too.
  - **Using a Board**: "Add, move, open, date and ship cards, on practice cards that never reach your plan."
  - **Card Types**: "Make a kind of card, give it a field, and use it on this board."
  - **Board Setup**: "Rename a column, set a WIP limit and add a header widget."
- **Sheets**: "Five Small Wins", a line on the practice sheet ("Nothing is saved unless you keep it."), "5 quick
  missions" and **Open the Practice Sheet**.
- **Dashboards**: "Layout View", a line on the grid and the changes (made on the real dashboard, which Undo takes
  back), and **Show the Grid**. Show Me in Dashboard Settings is already a choice, so it goes straight in.
- **Not Now** (where End sits on the strip) closes the panel; the tour stays on offer and nothing is recorded.

## The Dashboards tour

The Plan tour's third track, on a dashboard: [Layout View](#dashboards-layout-view), started from the footer's
**Start Dashboards Tour** button. Dashboard Settings › **Show Me** runs the same Layout View
([Plan tabs](plan-tabs.md) "Show Me").

- **On offer** while an Editor's dashboard is on screen: not to a Participant or a Viewer, not in an embed, not
  while a maximised slot covers the page. It ranks above the Plan and Forms tours, so on a dashboard the button
  names it. Once taken it is off the button until its **Dashboards Tour** row is on again, and it never offers
  itself on a banner.
- **As it starts, and however it ends** (completed or skipped), a run from the button marks the `dashboards` track
  taken (`planTourTracks`), on every device. Show Me from Dashboard Settings runs the same missions and records
  nothing.

## The mission strip

Every track shows its missions in one small panel, the **mission strip**, the same on all three:

- **Where it sits.** On a computer it floats centred near the bottom of the window, above the footer, at most 26 rem
  wide, clear of the work. On a phone (narrower than 640 px) it is a bottom sheet across the window's width, above
  the footer, with rounded top corners. The Sheets track's strip sits at the bottom of its practice dialog.
- **Over a window.** While a window is open over the page on a computer (a card's panel, the card type editor), the
  whole strip moves to the bottom-left corner, 19 rem wide, so the window stays clear and the mission, hints and
  lesson stay in full view. When the mission is one done on the page (adding or moving a card, a slot's size), an
  amber line over it says **Close this window first, then:**, so nobody is left wondering why nothing happens. When
  the window closes the strip goes back to its place. On a phone it docks at the top over a window, as before.
- **Never over what it names.** On a phone the sheet never covers the control the mission or its hint points at:
  when that control sits where the sheet would dock (**Types** in the bottom-right cluster above the footer, a
  window's name field at its top), the sheet docks at the other edge instead, and moves back as the mission moves
  on. Its usual place is above the footer, or the top while a window or a sheet up from the bottom is open (a
  column's settings, a card's panel), so it never sits over the window being worked in. It is measured again as the
  page changes (a panel opening, the window or the visible viewport resizing). (Owner, 2026-11-09: "Review the new
  tours on mobile, they break the UI, for example on planner it says to hit the Card Types, but it covers it".)
- **Names the control.** Each mission rings the control it names (**Types**, **Add card**, a column's cog) while it
  is being done, the most specific one drawn on screen first, and names it in bold in its line. A control another
  window covers (the Add a Field picker over Add Field) is never ringed: the ring would float over that window.
- **What it shows.** The track's name (**Practice Sprint**, **Card Types**, **Board Setup**, **Five Small Wins**,
  **Layout View**), one pip per
  mission (filled once done, ringed for the current one), the current mission as a short instruction, one line on
  why it matters, a **Hint** button where the mission has hints, and **End**.
- **Nothing is in the way.** The strip is not a dialog: the page under it stays fully usable and nothing is dimmed.
  A mission is done when the person does it, by any route (a drag, a menu, a key), never by a button.
- **Done, then Next.** When a mission is done its pip fills with a tick and the strip shows the mission's name with a
  tick and what was just learned (the **lesson**), and stays until the person presses **Next** (**Finish** after the
  last), so a lesson is never gone before it is read. The next mission then slides in; with reduced motion it
  changes without sliding.
- **Hints climb.** Each press of **Hint** shows the next of the mission's hints: first a nudge in words, then where
  to look, with a pulsing ring round the control or the place it means. A ring a hint asks for first brings its
  control into view, once, when it sits scrolled out of its column or the window (Add card under a long column), so
  "where to look" is always somewhere on screen; the ring round the control a mission names while it is being done
  never scrolls anything. A hint never does the mission for them.
- **The end.** After the last mission the strip shows the track's finish: a line of thanks, the track's own choices
  (keep the practice work or let it go), and **Learn More**, the track's help article in a new tab. **End** at any
  time ends the tour as skipped and takes away everything practice.
- **Spoken.** Each new mission and each lesson is announced politely to a screen reader (`aria-live="polite"`), and
  the strip's buttons are reachable by keyboard. **Escape** belongs to the page under it, never the strip.

## Practice cards

The Practice Sprint's cards live **on this screen alone**:

- They are laid into the board's store here and never sent: no write that touches one goes to the server, so no
  collaborator sees one, nothing is saved, no header widget changes for anyone else, and Undo never records one.
- They act like any card of the board's first card type (`task` when it takes every type): they are drawn, dragged
  (by pointer, finger or **Shift** and an arrow key), moved through the card's menu, opened and edited. A write that
  touches both practice and real cards (a selection dragged together) sends only its real part.
- They look like practice: a dashed brand-coloured border over a see-through face, and a **Practice** tag where the
  card's number would be. They have no number of their own, so the next real card keeps the number the server
  gives it.
- A fresh read of the board (a reconnect, a refetch) lays them back over it as they were.
- They go when the tour ends, however it ends, unless the person keeps them; a reload takes them away too, since
  they were never anywhere but this screen. Their comments, attachments and links are not offered (those are saved
  elsewhere): a practice card's panel says so in their place.

## Tour subject

- The tour subject is the board or dashboard on the open tab **that the person sees**, read from what is drawn when
  the button is pressed: one maximised or filling its tab first, then one on screen, then the first in the tab's
  element order.
- **On screen.** The Boards track brings its board into view when it sits on the canvas out of the window: the view
  pans to it, zooming out only if it is too big to fit.
- **Never over Start Planning.** An empty Plan tab shows Start Planning, so the Boards and Sheets tracks are on offer
  only once the tab has a board or Sheet.
- **The person's work is theirs.** The Boards track changes nothing real unless the person keeps the practice cards.
  The Sheets track works on its own practice sheet, never the person's, and adds a Sheet tab only when they keep
  it. The Dashboards track's missions are the person's own changes to their dashboard, each one undo step, as ever.
- If the tour subject goes mid-tour (deleted, by the person or a collaborator), the tour ends as skipped.
- **Leftover records.** Older tours placed an example card, Board or Sheet and recorded it; any such record is
  still swept on the next visit, its content removed. Nothing new is recorded.

## Boards: Practice Sprint

1. **The deal.** Three practice cards, **Draft the plan**, **Book a room** and **Send the invite**, are dealt one after
   another into the board's first column, each dropping in and settling (80 ms apart; placed at once with reduced
   motion).
2. **Missions**, in order:
   - **Add a Card** (`add-card`): add a card from the first column's **Add card**. While the sprint runs, a card
     added on its board (in one of its columns) is a practice card too: dashed, never sent, gone at the end unless
     kept. Done when a practice card that was not dealt appears. Lesson: a new card lands where you add it, ready for
     its title. Hints: where Add card sits, then a ring round it.
   - **Move one on** (`move-card`): drag a practice card into the next column. Done when any practice card leaves
     the first column. Lesson: work moves left to right; on a real card everyone in the plan sees it move. Hints:
     "Press and drag a dashed card to the right", then a ring round the next column. On a phone the instruction says
     to hold a card, then drag it.
   - **Open one** (`open-card`): open a practice card. Done when its panel opens. Lesson: everything about one piece
     of work lives here, saved as you type. Hint: a ring round a practice card.
   - **Give it a date** (`due-date`): set a practice card's due date. Only when the card type has a **Due** field.
     Done when a practice card has one. Lesson: dates show on the card, and on calendars and dashboards. Hint: a ring
     round the panel's Due field (the card's panel opens if none is).
   - **Ship it** (`ship-card`): drag a practice card into the board's last column (the column marked done, else the
     rightmost). Done when one lands there; it shows a **Shipped** stamp, the track's one flourish. Lesson: done is
     a column too; the header's widgets count what is in it. Hint: a ring round that column.
3. **WIP limits.** When, during the sprint, a column with a WIP limit goes over it (the count turning amber), the
   strip shows that once, in place of the current mission's why: "In Progress is over its limit of 3, so its count
   turns amber. Finish something before starting more." A board with no limits never mentions them.
4. **The finish** (`outro`): "Sprint done." with **Keep as Real Cards** (the practice cards become real cards where
   they are, one undo step) and **Clear Them** (they go). Either ends the tour as completed, as does **Learn More**
   followed by either.

## Sheets: Five Small Wins

The track opens the **practice sheet**: a dialog (most of the window on a computer, the whole screen on a phone)
holding a real Sheet, its toolbar, formula bar and grid, filled with a small budget. It is the same Sheet as any
other, but kept in memory: nothing in it is sent or saved, and the person's own sheet is untouched.

| Row | A (Category) | B (Planned)   | C (Actual) | D (Left) |
| --- | ------------ | ------------- | ---------- | -------- |
| 1   | Category     | Planned       | Actual     | Left     |
| 2   | Rent         | 1200          | 1200       | `=B2-C2` |
| 3   | Groceries    | 400           | 436        |          |
| 4   | Transport    | 150           |            |          |
| 5   | Fun          | 200           | 265        |          |
| 6   | Savings      | 500           | 500        |          |
| 7   | Total        | `=SUM(B2:B6)` |            |          |

Row 1 is a bold header and is frozen. The mission's cell (or cells) glow in the brand colour, and turn green the
moment the mission is done.

1. **Type a number** (`type-value`): "Transport came to 122. Type it into C4." Done when C4 holds the number 122.
   Lesson: numbers, dates and percentages are read as you type them. Hints: "Click C4, type 122, press Enter", then a
   ring round C4.
2. **Add it up** (`sum`): "Total what you spent in C7." Done when C7 holds a formula whose value is the sum of C2:C6.
   Lesson: start with = to write a formula; click or drag over cells to point at them. Hints: "Type =SUM( and drag
   over C2 to C6", then the whole answer, `=SUM(C2:C6)`.
3. **Fill it down** (`fill-down`): "D2 works out what's left. Fill it down to D6." Done when D3 to D6 each hold the
   planned minus the actual for their row. Lesson: a filled formula follows its row. Hints: on a computer, "Drag the
   small square at D2's corner down to D6"; on a touch screen, "Select D2 to D6, then Fill Down from the cell's
   menu"; then a ring round D2 to D6.
4. **Make it money** (`currency`): "Show B2 to D7 as currency." Done when every number in B2:D7 shows as currency.
   Lesson: the toolbar acts on whatever is selected. Hints: "Select B2 to D7, then Numbers › Number Format", then a
   ring round the toolbar's category switcher.
5. **Chart it** (`chart`): "Chart planned against actual." Done when the person picks any chart from Data › Insert
   Chart with cells selected. The chart is drawn in the strip from the cells they picked: in a plan it lands beside
   the sheet. Lesson: charts follow the cells, so they change when the numbers do. Hints: "Select A1 to C6, then
   Data › Insert Chart", then a ring round the switcher.
6. **The finish** (`outro`): "Five for five." with **Keep This Sheet** (a new Sheet tab, **Practice Budget**, holding
   the practice sheet as it now is; it opens) and **Done** (the dialog closes and the practice sheet goes). Either
   ends the tour as completed.

Closing the dialog (its close button, or End in the strip) ends the tour as skipped. **Escape** stays with the sheet (it cancels a cell's edit), so it never closes the practice by accident.

## Dashboards: Layout View

While the track runs, the dashboard shows **Layout View**: over each row its twelve column guides, faint and
dashed; on each slot a chip with its span (**8 / 12**); on each row a chip with its height (**320 px**); and the
dividers between slots and each row's bottom edge shown as they are on hover. Chips update live as things change. The
page stays fully usable; Layout View draws nothing that takes a click.

1. **Resize two slots** (`resize-slots`): drag the divider between two slots, or focus it and press an arrow key.
   Done when any slot's span changes. Lesson: slots snap to twelfths and a row's spans always add to twelve. Hints:
   "Drag the bar between two slots", then a ring round the first divider. Only when a row has two slots or more;
   otherwise **Add a slot beside** (`add-slot`) takes its place: done when a row gains a slot (a slot's cog › Add a
   Slot › Add Slot to the Right, or Dashboard Settings), hint a ring round the first slot's cog.
2. **Change a row's height** (`row-height`): drag a row's bottom edge, or focus it and press an arrow key. Done when
   any row's height changes. Lesson: rows grow to fit what they hold; a tall one suits a board or a Gantt. Hint: a
   ring round the first row's edge. Not for a dashboard whose rows all fill the page.
3. **Fill a slot** (`fill-slot`): only when a slot is empty when the tour starts. Done when an empty slot is filled.
   Lesson: a slot shows a tab, a board, a metric, a chart or a note, live from the plan. Hint: a ring round the first
   empty slot's Add to Slot.
4. **The finish** (`outro`): "That's the grid." with **Done**, and the line "Dashboard Settings starts you from
   another layout any time."

**On a phone** a dashboard's rows stack and its dividers and edges are hidden, so Layout View shows only the chips
(each span reading as it does on a wider screen) and the missions are those that work there: **Fill a slot** when a
slot is empty, then the finish, which says that slots sit side by side on a wider screen.

The missions are fixed when the tour starts, so filling the empty slot mid-tour keeps the count. Every change is the
person's own, one undo step, and stays when the tour ends.

## Boards: Card Types

Run on the board on screen, through the plan's own **Types** panel and type editor. The type made is real (the plan
stores it, with an undo step as ever); the card added is a practice card.

1. **Make a Card Type** (`make-type`): add a type from Types › Add Card Type and save it. Done when the plan has a
   type it did not have at the start. Lesson: a type is a kind of card, with its own colour, glyph and fields.
   Hints: a ring round **Types**, then round the editor's name field.
2. **Give It a Field** (`edit-type`): open the new type again and add a field. Done when its fields differ from how
   it was first saved. Hints: a ring round Types, then round **Add Field**.
3. **Add One to the Board** (`use-type`): add a card of the new type from the first column's Add card. A board that
   names its types takes the new one as it is made, so Add card offers it. The card is a practice card. Done when a
   practice card of the new type appears.
4. **The finish** (`outro`): "<Type> is ready." with **Keep the Type** and **Put It Back** (the type is deleted and the
   board's types are as they were). The practice card goes either way.

## Boards: Board Setup

Run on the board on screen, through its own controls. Every change is real and undoable as ever; the board's setup
as the track started is kept so the finish can put it back.

1. **Rename a Column** (`rename-column`): done when a column that was there at the start has a new name. Hints: the
   column cog, then a ring round it.
2. **Set a WIP Limit** (`set-wip`): done when a column's WIP limit changes. Hint: a ring round the column settings'
   WIP Limit.
3. **Add a Widget** (`add-widget`): done when the header shows a widget it did not at the start. Hint: a ring round
   the header's **Add a widget**.
4. **The finish** (`outro`): "Set up your way." with **Keep Changes** and **Put It Back** (the board's setup as it
   was, one undoable change).

Adding a column is left out: a new column makes a status, which putting the board back would not take away.

## Ending early

- If the tour can no longer run where it started (the person's edit rights go, they leave Plan, they open another
  tab, or the tour subject is deleted) it ends as skipped, taking away anything practice.
- **End** and closing the practice dialog end it as skipped; the finish's choices end it as completed. Ending Card
  Types or Board Setup early keeps their changes (each is undoable); only their practice card goes.

## Share roles

Only someone who may edit the tab sees the button for it: an **Editor**. A **Participant** and a **Viewer** never
do (the editor is read-only for them), since what it shows (adding cards, card types, a Sheet's toolbar and
settings) is an Editor's to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The editor tours' funnel, with its own tokens, so the tours chart apart:

- **Offer**: `UI` · `Opened` · `PlanTourOffer` the first time the Start Tour button shows the Boards or Sheets track
  in a page load; `UI` · `Opened` · `DashboardTourOffer` for the Dashboards track.
- **Start panel**: `UI` · `Opened` · `PlanTourStart` on a press of the button (or a Settings rerun) on a board or
  Sheet; `UI` · `Opened` · `DashboardTourStart` on a dashboard.
- **Start**: `UI` · `Started` · `PlanTour` when Using a Board or Five Small Wins is picked; `PlanTourCardTypes` and
  `PlanTourBoardSetup` for the other board tracks; `UI` · `Started` · `DashboardTour` for Layout View, from Show the
  Grid or Show Me.
- **Missions**: `UI` · `View` · `PlanTourStep<Id>` once each time a Boards or Sheets mission shows
  (`PlanTourStepAddCard`, `PlanTourStepMoveCard`, `PlanTourStepOpenCard`, `PlanTourStepDueDate`,
  `PlanTourStepShipCard`; `PlanTourStepMakeType`, `PlanTourStepEditType`, `PlanTourStepUseType`;
  `PlanTourStepRenameColumn`, `PlanTourStepSetWip`, `PlanTourStepAddWidget`;
  `PlanTourStepTypeValue`, `PlanTourStepSum`, `PlanTourStepFillDown`, `PlanTourStepCurrency`, `PlanTourStepChart`;
  `PlanTourStepOutro` for either finish).
- **End**: `UI` · `Ended` · `PlanTourCompleted` | `PlanTourSkipped`; `DashboardTourCompleted` |
  `DashboardTourSkipped` for Layout View.
- **Kept**: `UI` · `Selected` · `PlanTourKeepCards` and `PlanTourKeepSheet` when the finish keeps the practice work;
  `PlanTourPutBack` when Card Types or Board Setup finishes with Put It Back.
- **Settings rows**: `UI` · `Toggled` · `BoardsTourSeenOn` | `BoardsTourSeenOff`, `CardTypesTourSeenOn` |
  `CardTypesTourSeenOff`, `BoardSetupTourSeenOn` | `BoardSetupTourSeenOff` and `SheetsTourSeenOn` |
  `SheetsTourSeenOff`, describing the preference as the Diagram tour's row does.
- The practice cards and the practice sheet send no `Element`, `Plan` or `Sheet` events; the Dashboards track's
  changes are the person's own and are counted as ever.
- Retired with the step-card tours (November 2026): `PlanTourStepBoard`, `PlanTourStepAddCards`,
  `PlanTourStepCardPanel`, `PlanTourStepBoardHeader`, `PlanTourStepCardTypes`, `PlanTourStepSheet`,
  `PlanTourStepCells`, `PlanTourStepFormulas`, `PlanTourStepSheetToolbar`, `PlanTourStepSheetSettings`.

## Power user mode (retired)

The retired [Power user mode](../007-editor/power-user-mode.md) marked the Plan tour seen. It stays seen for someone
who had it on: `upgradeLegacyPreferences` (`packages/api-schema/src/legacy-preferences.ts`) adds every track to
`planTourTracks` when it drops the mode's keys.
