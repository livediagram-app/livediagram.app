# Illustrate tour

A short, optional guided tour of [Illustrate mode](illustrate-pages.md), offered the first time a person works in
Illustrate. It is the [Draw tour](../023-draw-mode/draw-tour.md)'s sibling: the same welcome card, anchored step
cards, glide, dimming ring, Skip, Back and outro card, driven by the same engine. Where this spec is silent, the
Draw tour's rules hold.

## Domain language

| Term                   | Means                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Illustrate tour**    | This tour                                                                           |
| **Diagram tour**       | The Diagram mode tour, [Diagram tour](editor-tour.md)                               |
| **Start Illustrating** | An empty Illustrate tab's template start, [Start Diagramming](start-diagramming.md) |

## Where it appears

- **The first time a person is in Illustrate mode** on a tab they may edit: switching a tab to Illustrate, or
  opening a document whose tab opens in Illustrate. The editor has to be usable (hydrated, no welcome overlay, not
  read-only, not an embed), and the tab not locked.
- **Not before the synced preferences are in**, so an answer given on another device holds on a new one.
- **Not over Start Illustrating.** An empty Illustrate tab shows Start Illustrating, which hides the pages while it
  is open, so the offer waits until a template is picked or the panel closed
  ([Start Diagramming](start-diagramming.md) "The tours wait"); the pages it points at are then on screen.
- **On its own, never at the same time as another tour.**
- **Optional.** The offer is the opt-in: **Yes** starts it, **No** declines it.
- **Once ever per person**, through the synced `illustrateTourSeen` user preference
  ([User preferences](user-preferences.md)): taken, skipped mid-way or declined, it never offers itself again, on
  any device.
- **Replayable from Settings**: the **Illustrate** switch in the Accessibility category's **Onboarding Tutorials** control,
  beside **Draw** and built the same way (on means "not seen yet"). Turning it on from off and closing Settings
  runs the tour straight away when the person is in Illustrate, or offers it the next time they enter Illustrate.

## Tour content

None. The tour points at the page chrome and places nothing, so there is nothing to take away and nothing in the
document's history.

## The steps

A welcome card, up to four steps, then an outro card. The bookend cards sit outside the step count. Each step rings
one control by its `data-tour-id`; where a control repeats per page (the name, the cog), the first page's leads. The
exact strings live in `apps/live/components/tour/illustrate-tour-steps.ts`.

0. **Getting started with Illustrate?** (the offer): centred card with its own illustration (an A4 page whose colour
   band, headline and bar chart fill in beside a widescreen slide), offering a quick tour of pages, layouts and
   slides, then **No** and **Yes**.
1. **Your Pages** (`page-name`): a page's name above its top-left corner. Pressing it fits that page to the screen;
   dragging it reorders the pages.
2. **Page Settings** (`page-cog`): the cog above its top-right corner, opening the page's settings: its size, its
   background and a layout to start from.
3. **Add a Page** (`add-page`): the + after the last page, adding an infographic, article, slide or logo page.
4. **Slides** (`slides`): the Slides button in the bottom-right cluster, where a slide deck is built from the pages
   and presented.
5. **You're ready to illustrate** (outro): a help-centre link to the Illustrate mode article (new tab) and **Start
   illustrating**, which completes the tour.

- A step whose control is not on screen when the tour starts (a page too small on screen shows no name or cog, a
  surface without the + or the Slides button) is left out up front, so the count stays honest; one that goes
  before its turn is skipped, as in the Diagram tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Illustrate, or they open
  another tab) it ends as skipped.

## Share roles

Only someone who may edit the tab is offered the tour: an **Editor**. A **Participant** or a **Viewer** is never
offered it, since the page controls it shows are not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Draw tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `IllustrateTourOffer` when its welcome card shows; `UI` · `Closed` ·
  `IllustrateTourOffer` on No.
- **Start**: `UI` · `Started` · `IllustrateTour`.
- **Stage views**: `UI` · `View` · `IllustrateTourStep<Id>` once per step entry (`IllustrateTourStepPageName`,
  `IllustrateTourStepPageSettings`, `IllustrateTourStepAddPage`, `IllustrateTourStepSlides`,
  `IllustrateTourStepOutro`).
- **End**: `UI` · `Ended` · `IllustrateTourCompleted` | `IllustrateTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `IllustrateTourSeenOn` | `IllustrateTourSeenOff`.

## Power user mode

[Power user mode](power-user-mode.md) marks the Illustrate tour seen alongside the Diagram, Plan, Facilitate and
Draw tours.
