# One help centre

liveworkspace runs one help centre for every app. It is built once, by `apps/help`, and shown at
`www.liveworkspace.app/help` and at each app's own `/help`, the way the Explorer is
([one-explorer.md](../004-index/one-explorer.md#4-the-explorer-is-built-once-by-liveworkspaceapp-and-shown-at-every-apps-address)).
An article about something the apps share is written once; where an app works differently, the article says so in a
note marked with that app's logo.

## Why

Each product had its own help app: five Next.js apps, ten Workers (each with staging), five registries and five
telemetry streams, with 976 articles between them. Measured on main (2026-11-19): 173 subjects appeared in two to
five products as articles more than 90% identical once the product's name was swapped, 696 files that were really
173 articles. Another 45 subjects were 70 to 90% alike: the same feature with a product's details. Most were platform
features (sharing, roles, teams, Community, tabs, the Explorer, the Trash, signing in, MCP, dark mode, the command
palette, the audit log), so every platform change meant five help edits, and the copies drifted. A reader who
used two apps searched two help centres. One centre holds about 450 articles.

## Where it is shown

| Address                                   | Shows           | Colours and header                         |
| ----------------------------------------- | --------------- | ------------------------------------------ |
| `www.<app>.app/help/…` (each of the five) | that app's help | the app's palette, logo and header buttons |
| `www.liveworkspace.app/help/…`            | All Apps        | liveworkspace's slate, its logo            |

The address decides the scope, so a link always opens the same view and there is no hidden state. Each app's router
answers `/help` and `/help/…` by fetching the same page from liveworkspace.app with the app named, through the
shared workspace proxy (`@liveworkspace/sites/workspace-proxy`), so the address bar keeps the app's name and there is
no redirect. The page's build assets come from liveworkspace's asset prefix, as the Explorer's do.

## Choosing an app

Every page carries the **app switch**, in the home's search box and in the header's search on other pages: a
segment naming the current scope with a caret, and an **All Apps** segment. The caret opens a menu of three groups:
**This App** (the app whose address this is, ticked), **All Apps** (with its guide count), and **Another App** (the
other apps, each with its logo and guide count). On liveworkspace.app the first segment reads **Choose App** and
**All Apps** is selected.

Choosing moves the reader, never just the filter:

- **All Apps** goes to the same path on `www.liveworkspace.app/help`.
- **Another app** goes to the same path on that app's address when the page applies to that app, or to that app's
  help home when it does not.
- **This app** from liveworkspace.app goes to the same path on that app's address, by the same rule.

**A search survives the move.** When the search box holds a query, the move carries it (`?q=<query>`), and the
page it lands on opens with the same query in its search box and its results showing, scoped to the new address.
So a reader can type, see few results, switch to another app or All Apps and keep reading without retyping.
**Search All Apps instead** at the foot of the results is the same move.

The switch is links (`<a href>`), so it works without script, opens in a new tab and is crawlable; with script, the
links' `q` follows the search box as the reader types.

## Articles and the apps they apply to

Every article names the apps it **applies to** in the registry (`apps`, one or more app ids). An app's help shows
only the articles that apply to it; All Apps shows every article.

- **The logos.** An article's header shows, at its top right, an **Applies To** row of the apps' marks (the Living
  Prism, `BrandGlyph` from `@liveworkspace/brand`, stateless and without motion), the current app's first and ringed
  in its accent, with a line under it ("Every liveworkspace app", or the apps' names). An article for one app shows
  that app's mark alone. A category card's illustration carries the same row, small, in its top right corner, with
  "All apps", "N apps" or "+N", when the category holds shared articles. Search results show it at the row's end.
- **App notes.** Inside an article, an `<AppNote app="…">` block holds what is true for one app only. It is drawn as
  an accented box in that app's palette: a light tint of the app's brand, a border of the same hue, the app's mark at
  its start and "In <app>" as its label. In an app's help that app's notes are open, the other apps' notes fold into
  one closed row ("How this works in N other apps", with their marks). Under All Apps every note is open, in the
  registry's app order. Apps an article applies to that have no note are listed in one quiet line ("Works the same
  in livedocuments and livedesign").
- **The work's name.** Shared copy names the work with `<Noun />` (and `<Noun plural />`, `<Noun capital />`), which
  reads canvas, plan, document, design or Space for the current app and "file" under All Apps, the words the
  Explorer uses. Product names in shared copy come from `<AppName />`.
- **Figures** may carry one variant per app; a page shows the current app's, and a shared figure in liveworkspace's
  slate where an app has none.
- **Read It In.** An article for more than one app lists those apps in its Contents card under **Read It In**, the
  current one marked Reading, each a link to the article on that app's address.

## The home pages

- **An app's home** keeps the layout its help has today ([livediagram help-pages.md](../../../../livediagram/docs/specs/018-help/help-pages.md)):
  the hero with the guide count, search and Popular chips; Start Here with its scene and steps; the About and Tips
  and Tricks cards beside it; the app's category sections, each card with its scene; and the dark Still Stuck band.
  Each app keeps its own home layout (`HelpHomeLayout`), now naming categories from the one catalogue.
- **The All Apps home** (`www.liveworkspace.app/help`): "Help for every app", the guide count across apps, search
  and Popular chips; **Pick an App**, five tiles each with its mark on a band in its palette, its line and its guide
  count, linking to its help; **New to liveworkspace?** (Start Here for the account, the Explorer, connected files
  and sharing); **Written once, for every app**, the shared categories with their scenes in slate and the five-app
  row; and Still Stuck.

## Search

One index of every article. In an app's help, results that apply to the app come first under **In <app>**, then up
to three under **From other apps**, each marked with its app; the panel's foot links **Search All Apps instead**
(the same query on liveworkspace.app). Under All Apps, results are one list, each with its apps' marks. The editors'
search panels search only their app's slice of the catalogue.

## Addresses, canonicals and the old paths

- An article's path is `/help/<categorySlug>/<slug>/`, the same on every address it applies to.
- **Canonical.** An article for one app is canonical on that app's `www` address. An article for two or more apps is
  canonical on `www.liveworkspace.app/help/…`, and the app copies point there, so search engines index one page.
- An app address asked for an article that does not apply to it answers `308` to the article on its canonical
  address.
- Every old help path keeps working: where merging moved an article, its old path answers `308` to the new one on
  the same address. The redirect map is generated from the merge and tested, every path of the five old registries
  answering 200 or a 308 that lands on a 200.

## Telemetry

One stream. Each help event carries `scope` (an app id, or `all`) and, where it is about an article, the article's
id, so one dashboard reads every app's help and each app's alone.

## Roles

The help centre is public and has no roles: it shows the same to signed-in people, guests and the signed out.

## What goes

The five product help apps (`<product>/apps/help`), their Workers and staging Workers, their help registries'
articles (each product's `packages/help-registry` keeps only what its editor's contextual help links need, over
the one catalogue) and their `018-help` specs, whose rules move here. The help-loop audits the one centre.

## Out of scope

- A help centre for the platform's own pages beyond the All Apps home (accounts, billing): none exist yet.
- Translations.
