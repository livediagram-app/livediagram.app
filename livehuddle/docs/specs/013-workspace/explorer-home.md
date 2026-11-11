# Explorer Home

**Home** is the shared Explorer's landing view (`/explorer`, `/explorer/home`), read from liveworkspace's index. It
answers the question a returning person brings, in one screen: "what was I working on?". Its sections are the hero, **New** (the four Spaces made most recently in this app, newest first, mine and my teams', made by AI ones included, wearing Made by AI; hidden while there are none: [One Explorer "New, on Home"](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#new-on-home)), **Jump Back In** (Most Used: up to eight items you opened in the last 14
days, the most opened first, then Recent: up to eight of your most recently opened, from every app, four across in two
rows on a desktop and one strip of up to eight on a phone, each with a line such as "Opened 12 times" or "Opened 2
hours ago"), and **Shared With You Recently**. Home's What Happened is retired
([History](history.md)): what happened to one item is its History. The view, its states and its telemetry are the package's
([`@liveworkspace/explorer`](../../../../packages/explorer/README.md)).

## What livehuddle gives it

- **Its words.** On livehuddle's address the hero greets by the reader's local hour, then asks "who are you
  meeting today?" (`heroWords` for the Space kind), its status pill counts Spaces in every space the person is in (My Work and each team, each Space once), and its search field's button
  is **New Space**, the `/new` flow ([Explorer structure](explorer-structure.md#what-livehuddle-lends-it)).
- **What it makes.** The hero shows livehuddle's four Spaces, a **Virtual Office**, a **Team Pod**, a **Coworking
  Space** and an **All-Hands Hall**, each its floor plan with a few avatars in it, drawn in livehuddle's green, that
  starts one (`/new?template=` `virtual-office`, `team-pod`, `coworking-space`, `all-hands-hall`), laid out as every
  app's are ([one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) "What you can make, on
  Home's hero"). Blank Space, the catalogue's fifth template, is the hero's New Space. Under All Apps livehuddle's
  tile is the Virtual Office, named **Space**. `apps/editor/lib/explorer-work-kinds.test.ts` holds every kind to a
  template `/new` opens ([Templates by mode](../007-editor/templates-by-mode.md)).
- **The first run.** When Home finds nothing yet, the shared Explorer shows its welcome in place of empty lists, from
  livehuddle's welcome manifest (`packages/templates/welcome.json`, the package's `./welcome.json` export: the blanks and Popular templates it offers
  to start from), loaded once, only then. The manifest is written beside the template catalogue by
  `packages/template-previews/src/welcome-manifest.test.ts` (`WELCOME_WRITE=1` writes it; without, the test fails
  when the file has drifted).
- **Its Help article.** Home's Help button opens livehuddle's Home article (`explorerHelpHref`).

## Hiding the banner

The hero's close belonged to the workbench frame's Explorer, which went with the CLI
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)). The Explorer at
`/explorer` is liveworkspace's, and its banner is liveworkspace's to show or hide.

## Opens

What livehuddle does is say when a canvas is opened. The editor's first-tab read carries `X-Document-Open: 1`
(never in an embed; `DOCUMENT_OPEN_HEADER` in `packages/api-schema/src/home.ts`, beside the 90-day use window), and the api records the open with the index (`POST /items/:id/open`, debounced there to one
write a minute; `apps/api/src/routes/document-subresource-routes.ts`). Making a canvas is a use of it too, recorded
beside the create unless it came in a bulk import. The index keeps the time for Recent and counts the open on that day
for Most Used (opens over the last 14 days), and Jump Back In reads both in one request. A canvas opened from This Browser is recorded in this browser
only (`apps/editor/lib/offline/offline-opens.ts`), in the This Browser list the Explorer reads, so Jump Back In can
show it too ([Offline Mode](../006-document/offline-mode.md)).

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Items". The Explorer that shows
it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
