# One help centre: blueprint

Implements [help-centre.md](../help-centre.md).

## The app and its Worker

| Thing             | Value                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| App               | `apps/help` (`@liveworkspace/help`), a Next.js static export built six times into `./dist/<scope>/` |
| Worker            | `liveworkspace-help`, staging `liveworkspace-help-staging`, no `workers.dev` and no preview URLs    |
| Production routes | `www.liveworkspace.app/help*`, `liveworkspace.app/help*`; staging `staging.liveworkspace.app/help*` |
| Apps' routers     | their `HELP` service binding names `liveworkspace-help`, and the forward adds `x-help-app: <app>`   |
| Local port        | 3020 (liveworkspace's block); the routers' `HELP_ORIGIN` and the site's dev server point at it      |
| Deploy            | with the sites (tier 1, before the routers), from full history, with room for six builds            |

`scripts/build-scopes.mjs` builds each scope in turn: it writes `lib/scope.generated.ts` (`SCOPE`),
`lib/bindings.generated.ts` (the scope's appearance key, viewport, boots, social card and telemetry, from
`lib/bindings/<scope>`), `editions/current.generated.ts` (the scope's edition) and `app/scope.generated.css` (its
theme, hero band and print colours), runs `next build`, and moves `out/` to `dist/<scope>/`. A build imports only
its own scope's product packages. The checked-in generated files are livediagram's, so `next dev` works; `pnpm dev`
writes `HELP_SCOPE`'s first. `all` builds first: its `/scope-manifest.json` becomes `dist/manifest.json` (every
article path and landing with its apps, the redirect map, each scope's origin), and each app's export drops the
pages that do not apply to it.

The Worker (`src/worker.ts`, logic in `src/help-scope.ts`) runs first on every request: the scope is `x-help-app`
when it names an app, else `all`; it strips a leading `/help` (liveworkspace.app's routes keep it, the routers strip
it), answers a redirect from the map, answers `308` to the canonical address for an article or landing that does
not apply to the scope (on staging, staging's address), and otherwise serves `/<scope><path>` from its assets, with
the security headers each product's `_headers` file carried and `Vary: x-help-app`. Six copies keep every page
static, with no client-side filtering of a page's content.

## The catalogue

`@liveworkspace/help-registry` holds the one catalogue (it holds the types and helpers today):

```ts
type AppId = 'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign' | 'livehuddle';
type HelpScope = AppId | 'all';

interface Article {
  id: string; // stable, for telemetry and redirects
  slug: string;
  categorySlug: string; // full nested path, as today
  parentSlug?: string;
  title: string;
  description: string;
  keywords: string[];
  apps: AppId[]; // one or more; ordered as APP_ORDER
}

interface Category {
  slug: string;
  title: string;
  apps: AppId[]; // the union of its articles' apps, derived and checked by a test
}
```

- `articlesFor(scope)`, `categoriesFor(scope)` and `searchArticles(query, scope)` filter by `apps`;
  `appliesTo(article, app)` answers the switch's "same path or that app's home".
- `@liveworkspace/help-registry/slice/<app>` exports only that app's articles, for its editor's search panel, so an
  editor never bundles the other apps' entries.
- `@liveworkspace/help-registry/hrefs` stays data-free; `articleHref(article, scope)` builds the address for a
  scope (`https://www.<app>.app/help/…` or `https://www.liveworkspace.app/help/…`).

## MDX components (`@liveworkspace/help-site/mdx-components`)

| Component                      | Renders                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<AppNote app="…">…</AppNote>` | the accented note; open for the scope's app and under All Apps, folded for other apps. `app` may list several (`app="livediagram,liveplanner"`, or an `apps` array): each app's mark in the label, the scope's palette when it is listed, else the first app's |
| `<AppNotesFold />`             | placed by the layout, not by authors: the "How this works in N other apps" row and its notes                                                                                                                                                                   |
| `<SameIn />`                   | placed by the layout: "Works the same in …" for apps with no note                                                                                                                                                                                              |
| `<Noun />`, `<AppName />`      | the scope's word for the work (`noun.ts`) and the app's name; "file" and "every app" for `all`                                                                                                                                                                 |
| `<Figure app="…" />`           | a figure for the listed apps' helps only (comma list); `app="all"` for All Apps' slate variant; no `app`, everywhere                                                                                                                                           |
| `<AppliesTo />`                | the header's logo row (`BrandGlyph`), current app first and ringed                                                                                                                                                                                             |

Note palettes come from each app's brand ramp (`@liveworkspace/brand` `BRAND_APPS`): background brand-50, border
brand-200, label brand-700, text brand-900, dark mode the 950/800/300/100 steps.

## The app switch

`AppSwitch` in `@liveworkspace/help-site`, rendered by `SearchInput` inside its box: one trigger and a menu
(`role="menu"`, items `menuitemradio`), every
item an `<a href>` built by `articleHref`/`appliesTo`. Keyboard: Enter or Space opens, arrows move, Escape closes
and returns focus to the caret (the shared `useMenu`/`useMenuButton`). The server renders same-path links; once
hydrated the switch reads the page's apps from `[data-help-applies]` (the article layout and the landings write it)
and links a page that does not apply to the target's home, and the Worker's `308` covers it without script.
`SearchInput` has three placements: `large` (the home hero), the header's (shown from `sm`, by `SiteHeader`'s
centre slot, and rendering nothing on the home, `/`), and `bar` (`PhoneSearchBar`, the row under the header below
`sm`, also nothing on the home). The trigger names the scope in the row, from `sm` in the hero and from `lg` in the
header, and shows the mark alone below those. On a phone the menu is a bottom sheet.

The search query rides along: `SearchInput` publishes its trimmed text, and `AppSwitch` (and **Search All Apps
instead**) append `?q=<encoded>` to every href while it is non-empty, updated on input (no navigation, no
re-render of the page). On load, `SearchInput` reads `q`, fills itself, opens its results for the page's scope and
removes `q` from the address with `history.replaceState`, so a reload or a shared link does not reopen them. `q` is
capped at 200 characters; the canonical and the static export ignore it.

## Canonicals and redirects

- `helpMetadata` sets `canonical` from `apps`: one app, that app's `www` address; more, `www.liveworkspace.app`.
- A scope's export omits articles that do not apply to it; its Worker answers their paths with `308` to the
  canonical address.
- `@liveworkspace/help-registry` `catalogue/redirects.ts` (`HELP_REDIRECTS`) maps every old path whose article
  moved, merged or retired (the products' `_redirects` files and their moved-page stubs, liveworkspace.app's old
  /help pages) to its new path, a fragment or an absolute address; `apps` limits one to those apps' addresses. The
  help Worker answers them `308` from the manifest, before anything else.

## Telemetry

Help keeps the vocabulary each app's help already sends (`Help·View`, `Help·Searched`, `Help·Helpful`,
`Help·Unhelpful`, by article id or search outcome) and adds `Help·Changed·Scope.<scope>` for the app switch. The
scope is the batch's sender: an app's help sends as that app (it is served on the app's address, through the app's
own `siteTrack`, so the app's opt-out holds); All Apps sends as `liveworkspace.app`, which the ingest accepts for
these events alone (`@liveworkspace/telemetry` `isPlatformHelpTelemetryEvent`), and sends nothing when the browser
asks sites not to track (Global Privacy Control or Do Not Track).

## Performance

- Pages stay static: no per-request rendering, CDN-cached per scope.
- Each build serves `search-index.json` with its scope's articles (in its wording, no bodies), fetched when the search
  box first gets focus, hover or a keystroke; `search-all.json` (every article) loads lazily, only once the panel is
  open with a query, to fill "From other apps". All Apps fetches its one index. `lib/search-index.test.ts` caps each
  index in bytes. The article layout reads its URL and its parent's off the route and imports only
  `@liveworkspace/help-registry/hrefs`, so a page that only builds links never bundles the catalogue.
- `BrandGlyph` rows are stateless SVG with no gradients or motion; a results list of 50 rows pays for paths only.
- Six static exports multiply build time and output size by six: the build is timed in CI, and a test caps
  `out/` size.

## Pages, art and checks carried from the product help apps

Written once for the one centre (`@liveworkspace/help-site` owns the code, `apps/help` the content and bindings).

- **Home.** `HelpHomeLayout` per scope reads `HOME` in `lib/home-sections.ts` (`sections`, `startHere` with its
  `steps`, `stillStuck`, `popular`); `HelpHome` draws it. The shared suite (`help-site.test.ts`) checks every category
  of the scope appears in exactly one section and every popular chip and step names a real article.
- **Category pages.** `FeatureCategoryIndex` renders one card grid per group under a heading via `getCategoryGroups`
  (buckets by the article's `group`, in the category's `groups` order, else first appearance; landings without a
  `group` form one ungrouped grid), and the sticky jump list from `lg`. Categories of 12 or fewer cards stay one grid.
- **Hero band.** `packages/ui/hero-band.css` (shared with marketing) draws the canvas wash; `HelpHero` uses it.
- **Scenes.** One file per category in `components/category-art/<slug>.tsx`, mapped by `components/category-art/index.tsx`
  (an unknown slug renders nothing). The stage is 400 by 220 with the dotted ground extended past its edges. Scenes
  the same in several apps are drawn once in `packages/help-site/src/art/scenes/<slug>.tsx` and take the app's content
  as props, the app file binding them; Tabs, Developers and Supported Devices (the same in livediagram and livehuddle)
  live in `src/art/diagram/<slug>.tsx`. Scenes use `brand-*` classes and `var(--color-brand-*)`.
- **Art kit and figures.** `src/art/primitives.tsx` (`Scene`, `Shape`, `Arrow`, `SelectionBox`, `Cursor`, `Avatar`,
  `Panel`, `Dialog`, `Button`, `Tabs`, `Menu`, `Tile`, `Label`, `TextBar`, `BarTab`) and `src/art/parts.tsx` hold the
  house style once. A figure the same in every app that shows it lives in `src/art/illustrations/<area>.tsx` (imported
  as `@liveworkspace/help-site/art/illustrations/<area>`, product words as props such as `product` and `noun`: `<StuckCanvas noun="canvas" />`,
  `<CliConsent product="livediagram" noun="canvas" />`); one that shows an app's own work, words or palette stays under
  `components/illustrations/<area>.tsx` as named scene components, with `<area>-parts.tsx` only when an area has
  enough private building blocks to interleave with its scenes, and `<surface>.tsx` for an editor surface several
  areas show (the Settings dialog with the shared `Switch`). Files are named after their subject, never after a batch
  of work. `src/components/Figure.tsx` frames a scene as `<Figure caption="...">` (registered in the MDX components).
  Branch hues beyond the brand come from the on-brand accent set (emerald, violet, amber, rose, teal, indigo) that
  `featureColours` uses.
- **Card icons.** `lib/featureIcons.tsx` (glyph) and `lib/featureColours.ts` (hue) are key-for-key identical, tested;
  `featureIcon(slug, categorySlug)` and `featureColour(...)` resolve the feature's entry, then its category's (first
  slug segment, `topCategorySlug`), then the neutral default, shared by category cards and the MDX `<Feature>` tile.
  Support cards use `ArticleCard` with `SUPPORT_ARTICLE_ICONS` (`lib/articleIcons.tsx`). `feature-icons.test.ts` and
  `help-site.test.ts` fail on a card with no glyph of its own, naming the slug, and read which browse pages number
  their cards instead of hardcoding Getting Started.
- **Search box.** `SearchInput` takes `/` (not from a text field or with a modifier), shows the `/` hint while empty and
  not on touch, closes on `Escape` then leaves on a second; the results container is a region named Search results with
  a polite live region ("3 articles found"). `searchArticles` implements the ranking in the spec; the keywords test
  fails an article without them.
- **Metadata.** `helpMetadata({ title, description, path })` wraps `pageMetadata` (`@liveworkspace/ui`) naming
  `siteName`; `featuresMetadata(site)` builds the Features index description (checked by `lib/features-page.test.ts`);
  cards come from `src/lib/help-cards.ts` through `app/og/[...card]/route.tsx` and the shared `renderSocialCard`
  (1200x630, `/help/og/<route>.png`); dates from `src/lib/article-dates.ts` (one `git log` pass over `app/`, page
  files only); `collectionJsonLd` (rendered by `FeatureCategoryIndex` and by `BrowsePage` given a `listing`),
  `breadcrumbJsonLd` through `JsonLd` from `Breadcrumb`; parent crumb and `TechArticle` url from
  `src/lib/article-route.ts`. Tests: `seo-canonical.test.ts` (every article's path matches its route; the canonical
  follows `apps`), `meta-descriptions.test.ts` (50 to 160 characters, unique titles), `article-route.test.ts`.
- **Header.** `SiteHeader` (`@liveworkspace/ui`) with `wide`, no ShareRail, a fixed 72px (`h-18`) at every breakpoint,
  the app's `ctaSurface="Help"` pair in an app's scope, Start Blank hidden below `md`.
- **Moved stubs.** Terms and Privacy stubs under `/help/policies/...` bind `@liveworkspace/help-site/lib/moved`
  (thin `noindex` client redirects), listed with the other retired paths in `HELP_REDIRECTS`.
- **Retired articles.** `lib/retired-articles.test.ts` pins every redirect target to a live page and keeps live
  articles and categories from being redirected away; a retired category's whole subtree maps to the help home.
- **Repair tool.** `BrowserRepairTool` renders the shared `BrowserRepairPanel` plus the browser checks on the
  Repair This Browser article.
- **Editors' search.** Each editor builds its Help group from `@liveworkspace/help-registry/slice/<app>` (every
  article of the app, title plus description plus keywords, absolute `/help` href, the article's telemetry id as the
  `UI·Opened` type); `buildSearchResults` stays catalogue-agnostic (the surface passes `helpItems`), matches a
  non-empty query only, caps the group at 6 and ranks it last. The editor and the Explorer both pass it.
- **Article count.** `help-site.test.ts` pins every category's count (sub-articles included), that every article sits
  in an existing category and that every `parentSlug` names an article or the category's own landing.
- **Article rendering.** Sections (tinted bands between `##` headings) are grouped at render time so the static HTML
  has them, and the reading-time row reserves its height.
- **Deploy.** Built from full history (`fetch-depth: 0`, `filter: blob:none`) so the sitemap dates each page by its last
  commit; a shallow clone leaves `lastModified` out.

## Tests

- Registry: every article names at least one app; every category's `apps` equals its articles' union; slugs are
  unique per path; each app's article count is pinned.
- Switch: for each scope and a sample of articles, every menu item's href follows the rule (same path when it
  applies, the target's home when not, liveworkspace.app for All Apps).
- Query carry: with text in the search box every switch href carries `q`; without, none does; a page loaded with
  `q` shows the query and its results and drops `q` from the address.
- Notes: an `<AppNote>` for an app the article does not apply to fails the build.
- Canonicals: every article's canonical matches its `apps`.
- Redirects: every path of the five old registries answers 200 or a 308 that lands on a 200.
- Routers: each app router's test covers `/help` and `/help/...` forwarded over the `HELP` binding with `x-help-app` set to its app.
- Repo-paths and style guards in `@liveworkspace/help-site` run over the one content tree.

## Migration

1. Build `apps/help` with the catalogue, components and switch; import the 976 articles grouped by path.
2. Merge each near-identical set (the 173) into one article: the common text, `apps` set, each product's
   differences as `<AppNote>`s, product nouns as `<Noun />`.
3. Merge the 45 similar sets the same way, by hand.
4. Product-only articles move over with `apps: [<app>]`.
5. Point each app's router `/help` at the `HELP` service binding with the `x-help-app` header; generate and test the redirect map.
6. Remove `<product>/apps/help` and their Workers from the deploy; retire each `018-help` product spec folder to a
   pointer at this spec; update the help-loop skill, README and docs/structure.md trees.
