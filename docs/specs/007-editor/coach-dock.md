# Coach dock

The surface a guided tour speaks through when it must never cover the work it teaches. It is part of the editor's
bottom chrome: a strip that stands on the tab bar, with the canvas giving up the room it takes. The tour offers
itself in the dock, runs its steps in the dock, and ends in the dock; over the canvas it draws only a ring around
the real control, with the step's number on its corner.

The [Pages tour](pages-tour.md) and a page's [Show Me](show-me.md) speak through it. Every other tour keeps its
banner and anchored card ([Diagram tour](editor-tour.md)) until it moves over.

## Domain language

| Term             | Means                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Coach dock**   | The strip itself, between the canvas and the tab bar                                                    |
| **Offer**        | The dock asking whether to take the tour: Take the Tour or No Thanks                                    |
| **Folded offer** | An offer left alone, folded into the **tour chip** in the tab bar                                       |
| **Tour chip**    | The tab bar's small "Slides Tour" pill with its own dismiss, standing for a folded offer                |
| **Pointer**      | The ring around a step's control, with the step's number on a badge at its corner                       |
| **Try it**       | A step's one thing to do on the page ("Pick any layout"); doing it ticks the step and moves the tour on |
| **Closing**      | The dock's last state: the tour is done, with its help link and Start                                   |

## Where it sits

- **Between the canvas and the tab bar**, the full width of the editor's column. The canvas is shorter by the
  dock's height while it shows, so nothing on the canvas, its floating toolbars or its bottom-right cluster is
  under it; they move up with the canvas edge.
- **Everything that stands on the tab bar stands on the dock** while it shows: toasts, the sign-in banner's place
  (it steps aside while a tour is up, as it does for the banner), panels docked to the bottom, and, on a phone,
  the bottom sheets the page's own controls open (Layout, Background). A sheet rises from the dock's top edge, so
  the tour's words and buttons stay in reach under it.
- **Zen mode**, which has no tab bar, keeps the dock at the bottom of the column.
- **It never moves** between steps. Only its words change; the pointer travels.

## What it shows

### The offer

- The tour's picture (desktop only), its eyebrow ("Slides tour"), a question ("New to slides?") and one line of
  what it covers, with its length: "4 stops, about a minute".
- **Take the Tour** (primary) starts it. **No Thanks** declines it for good, as the old No did.
- **Left alone, it folds.** After 12 seconds with no pointer over it and no focus in it, the offer folds into the
  tour chip in the tab bar. The chip's **▶ Slides Tour** starts the tour at its first step; its **×** declines
  it for good. A folded offer is not an answer: the chip stays for this visit, and the offer comes back on the
  next visit until it is answered.

### A step

- The eyebrow names the tour and the step ("Slides tour · 2 of 4") over a segmented progress bar, then the step's
  title and one or two sentences.
- **Try it**, when the step has one: an empty circle and the thing to do. Doing it on the page (pressing a layout,
  a background, the +) ticks the circle, reads **Done**, and moves to the next step 900 ms later, so the person
  sees what they picked land first. Next still works for someone who only wants to look.
- **End Tour** (quiet), **Back** (from the second step), **Next** (primary; the last step's reads **Finish**).
- A step with nothing to point at (the article's "Write on the Page") shows no pointer.

### The closing

- The picture, "Slides tour · Complete", the track's closing title and line, the track's help link and **Start**.
- Left alone, it folds away after 12 seconds as a completed tour; there is nothing left to answer.

## The pointer

- A 2 px ring in the app's brand blue with a soft halo, 6 px clear of the control, gliding between steps. **No
  dim**: the page around the control stays as bright as it was.
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
- Desktop: one row of one height (116 px) in every state, so the canvas resizes only as the dock comes and goes,
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

The dock shows only the tours that speak through it, which decide their own roles: the Pages tour and a page's
Show Me are for an **Editor** only. A **Participant** or **Viewer** never sees the dock.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The tour's own funnel is unchanged ([Pages tour](pages-tour.md#telemetry)). The dock adds:

- `UI` · `Closed` · `PagesTourOfferFolded` when an offer folds into the chip.
- `UI` · `Opened` · `PagesTourChip` when the chip starts the tour (the tour's own `Started` follows).

## Performance

- The dock changes the canvas's height twice per tour (shown, gone), never per frame: it does not animate its
  height, only its contents' opacity and position.
- The pointer re-measures on the engine's existing 150 ms tracking tick: one ring and one badge.
- Try it listens for one capture-phase press on the document while a step with one is up, and matches the press
  against one selector.

## Code

- `apps/live/components/tour/coach-dock/`: the dock, the chip, the pointer (ring and badge), the fold timer and
  Try it.
- `CoachDockSlot` in `EditorView` (between the canvas and the footer) and `CoachChipSlot` in `TabBar` (before
  Search) are where they draw.
