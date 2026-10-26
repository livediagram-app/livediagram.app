# Editor tours

The editor's guided tours share one engine: a sequence of anchored popover steps that spotlight one piece of the
interface at a time, opening the real panels and menus as they go. The tours on it are the
[Plan tour](../026-plan/plan-tour.md) (its Boards, Sheets and Dashboards tracks), the Forms tour, the card
type editor's Show Me ([Show me](show-me.md)) and the [element tours](element-tours.md). Each tour's switch is in
Settings' **Tours** category.

## Where it appears

The same way in as livediagram's ([Editor tour](../../../../livediagram/docs/specs/007-editor/editor-tour.md) "Where
it appears"), with liveplanner's tours on it:

- **The footer's Start Tour button is the one way in.** Every tour on offer is started from one button in the
  editor's bottom bar, immediately left of Settings: a contained chip with a play glyph in a small accent disc,
  reading **Start Boards Tour**, **Start Sheets Tour**, **Start Forms Tour** or **Start Dashboards Tour**
  (`TourOfferButton`, `@liveworkspace/workbench/components/tour`). On a phone, and wherever its neighbours drop
  their words, it shows the glyph alone and keeps its full name as its accessible name. With no tour on offer it is
  not drawn. A tour never starts, prompts or offers itself on its own: no banner, no card.
- **Which tour it offers.** Each tour's host publishes its tour while the person could take it (`useOfferTour`,
  `tour-offer.ts`), and the button offers the most specific one (`TOUR_OFFER_RANK`): a surface on the tab first
  (the Dashboards tour, while a dashboard is open), then the tab's own (the Plan tour on a board or Sheet, the
  Forms tour on a Form tab). Between two of the same rank, the one published last wins.
- **On offer whenever it could run**: to an Editor, once the editor is ready (hydrated, no welcome overlay), not
  read-only, not an embed. Each tour's spec says what else it needs.
- **It stays on offer once taken.** Finishing or skipping a tour does not take the button away: pressing it again
  is how the tour is taken again. What a run records (`planTourTracks`, `formTourSeen`,
  [User preferences](user-preferences.md)) only feeds Settings' **Tours** rows.
- **A press starts the first step.** There is no welcome card: the button already said what it starts. A press
  while another tour is on screen does nothing (one tour at a time). A run ends completed or skipped; there is no
  declining any more.
- **The last card is a step card**, drawn in the same popover as the steps (`TourPopover`), with the help link and
  the finish button. It takes no focus, so the person carries on where they were.
- **Settings reruns** (the **Tours** rows) and the form cog's **Show Me Around** start the tour if it is on offer
  right now; otherwise the button is there once it is.

## No welcome tour

No tour is offered on a brand-new user's first project: there is no Diagram tour and no `/new` handoff flag owing
one. A stored `tourSeen` preference is never read. A new user meets the Plan tour, on the footer's Start Tour button
once a board or Sheet is on the tab.

## Steps open what they explain

A step that points at a control that opens something (a menu, a popover, a panel) opens it, highlights what
opened, and closes it again as the step ends, however it ends: the person sees the real thing rather than being
told where it is. A step left while what it opens is still opening closes it as it arrives. Shared by every tour
(`tour-open.ts` for a button that opens a popover; element tours' menu steps open the element's menu to the path
their copy names, [Element tours](element-tours.md#menu-steps)).

## The spotlight

The screen dims around the step's target, which stays clear; no outline is drawn round it. The dim is one
full-screen layer with a rounded hole cut out of it (`TourSpotlight`).

## The page waits

While a step is up, element tours take no clicks or wheel on the page, only on the step card:
a press on what a step opened (a palette category's shape) closed it and the step reopened it, flickering the page.
A shield under the card stops presses on the window in the capture phase, ahead of every project listener, and
shows the not-allowed cursor. The keyboard still reaches the card. The other tours leave the page usable, as some
of their steps ask the person to try things.

## Motion

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
  Skip) and what it draws (`TourStage`: `TourSpotlight`, `TourPopover`) are shared by the
  [Plan tour](../026-plan/plan-tour.md), the Forms tour, the card type editor's Show Me and the
  [element tours](element-tours.md); each tour's host owns its offer, its steps and what ending means. A step anchors by `data-tour-id`, or by a
  `selector` resolved when it runs (the Plan tour's board and cards), and an anchorless card's `prepare` runs
  too. The last card's words (`TourCardCopy`) are a prop. The engine, the stage, the card, the spotlight, the
  shield, the tour colours and the Start Tour button live once in `@liveworkspace/workbench/components/tour`; the
  editor keeps only its steps and hosts.
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
  net; a tour filters its step list up front (by viewport and what the tab holds) so the "N of M" count stays
  honest instead of a hidden step burning its timeout mid-tour.
- **What counts as a dialog** is one signal, the modal guard (`../packages/workbench/src/lib/modal-guard.ts`): a count of open modal
  dialogs, fed by the editor's `Dialog` (so every dialog built on it counts with no extra work) and by the
  full-screen modals that do not use it calling `useModalGuard` themselves (the Search panel, the canvas theme
  dialog, the identity prompt, the new project wizard, the sign-in reasons and delete account
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
- This holds for every tour and the card type editor's Show Me, which all draw through `TourStage` and
  `TourPopover`.

## Share roles

Only someone who may edit the tab sees the Start Tour button (an **Editor**). A **Participant** or a **Viewer**
never sees it (the editor is read-only for the tours' purposes: `isReadOnly`).

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Each tour's funnel is its own (its spec says which). The generic tour tokens (`UI`·`Opened`/`Closed`·`TourOffer`,
`UI`·`Started`·`Tour`, `UI`·`View`·`TourStep<Id>`, `UI`·`Ended`·`TourCompleted`/`TourSkipped`,
`UI`·`Toggled`·`TourSeenOn`/`TourSeenOff`) are not sent; they are listed in liveworkspace's `../liveworkspace/apps/site/app/telemetry/liveplanner/retired-events.ts` ([liveworkspace/docs/telemetry.md](../../../../liveworkspace/docs/telemetry.md)).
