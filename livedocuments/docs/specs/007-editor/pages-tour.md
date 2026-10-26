# Pages tour

A short, optional guided tour of one [page kind](pages-mode.md#page-kinds): a slide, an infographic or an
article. Like every tour it is started from the footer's **Start Pages Tour** button and never offers itself; [Show Me](show-me.md)
runs the same track from a page's panel, and the [element tours](element-tours.md) share the button. Each kind has its own **track**, which shows how that kind of page is made by
opening the real controls on the person's own page (a slide's Layout and Background popovers, its deck button,
the Slide Deck and Present) rather than only pointing at them: anchored step cards, a glide, a
dimming spotlight, Skip, Back and a closing card, driven by the tour engine every tour shares ("How a tour runs").

## Domain language

| Term                   | Means                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Pages tour**         | This tour, whichever track it runs                                                       |
| **Track**              | One page kind's steps: the **Slides**, **Infographic** or **Article** track              |
| **Tour page**          | The page a track runs on: the person's own page of that kind, fixed when the tour starts |
| **Page Show Me**       | The same track run on demand from a page's panel ([Show Me](show-me.md))                 |
| **Start Making Pages** | An empty tab's template start, [Template start](start-diagramming.md)                    |

## Where it appears

The footer's Start Tour button is the one way in, for this tour as for every other; the Diagram tour spec (`007-editor/editor-tour.md`) "Where it appears" in livediagram describes the button, which tour it offers when several could run,
and the closing card. This tour's part:

- **On the button as "Start Pages Tour"**, whatever the page kind, while the open tab is in Pages, to an Editor,
  once the editor is usable (hydrated, no welcome overlay, not read-only, not an embed), the tab is not locked and at
  least one of its pages has its kind chosen. The selected element's own tour ([Element tours](element-tours.md))
  takes the button while that element is selected. A tour never starts, prompts or offers itself: until 25 October
  2026 each kind offered itself once ("Getting started with ...?", No / Yes) after a short delay.
- **Not over Start Making Pages**, nor over the first page's own kind choice ("What Is This Page For?"): the button
  waits until a template is picked or the panel closed ([Template start](start-diagramming.md) "The tour
  waits"), or the page's kind is chosen.
- **A press starts the first step** of the tour page's track; there is no welcome card. A press while another tour
  is on screen does nothing ("One tour at a time").
- **The tour page** is picked at the press: of the pages on screen, unlocked and showing their title bar, the one
  showing the most of itself in the window, a page of a kind not yet taken first; its kind picks the track. With
  no such page on screen a press does nothing.
- **It stays on offer once taken.** Finishing or skipping a track does not take the button away: pressing it again
  runs it again.
- **Taken, on every device.** However a run ends (completed or skipped), the synced `pagesTourKinds` user
  preference ([User preferences](user-preferences.md)) records its kind. The record feeds the Settings rows and
  which page a press prefers; it never hides the button. `pagesTourSeen` true counts every kind as taken only
  while [Power user mode](power-user-mode.md) is on (`apps/editor/lib/tour-tracks.ts`, shared with the [element
  tours](element-tours.md)).
- **Rerun from Settings**: in Settings' **Tours** category, **Pages Tours** switches every kind at once (on
  while any is untaken; off marks them all taken, on forgets every record), and one switch per kind sits nested beneath
  it, named for its kind (**Slides Tour**, **Infographic Tour**, **Article Tour**). On means that kind has not been taken. Turning one off marks that kind alone;
  turning one on forgets that kind alone (and folds a Power user's single `pagesTourSeen` into the taken list
  first, so the other kinds stay as they were). Closing Settings with a kind newly on starts the tour when it is on
  offer right now; otherwise it does nothing, and the button is there when the person is in Pages. Power user
  mode's readout lists **Pages Tours**.
- **Replayable from the page**: every page's panel carries **Show Me**, which runs that page's track on demand
  ([Show Me](show-me.md)).

## Tour content

The tour opens popovers, the page's panel and the Slide Deck, and closes them again on leaving the step. Its
controls stay live: a layout or background the person picks while its step is up is theirs, kept as any pick is (one
edit, undoable). The tour places nothing of its own.

## The steps

The track's steps, then its closing card, a step card in the same popover (`TourPopover`) that sits outside the
step count. Each
step rings one control of the tour page (or the Slide Deck), held by its own page rather than the first page's,
never the whole page: a ring that size would light most of the screen, so a step about the page itself is a card
on its own (centred, counted, no ring), and a popover step rings its title-bar button until the popover shows.

Each track's cards name its page kind, never the mode: eyebrow **Slides tour**, **Infographic tour** or **Article tour**.
The exact strings live in `apps/editor/components/tour/<kind>-tour-steps.ts`.

**A step that opens a popover** (Layout, Background, the Slide Deck) opens it once on entering, by pressing its
real button, and rings it. The popover stays open while the person presses the tour's card. Picking from it closes
it as it always does: the ring then moves to the tour page, so the person sees what they picked land; the step
never reopens it. Leaving the step closes whatever it opened that is still open.

**A step that opens the page's panel** opens it on the tab it is about (Page, Style or Text) and closes it on leaving.

### Slides track

1. **Choose a Layout** (the slide's Layout popover, opened): hover a layout to preview it, press to place it;
   Change Theme restyles every page.
2. **Change the Background** (the Background popover, opened): colours, gradients, animated backgrounds and
   pictures, a pattern on top; hover to preview, press to keep it.
3. **Add Another Slide** (the + after the last page, or the Toolbar strip's + while that one is out of the window).
4. **Your Slide Deck** (the Slide Deck, opened from the Slides button, ringing its rows): every slide page is in the
   deck already; drag a row to reorder, press one to go to that slide.
5. **Each Slide's Menu** (a row's ⋯ menu, opened): speaker notes, hide from the show, rename, duplicate.
6. **Set Up the Show** (the deck's Presentation settings, opened): transitions and their speed, auto-advance, slide
   size.
7. **Present** (the deck's Present button): full screen, arrow keys to move, Escape to end.
8. **You're ready to present** (closing card).

The deck stays open from step 4 to step 7 and closes after them, however the tour leaves them
(`holdSlideDeck` / `releaseSlideDeck`).

### Infographic track

1. **Your Page** (the page's name): press it to fit the page to the screen, drag it to reorder.
2. **Start From a Layout** (the Layout popover, opened).
3. **Change the Background** (the Background popover, opened).
4. **Page Size** (the page's panel, opened on Page): size and orientation; duplicate, move or delete below.
5. **Add a Page** (the +).
6. **Present It** (the Slide Deck, opened): any page can be a slide, picked in the deck and presented.
7. **You're ready to make pages** (closing card).

### Article track

1. **Write on the Page** (a centred card, no ring): click to write, `/` for blocks; full pages flow onto the next.
2. **The Page Toolbar** (the article's page toolbar, held up on the tour page through the step: it otherwise shows
   only while a page is hovered or written on).
3. **Article Style** (the Style popover beside the cog, opened by its button, [Article pages](article-pages.md) "Article style"): looks, accent, margins, page numbers, for every page of
   the article.
4. **Fonts and Spacing** (the Text popover beside it).
5. **You're ready to write** (closing card).

### Filtering

- A step whose control is not on screen when the tour starts (a slide's deck button and the Slides button on a
  phone; the + when neither the one after the last page nor the Toolbar strip's is in the window) is left out up front, so the count stays honest; one that goes before its
  turn is skipped ("Mechanics").
- If the tour can no longer run where it started (the person's edit rights go, they open another tab, or the tour page is deleted or locked) it ends as skipped, closing whatever it opened.

## How a tour runs

Every tour (this one, [Show Me](show-me.md) and the [element tours](element-tours.md)) runs on one engine.

### Mechanics

- **One engine.** The step runner (`useTourEngine`: prepare, await, heal, glide, Back / Next / Skip) and what it
  draws (`TourStage`: `TourSpotlight`, `TourPopover`, `TourShield`) live once, with the Start Tour button and the tour colours, in `@liveworkspace/workbench/components/tour`; each tour's host owns when it is on offer, its steps and what
  ending means. A step anchors by `data-tour-id`, or by a `selector` resolved when it runs, and an anchorless card's
  `prepare` runs too.
- The engine drives the **real UI**, not screenshots: a step's `prepare` opens the actual panel, popover or menu
  (pressing the same trigger a person would), then anchors the card to the resulting DOM node.
- Targets are awaited (poll with timeout) because several menus are lazy-loaded chunks. A step whose target never
  appears is skipped rather than wedging the tour, the way the person was going: going Back, past it to the step
  before; otherwise forward. If an open menu is dismissed mid-step, the step
  re-prepares itself; a target that still does not come back lets go of its spotlight, and the card waits centred.
- **A target is brought into view before the step lands**: centred in each scrolling ancestor that does not wholly
  show it (`revealInScrollers`, `tour-reveal.ts`), smoothly unless motion is reduced. Only real scroll containers
  move, never the canvas. It runs as a step's target lands, never while the step is up, so the person can scroll
  away.
- **A target has to render to count.** An anchor with no client rects is treated as absent; the step list itself
  is filtered up front so the "N of M" count stays honest.
- **Steps open what they explain** (`tour-open.ts` for a button that opens a popover) and close it again as the
  step ends, however it ends. Finishing or skipping restores a quiet editor.

### Dialogs come first

A tour never lands over a dialog the person has open (Share, Settings, Export, the Search panel, a confirm, any
dialog at all). What counts as a dialog is one signal, the modal guard (`../packages/workbench/src/lib/modal-guard.ts`), which the tours
read through `useOpenModalCount`.

- **A running tour steps aside.** When a dialog opens over a running tour the card and the spotlight hide, and the
  step's live tracking pauses. When the dialog closes the tour comes back on the same step. Stepping aside is not
  an answer: the tour neither ends nor counts a new step view.
- **A tour's own dialogs are not in its way.** A dialog a step opens to show what is in it (a Sankey's Flows, a
  chart's data) is the tour's, and so is the dialog a Show Me started from (the Share dialog). Only a dialog
  opened on top of those makes it step aside.

### The page waits

While a step of an element tour is up, the page takes no clicks or wheel, only the step card: a shield under the
card stops presses on the window in the capture phase and shows the not-allowed cursor. The keyboard still reaches
the card. The Pages tour and Show Me leave the page usable, as their steps ask the person to try things.

### Look and motion

- **The spotlight**: the screen dims around the step's target, one full-screen layer with a rounded hole cut out
  of it (`TourSpotlight`); no outline.
- **Every tour wears the active tab's colours**, as the start panel does (`useStartPalette`; `tour-colours.ts`
  reads it into CSS variables). The primary buttons' label is white or near-black, whichever contrasts more with
  the accent. The closing card is a step card like the others.
- **Arrival**: the dim fades in (250 ms) and the card settles in with it. **Hand-over**: on Next the spotlight and
  the card stay put while the next step prepares, then glide to it together once (250 ms, ease-in-out) and the
  card's words cross-fade. Between glides the hole follows its target exactly. One spotlight and one card for the
  whole run. Reduced motion keeps the fades only.

## Share roles

Only someone who may edit the tab sees Start Pages Tour, or Show Me: an **Editor**. A **Participant** or a
**Viewer** never does, since the page controls it opens are not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The tour's funnel; the track shows in the step tokens:

- **Offer**: `UI` · `Opened` · `PagesTourOffer` the first time the Start Tour button shows this tour in a page load.
- **Start**: `UI` · `Started` · `PagesTour` on a press of the button (or the Settings rerun).
- **Stage views**: `UI` · `View` · `PagesTourStep<Kind><Id>` once per step entry, `<Kind>` the track
  (`Slide`, `Infographic`, `Article`): `PagesTourStepSlideLayouts`,
  `PagesTourStepInfographicPageSize`, `PagesTourStepArticleStyle`, ...
- **End**: `UI` · `Ended` · `PagesTourCompleted` | `PagesTourSkipped`.
- **Settings rows**: `UI` · `Toggled` · `<Kind>TourSeenOn` | `<Kind>TourSeenOff`, for `SlidesTour`,
  `InfographicTour` and `ArticleTour`.
- **Page Show Me**: `UI` · `Started` · `<Kind>Tour`, and `UI` · `Ended` · `<Kind>TourCompleted` |
  `<Kind>TourSkipped`, for `SlideTour`, `InfographicTour` and `ArticleTour` ([Show Me](show-me.md)).

## Power user mode

[Power user mode](power-user-mode.md) marks the Pages tour seen (`pagesTourSeen`, every kind while the mode
is on) and every element tour (`elementToursSeen`).

## Code

- `<kind>-tour-steps.ts` (`slide-`, `infographic-`, `article-`): each track's steps, against one
  `PageTourApi` (`page-tour-api.ts`); `page-tour-dom.ts` opens and closes a page's title-bar popovers and finds
  its controls; `page-tour-steps.ts` picks a track's steps for a kind, loaded at the press so the
  copy stays out of the editor's first load.
- `PagesTourHost.tsx`: when the tour is on the Start Tour button, the tour page and the seen record. `PageTour.tsx`: the page panel's Show Me.
- `apps/editor/lib/page-panel-request.ts`: how a tour opens or closes a page's panel on a tab from outside `CanvasPages`.
