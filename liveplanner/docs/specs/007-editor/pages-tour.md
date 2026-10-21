# Pages tour

A short, optional guided tour of one [page kind](pages-mode.md#page-kinds) in Pages mode: a slide, an
infographic, an article or a logo. Each kind has its own **track**, which shows how that kind of page is made by
opening the real controls on the person's own page (a slide's Layout and Background popovers, its deck button,
the Slide Deck and Present) rather than only pointing at them. It is the [Draw tour](../023-draw-mode/draw-tour.md)'s
sibling: the same welcome card, anchored step cards, glide, dimming ring, Skip, Back and outro card, driven by the
same engine. Where this spec is silent, the Draw tour's rules hold.

## Domain language

| Term                   | Means                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Pages tour**         | This tour, whichever track it runs                                                                 |
| **Track**              | One page kind's steps: the **Slides**, **Infographic**, **Article** or **Logo** track              |
| **Tour page**          | The page a track runs on: the person's own page of that kind, fixed when the tour starts           |
| **Page Show Me**       | The same track run on demand from a page's panel ([Show Me](show-me.md)), without the welcome card |
| **Diagram tour**       | The Diagram mode tour, [Diagram tour](editor-tour.md)                                              |
| **Start Making Pages** | An empty Pages tab's template start, [Start Diagramming](start-diagramming.md)                     |

## Where it appears

- **The first time a person works on a page of a kind** on a tab they may edit, in Pages: entering
  Pages with such a page on screen, or a page of a kind not yet toured arriving on the tab (added from the +,
  or the first page's kind chosen). The editor has to be usable (hydrated, no welcome overlay, not read-only, not
  an embed), and the tab not locked.
- **The tour page** is the page on screen of a kind not yet toured that shows the most of itself in the window;
  its kind picks the track. A page that is locked or too small on screen to show its title bar is passed over.
- **Not before the synced preferences are in**, so an answer given on another device holds on a new one.
- **Not over Start Making Pages**, nor over the first page's own kind choice ("What Is This Page For?"): the offer
  waits until a template is picked or the panel closed ([Start Diagramming](start-diagramming.md) "The tours
  wait"), or the page's kind is chosen.
- **On its own, never at the same time as another tour.**
- **Optional.** The offer is the opt-in: **Yes** starts it, **No** declines it.
- **Once ever per kind, per person**, through the synced `pagesTourKinds` user preference
  ([User preferences](user-preferences.md)): the kinds whose track has been taken, skipped mid-way or declined.
  Each never offers itself again, on any device; a page of another kind still offers its own.
  `pagesTourSeen` true counts every kind as toured only while [Power user mode](power-user-mode.md) is on: an
  answer given before the tour offered each kind once named no kind, so each kind is offered once more
  (`apps/live/lib/tour-tracks.ts`, shared with the [Plan tour](../026-plan/plan-tour.md)).
- **Replayable from Settings**: in Settings' **Tours** category, **Pages Tours** switches every kind at once (on
  while any is owed; off answers them all, on forgets every answer), and one switch per kind sits nested beneath
  it, named for its kind (**Slides Tour**, **Infographic Tour**, **Article Tour**, **Logo Tour**). On means that kind
  is still owed. Turning one off answers that kind alone; turning one on forgets that kind alone (and folds a
  Power user's single `pagesTourSeen` into the answered list first, so the other kinds stay as they were).
  Closing Settings with a kind newly owed runs the track for the page on screen straight away when the person is
  in Pages, or offers it the next time they enter Pages. Power user mode's readout lists **Pages Tours**.
- **Replayable from the page**: every page's panel carries **Show Me**, which runs that page's track on demand
  ([Show Me](show-me.md)), wherever the offer stands.

## Tour content

The tour opens popovers, the page's panel and the Slide Deck, and closes them again on leaving the step. Its
controls stay live: a layout or background the person picks while its step is up is theirs, kept as any pick is (one
edit, undoable). The Logo track alone places something: two shapes to combine (below), placed, united and taken away
with no undo step (`useTourSquare`), so the page is left as it was and Undo never brings them back.

## The steps

A welcome card, then the track's steps, then its outro card; the bookend cards sit outside the step count. Each
step rings one control of the tour page (or the Slide Deck), held by its own page rather than the first page's,
never the whole page: a ring that size would light most of the screen, so a step about the page itself is a card
on its own (centred, counted, no ring), and a popover step rings its title-bar button until the popover shows.

The welcome card names its page kind, never the mode: eyebrow **Slides tour**, **Infographic tour**, **Article
tour** or **Logo tour**, over an illustration of that kind (`components/tour/art/pages-tour-art.tsx`): a
slide whose words and picture trade sides as layouts are picked beside it, with a Present button; an infographic
page whose band, headline, bars and ring chart fill in; an article page written line by line, its next page
behind; a logo's two shapes meeting on the page's guides, its wordmark appearing.
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
(each popover opened), then Combine shown for real (`logo-combine-demo.ts`): **Combine Shapes** places a square and
a circle overlapping in the page's lower third and selects them, so Combine shows; **Four Ways to Combine** opens its
menu; **One Shape** unites them, as Unite does, and highlights the result. Then **That Is a Logo Page**. The shapes and
their union go when the tour ends.

### Filtering

- A step whose control is not on screen when the tour starts (a slide's deck button and the Slides button on a
  phone; the + when neither the one after the last page nor the Toolbar strip's is in the window) is left out up front, so the count stays honest; one that goes before its
  turn is skipped, as in the Diagram tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Pages, they open
  another tab, or the tour page is deleted or locked) it ends as skipped, closing whatever it opened.

## Share roles

Only someone who may edit the tab is offered the tour, or sees Show Me: an **Editor**. A **Participant** or a
**Viewer** is never offered it, since the page controls it opens are not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Draw tour's funnel, with its own tokens; the track shows in the step tokens:

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
is on) alongside the Diagram, Plan, Workshop and Draw tours.

## Code

- `<kind>-tour-steps.ts` (`slide-`, `infographic-`, `article-`, `logo-`): each track's steps, against one
  `PageTourApi` (`page-tour-api.ts`); `page-tour-dom.ts` opens and closes a page's title-bar popovers and finds
  its controls; `page-tour-steps.ts` picks a track's steps for a kind, loaded at the offer or the press so the
  copy stays out of the editor's first load.
- `PagesTourHost.tsx`: the offer, the tour page and the seen-guard. `PageTour.tsx`: the page panel's Show Me.
- `apps/live/lib/page-panel-request.ts`: how a tour opens or closes a page's panel on a tab from outside `CanvasPages`.
