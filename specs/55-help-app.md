# Help app

A standalone help centre at `/help`, modelled on the Manager Toolkit help centre but with livediagram's information architecture, content, and brand.

## Why

The editor is friction-free and discoverable, but there's no place that explains features in depth, answers "how do I…", or covers account/privacy/self-hosting questions. A searchable help centre fills that gap and doubles as SEO surface (every article is an indexable static page).

## Shape

A new Next.js app, `apps/help`, deployed as the `livediagram-help` Worker and stitched in by the router under `/help` — the same pattern as `apps/telemetry` (see [spec/08](08-router-app.md), [spec/22](22-telemetry.md)):

- `output: 'export'`, `basePath: '/help'`, `assetPrefix: '/help'`. Static only, no SSR (see [hard constraints](../CLAUDE.md)).
- The router strips `/help` and forwards to the worker, which serves `./out`.
- Content is **MDX** (`@next/mdx`) plus a TypeScript article index (`lib/articles.ts`). Navigation/index pages are TSX.

It behaves **exactly like the Manager Toolkit help centre**: hero + client-side search, a category grid, a "Feature Guides" grid, article pages with an auto-generated table of contents, breadcrumbs, "Was this helpful?" feedback, reading time, related-guide sidebar, and a back-to-top button. The difference is the categories/content (livediagram's) and the **brand**: livediagram is light + sky-blue (`brand-500`, see [spec/01](01-color-scheme.md)), not MT's dark purple, so every surface uses the shared `@livediagram/tailwind-config` brand ramp and slate neutrals to match `apps/marketing` and `apps/telemetry`.

### No paid tier

livediagram is free and MIT-licensed with no plan for a paid tier (see [spec/03](03-open-source-and-business-model.md)). So the help centre has **no "Accounts and Billing" category and no "Pro" callouts**. Instead it carries a **Self-hosting** category, reflecting that anyone can run their own instance.

## Information architecture

The **`@livediagram/help-registry` package** is the single source of truth for categories and articles; `apps/help/lib/articles.ts` re-exports it so the help app's `@/lib/articles` import path stays stable. It lives in `packages/` (not in the help app) because the live editor's search panel consumes the same catalogue (see "Help in global search" below). Two flat arrays (`categories`, `articles`) plus helpers (`getArticlesByCategory`, `getCategoryGroups`, `getSubArticles`, `searchArticles`). An article's `categorySlug` is its full nested path (e.g. `canvas/the-canvas`); `parentSlug` links a sub-article to its feature landing page.

**Search keywords.** Every article carries a required `keywords` field: space-separated, lowercase synonyms for the vocabulary users actually type when they don't know the article's title — synonyms ("transparency" for opacity, "hotkey" for keyboard shortcuts), adjacent spellings ("color" beside "colour"), and concept words the copy doesn't happen to use. `searchArticles` matches case-insensitively on **title + description + keywords**, and the editor's search panel matches the same fields, so an article is findable by the concept it discusses, not only by an exact title match. A test enforces that no article ships without keywords. (Born from a user report: searching "Opacity" found nothing because the element-opacity article is titled "Layer Order and Opacity" and the in-editor catalogue didn't cover it.)

**Sub-category grouping.** A feature category's landing cards can be split into labelled sub-category sections on its index page via an optional `group` field on each landing (e.g. Palette's `Selection Modes` / `Elements` / `Palette Settings`). `getCategoryGroups` buckets the category's landings by `group` in first-appearance order, and `FeatureCategoryIndex` renders one card grid per group under a heading. Landings without a `group` render in a single ungrouped grid, so other feature categories are unchanged.

Categories fall into two kinds. The **support** categories carry standalone articles; the **feature** categories (`kind: 'feature'`) carry the in-depth feature guides and are grouped under a separate "Feature Guides" heading on the home page and the `/features` index. Each feature category has a card-grid index page at `/help/<slug>/` (shared `FeatureCategoryIndex` component), and within it each feature has its own landing page plus optional sub-articles.

**Developers.** A support category for the public REST API ([spec/61](61-public-api-and-tokens.md)). Standalone articles — _The livediagram API_ (overview + base URL), _Authentication_ (bearer API tokens vs the guest path), _Working with Diagrams_ (worked `curl` examples), and _Errors and Rate Limits_ — that tell an integrator how to call the API a token unlocks. The human-facing companion to the machine-readable `GET /api/openapi.json` ([spec/37](37-api-documentation.md)), which the articles link out to rather than duplicate.

**Policies.** A support category, not a feature one. It is the home for the hosted service's legal pages: the **Terms of Service** and the **Privacy Policy**, both governing only the hosted service at livediagram.app (a self-hosted copy is the operator's responsibility). These were standalone marketing routes (`/terms`, `/privacy`); they now live as help articles under `/help/policies/`, and the old marketing routes stay alive as thin client redirects so historical links keep resolving. (The Privacy Policy previously sat in `privacy-and-security`; it moved here so the two policies sit together, and the old help URL redirects to the new one.)

| slug                   | title                | icon      | kind    |
| ---------------------- | -------------------- | --------- | ------- |
| `about`                | About livediagram    | info      | support |
| `getting-started`      | Getting Started      | rocket    | support |
| `tips-and-tricks`      | Tips and Tricks      | lightbulb | support |
| `account-and-data`     | Account and Data     | user      | support |
| `privacy-and-security` | Privacy and Security | shield    | support |
| `self-hosting`         | Self-Hosting         | server    | support |
| `developers`           | Developers           | code      | support |
| `troubleshooting`      | Troubleshooting      | wrench    | support |
| `supported-devices`    | Supported Devices    | devices   | support |
| `policies`             | Policies             | document  | support |
| `contact`              | Contact              | mail      | support |
| `explorer`             | Explorer             | folder    | feature |
| `palette`              | Palette              | palette   | feature |
| `canvas`               | Canvas               | frame     | feature |
| `tabs`                 | Tabs                 | tabs      | feature |
| `collaboration`        | Collaboration        | users     | feature |
| `activity-panel`       | Activity Panel       | activity  | feature |
| `tools`                | Tools                | tools     | feature |
| `search-panel`         | Search Panel         | search    | feature |

The feature categories group the feature guides by area:

- **Explorer** — the diagram library (explorer/15, teams/32+35): The Explorer overview, Recent, Shared with you, My Work and folders, Team Spaces, Image Gallery, and Saved Themes, one guide per sidebar section.
- **Palette** — the floating palette, in three sub-categories grouped on the index (see "Sub-category grouping" below): **Selection Modes** (one guide per tool-picker mode: Select, Hand, Eraser, Format Painter, Laser, Spotlight, Isometric), **Elements** (one guide per palette tab: Shapes (+ shape markers, style presets 48), Arrows (+ arrow styles, curve/elbow handles, arrow-to-arrow), Tools (+ drawing/shape-recognition, images, data elements 46+51+52+53), Components, Devices, Icons, Technology 41), and **Palette Settings** (one guide per gear-menu setting: Auto-Attach Arrows, Alignment Guides, Minimal Panels, Reset Palette Position).
- **Canvas** — the infinite canvas (09), selecting and grouping (selection/groups), links and link cards (40), annotations (38), themes (29+42+44), templates, text and fonts (28).
- **Tabs** — multiple boards (13+17+30): Tabs, Tab Folders, Linking Across Tabs, Add a Tab to Another Diagram, Importing (27), Exporting, and Cleanup (47), one guide per tab-menu action.
- **Collaboration** — comments, live presence (07: live cursors / selections / per-tab presence), teams (32+35), sharing and embeds (24+33+34), session tools (39).
- **Activity Panel** — the per-diagram change log (12) promoted to its own category: What it is, How it works, Undo, Redo, and Reverting a change, one guide each.
- **Tools** — AI assistance (25), zen mode (26), light/dark UI mode (07), Markdown import (27), layout cleanup (47).
- **Search Panel** — the global search (09): an overview landing plus sub-articles for each thing search does, finding diagrams/folders, teams, tabs and elements, adding palette items to the canvas, and the Create-new-tab action.

Where a feature's name would equal its category slug, the landing slug is distinguished (`the-canvas`, `the-explorer`, `using-tabs`) so a feature slug never equals a category slug (which would break the breadcrumb's parent link).

There is **no Presentation Mode guide**: spec/31 is a draft and the feature is not built, so the article was unpublished rather than ship documentation for a non-existent feature.

## In-article illustrations

Articles were text-heavy, so each section that benefits from a picture carries a
**figure**: an inline SVG mock of the real editor surface it describes (the
palette, a dialog, the tab bar, a flow of shapes, live cursors, ...). They are
SVG, not screenshots, so they stay crisp, theme with the brand ramp, add zero
binary assets to the static export, and never drift from a UI rebrand the way a
captured screenshot would.

### Card icons and accents

Separate from the illustrations above: every card in the catalogue carries a
small outline glyph in a tinted tile. `lib/featureIcons.tsx` maps a feature slug
to the glyph, `lib/featureColours.ts` to the hue, and the two maps are kept
**key-for-key identical** (enforced by test) — a bespoke glyph beside a
fallback hue reads as an oversight.

Both fall back **to the article's top-level feature category**, not to a single
default. That matters more than it sounds: when the fallback landed, 107 of the
172 landing cards under the ten feature categories had no bespoke entry, so with
one default nearly two thirds of the catalogue drew the same sky-blue canvas
frame in the same grey tile. **None still take it.** All 172 cards under
the ten feature categories now have a glyph and a hue of their own, so the
category fallback has become what it should be: the safety net a NEW card lands
on before someone draws it, rather than something a reader sees. Keep it that
way — a new landing page should arrive with its own entry in both maps, the way
it arrives with its own registry entry. A grid where most tiles are identical is decoration, not a
catalogue — the
glyph exists so a card reads as "palette" or "sharing" before you read its
title. One distinct hue and glyph per category restores that much at least.

Resolution order is `featureIcon(slug, categorySlug)` / `featureColour(...)`:
the feature's own entry, then its category's, then the neutral default. The
category lookup reads only the FIRST segment (`topCategorySlug` in
`@livediagram/help-registry`, which owns the nested-slug convention), so
`palette/tools/data-elements` inherits Palette's. Both resolvers are shared by
the category index cards and the MDX `<Feature>` tile, so a feature looks the
same wherever it appears. Adding a bespoke glyph is still the better answer for
any individual card — the category fallback is the floor, not the goal. Draw them
a category at a time: a batch that shares a family reads as a set. And **look at
them rendered before shipping** — valid path geometry is not the same as a
legible 24px glyph. Three of the Palette thirteen had to be redrawn only after
seeing them: a chair that read as a table, a button whose pointer swallowed it,
and a sticker using the folded corner that already means a document here. The
Canvas batch cost two more, both from colliding with a glyph already in the set —
a magnet drawn as a shield, and a drop shadow that read first as "duplicate" and
then, hatched, as the motion lines on `animations`. `shadows` is the one glyph
that fills and fades, because it is the only one whose subject IS a fill and a
fade; every stroke-only version of it meant something else. The Collaborate
batch cost two: a tick drawn inside a circle rendered as a prohibition sign,
which is the opposite of "decided", and a roll call drawn as circles beside
lines read as a bulleted list until the circles became heads and shoulders.

The pattern in every redraw so far is worth stating, since it is not what you
would guess: none was wrong on its own terms. Each had either landed on a glyph
already in the set, or landed on a completely different idiom's meaning. Portals
took three attempts for exactly that reason — two rings joined by a line is the
chain that `links` means, and joined by an arc it is a pair of headphones — and
settled on the single ring with an arrow entering it, accepting that the pairing
lives in the label rather than the picture.

One rule fell out of the Behaviour batch and is worth keeping: **draw what the
element DOES, never the control itself.** Every Behaviour element is physically a
button, and the family glyph already draws a button, so six glyphs of buttons
would have been six copies of one picture. What separates them is the play
triangle, the tick, the burst, the mosaic and the die.

Applied up front, that rule is also what made the Search Panel's six the first
batch to need no redraw at all: six articles about one control, and not one of
them draws a magnifier. They draw what you find — diagrams in a folder, a team,
a tab and the element inside it, a shape landing on the canvas, a new tab.

The Explorer's five raised the mirror-image problem and it is worth naming: a
bespoke glyph has to differ from its own CATEGORY's fallback too, since the two
sit side by side in the same grid until every card in the category is drawn. The
Explorer's fallback is a folder tree, so Folders is two folders nested and
Unsorted is loose cards sitting outside one — folders that are unmistakably about
something other than being a folder.

One more, from the Data elements: **half a subject drawn clearly beats the whole
subject drawn ambiguously.** Progress Bars and Rings covers both, and a ring above
a bar is a circle on a stem, which reads as a lightbulb and nothing else. It draws
the bar only. Rating hit the same collision rule from the other side — stars, when
`favourites` is already a star — so it draws the SCALE, a row part-filled, rather
than the symbol.

Voting's five are the clearest case of the whole exercise, and needed no redraw
because the rule was applied first: five articles about ONE feature, where every
single one could have been drawn as "some dots". They draw spending a dot,
restricting to a layer, hiding the count, tracking the room, and what won.
`casting-dots` has no box around its dots for the same reason Rating has no star:
dots in a box is the die that `pickers` already draws. The four Arrow guides are
the same shape of problem — four articles about arrows, next to an `arrows` family
glyph that is already an arrow — so they draw the three shapes, the handle you
drag, the obstacle, and the other arrow. The Sharing guides ran into it a third
way: the obvious drawing for each was already spoken for somewhere else in the
set — a padlock is `locking`, a chain is `links`, a picture is `images` — so they
draw the password field, the deadline, the page the diagram sits inside, and the
refresh. Avatar Mode and Walking Together met it a fourth way: the set already
had five person glyphs and every one was a head-and-shoulders bust, so these two
are whole figures mid-stride — which happens to be exactly what the feature is.
And Changing the Theme is the plainest collision of the lot: a wheel of hues
rendered as the `pie-chart` glyph exactly, while `themes` already owned the paint
palette and `custom-themes` owned swatches-with-a-plus, so what was left to draw
was the browsing itself. By the Collaboration batch every one of the six had its
obvious drawing already spoken for, so each took the next detail down: a stopwatch
rather than a clock, a question in a bubble rather than cards, dots landing on
something rather than dots, an envelope rather than people, a folder handed
outward rather than a folder holding people.

Two mechanical checks earn their keep alongside the render, because both catch
things the eye skims: every path must parse (a leading moveto, seven-parameter
arcs, correct arity elsewhere), and every anchor point must sit far enough inside
the 24-unit box that its stroke does not clip the edge. The second one found a
sparkle on Shape Recognition sitting low enough to be shaved. Note that any such
checker has to split ARC parameters properly — SVG allows the two flags to be
glued to the following coordinate (`0 1 4.5` written `014.5`), and a naive number
scan reads that as one value and then reports perfectly good glyphs as broken.

The system has three layers, all under `apps/help`:

- **`components/illustrations/primitives.tsx`** — the shared SVG kit (`Scene`,
  `Shape`, `Arrow`, `SelectionBox`, `Cursor`, `Avatar`, `Panel`, `Dialog`,
  `Button`, `Tabs`, `Menu`, `Tile`, `Label`, `TextBar`). Every figure composes
  from these so the house style (white panels, slate borders, sky-blue `brand`
  accents) lands in one place. This is the no-duplication rule applied to art.
- **`components/illustrations/<area>.tsx`** — one file per area (canvas, palette,
  collaboration, ...) exporting named **scene** components (e.g.
  `CanvasOverview`, `ThemePicker`) built from the primitives. Branch hues beyond
  brand use the on-brand accent set (emerald / violet / amber / rose / teal /
  indigo) already used by `featureColours`.
- **`components/illustrations/<area>-parts.tsx`** — an area's own building
  blocks, when it grows enough of them to interleave with its scenes (the
  Explorer's sidebar row and diagram card; the palette's per-mode glyphs and
  shared mode-row). Distinct from `primitives.tsx`, which is the house style
  every area shares: these are wanted by one area only. The split exists so an
  `<area>.tsx` reads as a uniform list of complete scenes rather than
  alternating between two kinds of thing — an area with one or two helpers
  keeps them inline and needs no parts file. The marketing feature-art files
  (`apps/marketing/components/feature-art/<name>-parts.tsx`) follow the same
  convention.
- **`components/Figure.tsx`** — frames any scene in an "editor viewport" card
  with an optional caption. Registered globally in `mdx-components.tsx` (like
  `Tip` / `Note`), so an article only imports the specific scene and writes
  `<Figure caption="…"><Scene/></Figure>`.

Figures are added to the sections that genuinely benefit (a concrete UI surface,
a before/after, a spatial relationship), not to every section; reference-only or
purely conceptual sections stay text. Scenes are reused across articles wherever
the same surface recurs rather than redrawn.

## In-editor entry point

The editor's `TabBar` gains a **Help** link on its right edge, beside the existing GitHub link — a plain `<a href="/help/" target="_blank">` (same convention as the GitHub link, no editor-page wiring). It fires `track('UI', 'Opened', 'Help')` (see [spec/22](22-telemetry.md); reuses existing `UI`/`Opened` enum pair). A "Help" link also lives in the help app's own header/footer.

### Help in global search

The editor's global search panel (spec/09) surfaces matching help articles as a
**Help** group, so "how do I…" is answerable without leaving the canvas. The
searchable catalogue (`apps/live/lib/help-search.ts`) is derived from the
**full `@livediagram/help-registry` registry** — every article, matched on its
title plus the registry's description + `keywords` synonyms, resolved to an
absolute `/help` href (the article slug doubles as the telemetry-safe leaf).
There is no second hand-curated list to keep in sync; adding an article to the
registry makes it findable in the editor automatically. `buildSearchResults`
stays catalogue-agnostic (the surface passes `helpItems`, the same pattern as
palette results), matches on a non-empty query only, caps the group at 6, ranks
it last (navigation and edit results keep the default Enter), and picking one
opens the article in a new tab. Both the editor and the Explorer pass the
catalogue, since help is global. (The `help-articles.ts` deep-link map remains,
but only for surfaces that link ONE article contextually — see spec/56.)

## Analytics

The help app is a static site outside the editor, so it does not use the editor's first-party telemetry pipeline. It emits nothing by default (no third-party scripts), keeping it self-host-clean. The in-editor Help link is the only telemetry touchpoint, via the existing pipeline.

## Deployment

A `deploy-help` job in `.github/workflows/deploy.yml` mirrors `deploy-telemetry` (build artifact → `wrangler deploy`). The router's `deploy-router` job already depends on the static apps; it gains a dependency on `deploy-help`, and `apps/router/wrangler.toml` gains a `HELP` service binding to `livediagram-help`.

## Out of scope (for now)

- Weighted ranking inside the Help group (title hits before keyword hits).
  Matching is a flat case-insensitive substring over title + description +
  keywords, capped at 6; registry order decides ties. Revisit if keyword
  coverage makes the group noisy.

(Previously listed here: surfacing the full article catalogue in editor
search. That shipped — the registry moved to `@livediagram/help-registry` with
per-article `keywords`, and `help-search.ts` now derives from it.)
