# One help centre: blueprint

Implements [help-centre.md](../help-centre.md).

## The app and its Worker

| Thing             | Value                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| App               | `apps/help`, Next.js static export (`./out`), built on `@liveworkspace/help-site`                    |
| Worker            | `liveworkspace-help`, staging `liveworkspace-help-staging`, no `workers.dev` and no preview URLs     |
| Production routes | `www.liveworkspace.app/help*`; each app's router reaches it through the workspace proxy, not a route |
| Local port        | 3020 (liveworkspace's block); the site's dev server forwards `/help` to it                           |
| Deploy            | the monorepo deploy's second tier, from full history (the sitemap dates articles by last commit)     |

`@liveworkspace/sites/workspace-proxy` gains `/help`, `/help/…` and their `.txt` payloads, forwarded with the
header `x-help-app: <app id>`, no cookies, `no-store`. The help Worker renders one prebuilt page per scope: the
export holds `out/<scope>/help/…` for the six scopes (five apps and `all`), and the Worker picks the folder from
`x-help-app` (absent on liveworkspace.app, meaning `all`). Six copies keep every page static and cacheable by
the CDN per scope, with no client-side filtering of a page's content.

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

| Component                      | Renders                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `<AppNote app="…">…</AppNote>` | the accented note; open for the scope's app and under All Apps, folded for other apps          |
| `<AppNotesFold />`             | placed by the layout, not by authors: the "How this works in N other apps" row and its notes   |
| `<SameIn />`                   | placed by the layout: "Works the same in …" for apps with no note                              |
| `<Noun />`, `<AppName />`      | the scope's word for the work (`noun.ts`) and the app's name; "file" and "every app" for `all` |
| `<Figure app="…" />`           | the scope's variant of a figure, falling back to the slate shared one                          |
| `<AppliesTo />`                | the header's logo row (`BrandGlyph`), current app first and ringed                             |

Note palettes come from each app's brand ramp (`@liveworkspace/brand` `BRAND_APPS`): background brand-50, border
brand-200, label brand-700, text brand-900, dark mode the 950/800/300/100 steps.

## The app switch

`AppSwitch` in `@liveworkspace/help-site`: two segments and a menu (`role="menu"`, items `menuitemradio`), every
item an `<a href>` built by `articleHref`/`appliesTo`. Keyboard: Enter or Space opens, arrows move, Escape closes
and returns focus to the caret. Phone width: the scope's chip under the header, the menu as a bottom sheet.

The search query rides along: `SearchInput` publishes its trimmed text, and `AppSwitch` (and **Search All Apps
instead**) append `?q=<encoded>` to every href while it is non-empty, updated on input (no navigation, no
re-render of the page). On load, `SearchInput` reads `q`, fills itself, opens its results for the page's scope and
removes `q` from the address with `history.replaceState`, so a reload or a shared link does not reopen them. `q` is
capped at 200 characters; the canonical and the static export ignore it.

## Canonicals and redirects

- `helpMetadata` sets `canonical` from `apps`: one app, that app's `www` address; more, `www.liveworkspace.app`.
- A scope's export omits articles that do not apply to it; its Worker answers their paths with `308` to the
  canonical address.
- `redirects.generated.ts` maps every old path of the five product registries whose article moved or merged to its
  new path; the routers answer them `308` before the proxy.

## Telemetry

Help events (`help_view`, `help_search`, `help_switch_scope`, `help_feedback`) go to the telemetry Worker
([008-telemetry](../../008-telemetry/README.md)) with `scope`, `articleId` where there is one, and for
`help_switch_scope` the `from` and `to` scopes.

## Performance

- Pages stay static: no per-request rendering, CDN-cached per scope.
- The search box keeps loading the catalogue on first focus, hover or keystroke; the scope's slice only, the All
  Apps index on liveworkspace.app or after **Search All Apps instead**. A size test caps each slice and the full index.
- `BrandGlyph` rows are stateless SVG with no gradients or motion; a results list of 50 rows pays for paths only.
- Six static exports multiply build time and output size by six: the build is timed in CI, and a test caps
  `out/` size.

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
- Proxy: `workspace-proxy.test.ts` covers `/help` for all five routers.
- Repo-paths and style guards in `@liveworkspace/help-site` run over the one content tree.

## Migration

1. Build `apps/help` with the catalogue, components and switch; import the 976 articles grouped by path.
2. Merge each near-identical set (the 173) into one article: the common text, `apps` set, each product's
   differences as `<AppNote>`s, product nouns as `<Noun />`.
3. Merge the 45 similar sets the same way, by hand.
4. Product-only articles move over with `apps: [<app>]`.
5. Point each app's router `/help` at the workspace proxy; generate and test the redirect map.
6. Remove `<product>/apps/help` and their Workers from the deploy; retire each `018-help` product spec folder to a
   pointer at this spec; update the help-loop skill, README and docs/structure.md trees.
