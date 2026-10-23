# Explorer Home

**Home** is the shared Explorer's landing view (`/explorer`, `/explorer/home`), read from liveworkspace's index. It
answers the two questions a returning person brings, in one screen: "what was I working on?" and "what happened
while I was away?". Its sections are the hero, **Jump Back In** (Most Used: the items you used on the most days in the
last 90, then your most recently opened, up to eight from every app, each with a line such as "Used on 6 days" or
"Opened 2 hours ago"), **Shared With You Recently** and **What Happened** (what other people did to what you can
open, from the [Timeline](timeline.md)). The view, its states and its telemetry are the package's
([`@liveworkspace/explorer`](../../../../packages/explorer/README.md)).

## What livediagram gives it

- **Its words.** On livediagram's address the hero greets by the reader's local hour, then asks "what are you
  drawing today?" (`heroWords` for the Canvas kind), its status pill counts canvases, and its search field's button
  is **New Canvas**, the `/new` flow ([Explorer structure](explorer-structure.md#what-livediagram-lends-it)).
- **Its hero art.** On liveworkspace's page livediagram ships no hero manifest, so the hero's right column is empty.
  In a workbench's workspace frame (`apps/editor/app/embed/workbench/ExplorerHost.tsx`) the hero draws three template
  previews, loaded with Home's hero rather than with every Explorer page.
- **The first run.** When Home finds nothing yet, the shared Explorer shows its welcome in place of empty lists, from
  livediagram's welcome manifest (`packages/templates/welcome.json`, the package's `./welcome.json` export: the blanks and Popular templates it offers
  to start from), loaded once, only then. The manifest is written beside the template catalogue by
  `packages/template-previews/src/welcome-manifest.test.ts` (`WELCOME_WRITE=1` writes it; without, the test fails
  when the file has drifted).
- **Its Help article.** Home's Help button opens livediagram's Home article (`explorerHelpHref`).

## Hiding the banner

In the workbench frame the hero can be closed. The close is reported (`UI·Toggled·HomeBannerOff`), then written to
the synced `homeBanner` preference, so the hero stays hidden for the person on every device until they turn it back
on in Settings.

## Opens

What livediagram does is say when a canvas is opened. The editor's first-tab read carries `X-Document-Open: 1`
(never in an embed), and the api records the open with the index (`POST /items/:id/open`, debounced there to one
write a minute; `apps/api/src/routes/document-subresource-routes.ts`). Making a canvas is a use of it too, recorded
beside the create unless it came in a bulk import. The index keeps the time for Recent and the day as a use day for
Most Used, and Jump Back In reads both in one request. A canvas opened from This Browser is recorded in this browser
only (`apps/editor/lib/offline/offline-opens.ts`), in the This Browser list the Explorer reads, so Jump Back In can
show it too ([Offline Mode](../006-document/offline-mode.md)).

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows
it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
