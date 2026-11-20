# Save Locations

A new document is stored in one of a small set of **save locations**: on the server (livediagram) or in this browser
only (Offline, [Offline Mode](offline-mode.md)). More stores may come (GitHub is plausible). Google Drive is not
one of them: it is a mirror of cloud documents, not a place a document is stored
([Google Drive is a mirror, not a location](#google-drive-is-a-mirror-not-a-location)).

**Nobody is asked.** New Canvas ([Dedicated route for new-document creation](../007-editor/new-document-route.md#no-welcome-step))
asks nothing: every new document is stored in the default location for who is creating it, below. A document
moves between the two afterwards with [Offline Mode](offline-mode.md)'s **Sync Canvas** and **Take Offline**.
(A Location step would be answered with the default by most people before they had anything on the canvas.) A
document kept Offline says what it is on the document itself: the editor header's
**Offline** badge and its legend, [Offline Mode](offline-mode.md#offline-badge--explorer).)

| Location        | What it means                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **livediagram** | A normal cloud document, saved to the api (its Durable Object), reachable from any device.                   |
| **Offline**     | Offline Mode ([Offline Mode](offline-mode.md)): saved only in this browser's IndexedDB, never to the server. |

## The default depends on who is creating

| Who                | Default         |
| ------------------ | --------------- |
| A guest            | **Offline**     |
| A signed-in person | **livediagram** |

Why a guest starts local: [Auth + guest access → Guest documents start local](../014-identity/auth-and-guest-access.md#guest-documents-start-local).

- One function answers it: `defaultSaveLocationFor({ signedIn })` in
  `apps/editor/lib/save-locations.ts`. Every create from `/new` asks it at commit, through
  `resolveSaveLocation` in `useNewDocumentLocation` (`apps/editor/app/new/useNewDocumentLocation.ts`): a plain `/new`
  and its links (`/new?mode=`, `/new?template=`, `/new?blank=1`).
- A `/new?folder=` / `?team=` context names a server place, so it is
  livediagram whoever is creating.
- Before sign-in has answered, `signedIn` is the `ld_signed_in` hint cookie
  ([Who is a guest, before sign-in answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers)).
  A browser that looks signed in waits for its session's own answer before creating, up to 15 seconds, so a
  signed-in person is never handed a document kept Offline; a guest never waits. The page's 5-second give-up on
  sign-in (it then carries on as a guest) is not that answer, or a slow session would make the document Offline.
  Only a known account saves on livediagram; a session that
  still hasn't answered after the wait keeps the document kept Offline, where nothing is lost.
- There is no per-person override: no setting chooses the store. Where a document is **filed** on livediagram is the
  person's to set, in Settings > Explorer > Default Folders ([Default folders](../013-workspace/default-folders.md)).
  The retired `skipLocationStep` preference is not read ([User preferences](../007-editor/user-preferences.md)).

## On the start screen

Nobody is asked, but the start screen offers one switch, **Sync Canvas to Server**, in a quiet strip under its choices
(a mode's start), so a new canvas can change place while it is still empty without a trip to the Explorer. It reflects
where the canvas is **now**, so it starts as the default above: **off** for a guest (Offline), **on** for a signed-in
person (livediagram).

- **The whole row is the switch**, as a Settings row is: a press anywhere on it (its icon, label or line) flips
  it, and it tints on hover. Screen readers still hear one switch, named by the label and described by the line.
- **Turned on** it syncs the canvas in place ([Offline Mode → Syncing in place](offline-mode.md#syncing-in-place)), a
  guest's as their guest id; **turned off** it takes it offline in place
  ([Offline Mode → Taking offline in place](offline-mode.md#taking-offline-in-place)). No confirmation: the canvas is
  empty and nobody else has it, so nothing can be lost. No reload: the person stays on the start screen.
- **While it moves** the switch is busy (a spinner in its knob, `aria-busy`) and its line reads "Syncing to the
  server…" or "Moving to this browser…"; a polite status says the same, then "Synced to the server." or "Moved to
  this browser.". **A failure** shows the conversion's toast (`syncFailureMessage`, or "Couldn’t move this to this
  browser. It stays safe on the server.") and the switch returns to where the canvas still is.
- **The line under the label** follows the state, with a small cloud or browser-window icon beside it:

  | State          | Line                                                                        |
  | -------------- | --------------------------------------------------------------------------- |
  | Off, signed in | Saved in this browser only. Turn on to open it anywhere and share it.       |
  | Off, guest     | Saved in this browser only. Turn on to save it to our servers and share it. |
  | On, signed in  | Saved to your account, on every device.                                     |
  | On, guest      | Saved on liveworkspace servers. Sign in to open it on any device.           |

- **When it shows** (`showsSaveSwitch`): the canvas has loaded and the reader and their sign-in are known; the reader
  owns it and can edit it; it has one tab with nothing on it; it has no live share link, is not open through one and
  is not in a team; nobody else is in it; and the editor is not embedded or in another app's workbench. Anywhere else
  the row is hidden, and with it the strip it sits in and that strip's rule (every app's start screen alike), and the
  Explorer's Sync Canvas and Take Offline stay the way to move it. Once a move has started the
  row stays until it lands.
- **Built once.** The switch (`Switch`) and the row (`SaveSwitch`, `SaveSwitchRow`, its words and `showsSaveSwitch`)
  are `@liveworkspace/ui`'s (`packages/ui/src/Switch.tsx`, `packages/ui/src/save-switch/`), shared by every app. This
  app hands in only its kind's word, what it knows of the open canvas and its two in-place moves
  (`apps/editor/components/start/StartSaveSwitch.tsx`). It reads only state the editor already holds and loads with the
  start's own chunk, so the start screen's first paint makes no request for it.

**In the wizard, before the create.** `/new`'s mode wizard shows the same row under its modes
(`apps/editor/components/start/StartSaveSwitch.tsx`, the shared `SaveSwitchRow`). Nothing exists yet, so it moves nothing: it
starts at the default for who is creating (the settled sign-in, or the hint until it answers) and the create goes
where it says (`resolveSaveLocation`'s `chosen`, null until the person flips it, so a sign-in that answers late still
sets the default). It is drawn once the page runs in the browser, never in the prerender, and is absent when a
`/new?folder=` / `?team=` context names a server place. The new canvas's start then shows the switch again, now
reflecting where the canvas is.

## Choosing a folder

Where a document goes within livediagram is chosen in the shared Explorer
([`@liveworkspace/explorer`](../../../../packages/explorer/README.md)): its Move dialog (`MoveToFolderDialog`,
[Folders](../013-workspace/folders.md)) and its default folder picker ([Default folders](../013-workspace/default-folders.md)),
both over the index's folders. The Move dialog's **New Team** makes a team on the spot, opens it and files the item
in it, offered only to someone signed in ([Teams](../013-workspace/teams.md)). A document kept Offline has no
folder: it is listed on Offline's own page ([Offline Mode](offline-mode.md)).

## The contract for adding a location

A save location is one id in a small module, `apps/editor/lib/save-locations.ts`:

- `SaveLocationId` is the closed union of location ids (`'livediagram' |
'browser'` today).
- `defaultSaveLocationFor` decides which one a new document gets.
- `isOfflineLocation(id)` says whether an id resolves to the browser-only store.
  It is the only place `/new` touches [Offline Mode](offline-mode.md)'s notion of "offline".

Adding a location (say, GitHub) means: a new id in the union, a rule in `defaultSaveLocationFor`
for who gets it, and a create branch in `/new` that hands the document to that store.

The wire between the wizard and `/new` is `NewDocumentSettings.saveLocation:
SaveLocationId`.

## Google Drive is a mirror, not a location

A signed-in person can keep a copy of their own work, from every liveworkspace app, in their own Google
Drive. The document still lives in livediagram (the default location): Drive
holds a copy that liveworkspace keeps in sync, and a Drive
file is never the document's home. So Drive is never a save location, and a document created with
**livediagram** is synced like any other. Canvases kept Offline have no
server copy and are not synced. The sync itself (connection, folder tree,
rename, move, delete to Trash, "Open with") is liveworkspace's, specified in [Google Drive sync](../../../../liveworkspace/docs/specs/005-drive/drive.md), not
here.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`Document` / `Created` carries a `type` naming the store,
`Cloud` for livediagram and `Offline` for the Offline location. A future location adds
its own preset `type`; the location id itself never leaves as content.

## Help centre ([One help centre](../../../../liveworkspace/docs/specs/017-help/help-centre.md))

The Offline Mode article says a guest's new documents start in this browser and a signed-in person's on livediagram,
and how to move one either way. No article of its own: each location's article (offline today) is where the substance
is.

## Implementation map

- `apps/editor/lib/save-locations.ts` (+ test): the ids and helpers above.
- `apps/editor/app/new/useNewDocumentLocation.ts`: `resolveSaveLocation`, the location every create from `/new` uses.
- `apps/editor/components/start/StartSaveSwitch.tsx`: the start screen's Sync Canvas to Server switch, over `@liveworkspace/ui`'s `SaveSwitch` ([On the start screen](#on-the-start-screen)).
- `apps/editor/app/new/page.tsx`: derives the offline create branch from the location id.

## References

See [Dedicated route for new-document creation](../007-editor/new-document-route.md) (`/new`),
[Offline Mode](offline-mode.md) (the browser-only store),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[One help centre](../../../../liveworkspace/docs/specs/017-help/help-centre.md) (help).
