# The site switcher

Every app's headers carry one way to move between liveworkspace's sites: **hover the logo**. A card
drops down from it, with **liveworkspace** at the top and one row for each app below it
(livediagram, liveplanner, livedocuments, livedesign). Each row names the site without ".app", with
its one-line pitch under it, and is one click to that site. The app you're on is marked.

It replaced each app's section switcher, the "Home / Editor / Explorer / Help / …" menu beside the
logo (October 2026). An app's own surfaces are still linked from its pages: the header's call to
action, the footer, and the Explorer's footer row.

## Where it shows

The header of every public page (`SiteHeader`: marketing, help, community, licences), the
Explorer's header and the editor's header in each app, and the telemetry dashboard on
liveworkspace.app.

## How it behaves

- **Pointer**: hovering the logo opens the card; a chevron fades in beside the logo to say so.
  Clicking the logo itself still goes to the app's home, as before.
- **Touch**: there is no hover, so the chevron is always shown, and a tap on it opens the card.
  A tap outside closes it.
- **Keyboard**: the chevron is a menu button. Tab reaches it after the logo; Enter, Space or an
  arrow opens the card with focus on the first site, arrows move between sites, Escape closes it
  and returns focus to the chevron.
- Sites are plain links to each site's own origin (`https://www.livediagram.app`, …; app links always use `www.`), since every site
  is a different origin.

## On an Explorer page

On the Explorer (`/explorer` and every view under it, on liveworkspace.app and on each app's own
address), the switcher keeps you on the Explorer: each app's row goes to **that app's Explorer at
the same view** (`livediagram.app/explorer/timeline` → `liveplanner.app/explorer/timeline`), and
liveworkspace's row to liveworkspace.app's Explorer at that view, in no app (every app's work). The
app whose address the page is on is the one marked; on liveworkspace.app it is liveworkspace.

- **What carries over**: the path under `/explorer` and the query (`?id=` of a folder or team,
  `?q=` of a search or lens, `?settings=`). Folders and teams are the account's, not an app's
  ([one-explorer.md](../004-index/one-explorer.md)), so their ids open on every app.
- **What doesn't**: the query that only speaks on arrival or hands over to one app (`from`,
  `ended`, `trashed`, `title`, `convert`, `item`), and the hash. A view the target doesn't have
  opens its Explorer's Home instead: This Browser (`/explorer/offline`) on liveworkspace.app, which
  can't read an app's offline list, and an app's Image Gallery (`/explorer/images`) or Shape
  Libraries (`/explorer/shape-libraries`) where it keeps none (the registry's `imagesPath` and
  `shapeLibrariesPath` say which apps do; liveworkspace.app shows the last app's).
- **How**: `explorerSwitchHref(pathname, search)` in `@liveworkspace/sites` turns the page's
  address into each site's link (null off the Explorer), and the shared `SiteSwitcher` takes it as
  `hrefFor`. Only the Explorer's header passes it; every other header's switcher still goes to each
  site's home. The links are worked out from the address the page already has, once per move
  within the Explorer: no request.

## The list

`@liveworkspace/sites` (`packages/sites`) holds the list: each site's name, URL, one-line pitch and
accent colour. Every app's switcher reads it, so adding an app is one row there, not an edit in each
app. It lists livediagram, liveplanner, livedocuments and livedesign.

Running locally, every link between the sites stays on this machine: `siteUrl` gives each site its
port block's first port (`LOCAL_PORTS`: liveworkspace 3000, livediagram 3100, liveplanner 3200,
livedocuments 3300, livedesign 3400, as in the root AGENTS.md) whenever a dev server renders it
(`NODE_ENV=development`), and its live address in a build. The switcher, the landing page, the app
footers' liveworkspace links and the Explorer's cross-app items all read it.

Every app shows **the same switcher**: one copy, `SiteSwitcher` in `@liveworkspace/ui`
(`packages/ui/src/SiteSwitcher.tsx`), which each app's UI package binds to its app's prism (its own
`SiteSwitcher.tsx`), so a change to it is a change to all. All four apps have it. On a phone (below `sm`) the card hangs from
the logo, which every header sets on the 16px left gutter, and spans the screen to the right gutter
(`100vw` less both). It is never `position: fixed`: the headers' backdrop blur makes the header the
box a fixed child is placed in, which once put the card above the top of the screen.
