# Diagram tour ("Getting started with Diagrams?")

A bootstrap-style guided tour of [Diagram mode](editor-modes.md): a sequence of anchored popover steps that
spotlight one piece of the diagramming chrome at a time, opening the real panels and menus as it goes. Until
October 2026 it was the **welcome tour**, offered whatever mode a tab was in; it is now about diagramming alone,
and the other modes have tours of their own (the [Plan tour](../026-plan/plan-tour.md) and the
[Facilitate tour](../012-collaboration/facilitate-tour.md)). It superseded the guided-tour **sample diagram**
([Guided tour sample ("Take the guided tour"), RETIRED](guided-tour-sample.md)), which taught through
annotation markers on the canvas; the sample's template, builder, and /new card were removed once this tour
proved the better introduction.

## Domain language

| Term             | Means                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **Diagram tour** | This tour. In the interface: **Diagram Tour**, and **Diagram** in Settings' Onboarding Tutorials |
| **welcome tour** | Its name until October 2026; kept only in code identifiers and telemetry tokens                  |
| **Diagram tab**  | A tab whose mode is Diagram, an event-storming board included (one is always in Diagram)         |

## Where it appears

- **Only in Diagram mode.** The tour is offered, and runs, only while the open tab is in Diagram mode. It is
  never offered on a Draw, Facilitate, Illustrate or Plan tab, nor on a Board, Sheet or Dashboard tab (always
  in Plan); an offer owed there waits until the person is on a Diagram tab. Leaving Diagram mid-tour
  (switching the tab's mode, or opening a tab in another mode) ends it as skipped, since its steps point at
  chrome the other modes do not show.
- **Automatically, for a brand-new user.** When a **zero-owned-documents** user (the `/new` page already learns
  the count from the Jump-back-in fetch; `null` = unknown = no offer) creates a document through the wizard
  (any path: Create or Skip), the tour is owed in that browser tab. A document that opens on a Diagram tab
  shows a centred **welcome offer card** once the editor is ready, and once its start is done (a template picked
  or Start Diagramming closed, [Template starts](start-diagramming.md) "The tours wait"): **Yes** starts the tour,
  **No** dismisses it. A document made from a Plan, Draw, Illustrate or Facilitate template does not show it
  there; the offer stays owed and comes the first time the person works on a Diagram tab in that browser tab.
  There is no wizard toggle; the offer IS the opt-in, and declining must be one obvious, equal-weight click.
- **Once ever per user.** However the offer ends (declined, skipped mid-tour, or completed), the synced
  `tourSeen` user preference ([User preferences](user-preferences.md)) stops it ever reappearing: the offer
  must never read as nagging, and answering it once covers every device the user signs in from (guests get
  the same via their owner-keyed preference row + the localStorage warm cache). The preference keeps the
  welcome tour's name, so an answer given to the welcome tour still holds for this one.
- **Replayable from Settings.** The Settings dialog's Accessibility category has a **Onboarding Tutorials** control whose
  **Diagram** switch surfaces `tourSeen` (inverted: on means not seen). Turning a previously-off switch on and
  closing Settings relaunches the tour from the top when the open tab is in Diagram, and otherwise offers it
  the next time the person is on a Diagram tab. The welcome card is always step 1, on a rerun too. Finishing
  the rerun turns it off again.
- **One tour at a time.** The [Plan tour](../026-plan/plan-tour.md), the
  [Facilitate tour](../012-collaboration/facilitate-tour.md), the [Draw tour](../023-draw-mode/draw-tour.md) and
  the [Illustrate tour](illustrate-tour.md) are this tour's siblings; while any is on screen the others wait.
  Each belongs to its own mode, so none is owed to another: the others never wait for this tour's offer, and
  this tour never carries theirs.

## Handoff

Create hard-navigates to `/document/<id>`, so the intent crosses pages via a **sessionStorage flag**
(`livediagram:v2:tour-pending`), set just before `window.location.assign`. The editor PEEKS at the flag and
clears it only when the offer is **resolved** (completed, skipped, or declined), never on mere page load, so
reloading mid-offer or mid-tour brings the offer back instead of silently swallowing an unanswered tour. The
flag is also what keeps the offer owed across a document that opened in another mode. sessionStorage keeps it
per-tab; a URL param would survive into copy-pasted links. The editor shows the offer only when it's actually
usable: hydrated, no welcome overlay, no start on screen, not read-only, not an embed, and the open tab in
Diagram. The Settings
relaunch crosses no navigation, so it's a window event (`livediagram:tour-relaunch`), which also re-marks the
flag, so a mid-rerun reload re-offers the same way.

## The steps

A welcome offer card, then six steps in palette → canvas → tabs → theme order (five on mobile, where the
theme-canvas step is skipped; four on an **event-storming board**, which hides the strip's pickers, and so drops
the two dropdown steps; three when it is both), and a closing "you're ready" card. The bookend cards sit outside the step count. Copy is one or two
short sentences per step about diagramming ("concise" is the spec constraint; the exact strings live in
`apps/live/components/tour/tour-steps.ts`):

0. **Getting started with Diagrams?** (the offer): centred card, eyebrow **Diagram tour**, "Want a quick tour of the
   editor so you can build mind blowing diagrams in minutes?", then **No** / **Yes**. Yes and No are every tour's
   offer buttons (`WELCOME_TOUR_COPY` in `TourPopover.tsx`).
1. **The Palette**: the strip across the top where every shape, arrow and icon comes from.
2. **Selection Modes**: opens the canvas-tool dropdown (Select / Hand / Eraser / ...) and explains mode
   switching. No "default" claim in the copy: desktop defaults to Select but mobile to Hand.
3. **Palette Categories**: opens the palette-category dropdown (Popular / Shapes / Tools / Components /
   Devices / Icons / Technology). A dedicated "Tools category" step existed briefly and was cut: the category
   dropdown already tells that story.
4. **The Element Menu**: selects an element (adding a theme-coloured square at the viewport centre first if the
   tab is empty) and opens its right-click menu programmatically. A square it added is the tour's own: placed
   with no history and taken away, with its selection, when the tour ends however it ends (`useTourSquare`), so
   a fresh document is left as it was and Undo never brings it back.
5. **Tabs**: highlights the active tab pill and the "+" add button as one region (an `alsoHighlight` union,
   like the dropdown steps): one document holds many diagrams, one per tab, with the tab menu covered in the
   copy. A separate open-the-⋯-menu step existed briefly and was folded in here.
6. **Theme & Canvas** (desktop only): highlights the paintbrush dock button
   ([Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)) that opens the tab's theme + canvas
   background dialog. No prepare needed: the button is always in the desktop chrome for an editable session.
   Mobile reaches the same dialog through the canvas menu, so the step is skipped there.
7. **Outro** (card): "You're ready to diagram": a help-article illustration, a help-centre link (new tab),
   and a "Start diagramming" button that completes the tour.

Retired steps: **Tab Mode** (opening the editor mode switch's menu, step 4 until October 2026) was cut to keep
the tour on diagramming; each mode now has a tour of its own, offered when the person enters it. **The Explorer** (the document browser behind the top-left menu button) was step 5 of the
welcome tour; it describes the whole app rather than diagramming, so the Diagram tour left it out. A **Search**
step (opening the Cmd/Ctrl+K panel) once followed Theme & Canvas until it was cut to keep the tour short; the
search panel has its own help article.

Each step popover shows the step count, a title, the copy, and Back / Next (Done on the last step) plus a Skip
control. A dimming highlight ring surrounds the current target; it never blocks pointer input, so the user can
poke at whatever is highlighted mid-tour. Phase changes are animated: the ring keeps the previous rect and
**glides** to the next target, the popover transitions its position, and the card content slides
directionally (the New Document wizard's tip-next / tip-prev motion). The dropdown steps highlight the
**union** of the trigger button and its portalled menu, so the ring wraps the whole control, not the floating
menu alone.

## Mechanics

- **One engine, three tours.** The step runner (`useTourEngine`: prepare, await, heal, glide, Back / Next /
  Skip) and what it draws (`TourStage`: the card backdrop, the ring, `TourPopover`) are shared with the
  [Plan tour](../026-plan/plan-tour.md) and the [Facilitate tour](../012-collaboration/facilitate-tour.md);
  each tour's host owns its offer, its steps and what ending means. A step anchors by `data-tour-id`, or by a
  `selector` resolved when it runs (the Plan tour's board and cards), and an anchorless card's `prepare` runs
  too. The bookend cards' words (`TourCardCopy`) and the welcome art are props, defaulting to this tour's.
- The engine drives the **real UI**, not screenshots: steps have a `prepare` phase that opens the actual panel
  / dropdown / menu (clicking the same triggers a user would, or calling editor-context handlers like
  `setContextMenu`), then anchors the popover to the resulting DOM node found via `data-tour-id` attributes
  (plus the existing `data-palette-dropdown-menu` / `data-element-id` hooks).
- Targets are awaited (poll with timeout) because several menus are lazy-loaded chunks. A step whose target
  never appears is skipped rather than wedging the tour, the way the person was going: going Back, past it to the
  step before (never onto the welcome card); otherwise forward. If an open menu is dismissed mid-step (outside
  click), the step re-prepares itself; a target that still does not come back lets go of its ring, and the card
  waits centred.
- **A target has to render to count.** Chrome a surface hides can stay in the DOM (`display:none`), so an
  anchor with no client rects is treated as absent: it is never clicked and never measured. That is the safety
  net; the step list itself is filtered up front (`tourStepsFor`, by viewport and tab kind) so the "N of M"
  count stays honest instead of a hidden step burning its timeout mid-tour.
- **The strip** ([Toolbar layout](toolbar-layout.md)): the Palette step anchors to the strip's card, not the
  full-width row it is centred in; the selection-mode and category steps use the strip's own pickers.
- Advancing closes whatever the previous step opened (dropdowns, context menu, popovers); finishing or skipping
  restores a quiet editor.

## Look

- **Every tour wears the active tab's colours**, as the start panels do: the card (welcome, step and outro) takes
  the tab's palette (`useStartPalette`, the start panels' hook; `tour-colours.ts` reads it into CSS variables).
  Card background, border, title, copy (muted) and the eyebrow, help link, progress dots and primary buttons
  (the tab's accent) all follow it, so a tour on a dark or coloured tab reads as part of that tab.
- **The primary buttons stay readable**: their label is white or near-black, whichever contrasts more with the
  accent.
- **The ring** around a step's target is drawn in the same accent; the dim around it is unchanged.
- This holds for the Diagram, Plan, Facilitate, Draw and Illustrate tours and the card type editor's Show Me,
  which all draw through `TourStage` and `TourPopover`.

## Share roles

Only someone who may edit the tab is offered the tour (an **Editor**): the element step selects an element and
may place the tour's own square. A **Participant** or a **Viewer** is never offered it (the editor is read-only
for the tour's purposes: `isReadOnly`).

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

The welcome tour's tokens, unchanged, so the funnel's history reads straight through the rename:

- **Offer**: `'UI'/'Opened'/'TourOffer'` when the welcome card shows (first run and Settings relaunch alike);
  `'UI'/'Closed'/'TourOffer'` on **No**.
- **Start**: `'UI'/'Started'/'Tour'` on accept.
- **Stage views**: `'UI'/'View'/'TourStep<Id>'` once per step entry (`TourStepPalette`,
  `TourStepSelectionModes`, `TourStepCategories`, `TourStepContextMenu`, `TourStepTabs`,
  `TourStepThemeCanvas`, `TourStepOutro`, derived from the fixed step ids, never content; a Back re-entry
  counts as a view). The last View before an `Ended/TourSkipped` marks the drop-off stage.
  `TourStepExplorer`, `TourStepSearch` and `TourStepEditorMode` are retired with their steps, and stay explained for the history.
- **End**: `'UI'/'Ended'/'TourCompleted' | 'TourSkipped'` (leaving Diagram mid-tour is a skip).
- **Settings row**: `'UI'/'Toggled'/'TourSeenOn' | 'TourSeenOff'`.
