# Save Locations

A new document is stored in one of a small set of **save locations**: on the server (livediagram) or in this browser
only (This Browser, [Offline Mode](offline-mode.md)). More stores may come (GitHub is plausible). Google Drive is not
one of them: it is a mirror of cloud documents, not a place a document is stored
([Google Drive is a mirror, not a location](#google-drive-is-a-mirror-not-a-location)).

**Nobody is asked.** The New Canvas wizard ([Dedicated route for new-document creation](../007-editor/new-document-route.md#one-step-wizard))
has no Location step: every new document is stored in the default location for who is creating it, below. A document
moves between the two afterwards with [Offline Mode](offline-mode.md)'s **Sync Canvas** and **Take Offline**.
(The wizard used to end on a Location step with a Save location chooser, a tile per location, the This Browser
data-loss warning and a folder browser; it was removed, as most people answered it with the default before they had
anything on the canvas. A document in This Browser still says what it is on the document itself: the editor header's
**This Browser** badge and its legend, [Offline Mode](offline-mode.md#this-browser-badge--explorer).)

| Location         | What it means                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **livediagram**  | A normal cloud document, saved to the api (its Durable Object), reachable from any device.                   |
| **This Browser** | Offline Mode ([Offline Mode](offline-mode.md)): saved only in this browser's IndexedDB, never to the server. |

## The default depends on who is creating

| Who                | Default          |
| ------------------ | ---------------- |
| A guest            | **This Browser** |
| A signed-in person | **livediagram**  |

Why a guest starts local: [Auth + guest access → Guest documents start local](../014-identity/auth-and-guest-access.md#guest-documents-start-local).

- One function answers it: `defaultSaveLocationFor({ signedIn })` in
  `apps/editor/lib/save-locations.ts`. Every create from `/new` asks it at commit, through
  `resolveSaveLocation` in `useNewDocumentLocation` (`apps/editor/app/new/useNewDocumentLocation.ts`): a mode chosen
  in the wizard, its **Create** and **Skip**, and the wizard-less links (`/new?template=`, `/new?blank=1`).
- A `/new?folder=` / `?team=` context names a server place, so it is
  livediagram whoever is creating.
- Before sign-in has answered, `signedIn` is the `ld_signed_in` hint cookie
  ([Who is a guest, before sign-in answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers)).
  A browser that looks signed in waits for the settled answer before creating, so a signed-in person is never handed
  a document in This Browser; a guest never waits.
- There is no per-person override: no setting chooses the store. Where a document is **filed** on livediagram is the
  person's to set, in Settings > Documents > Default Folders ([Default folders](../013-workspace/default-folders.md)).
  A preference that once did both, "Always save new documents in <place> and skip this step" (`skipLocationStep`),
  is retired and no longer read ([User preferences](../007-editor/user-preferences.md)).

## Choosing a folder

Where a document goes within livediagram is chosen in the shared Explorer
([`@liveworkspace/explorer`](../../../../packages/explorer/README.md)): its Move dialog (`MoveToFolderDialog`,
[Folders](../013-workspace/folders.md)) and its default folder picker ([Default folders](../013-workspace/default-folders.md)),
both over the index's folders. The Move dialog's **New Team** makes a team on the spot, opens it and files the item
in it, offered only to someone signed in ([Teams](../013-workspace/teams.md)). A document in This Browser has no
folder: it is listed on This Browser's own page ([Offline Mode](offline-mode.md)).

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

A signed-in user can mirror the documents in My Work to their own Google
Drive. The document still lives in livediagram (the default location): Drive
holds a copy that is kept in sync both ways while a tab is open, and a Drive
file is never the document's home. So Drive is never a save location, and a document created with
**livediagram** is mirrored like any other. Canvases in This Browser have no
server copy and are not mirrored. The mirror itself (connection, folder tree,
rename, move, delete to Trash, "Open with") is specified in [Google Drive mirror](../022-drive-mirror/drive-mirror.md), not
here.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`Document` / `Created` carries a `type` naming the store,
`Cloud` for livediagram and `Offline` for This Browser. A future location adds
its own preset `type`; the location id itself never leaves as content.

## Help centre ([Help app](../018-help/help-app.md))

The Offline Mode article says a guest's new documents start in this browser and a signed-in person's on livediagram,
and how to move one either way. No article of its own: each location's article (offline today) is where the substance
is.

## Implementation map

- `apps/editor/lib/save-locations.ts` (+ test): the ids and helpers above.
- `apps/editor/app/new/useNewDocumentLocation.ts`: `resolveSaveLocation`, the location every create from `/new` uses.
- `apps/editor/app/new/page.tsx`: derives the offline create branch from the location id.

## References

See [Dedicated route for new-document creation](../007-editor/new-document-route.md) (the wizard),
[Offline Mode](offline-mode.md) (the browser-only store),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) (help).
