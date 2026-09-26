# Landing funnel

Status: shipped

## What

Measure how the public pages turn visitors into diagrams: for every call to
action (CTA) that links into the editor, how many people it brought to `/new`,
and how many of those went on to create a diagram. Read beside the page views
[Page view telemetry](../017-telemetry/page-view-telemetry.md) already counts, that gives a three-step funnel per page and per
button:

1. **Viewed**: the page was viewed (`Page·View·<path>`, [Page view telemetry](../017-telemetry/page-view-telemetry.md)).
2. **Arrived**: somebody followed one of its CTAs and `/new` opened
   (`Cta·Opened·<source>`).
3. **Created**: that visit went on to create a diagram (`Cta·Created·<source>`).

The dashboard's **Pages** tab opens with the funnel (see Dashboard below).

## Why

Before this the marketing site reported page views and nothing else, so no
change to the landing page could be judged. "Does the hero convert better
than the closing CTA?", "do the template gallery's cards create diagrams?",
"is Just Draw or Choose Template the stronger button?", "does anyone start
from a comparison page?" had no answer. [Marketing site](marketing-site.md)'s landing page work (a new
headline, fewer sections, a prompt in the hero) needs a number to move before
any of it is worth doing.

## How attribution travels: in the link, not the person

Every CTA's `href` carries a `via=<source>` query parameter naming **which
button on which kind of page** it is, for example
`/new?via=Home.Hero` or `/new?template=kanban&via=Home.Gallery`. The source is
baked into the static HTML at build time, so it works with JavaScript off, for
a middle-click or open-in-new-tab, and for a copied link.

The editor's `/new` page reads it once on arrival and then:

- **Strips it from the address bar** (`history.replaceState`, keeping every
  other parameter), so a reload, a bookmark or a Back from the editor never
  counts the same arrival twice, and nobody sees a tracking parameter in the
  URL they share.
- Sends `Cta·Opened·<source>` straight away.
- Holds the source for the life of the page and sends `Cta·Created·<source>`
  beside the usual `Diagram·Created` when the diagram is committed, whichever
  path committed it (the wizard's Create, its Skip, or a Just Draw / template
  bypass).

So the marketing site still sends **only page views** ([Page view telemetry](../017-telemetry/page-view-telemetry.md)): no click
handlers, no new emitter. Everything new is sent by the editor, which already
emits.

### What this is not

A source names a button, never a visitor. The three events share nothing that
links them: no id, no session, no timestamp beyond the day. The funnel is
three independent counts divided by each other, exactly as [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) requires.
It is closer to the `?template=<kind>` a gallery card already carries than to
a referrer: it can only ever say one of the fixed values below, and it says
nothing about where the visitor was before our own page.

## The vocabulary

A source is `<Surface>.<Slot>`, drawn from a closed table,
`CTA_SOURCES` in `@livediagram/api-schema` (`cta-sources.ts`). One table
serves the link builders, the editor's reader, the ingest validator and the
dashboard, so a CTA can't be linked with a source the editor ignores or the
ingest drops.

| Surface     | Pages it covers                    | Slots                                                                           |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `Home`      | `/`                                | `Header`, `HeaderDraw`, `Hero`, `HeroDraw`, `Gallery`, `GalleryDraw`, `Closing` |
| `Feature`   | `/features/<id>`                   | `Header`, `HeaderDraw`, `Hero`, `Closing`                                       |
| `Compare`   | `/alternatives`, `/alternatives/*` | `Header`, `HeaderDraw`, `Card`                                                  |
| `Faq`       | `/faq`                             | `Header`, `HeaderDraw`, `Card`                                                  |
| `Status`    | `/status`                          | `Header`, `HeaderDraw`                                                          |
| `Dashboard` | `/telemetry`                       | `Header`, `HeaderDraw`                                                          |
| `Help`      | `/help`, `/help/*`                 | `Header`                                                                        |

The slots:

- `Header` / `HeaderDraw`: the shared `SiteHeader` pair, Choose Template
  (`/new`) and Just Draw (`/new?blank=1`). The help centre's header has one
  Start drawing button, its `Header`.
- `Hero` / `HeroDraw`: the landing hero's pair; on a feature page, `Hero` is
  the category hero's Start drawing.
- `Gallery`: any card in the landing template gallery
  (`/new?template=<kind>`). The template itself is already reported by
  `Template·Used`, so it is not repeated in the source. `GalleryDraw` is the
  blank-canvas link shown when a gallery search matches nothing.
- `Closing`: the shared "Time to start" band (`StartDrawingCta`).
- `Card`: the Start drawing card at the foot of the comparison and FAQ pages.

A link into `/new` from a public page with no source (the apps menu's Editor
item, a link inside a help article) is deliberately not a CTA and is not
counted. Adding a CTA means adding its slot to `CTA_SOURCES` and building its
`href` with `ctaHref(href, source)`; `cta-sources.test.ts` pins the table.

### Server validation

`Cta` pairs only with `Opened` and `Created`, and its `type` must be a source
in `CTA_SOURCES` (`isCtaSource`). Anything else is dropped at ingest, so the
public dashboard can never show a hand-posted `Cta` row outside the table. The
editor reads `via` through the same `isCtaSource`, so an unknown value (a
stale link after a slot is renamed, or someone editing the URL) is ignored and
the visit counts as an ordinary `/new`.

## Dashboard

### The Pages tab's funnel

The Pages tab ([Page view telemetry](../017-telemetry/page-view-telemetry.md)) opens with a **Landing Funnel** section above the top
pages, for the selected window:

- **A headline strip** across the whole public site: page views of the
  surfaces above, arrivals from their CTAs, diagrams created from them, and
  the two step rates (views → arrivals, arrivals → created) plus the overall
  rate (views → created).
- **One card per surface**, busiest first: its three counts drawn as a
  shrinking funnel bar with the step rate between each step, then a row per
  slot (label, arrivals, created, and the slot's conversion rate) so the
  buttons on one page can be compared directly. Every slot is listed, unused
  ones included, since a button nobody presses is what this is for spotting.
  When two or more slots created diagrams, the one that created the most
  (ties to the better conversion) is tagged **Most diagrams**. A surface with
  no views and no arrivals in the window is left out, with a line naming it.
- Each headline count carries the dashboard's usual trend arrow against the
  span before the window, and the overall rate shows what it was then.

Rates are shown to whole percentages (one decimal under 10%), and as "n/a"
when the step before is zero. They are not capped: the counts are independent,
so a rate over 100% (a page view lost to a closed tab before the beacon, an
arrival from a link copied out of a page) is shown as it is rather than
tidied.

The helpers (`cta-funnel.ts`) are pure and tested apart from the view, like
`page-views.ts`.

### The Dashboard tab

The Visitors group gains a **Calls to Action** chart stack: CTA Arrivals and
Diagrams from CTAs, headed by Diagrams from CTAs, with a See also link to the
Pages tab's funnel.

## Out of scope

- **Click events on the marketing site.** A click that never reaches `/new`
  (the tab was closed first) isn't counted. Counting it would need a click
  handler and a second marketing event, for a gap measured in a fraction of a
  second.
- **Which template a gallery visit created** beyond `Template·Used`, which
  already names it.
- **Attribution beyond the first diagram.** The source lives for one `/new`
  page; what that person does next is not linked to it.
- Referrers, campaigns and UTM parameters from other sites. The vocabulary is
  our own buttons only.
