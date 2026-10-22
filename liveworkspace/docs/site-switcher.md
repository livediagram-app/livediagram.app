# The site switcher

Every app's headers carry one way to move between liveworkspace's sites: **hover the logo**. A card
drops down from it, with **liveworkspace.app** at the top and one row for each app below it
(livediagram.app, liveplanner.app). Each row is one click to that site. The app you're on is marked.

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

## The list

`@liveworkspace/sites` (`packages/sites`) holds the list: each site's name, URL, one-line pitch and
accent colour. Every app's switcher reads it, so adding an app is one row there, not an edit in each
app. It lists livediagram, liveplanner, livedocuments and livedesign.
