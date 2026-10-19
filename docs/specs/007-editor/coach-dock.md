# Coach dock

The one surface every guided tour speaks through, so no tour ever covers the work it teaches. It is part of the
editor's bottom chrome: a strip that stands on the tab bar, with the canvas giving up the room it takes. A tour
offers itself in the dock, runs its steps in the dock, and ends in the dock; over the page it draws only a ring
around the real control, with the step's number on its corner.

## Every tour speaks through it

One look, one set of buttons, one set of words for every tour, so a person who has met one has met them all:

- the mode tours: the [Diagram tour](editor-tour.md), the [Plan tour](../026-plan/plan-tour.md), the
  [Workshop tour](../012-collaboration/workshop-tour.md), the [Draw tour](../023-draw-mode/draw-tour.md), the
  [Forms tour](../030-forms/forms.md#the-forms-tour) and the [Avatar tour](../008-canvas/avatar-tour.md);
- the [Pages tour](pages-tour.md);
- the [element tours](element-tours.md), once started from their offer beside the selection toolbar (that small
  offer stays where it is: it belongs to the selected element, and shows only while one is selected);
- every [Show Me](show-me.md): a page's, the card type editor's, the Share dialog's, the Dashboard's, the Sankey
  Flows dialog's, the Tab Style dialog's and Photo Review's.

There is no other tour surface: no banner, no floating step card and no dim.

## Domain language

| Term             | Means                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Coach dock**   | The strip itself, between the canvas and the tab bar (over a dialog's dim for a tour of a dialog)       |
| **Offer**        | The dock asking whether to take the tour: Take the Tour or No Thanks                                    |
| **Folded offer** | An offer left alone, folded into the **tour chip** in the tab bar                                       |
| **Tour chip**    | The tab bar's small "Slides Tour" pill ("Tour" on a phone) with its own dismiss, for a folded offer     |
| **Pointer**      | The ring around a step's control, with the step's number on a badge at its corner                       |
| **Try it**       | A step's one thing to do on the page ("Pick any layout"); doing it ticks the step and moves the tour on |
| **Closing**      | The dock's last state: the tour is done, with its help link and Start                                   |

## Where it sits

- **Between the canvas and the tab bar**, the full width of the editor's column. The canvas is shorter by the
  dock's height while it shows, so nothing on the canvas, its floating toolbars or its bottom-right cluster is
  under it; they move up with the canvas edge.
- **Everything that stands on the tab bar stands on the dock** while it shows: toasts, the sign-in banner's place
  (it steps aside while a tour is up), panels docked to the bottom, and, on a phone,
  the bottom sheets the page's own controls open (Layout, Background). A sheet rises from the dock's top edge, so
  the tour's words and buttons stay in reach under it.
- **Zen mode**, which has no tab bar, keeps the dock at the bottom of the column.
- **A tour of a dialog** (a Show Me started inside one, or an element tour's step inside the data dialog it opened)
  stands its dock at the bottom of the window, over the dialog's dim, where it can be pressed. The dialog stands on
  it: it centres in the room above the dock and caps its height there, a phone's dialog sheet rises from the dock's
  top edge, and the Tab Style panel anchored to its brush rises above the dock when the dock is the higher. The
  dock floor (`--coach-dock-floor` on the page) is what they all read.
- **It never moves** between steps. Only its words change; the pointer travels.

## What it shows

### The offer

- The tour's picture, large (256 × 88 px, desktop only), leading the offer at its left, its eyebrow ("Slides tour"), a question ("New to slides?", "New to
  diagrams?", "New to boards?") and one line of what it covers, as a statement, with its length: "4 stops, about a
  minute".
- **Take the Tour** (primary) starts it. **No Thanks** declines it for good. Every offered tour reads the same two.
- **An offer of choices** (the Plan tour on a tab with a board and a sheet: "New to boards and sheets?") shows one
  primary button per choice (**Boards**, **Spreadsheets**) in place of Take the Tour, with No Thanks beside them.
- **Left alone, it folds.** After 12 seconds with no mouse moving over it and no focus in it (a pointer merely
  resting where the dock appeared, or a touch, does not count), the offer folds into the
  tour chip in the tab bar, named for the tour ("Diagram Tour", "Boards Tour", "Slides Tour"). The chip's
  **▶** starts the tour at its first step (an offer of choices opens again instead, to be chosen from); its **×**
  declines it for good.
- **Only an answer is an answer.** Only **No Thanks** (in the dock, the chip's ×, or Escape from inside the dock)
  declines a tour, and only taking it (finished or ended part-way) uses it up. An offer that folds is not an answer:
  the chip stays for this visit. An offer withdrawn because the person moved on before answering (another tab, the
  mode left, the page it was about deleted, edit rights gone) is not an answer either: nothing is recorded. Either
  way the tour is offered again the next time its moment comes (the next visit, or coming back to its mode), and
  keeps coming back until the person takes it or says No Thanks.

### A step

- The eyebrow names the tour and the step ("Slides tour · 2 of 4") over a segmented progress bar, then the step's
  title and one or two sentences.
- **Try it**, when the step has one: an empty circle and the thing to do. Doing it on the page (pressing a layout,
  a background, the +) ticks the circle, reads **Done**, and moves to the next step 900 ms later, so the person
  sees what they picked land first. Next still works for someone who only wants to look.
- **End Tour** (quiet), **Back** (from the second step), **Next** (primary; the last step's reads **Finish**).
- A step with nothing to point at (the article's "Write on the Page") shows no pointer.

### The closing

- The picture, "Slides tour · Complete", the closing title ("You're ready to present", "You're ready to diagram";
  a Show Me's and an element tour's: "That Is a Card Type", "That Is a Funnel") and line, the tour's help link
  (its article, named: "Draw Help", "Card Types Help") and **Start** (a Show Me's and an element tour's read
  **Done**).
- Left alone, it folds away after 12 seconds as a completed tour; there is nothing left to answer.

## The pointer

- A 2 px ring in the app's brand blue with a soft halo, 6 px clear of the control (14 px for a tour of a dialog,
  whose rows are packed tight), gliding between steps. **No dim**: the page around the control stays as bright as
  it was. A ring around a control inside a dialog stands just above the dialog, and just below a menu its controls
  open, which stays lit.
- **The step badge**: a 20 px brand-blue circle on the ring's top-left corner carrying the step's number, the same
  number the dock reads ("1 of 4"), so the ring and the dock read as one. It stays inside the window.
- No line joins them: a line from the dock would cross the page and the controls between, the very things the dock
  keeps clear of.
- Neither takes a press.

## Teach what is on screen

A step points at the control the page is already showing for its job rather than opening a second one. On a blank
slide or infographic page, the **Choose a Layout** step rings the page's own **Start From a Layout** card and opens
nothing; the Layout popover opens only when that card is not there. Once a layout is picked from the card, the
card goes, the ring moves to the Layout button, and the popover is not opened behind the person's back.

## Look

- The app's own colours, never the tab's theme: white (slate 900 in dark) with a slate border along its top,
  slate text, the shared Button in its primary, secondary and ghost variants. Contrast is AA on every line in
  light and dark, whatever the canvas.
- Desktop: one row of one height (116 px) in every state, the offer's and the closing's picture filling that height, so the canvas resizes only as the dock comes and goes,
  with the words in a centred column up to 72rem wide and the buttons at its right.
- Phone (under 640 px): the words, then the buttons in a full-width row of equal buttons, 40 px tall, each with a
  44 px tap area. End Tour sits at the top right of the dock. No picture.

## Keyboard and assistive tech

- The dock never takes focus. It is a labelled region ("Slides tour"); a polite live region announces each step's
  number and title as it arrives.
- **Escape** from inside the dock declines the offer, ends a step, or finishes from the closing. Escape anywhere
  else is the page's own (closing a popover the step opened is not ending the tour).
- Its buttons are reached by Tab in the order shown.
- Reduced motion: no rise-in, no ring glide; changes are instant.

## Share roles

The dock adds no roles of its own: each tour decides who is offered it, and the dock shows only what a tour asks.
The mode tours, the Pages tour, the element tours and a page's Show Me are for an **Editor** only. A Show Me in a
dialog follows that dialog: the Share dialog's runs for whoever may open Share. A **Participant** or **Viewer**
otherwise never sees the dock.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Each tour's own funnel is unchanged. The dock adds two events per offered tour, named by the tour's own prefix
(the Diagram tour's is empty, as its `TourOffer` is):

- `UI` · `Closed` · `<Tour>OfferFolded` when an offer folds into the chip: `TourOfferFolded`,
  `PlanTourOfferFolded`, `WorkshopTourOfferFolded`, `DrawTourOfferFolded`, `FormTourOfferFolded`,
  `AvatarTourOfferFolded`, `PagesTourOfferFolded`.
- `UI` · `Opened` · `<Tour>Chip` when the chip starts the tour (the tour's own `Started` follows): `TourChip`,
  `PlanTourChip`, `WorkshopTourChip`, `DrawTourChip`, `FormTourChip`, `AvatarTourChip`, `PagesTourChip`.

Each is charted in its tour's funnel on the dashboard's Visitors tab. Show Me and the element tours have no offer
in the dock, so nothing folds.

## Performance

- The dock changes the canvas's height twice per tour (shown, gone), never per frame: it does not animate its
  height, only its contents' opacity and position.
- The pointer re-measures on the engine's existing 150 ms tracking tick: one ring and one badge.
- Try it listens for one capture-phase press on the document while a step with one is up, and matches the press
  against one selector.

## Code

- `apps/live/components/tour/coach-dock/`: the dock, the chip, the pointer (ring and badge), the fold timer and
  Try it. `CoachDockStage` is the one stage every tour host and `ShowMeStage` draw through.
- `CoachDockSlot` in `EditorView` (between the canvas and the footer) and `CoachChipSlot` in `TabBar` (before
  Search) are where they draw.
