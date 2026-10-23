# Help app

A standalone help centre at `/help`, modelled on the Manager Toolkit help centre but with livedesign's information architecture, content, and brand.

## Why

The editor is friction-free and discoverable, but there's no place that explains features in depth, answers "how do I…", or covers account/privacy/self-hosting questions. A searchable help centre fills that gap and doubles as SEO surface (every article is an indexable static page).

## Shape

A new Next.js app, `apps/help`, deployed as the `livedesign-help` Worker and stitched in by the router under `/help` — the same pattern as the live app's assets (see [Router app](../016-platform/router-app.md), [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)):

- `output: 'export'`, `basePath: '/help'`, `assetPrefix: '/help'`. Static only, no SSR (see [hard constraints](../../../AGENTS.md)).
- The router strips `/help` and forwards to the worker, which serves `./out`.
- Content is **MDX** (`@next/mdx`) plus a TypeScript article index (`lib/articles.ts`). Navigation/index pages are TSX.

It started as a copy of the Manager Toolkit help centre and has since been redesigned in the marketing site's language; what each page looks like (the home page's sections, category art, grouped category pages, article navigation, search keys) is [Help pages](help-pages.md). The building blocks below stay: hero + client-side search, category cards, article pages with an auto-generated table of contents, breadcrumbs, "Was this helpful?" feedback, reading time, related-guide sidebar, and a back-to-top button. An article's sections (the tinted bands between its `##` headings) are grouped while it renders, so the static HTML already has them, and the reading-time row holds its height before the time is counted: nothing moves after the page appears. The difference is the categories/content (livedesign's) and the **brand**: livedesign is sky-blue (`brand-500`, see [Theme](../004-interface-design/color-scheme.md)) on light or dark chrome ([Appearance](../004-interface-design/appearance.md)), not MT's dark purple, so every surface uses the shared `@livedesign/tailwind-config` brand ramp and slate neutrals to match `apps/marketing`.

### No paid tier

livedesign is free and MIT-licensed with no plan for a paid tier (see [Open source + distribution](../002-project-scope/open-source-and-business-model.md)). So the help centre has **no "Accounts and Billing" category and no "Pro" callouts**. Instead it carries a **Self-hosting** category, reflecting that anyone can run their own instance.

## Information architecture

The **`@livedesign/help-registry` package** is the single source of truth for categories and articles; `apps/help/lib/articles.ts` re-exports it so the help app's `@/lib/articles` import path stays stable. It lives in `packages/` (not in the help app) because the live editor's search panel consumes the same catalogue (see "Help in global search" below). Two flat arrays (`categories`, `articles`) plus helpers (`getArticlesByCategory`, `getCategoryGroups`, `getSubArticles`, `searchArticles`). The link helpers (`articleHref`, `categoryHref`) also live apart in the data-free `@livedesign/help-registry/hrefs`, so a page that only builds links never bundles the catalogue: the article layout reads its own URL and its parent's off the route (`lib/article-route.ts`) and imports only the hrefs, and the search box loads the registry on the reader's first focus, hover or keystroke ([Web performance](../016-platform/web-performance.md)). An article's `categorySlug` is its full nested path (e.g. `canvas/the-canvas`); `parentSlug` links a sub-article to its feature landing page.

**Search keywords.** Every article carries a required `keywords` field: space-separated, lowercase synonyms for the vocabulary users actually type when they don't know the article's title — synonyms ("transparency" for opacity, "hotkey" for keyboard shortcuts), adjacent spellings ("color" beside "colour"), and concept words the copy doesn't happen to use. `searchArticles` matches case-insensitively on **title + description + keywords**, and the editor's search panel matches the same fields, so an article is findable by the concept it discusses, not only by an exact title match. A test enforces that no article ships without keywords. (Born from a user report: searching "Opacity" found nothing because the element-opacity article is titled "Layer Order and Opacity" and the in-editor catalogue didn't cover it.)

**Sub-category grouping.** A feature category's landing cards can be split into labelled sub-category sections on its index page via an optional `group` field on each landing (e.g. Pages' `Basics` / `Kinds of Page`). `getCategoryGroups` buckets the category's landings by `group` in first-appearance order, and `FeatureCategoryIndex` renders one card grid per group under a heading. Landings without a `group` render in a single ungrouped grid, so other feature categories are unchanged.

Categories fall into two kinds. The **support** categories carry standalone articles; the **feature** categories (`kind: 'feature'`) carry the in-depth feature guides and are grouped under a separate "Editor Guides" heading on the home page and listed on the `/features` index. Each feature category has a card-grid index page at `/help/<slug>/` (shared `FeatureCategoryIndex` component), and within it each feature has its own landing page plus optional sub-articles.

**Developers.** A support category for the public REST API ([Public API and API tokens](../015-api/public-api-and-tokens.md)). Standalone articles — _The livedesign API_ (overview + base URL), _Authentication_ (bearer API tokens vs the guest path), _Working with Designs_ (worked `curl` examples), and _Errors and Rate Limits_ — that tell an integrator how to call the API a token unlocks. The human-facing companion to the machine-readable `GET /api/openapi.json` ([API documentation (OpenAPI)](../015-api/api-documentation.md)), which the articles link out to rather than duplicate.

**Policies.** A support category, not a feature one. It is the home for the hosted service's legal pages: the **Terms of Service**, the **Privacy Policy** and **Reporting a Vulnerability** (the vulnerability disclosure policy, [Vulnerability disclosure](../002-project-scope/vulnerability-disclosure.md), which the marketing `/security` route, `/.well-known/security.txt` and the repo's `SECURITY.md` all point at). The Terms and Privacy Policy govern only the hosted service at livedesign.app (a self-hosted copy is the operator's responsibility). These were standalone marketing routes (`/terms`, `/privacy`); they now live as help articles under `/help/policies/`, and the old marketing routes stay alive as thin client redirects so historical links keep resolving. (The Privacy Policy previously sat in `privacy-and-security`; it moved here so the two policies sit together, and the old help URL redirects to the new one.)

| slug                   | title                | kind    |
| ---------------------- | -------------------- | ------- |
| `about`                | About livedesign     | support |
| `getting-started`      | Getting Started      | support |
| `tips-and-tricks`      | Tips and Tricks      | support |
| `account-and-data`     | Account and Data     | support |
| `privacy-and-security` | Privacy and Security | support |
| `self-hosting`         | Self-Hosting         | support |
| `developers`           | Developers           | support |
| `troubleshooting`      | Troubleshooting      | support |
| `supported-devices`    | Supported Devices    | support |
| `policies`             | Policies             | support |
| `contact`              | Contact              | support |
| `pages`                | Pages                | feature |
| `user-interface`       | User Interface       | feature |
| `explorer`             | Explorer             | feature |
| `selection-modes`      | Selection Modes      | feature |
| `palette`              | Palette              | feature |
| `canvas`               | Canvas               | feature |
| `tabs`                 | Tabs                 | feature |
| `collaboration`        | Collaboration        | feature |
| `tools`                | Tools                | feature |
| `search-panel`         | Search Panel         | feature |

The feature categories group the feature guides by area. **Pages is the first**: it is what livedesign is for.

- **Pages** — the pages a design is made of, in two groups: **Basics** (Working with Pages, exporting and presenting pages, the Pages tour, tab windows) and **Kinds of Page** (logo pages, wireframe pages and photo pages).
- **User Interface** — the panels, toolbar, context menus, the Map, zoom and tab bars, quick controls and power user mode.
- **Explorer** — the design library: The Explorer overview, Home (the Timeline), Recent, Shared With Me, My Work and folders, Team Spaces, Image Gallery, and Saved Themes, one guide per sidebar row.
- **Selection Modes** — one guide per tool-picker mode: Select, Hand, Format Painter, Laser, Spotlight, Isometric.
- **Palette** — the palette strip: one guide per palette category (Shapes and arrows, Text, Media and images, Data elements, Concepts, Components, Devices, Icons, Stickers) and one per palette setting.
- **Canvas** — the canvas around the pages, selecting many elements, links and link cards, themes, templates, text and fonts, layers, animations, Undo and Redo.
- **Tabs** — a design's tabs: Tabs, Tab Folders, Linking Across Tabs, Add a Tab to Another Design, Importing and Exporting, one guide per tab-menu action.
- **Collaboration** — comments, live presence (live cursors, selections, per-tab presence), following a presenter, teams, sharing and embeds.
- **Tools** — AI assistance, zen mode and appearance (light, dark, system).
- **Search Panel** — the global search: an overview landing plus sub-articles for each thing search does, finding designs/folders, teams, tabs and elements, adding palette items to the canvas, and the Create-new-tab action.

Where a feature's name would equal its category slug, the landing slug is distinguished (`the-canvas`, `the-explorer`, `using-tabs`) so a feature slug never equals a category slug (which would break the breadcrumb's parent link).

**Troubleshooting tools.** One Troubleshooting article is a working tool, not only text: _Repair This Browser_ renders `BrowserRepairTool` (`apps/help/components/`), the shared `BrowserRepairPanel` from `@livedesign/ui` plus the browser checks, so a person whose editor will not start can still clear its stuck settings from the help centre, which shares the editor's origin ([Load recovery](../007-editor/load-recovery.md)).

## In-article illustrations

Articles were text-heavy, so each section that benefits from a picture carries a
**figure**: an inline SVG mock of the real editor surface it describes (the
palette, a dialog, the tab bar, a flow of shapes, live cursors, ...). They are
SVG, not screenshots, so they stay crisp, theme with the brand ramp, add zero
binary assets to the static export, and never drift from a UI rebrand the way a
captured screenshot would.

A figure's words are its caption: the `<figcaption>` names the `<figure>` for a screen reader, and the SVG itself
is `aria-hidden` (an unnamed `role="img"` was an image with no alternative on every illustrated article). A picture
that teaches something says it in its caption.

### Card icons and accents

Separate from the illustrations above: every card in the catalogue carries a
small outline glyph in a tinted tile. `lib/featureIcons.tsx` maps a feature slug
to the glyph, `lib/featureColours.ts` to the hue, and the two maps are kept
**key-for-key identical** (enforced by test) — a bespoke glyph beside a
fallback hue reads as an oversight.

Both fall back **to the article's top-level feature category**, not to a single
default. That matters more than it sounds: when the fallback landed, nearly two
thirds of the landing cards had no bespoke entry, so with one default they drew the
same sky-blue canvas frame in the same grey tile. **None still take it.** Every
card under the feature categories now has a glyph and a hue of its own, so the
category fallback has become what it should be: the safety net a NEW card lands
on before someone draws it, rather than something a reader sees. Keep it that
way — a new landing page should arrive with its own entry in both maps, the way
it arrives with its own registry entry.

The **support** categories work the same way one level simpler. Their cards render
through `ArticleCard`, which takes its glyph from `SUPPORT_ARTICLE_ICONS`
(`lib/articleIcons.tsx`) and its tone from the brand, so there is no paired hue
map to keep in step — and it falls back to a generic design glyph rather than a
per-category one. That fallback had 13 of the 40 icon-showing support cards on it,
a third of them identical, so those are drawn too. (Getting Started is the
exception by design: its cards lead with a numbered step badge instead of an
icon.) Both halves of the catalogue are now fully illustrated, and a test per half keeps
them that way: `feature-icons.test.ts` and `article-icons.test.ts` each fail on a
card with no glyph of its own, naming the slug. The support one also reads WHICH
browse pages number their cards straight off the pages, rather than hardcoding
that Getting Started is the numbered one — so if the numbering ever moves, its
eight cards start needing glyphs and the test says so instead of quietly exempting
the wrong category. A grid where most tiles are identical is decoration, not a
catalogue — the
glyph exists so a card reads as "palette" or "sharing" before you read its
title. One distinct hue and glyph per category restores that much at least.

Resolution order is `featureIcon(slug, categorySlug)` / `featureColour(...)`:
the feature's own entry, then its category's, then the neutral default. The
category lookup reads only the FIRST segment (`topCategorySlug` in
`@livedesign/help-registry`, which owns the nested-slug convention), so
`palette/tools/data-elements` inherits Palette's. Both resolvers are shared by
the category index cards and the MDX `<Feature>` tile, so a feature looks the
same wherever it appears. Adding a bespoke glyph is still the better answer for
any individual card — the category fallback is the floor, not the goal. Draw them
a category at a time: a batch that shares a family reads as a set. And **look at
them rendered before shipping** — valid path geometry is not the same as a
legible 24px glyph. Three of the Palette thirteen had to be redrawn only after
seeing them: a chair that read as a table, a button whose pointer swallowed it,
and a sticker using the folded corner that already means a design here. The
Canvas batch cost two more, both from colliding with a glyph already in the set —
a magnet drawn as a shield, and a drop shadow that read first as "duplicate" and
then, hatched, as the motion lines on `animations`. `shadows` is the one glyph
that fills and fades, because it is the only one whose subject IS a fill and a
fade; every stroke-only version of it meant something else.

The pattern in every redraw so far is worth stating, since it is not what you
would guess: none was wrong on its own terms. Each had either landed on a glyph
already in the set, or landed on a completely different idiom's meaning.

One rule is worth keeping: **draw what the thing DOES, never the control itself.**
Applied up front, that rule is also what made the Search Panel's six the first
batch to need no redraw at all: six articles about one control, and not one of
them draws a magnifier. They draw what you find — designs in a folder, a team,
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
a star reads as a favourite — so it draws the SCALE, a row part-filled, rather
than the symbol.

The four Arrow guides are the same shape of problem — four articles about arrows, next to an `arrows` family
glyph that is already an arrow — so they draw the three shapes, the handle you
drag, the obstacle, and the other arrow. The Sharing guides ran into it a third
way: the obvious drawing for each was already spoken for somewhere else in the
set — a padlock is `locking`, a chain is `links`, a picture is `images` — so they
draw the password field, the deadline, the page the design sits inside, and the
refresh. And Changing the Theme is the plainest collision of the lot: a wheel of hues
rendered as the `pie-chart` glyph exactly, while `themes` already owned the paint
palette and `custom-themes` owned swatches-with-a-plus, so what was left to draw
was the browsing itself.

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
- **`components/illustrations/<surface>.tsx`**: an editor surface several
  areas show (the Settings dialog in `settings-dialog.tsx`, with the shared
  `Switch`), drawn once and imported wherever it recurs. Files are named after
  their subject, never after the batch of work that produced them.
- **`components/illustrations/<area>-parts.tsx`** — an area's own building
  blocks, when it grows enough of them to interleave with its scenes (the
  Explorer's sidebar row and design card). Distinct from `primitives.tsx`, which is the house style
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

## Header

The help centre's header is the shared `SiteHeader` from `@livedesign/ui`, the same bar marketing and the telemetry dashboard render, so the three read as one product: Brand (hover it for liveworkspace's other sites, the [site switcher](../../../../liveworkspace/docs/site-switcher.md)) on the left, the article search (`SearchInput`) in the header's centre slot from `sm` up, and on the right the same **Start Blank** and **Choose Template** CTA pair the landing page shows (`ctaSurface="Help"`, so its links carry `Help.HeaderBlank` and `Help.Header` for the [Landing funnel](../019-marketing/landing-funnel.md)), Start Blank hidden below `md` (rather than `sm`, as on pages without a centre slot) so the search box keeps room on a small tablet. It leaves the page-edge ShareRail off: the rail sits in the gutter beside a `max-w-6xl` page, and help's pages run `max-w-7xl`, so on an `xl` screen it would cover the article sidebar. It passes `wide`, which gives the bar help's own `max-w-7xl` / `md:px-8` column, so the logo lines up with the breadcrumb and article content below. The bar is a fixed 72px (`h-18`) at every breakpoint, which the sticky breadcrumb bar (`top-18`) and the article sidebar's sticky offset rely on.

## SEO

One rule for every public page, shared with the marketing site ([Marketing site](../019-marketing/marketing-site.md) "SEO and metadata"): per-page metadata comes from `pageMetadata` in `@livedesign/ui`, which help wraps as `helpMetadata({ title, description, path })` only to name itself (`siteName: 'livedesign Help'`).

- **The title passes through as given.** Link previews (`og:title`, `twitter:title`) carry the bare article title, with the site name beside it. The design `<title>` still reads "<Title> | livedesign": the root layout's `title.template` adds the suffix to every child segment, and the help home (the root index, which the template doesn't reach) spells it out as `Help | livedesign`.
- **Canonical and `og:url` are the page's path**, `/help/<categorySlug>/<slug>/`, resolved against the shared origin; `seo-canonical.test.ts` checks every article's path matches its route.
- **Every article and category landing has its own card**: `og:type` article, Twitter `summary_large_image`, with a 1200x630 PNG at `/help/og/<route>.png` (`lib/help-cards.ts`, rendered at build time by `app/og/[...card]/route.tsx` through the shared `renderSocialCard` in `@livedesign/ui`, the one marketing's cards use). The card shows the top category as its kicker (Help Topic on a landing), the title, the registry's card description through `cardSubtitle` (two lines, ending on a whole word) and "Help Centre" in its footer beside the livedesign.app pill. Pages outside the registry (the home, the features index) carry the brand card marketing generates (`/opengraph-image`, `/twitter-image`).
- **The sitemap dates each page by its last commit** (`lib/article-dates.ts`): one `git log` pass over `app/` at build time, page files only, and a landing dated by its newest article. A shallow clone, or no git, leaves `lastModified` out rather than claim every page changed today; the deploy build fetches full history without file contents (`fetch-depth: 0`, `filter: blob:none`) for this.
- **Category landings carry `CollectionPage` structured data** whose `ItemList` names the articles the landing lists, in order (`collectionJsonLd`, rendered by `FeatureCategoryIndex` and by `BrowsePage` given a `listing`). The home carries the `WebSite` node. There is no `SearchAction`: Google retired the sitelinks search box it fed, and help search is not addressable by URL.
- **Breadcrumb structured data** is a `BreadcrumbList` rooted at the help home, built by the shared `breadcrumbJsonLd` (the one marketing's `BreadcrumbJsonLd` uses) and rendered through `JsonLd` from the `Breadcrumb` component.
- **A sub-article's parent crumb and its `TechArticle` url come from its route.** Sub-articles nest under their parent's folder, so the parent is the route one level up and the article's own URL is its route (`lib/article-route.ts`), never rebuilt from the page's `categorySlug` prop, which names the top category on some pages and the parent's path on others. `article-route.test.ts` checks every sub-article sits directly under a real page.
- **Meta descriptions are 50 to 160 characters**, the same range the marketing site holds, so a search result shows each one whole; the article meta is written for the result, not copied from the search card. **Page titles are unique** across articles, static pages and category landings. `meta-descriptions.test.ts` holds every page to both.

## In-editor entry point

The editor's `TabBar` gains a **Help** link on its right edge, beside the existing GitHub link — a plain `<a href="/help/" target="_blank">` (same convention as the GitHub link, no editor-page wiring). It fires `track('UI', 'Opened', 'Help')` (see [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md); reuses existing `UI`/`Opened` enum pair). A "Help" link also lives in the help app's own header/footer.

### Help in global search

The editor's global search panel ([Canvas and palette](../008-canvas/canvas-and-palette.md)) surfaces matching help articles as a
**Help** group, so "how do I…" is answerable without leaving the canvas. The
searchable catalogue (`apps/live/lib/help-search.ts`) is derived from the
**full `@livedesign/help-registry` registry** — every article, matched on its
title plus the registry's description + `keywords` synonyms, resolved to an
absolute `/help` href, with the article's telemetry id ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) Help) as the
click's `UI·Opened` type.
There is no second hand-curated list to keep in sync; adding an article to the
registry makes it findable in the editor automatically. `buildSearchResults`
stays catalogue-agnostic (the surface passes `helpItems`, the same pattern as
palette results), matches on a non-empty query only, caps the group at 6, ranks
it last (navigation and edit results keep the default Enter), and picking one
opens the article in a new tab. Both the editor and the Explorer pass the
catalogue, since help is global. (The `help-articles.ts` deep-link map remains,
but only for surfaces that link ONE article contextually — see [Contextual help links](contextual-help-links.md).)

## Analytics

The help centre emits through the first-party pipeline ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `Help·View·<slug>` per article read, the settled search outcome, article votes, window-level errors, and page views ([Page view telemetry](../017-telemetry/page-view-telemetry.md)). It uses the public sites' shared `siteTrack` from `@livedesign/telemetry-client` (the `NEXT_PUBLIC_TELEMETRY_ENABLED` build gate plus the [User preferences](../007-editor/user-preferences.md) opt-out), the same instance the shared `PageViewBoot` reports page views through, so it runs one buffer. No third-party scripts; off by default, which keeps it self-host-clean.

## Deployment

A `deploy-help` job in `.github/workflows/deploy.yml` mirrors `deploy-marketing` (build artifact → `wrangler deploy`). The router's `deploy-router` job already depends on the static apps; it gains a dependency on `deploy-help`, and `apps/router/wrangler.toml` gains a `HELP` service binding to `livedesign-help`.

## Out of scope (for now)

- Weighted ranking inside the Help group (title hits before keyword hits).
  Matching is a flat case-insensitive substring over title + description +
  keywords, capped at 6; registry order decides ties. Revisit if keyword
  coverage makes the group noisy.

(Previously listed here: surfacing the full article catalogue in editor
search. That shipped — the registry moved to `@livedesign/help-registry` with
per-article `keywords`, and `help-search.ts` now derives from it.)

## articleCount is pinned by a test

A category’s `articleCount` counts every registry entry whose `categorySlug` is exactly that category — **sub-articles included**. It is hand-maintained, and a stale one is invisible: the card simply advertises the wrong number and nothing at runtime notices. `registry-counts.test.ts` pins it, along with two things that were previously only convention: every article sits in a category that exists, and every `parentSlug` names either another article or the category’s own landing page.
