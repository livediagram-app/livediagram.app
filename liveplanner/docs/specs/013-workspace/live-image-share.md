# Live image share link

A share link's **live image**: an `<img>`-able URL that serves the project as SVG, so it can be embedded in a README,
wiki or site and stay up to date, with no editor chrome, just the content (like the SVG export). The same drawing,
fitted onto a 1200 x 630 PNG, is what a pasted share link previews with in a chat app
([Share-link previews](share-link-previews.md)).

The image is liveworkspace's, built once for every app ([previews.md](../../../../liveworkspace/docs/previews.md)): the service resolves the
link with the index, stores the drawing and serves it. liveplanner renders for the platform: the plan draws the tab
when the service asks through its export door ([Project previews](../006-project/project-snapshots.md)).

## Confirmed decisions

- **Scope: tied to a share link.** The image URL embeds a project's share code,
  so only projects the owner has explicitly shared expose an image. The URL is
  effectively public to anyone who has it (an `<img>` can't send a password or
  auth header), which matches a share link's existing semantics.
  - **Password-protected shares** ([Share password](share-password.md)) get **no** image URL — an `<img>`
    can't supply the password, so exposing an unguarded image would bypass the
    gate.
  - Revoking / expiring the share link also kills the image URL (it resolves
    through the index, the same authority as the share view).
- **Format: SVG.** Scalable, tiny, crisp at any size, and renders from the same
  vector logic as the SVG export. Best for embedding and staying live.

## Endpoint

`GET /api/share/<code>/image.svg[?tab=<id>]` on liveplanner.app, which the router forwards to liveworkspace's previews
(`/api/previews/share/<code>/image.svg`, [previews.md](../../../../liveworkspace/docs/previews.md) "The addresses"):

1. The service resolves `<code>` with the index, the single authority for expiry, level, tab and password: a missing,
   revoked or expired link, or one behind a share password, is a 404.
2. A tab-scoped link ([Tab-scoped share links](tab-scoped-share-links.md)) always draws its own tab, and a `?tab=` naming
   any other is a 404; a whole-project link draws the first tab, or the one `?tab=` names.
3. It answers `Content-Type: image/svg+xml` with a short `Cache-Control` (`public, max-age=30,
stale-while-revalidate=300`), so embeds update without asking the plan on every view.

## What each tab draws

The image draws a tab as the editor's export draws it ([Plan tabs](../026-plan/plan-tabs.md) "Export"), from what the
project holds now:

- **A Board** draws its columns with their cards, read from the project's items.
- **A Sheet** draws its window of cells, worked out ([Sheet](../029-sheets/sheet.md) "Exports and images").
- **A Form** draws its form as respondents see it, on the form's look.
- **A Dashboard** draws its page laid out, at the export's 1440 px width (`apps/api/src/thumbnail-dashboard.ts`, over
  `@liveplanner/plan-art`'s `planImageOf` and `planArtResolver`, the same ones the editor's export and the MCP's
  previews use): each metric and chart drawn from the project's cards (a figure with its bar, Cards by Field's bars,
  a Gantt's bars over its weeks, a Calendar's month and so on), never a box labelled with its kind; each note, title
  and Utility on its card; each Board or Sheet tab slot drawing that tab's board or Sheet. A figure from a Sheet and a
  Form Metric are written by name, without their figure (working a Sheet's figure out needs the sheets engine on its
  workbook, which the api does not run for an image).

### A Dashboard's cost

A Dashboard's image reads, besides its own tab, one bounded query of the tabs it draws from (`dashboardSourceTabs`):
the tabs its slots show and the tabs holding a board (whose columns name the statuses its charts count by), in tab
order, at most `DASHBOARD_IMAGE_TABS_MAX` (60). It reads the project's cards and card types once, as a board's image
does. Rendering is pure and bounded by the layout's own limits (12 rows of 4 slots) and the project's card limit:

| Page                                                               | Cards | Render (M-series laptop) |
| ------------------------------------------------------------------ | ----- | ------------------------ |
| Project Planner's Overview (9 slots: metrics, charts, 4 tab slots) | 50    | about 3 ms               |
| Project Planner's Overview                                         | 2,000 | about 5 ms               |
| 12 rows of 4 charts and metrics                                    | 2,000 | about 37 ms              |

`thumbnail-dashboard.perf.test.ts` holds the budget. liveworkspace's previews keep each drawing until the plan is
saved again ([previews.md](../../../../liveworkspace/docs/previews.md) "Staleness"), so a Dashboard's render is paid at most once per save and
tab, not per view. The labelled boxes drawn before cost about 0.2 ms.

## Share dialog

The shared Share dialog (`@liveworkspace/explorer`) has no **Live image** menu, so the address is built by hand from a
link's code: `/api/share/<code>/image.svg`, with `?tab=<id>` to pick a tab.
