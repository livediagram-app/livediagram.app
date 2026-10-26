# Diagram tour ("Start Diagram Tour")

A bootstrap-style guided tour of [Diagram mode](editor-modes.md): a sequence of anchored popover steps that
spotlight one piece of the diagramming chrome at a time, opening the real panels and menus as it goes. It is about diagramming alone;
the other modes have tours of their own (the [Draw tour](../023-draw-mode/draw-tour.md) and the
[Workshop tour](../012-collaboration/workshop-tour.md)).

## Domain language

| Term             | Means                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Diagram tour** | This tour. In the interface: **Diagram Tour**, and **Diagram Tour** in Settings' Tours category |
| **welcome tour** | A name kept only in code identifiers and telemetry tokens                                       |
| **Diagram tab**  | A tab whose mode is Diagram, an event-storming board included (one is always in Diagram)        |

## Where it appears

- **The footer's Start Tour button is the one way in.** Every tour (this one, the mode tours, the element tours,
  the avatar tour) is started from one button in the editor's bottom bar, immediately left of Settings:
  a contained chip with a play glyph in a small accent disc, reading **Start Diagram Tour** (`TourOfferButton`,
  `@liveworkspace/workbench/components/tour`). It is as tall as its neighbours and set in their type, its hover runs
  at `duration-micro`, it has a visible focus ring, and it has light and dark looks. On a phone (below `sm`), and
  wherever its neighbours drop their words, it shows the glyph alone and keeps **Start Diagram Tour** as its
  accessible name; it never widens the bar past the screen. A tour never starts, prompts or offers itself on its
  own: no banner, no card, no toolbar beside an element. Offer banners would be something people have to keep turning down.
- **Which tour it offers.** Each tour's host publishes its tour while the person could take it (`useOfferTour`,
  `tour-offer.ts`), and the button offers the most specific one (`TOUR_OFFER_RANK`): the selected element's own
  tour first, then a tool in hand or a surface on the tab (the Avatar tour), then the tab's
  mode (Diagram, Draw, Workshop). Between two of the same rank, the one published last wins. With
  no tour on offer the button is not drawn.
- **Only in Diagram mode.** This tour is on offer, and runs, only while the open tab is in Diagram mode, to an
  Editor, once the editor is ready: hydrated, no welcome overlay, no start on screen ([Template
  starts](start-diagramming.md) "The tours wait"), not read-only and not an embed. Leaving Diagram mid-tour
  (switching the tab's mode, or opening a tab in another mode) ends it as skipped, since its steps point at chrome
  the other modes do not show.
- **It stays on offer once taken.** Finishing or skipping the tour does not take the button away: pressing it again
  is how the tour is taken again.
- **A press starts the first step.** There is no welcome card: the button already said what it starts. A press
  while another tour is on screen does nothing ("One tour at a time").
- **The last card is a step card.** "You're ready to diagram" is drawn in the same popover as the steps
  (`TourPopover`), centred, with the help link and the finish button; every mode tour's finish button reads just
  **Start** (`TOUR_FINISH`), and its help link reads **Help** behind a help icon (an element tour's names its
  article, "Sankey Diagram Help", behind the same icon). It takes no focus, so the person carries on where they were.
- **How a step reads.** Every tour's words, the editor's, each mode's and each element's, are written to get someone
  going fast: what to do first, in one idea and about twenty words at most; the control named exactly as it is
  labelled; a menu path written as it is pressed ("Tools › Boundary", or "In its menu, Mind Map"); no inside terms
  ("accent", "steps toward the fill", "one undo step": say "Undo takes back any change"); no list of every option
  where the person can see them. A detail that changes what the
  person can do stays (a keyboard key, a right-click a phone lacks, how many there are).
- **Escape is each card's way out.** On a step it skips the tour (as **Skip tour**), on the last card it finishes
  (as its finish button). Every tour's cards are the same card
  (`TourPopover`), so this holds for all of them. It leaves the key alone while it is editing a field, where an
  element tour asks for Escape to put text back, and when another surface has already taken it.
- **Taken, on every device.** However a run ends (skipped mid-tour or completed), the synced `tourSeen` user
  preference ([User preferences](user-preferences.md)) records it, so Settings' **Diagram Tour** row reads off. It no
  longer hides the button: it is a record, kept for the Settings row. The preference keeps the welcome tour's name.
- **Rerun from Settings.** The Settings dialog's **Tours** category has a **Diagram Tour** switch that surfaces
  `tourSeen` (inverted: on means not seen). Turning a previously-off switch on and closing Settings starts the tour
  from the top when the open tab is in Diagram and the tour is on offer there; otherwise it does nothing, and the
  button is there when the person reaches a Diagram tab. Finishing the rerun turns it off again.
- **One tour at a time.** The
  [Workshop tour](../012-collaboration/workshop-tour.md) and the [Draw tour](../023-draw-mode/draw-tour.md)
  are this tour's siblings; while any is on screen the others do not start.
  Each belongs to its own mode, so the button offers the open tab's.
- **Dialogs come first.** A tour never lands over a dialog the person has open (Share, Settings, Export,
  the Search panel, a confirm, any dialog at all). This holds for every tour on the shared engine:
  - **A running tour steps aside.** When a dialog opens over a running tour (opened by the person, or by
    something else such as a sign-in prompt), the card and the spotlight hide, and the step's live
    tracking pauses, so nothing is reopened under the dialog. When the dialog closes the tour comes back on the
    same step, its target re-found (and re-prepared if the dialog closed what it had opened). Stepping aside is
    not an answer: the tour neither ends nor counts a new step view.
  - **A tour's own dialogs are not in its way.** A dialog a tour step opens to show what is in it (a Sequence's
    or a chart's data dialog, a Sankey's Flows) is the tour's: while the step's target sits inside it the tour
    stays up, and it stays up after that dialog's last step too, until the tour puts it away. A tour started
    from inside a dialog (Show Me in the Share dialog, Photo Review) counts that dialog as
    its own in the same way. Only a dialog opened on top of those makes it step aside.

## Handoff

None: with the button as the one way in there is nothing to hand over from `/new`, which does not wait for the
document count on create. The Settings rerun crosses no navigation, so it is a window
event (`livediagram:tour-relaunch`, `lib/diagram-tour.ts`).

## The steps

Six steps in palette → canvas → tabs → theme order (five on mobile, where the
theme-canvas step is skipped; four on an **event-storming board**, which hides the strip's pickers, and so drops
the two dropdown steps; three when it is both), and a closing "you're ready" card, which sits outside the step count. Copy is one or two
short sentences per step about diagramming ("concise" is the spec constraint; the exact strings live in
`apps/editor/components/tour/tour-steps.ts`). A step that names a hover, a click or a right-click carries its touch
words too (`touchBody`), which a touch screen (a coarse pointer) reads instead: a tap, a long-press:

1. **The Palette**: the strip across the top: "Add whatever you need to your canvas to start drawing after the
   tour."
2. **Selection Modes**: opens the canvas-tool dropdown (Select / Hand / Eraser / ...) and explains mode
   switching. No "default" claim in the copy: desktop defaults to Select but mobile to Hand.
3. **Palette Categories**: opens the first category on the palette's category bar (Shapes), its flyout highlighted
   with the bar ([Toolbar layout](toolbar-layout.md#the-category-bar)): "The palette's categories sit along the
   top: rest on one to see its elements, then click one to add it, or drag it onto the canvas." A dedicated "Tools category" step existed briefly and was cut: the category
   dropdown already tells that story. On touch: "Tap a category to see what is in it. Tap to add, or drag onto the
   canvas." (the flyout's own touch hint).
4. **The Element Menu**: selects an element (adding a theme-coloured square at the viewport centre first if the
   tab is empty) and opens its right-click menu programmatically. A square it added is the tour's own: placed
   with no history and taken away, with its selection, when the tour ends however it ends (`useTourSquare`), so
   a fresh document is left as it was and Undo never brings it back. On touch it reads "Long-press anything to style
   it, or add a note, link or comment."
5. **Tabs**: opens the active tab's ⋯ menu and highlights it with the tab pill (an `alsoHighlight` union): each
   tab holds its own work in its own mode; + adds one; the menu renames, duplicates, locks, exports or sets it
   side by side. The menu closes as the step ends.
6. **Theme & Canvas** (desktop only): opens Tab Style from the Style (painter's palette) dock button, which the step's copy names as **the Style button**
   ([Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)) and highlights the open panel with the
   button, over the dialog layer. It closes as the step ends, however it ends, including when the step is left
   while the panel is still opening. A phone's dock has the same button, but opens Tab Style as a modal sheet, and the
   tour stands aside while a modal is open, so the step would show the sheet with no card: it is skipped there.
7. **Outro** (card): "You're ready to diagram": a help-article illustration, a **Learn More** link to the help
   centre (new tab, no underline), and a **Start** button that completes the tour.

Left out: **Tab Mode** (the editor mode switch's menu), to keep the tour on diagramming, since each mode has a tour
of its own on the Start Tour button while the person is in it; and **The Explorer** (the document browser behind the
top-left menu button), which describes the whole app rather than diagramming. There is no **Search** step, to keep the tour
short; the search panel has its own help article.

Each step popover shows the step count, a title, the copy, and Back / Next plus a Skip control, with a row of
dots in which the current step's is drawn long. The right and left arrow keys are Next and Back, and Escape skips
(never while a field is being typed in, nor with a modifier held). The dropdown steps highlight the **union** of
the trigger button and its portalled menu.

### Steps open what they explain

A step that points at a control that opens something (a menu, a popover, a panel) opens it, highlights what
opened, and closes it again as the step ends, however it ends: the person sees the real thing rather than being
told where it is. A step left while what it opens is still opening closes it as it arrives. Shared by every tour
(`tour-open.ts` for a button that opens a popover; element tours' menu steps open the element's menu to the path
their copy names, [Element tours](element-tours.md#menu-steps)).

### The spotlight

The screen dims around the step's target, which stays clear; no outline is drawn round it. The dim is one
full-screen layer with a rounded hole cut out of it (`TourSpotlight`).

### The page waits

While a step is up, the Diagram tour and element tours take no clicks or wheel on the page, only on the step card:
a press on what a step opened (a palette category's shape) closed it and the step reopened it, flickering the page.
A shield under the card stops presses on the window in the capture phase, ahead of every document listener, and
shows the not-allowed cursor. The keyboard still reaches the card. The other tours leave the page usable, as some
of their steps ask the person to try things.

### Motion

- **Arrival.** Nothing is drawn while the first step prepares; then the dim fades in (`long`, 250 ms) and the step
  card settles in with it (dialog-in, `short`, 50 ms later), both inside the chrome ceiling. Reduced motion keeps
  the fades.
- **Hand-over.** On Next the spotlight and the card stay on the current target while the next step prepares (a
  menu opening, a panel scrolling) and the card's buttons wait. The next step lands once its target exists, its own
  entrance (CSS animations and transitions) has finished and its rect holds for three frames (at most 600 ms).
  Then the hole and the card glide to it together, once, over 250 ms (`long`, a tour move) ease-in-out, and the
  card's words cross-fade: a step's words never sit beside the previous step's target, and nothing chases a menu as
  it opens.
- **Following.** Between glides the hole follows its target exactly, with no easing to lag behind a scroll or a
  zoom. A glide is one frame-by-frame tween written straight to the hole, with no render during it.
- **One of each.** One spotlight and one card for the whole run, never remounted per step.

## Mechanics

- **One engine, every tour.** The step runner (`useTourEngine`: prepare, await, heal, glide, Back / Next /
  Skip) and what it draws (`TourStage`: `TourSpotlight`, `TourPopover`) are shared with the
  [Workshop tour](../012-collaboration/workshop-tour.md), the [Draw tour](../023-draw-mode/draw-tour.md), the
  avatar, element and Show Me tours;
  each tour's host owns its offer, its steps and what ending means. A step anchors by `data-tour-id`, or by a
  `selector` resolved when it runs (a Show Me step's Mashup tile), and an anchorless card's `prepare` runs
  too. The last card's words (`TourCardCopy`) are a prop, defaulting to this tour's. The engine, the stage, the
  card, the spotlight, the shield, the tour colours and the Start Tour button live once in
  `@liveworkspace/workbench/components/tour`; each editor keeps only its steps and hosts.
- The engine drives the **real UI**, not screenshots: steps have a `prepare` phase that opens the actual panel
  / dropdown / menu (clicking the same triggers a user would, or calling editor-context handlers like
  `setContextMenu`), then anchors the popover to the resulting DOM node found via `data-tour-id` attributes
  (plus the existing `data-palette-dropdown-menu` / `data-element-id` hooks).
- Targets are awaited (poll with timeout) because several menus are lazy-loaded chunks. A step whose target
  never appears is skipped rather than wedging the tour, the way the person was going: going Back, past it to the
  step before; otherwise forward. If an open menu is dismissed mid-step (outside
  click), the step re-prepares itself; a target that still does not come back lets go of its spotlight, and the card
  waits centred.
- **A target is brought into view before the step lands.** A target below the fold of a scrolling panel (a long
  form's add bar, a dialog's lower section) is centred in each scrolling ancestor that does not wholly show it
  (inside a 16 px margin), clear of chrome floating over a panel's edges (`revealInScrollers`, `tour-reveal.ts`),
  smoothly unless motion is reduced; a target already in view stays put, and a step may ask for its target at the
  panel's top instead (`revealAt: 'start'`). Only real scroll containers move (overflow `auto` or
  `scroll`): never the canvas, which clips and pans itself, and never a page whose overflow is hidden. It runs as a
  step's target lands and again when a heal brings it back, never while the step is up, so the person can scroll away.
- **A target has to render to count.** Chrome a surface hides can stay in the DOM (`display:none`), so an
  anchor with no client rects is treated as absent: it is never clicked and never measured. That is the safety
  net; the step list itself is filtered up front (`tourStepsFor`, by viewport and tab kind) so the "N of M"
  count stays honest instead of a hidden step burning its timeout mid-tour.
- **The strip** ([Toolbar layout](toolbar-layout.md)): the Palette step anchors to the strip's card, not the
  full-width row it is centred in; the selection-mode and category steps use the strip's own pickers.
- **What counts as a dialog** is one signal, the modal guard (`../packages/workbench/src/lib/modal-guard.ts`): a count of open modal
  dialogs, fed by the editor's `Dialog` (so every dialog built on it counts with no extra work) and by the
  full-screen modals that do not use it calling `useModalGuard` themselves (the Search panel, the canvas theme
  dialog, Photo Review, the identity prompt, the new document wizard, the sign-in reasons and delete account
  modals). The window-level shortcut and paste listeners read the same count. The tours subscribe to it
  (`useOpenModalCount`, a `useSyncExternalStore` hook), never query the DOM for it. The engine keeps a
  **baseline**: the dialogs open when the tour started, raised when a step's target is found inside a dialog (the
  tour's own), and lowered as dialogs close; the tour steps aside while more dialogs are open than its baseline,
  except while a step is still waiting for its target (a step opening its own dialog is not interrupted).
- Advancing closes whatever the previous step opened (dropdowns, context menu, popovers); finishing or skipping
  restores a quiet editor.

## Look

- **Every tour wears the active tab's colours**, as the start panels do: the card (step and last) takes
  the tab's palette (`useStartPalette`, the start panels' hook; `tour-colours.ts` reads it into CSS variables).
  Card background, border, title, copy (muted) and the eyebrow, help link, progress dots and primary buttons
  (the tab's accent) all follow it, so a tour on a dark or coloured tab reads as part of that tab.
- **The primary buttons stay readable**: their label is white or near-black, whichever contrasts more with the
  accent.
- **The spotlight** is the dim alone, with no outline in the accent; the step card wears the tab's colours.
- This holds for the Diagram, Workshop and Draw tours and Show Me,
  which all draw through `TourStage` and `TourPopover`.

## Share roles

Only someone who may edit the tab sees the button for it (an **Editor**): the element step selects an element and
may place the tour's own square. A **Participant** or a **Viewer** never sees it (the editor is read-only
for the tour's purposes: `isReadOnly`).

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

The welcome tour's tokens, unchanged, so the funnel's history reads straight through the rename:

- **Offer**: `'UI'/'Opened'/'TourOffer'` the first time the Start Tour button shows this tour in a page load.
  Until 25 October 2026 it counted the welcome card showing, and `'UI'/'Closed'/'TourOffer'` counted **No**;
  nothing sends Closed now, and its explanation stays for the history.
- **Start**: `'UI'/'Started'/'Tour'` on a press of the button (or the Settings rerun).
- **Stage views**: `'UI'/'View'/'TourStep<Id>'` once per step entry (`TourStepPalette`,
  `TourStepSelectionModes`, `TourStepCategories`, `TourStepContextMenu`, `TourStepTabs`,
  `TourStepThemeCanvas`, `TourStepOutro`, derived from the fixed step ids, never content; a Back re-entry
  counts as a view). The last View before an `Ended/TourSkipped` marks the drop-off stage.
  `TourStepExplorer`, `TourStepSearch` and `TourStepEditorMode` are retired with their steps, and stay explained for the history.
- **End**: `'UI'/'Ended'/'TourCompleted' | 'TourSkipped'` (leaving Diagram mid-tour is a skip).
- **Settings row**: `'UI'/'Toggled'/'TourSeenOn' | 'TourSeenOff'`.
