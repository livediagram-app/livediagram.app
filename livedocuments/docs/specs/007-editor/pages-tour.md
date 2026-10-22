# Pages tour

A short, optional guided tour of one [page kind](pages-mode.md#page-kinds): a slide, an infographic, an article
or a logo. It is livedocuments' only tour that offers itself; the others run on demand ([Show Me](show-me.md),
[Element tours](element-tours.md)). Each kind has its own **track**, which shows how that kind of page is made by
opening the real controls on the person's own page (a slide's Layout and Background popovers, its deck button,
the Slide Deck and Present) rather than only pointing at them: a welcome card, anchored step cards, a glide, a
dimming spotlight, Skip, Back and an outro card, driven by the tour engine every tour shares ("How a tour runs").

## Domain language

| Term                   | Means                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Pages tour**         | This tour, whichever track it runs                                                                 |
| **Track**              | One page kind's steps: the **Slides**, **Infographic**, **Article** or **Logo** track              |
| **Tour page**          | The page a track runs on: the person's own page of that kind, fixed when the tour starts           |
| **Page Show Me**       | The same track run on demand from a page's panel ([Show Me](show-me.md)), without the welcome card |
| **Start Making Pages** | An empty tab's template start, [Template start](start-diagramming.md)                              |

## Where it appears

- **The first time a person works on a page of a kind** on a tab they may edit: opening a tab with such a page
  on screen, or a page of a kind not yet toured arriving on the tab (added from the +,
  or the first page's kind chosen). The editor has to be usable (hydrated, no welcome overlay, not read-only, not
  an embed), and the tab not locked.
- **The tour page** is the page on screen of a kind not yet toured that shows the most of itself in the window;
  its kind picks the track. A page that is locked or too small on screen to show its title bar is passed over.
- **Not before the synced preferences are in**, so an answer given on another device holds on a new one.
- **Not over Start Making Pages**, nor over the first page's own kind choice ("What Is This Page For?"): the offer
  waits until a template is picked or the panel closed ([Template start](start-diagramming.md) "The tour
  waits"), or the page's kind is chosen.
- **On its own, never at the same time as another tour**, and never over an open dialog ("Dialogs come first").
- **Optional.** The offer is the opt-in: **Yes** starts it, **No** declines it.
- **Once ever per kind, per person**, through the synced `pagesTourKinds` user preference
  ([User preferences](user-preferences.md)): the kinds whose track has been taken, skipped mid-way or declined.
  Each never offers itself again, on any device; a page of another kind still offers its own.
  `pagesTourSeen` true counts every kind as toured only while [Power user mode](power-user-mode.md) is on: an
  answer given before the tour offered each kind once named no kind, so each kind is offered once more
  (`apps/live/lib/tour-tracks.ts`, shared with the [element tours](element-tours.md)).
- **Replayable from Settings**: in Settings' **Tours** category, **Pages Tours** switches every kind at once (on
  while any is owed; off answers them all, on forgets every answer), and one switch per kind sits nested beneath
  it, named for its kind (**Slides Tour**, **Infographic Tour**, **Article Tour**, **Logo Tour**). On means that kind
  is still owed. Turning one off answers that kind alone; turning one on forgets that kind alone (and folds a
  Power user's single `pagesTourSeen` into the answered list first, so the other kinds stay as they were).
  Closing Settings with a kind newly owed runs the track for the page on screen straight away, or offers it the
  next time such a page is on screen. Power user mode's readout lists **Pages Tours**.
- **Replayable from the page**: every page's panel carries **Show Me**, which runs that page's track on demand
  ([Show Me](show-me.md)), wherever the offer stands.

## Tour content

The tour opens popovers, the page's panel and the Slide Deck, and closes them again on leaving the step. Its
controls stay live: a layout or background the person picks while its step is up is theirs, kept as any pick is (one
edit, undoable). The tour places nothing of its own.

## The steps

A welcome card, then the track's steps, then its outro card; the bookend cards sit outside the step count. Each
step rings one control of the tour page (or the Slide Deck), held by its own page rather than the first page's,
never the whole page: a ring that size would light most of the screen, so a step about the page itself is a card
on its own (centred, counted, no ring), and a popover step rings its title-bar button until the popover shows.

The welcome card names its page kind, never the mode: eyebrow **Slides tour**, **Infographic tour**, **Article
tour** or **Logo tour**, over an illustration of that kind (`components/tour/art/pages-tour-art.tsx`): a
slide whose words and picture trade sides as layouts are picked beside it, with a Present button; an infographic
page whose band, headline, bars and ring chart fill in; an article page written line by line, its next page
behind; a logo's mark built on the page's guides, its wordmark appearing.
The exact strings live in `apps/live/components/tour/<kind>-tour-steps.ts`.

**A step that opens a popover** (Layout, Background, the Slide Deck) opens it once on entering, by pressing its
real button, and rings it. The popover stays open while the person presses the tour's card. Picking from it closes
it as it always does: the ring then moves to the tour page, so the person sees what they picked land; the step
never reopens it. Leaving the step closes whatever it opened that is still open.

**A step that opens the page's panel** opens it on the tab it is about (Page, Style, Text, or a logo page's
Layouts) and closes it on leaving.

### Slides track

0. **Getting started with Slides?** (offer): a quick look at making a slide, choosing its layout and background,
   the deck and presenting.
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
8. **You're ready to present** (outro).

The deck stays open from step 4 to step 7 and closes after them, however the tour leaves them
(`holdSlideDeck` / `releaseSlideDeck`).

### Infographic track

0. **Getting started with Infographics?** (offer): a quick look at laying out a page.
1. **Your Page** (the page's name): press it to fit the page to the screen, drag it to reorder.
2. **Start From a Layout** (the Layout popover, opened).
3. **Change the Background** (the Background popover, opened).
4. **Page Size** (the page's panel, opened on Page): size and orientation; duplicate, move or delete below.
5. **Add a Page** (the +).
6. **Present It** (the Slide Deck, opened): any page can be a slide, picked in the deck and presented.
7. **You're ready to make pages** (outro).

A **wireframe** page takes this track under its own offer (**Getting started with wireframes?**), save step 4,
**Device**: its cog picks the device, turns it and sets its frame, rather than a page size.

### Article track

0. **Getting started with Articles?** (offer): a quick look at writing an article.
1. **Write on the Page** (a centred card, no ring): click to write, `/` for blocks; full pages flow onto the next.
2. **The Page Toolbar** (the article's page toolbar, held up on the tour page through the step: it otherwise shows
   only while a page is hovered or written on).
3. **Article Style** (the Style popover beside the cog, opened by its button, [Article pages](article-pages.md) "Article style"): looks, accent, margins, page numbers, for every page of
   the article.
4. **Fonts and Spacing** (the Text popover beside it).
5. **You're ready to write** (outro).

### Logo track

The logo page's Show Me steps ([Logo pages](logo-pages.md#show-me)) behind the offer **Getting started with
Logos?**: **Start From a Logo Layout** (the panel, opened on Layouts), **Draw on Guides** and **Mirror As You Draw**
(each popover opened), then **That Is a Logo Page**.

### Filtering

- A step whose control is not on screen when the tour starts (a slide's deck button and the Slides button on a
  phone; the + when neither the one after the last page nor the Toolbar strip's is in the window) is left out up front, so the count stays honest; one that goes before its
  turn is skipped ("Mechanics").
- If the tour can no longer run where it started (the person's edit rights go, they open another tab, or the tour page is deleted or locked) it ends as skipped, closing whatever it opened.

## How a tour runs

Every tour (this one, [Show Me](show-me.md) and the [element tours](element-tours.md)) runs on one engine.

### Mechanics

- **One engine.** The step runner (`useTourEngine`: prepare, await, heal, glide, Back / Next / Skip) and what it
  draws (`TourStage`: `TourSpotlight`, `TourPopover`) are shared; each tour's host owns its offer, its steps and what
  ending means. A step anchors by `data-tour-id`, or by a `selector` resolved when it runs, and an anchorless card's
  `prepare` runs too.
- The engine drives the **real UI**, not screenshots: a step's `prepare` opens the actual panel, popover or menu
  (pressing the same trigger a person would), then anchors the card to the resulting DOM node.
- Targets are awaited (poll with timeout) because several menus are lazy-loaded chunks. A step whose target never
  appears is skipped rather than wedging the tour, the way the person was going: going Back, past it to the step
  before (never onto the welcome card); otherwise forward. If an open menu is dismissed mid-step, the step
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
dialog at all). What counts as a dialog is one signal, the modal guard (`lib/modal-guard.ts`), which the tours
read through `useOpenModalCount`.

- **An offer waits.** A tour that would be offered while a dialog is open stays owed and is offered once every
  dialog has closed, after the tour's usual offer delay. Nothing is remembered as answered while it waits.
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
  the accent. The offer and the last card are a deep gradient of the tab's hue in white, deepened until white
  reads on it at AA.
- **Arrival**: the dim fades in (250 ms) and the card settles in with it. **Hand-over**: on Next the spotlight and
  the card stay put while the next step prepares, then glide to it together once (250 ms, ease-in-out) and the
  card's words cross-fade. Between glides the hole follows its target exactly. One spotlight and one card for the
  whole run. Reduced motion keeps the fades only.

## Share roles

Only someone who may edit the tab is offered the tour, or sees Show Me: an **Editor**. A **Participant** or a
**Viewer** is never offered it, since the page controls it opens are not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The tour's funnel; the track shows in the step tokens:

- **Offer**: `UI` · `Opened` · `PagesTourOffer` when its welcome card shows; `UI` · `Closed` ·
  `PagesTourOffer` on No.
- **Start**: `UI` · `Started` · `PagesTour`.
- **Stage views**: `UI` · `View` · `PagesTourStep<Kind><Id>` once per step entry, `<Kind>` the track
  (`Slide`, `Infographic`, `Article`, `Logo`): `PagesTourStepSlideLayouts`,
  `PagesTourStepInfographicPageSize`, `PagesTourStepArticleStyle`, `PagesTourStepLogoOutro`, ...
- **End**: `UI` · `Ended` · `PagesTourCompleted` | `PagesTourSkipped`.
- **Settings rows**: `UI` · `Toggled` · `<Kind>TourSeenOn` | `<Kind>TourSeenOff`, for `SlidesTour`,
  `InfographicTour`, `ArticleTour` and `LogoTour` (`PagesTourSeenOn` | `PagesTourSeenOff` until the row split
  per kind in October 2026).
- **Page Show Me**: `UI` · `Started` · `<Kind>Tour`, and `UI` · `Ended` · `<Kind>TourCompleted` |
  `<Kind>TourSkipped`, for `SlideTour`, `InfographicTour`, `ArticleTour` and `LogoTour` ([Show Me](show-me.md)).

## Power user mode

[Power user mode](power-user-mode.md) marks the Pages tour seen (`pagesTourSeen`, every kind while the mode
is on) and every element tour (`elementToursSeen`).

## Code

- `<kind>-tour-steps.ts` (`slide-`, `infographic-`, `article-`, `logo-`): each track's steps, against one
  `PageTourApi` (`page-tour-api.ts`); `page-tour-dom.ts` opens and closes a page's title-bar popovers and finds
  its controls; `page-tour-steps.ts` picks a track's steps for a kind, loaded at the offer or the press so the
  copy stays out of the editor's first load.
- `PagesTourHost.tsx`: the offer, the tour page and the seen-guard. `PageTour.tsx`: the page panel's Show Me.
- `apps/live/lib/page-panel-request.ts`: how a tour opens or closes a page's panel on a tab from outside `CanvasPages`.
