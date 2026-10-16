# Save Locations

A new document is stored in one of a small set of **save locations**: on the server (livediagram) or in this browser
only (Local Browser, [Offline Mode](offline-mode.md)). More stores may come (GitHub is plausible). Google Drive is not
one of them: it is a mirror of cloud documents, not a place a document is stored
([Google Drive is a mirror, not a location](#google-drive-is-a-mirror-not-a-location)).

**Nobody is asked.** The New Document wizard ([Dedicated route for new-document creation](../007-editor/new-document-route.md#one-step-wizard))
has no Location step: every new document is stored in the default location for who is creating it, below. A document
moves between the two afterwards with [Offline Mode](offline-mode.md)'s **Sync Document** and **Take Offline**.
(The wizard used to end on a Location step with a Save location chooser, a tile per location, the Local Browser
data-loss warning and a folder browser; it was removed, as most people answered it with the default before they had
anything on the canvas. A Local only document still says what it is on the document itself: the editor header's
**Local only** badge and its legend, [Offline Mode](offline-mode.md#local-only-badge--explorer).)

| Location          | What it means                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **livediagram**   | A normal cloud document, saved to the api (D1), reachable from any device.                                   |
| **Local Browser** | Offline Mode ([Offline Mode](offline-mode.md)): saved only in this browser's IndexedDB, never to the server. |

## The default depends on who is creating

| Who                               | Default           |
| --------------------------------- | ----------------- |
| A guest, with sign-in enabled     | **Local Browser** |
| A signed-in person                | **livediagram**   |
| Anyone on a guest-only deployment | **livediagram**   |

Why a guest starts local: [Auth + guest access → Guest documents start local](../014-identity/auth-and-guest-access.md#guest-documents-start-local).

- One function answers it: `defaultSaveLocationFor({ signedIn, clerkEnabled })` in
  `apps/live/lib/save-locations.ts`. Every create from `/new` asks it at commit, through
  `resolveSaveLocation` in `useNewDocumentLocation` (`apps/live/app/new/useNewDocumentLocation.ts`): a mode chosen
  in the wizard, its **Create** and **Skip**, and the wizard-less links (`/new?template=`, `/new?blank=1`).
- A `/new?folder=` / `?team=` context names a server place, so it is
  livediagram whoever is creating.
- Before Clerk has answered, `signedIn` is the `__client_uat` hint
  ([Who is a guest, before Clerk answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-clerk-answers)).
  A browser that looks signed in waits for the settled answer before creating, so a signed-in person is never handed
  a Local only document; a guest never waits.
- There is no per-person override: no setting chooses the store. Where a document is **filed** on livediagram is the
  person's to set, in Settings > Documents > Default Folders ([Default folders](../013-workspace/default-folders.md)).
  A preference that once did both, "Always save new documents in <place> and skip this step" (`skipLocationStep`),
  is retired and no longer read ([User preferences](../007-editor/user-preferences.md)).

## The folder browser

Where a document goes within livediagram is chosen with the shared `PlacementBrowser`, in the Explorer's Move dialog
([Folders](../013-workspace/folders.md)) and the default folder picker ([Default folders](../013-workspace/default-folders.md)).
Both render it in its **`list` layout**: stacked
rows, icon beside label, the kind caption ("Top level", "Folder", "Open
folder") pinned right like a file explorer's Type column, with the inline New
Folder row last. Same browse, same placement strings, same double-click
commit; only the shape differs. The `tiles` layout remains on the browser as a prop, not a second
browser, so the product still has exactly one way to choose where a document
lives.

**Subfolder count.** A destination that holds more folders says so with a
small badge beside its name, "1 Subfolder" / "3 Subfolders": the space cards
on the overview (root folders of My documents or the team), the "save here" card
at the top of a level, and any folder row that drills in. A folder with
nothing inside shows no badge, so the badge itself is the "there's more in
here" cue, not just a number. Both layouts show it; in a row it sits beside
the name, on a tile it takes its own line between name and caption.

**The bar.** A full-width bar sits above the rows at **every** level. Where
there is a level above, it is the back button (chevron, the level's name,
and a chip naming where you are). Where there is not, it is a static heading
in the same shape: **"Choose a Space"** on the space overview, **"Choose a
Folder"** (with the space's name as the chip) at the root of a team-scoped
surface's one team. **The overview is always the first screen wherever
My documents is offered**, even when it is the only space: choosing where
a document lives starts with choosing the space, deliberately, and that
screen is where a "create a team" option belongs for someone who has no
team yet. An earlier version dropped a lone My documents space straight into
its folders, which left nowhere to put that option.

**It opens where its selection is.** The overview is the first screen while
the selection is a space's root. When the selection is a **folder** (the folder a
moved document lives in, a key's current default folder), the browser opens at
the level that lists that folder, its card checked, so the screen shows the
place the document will go; the bar's back button leads up to the space and
the overview. Until the reader moves about in the browser it follows the
selection, so a default that resolves after the step appears, or a new one
chosen through **Change default**, is opened to as well. Once the reader
selects, drills, goes back or creates in it, it stays where they take it. A
folder the browser cannot see yet (its list still loading) opens the
overview, and the level once the folder arrives.

That option is the **New Team tile**, last on the overview after the
team cards: the same dashed inline-name tile as New Folder (one
`InlineCreateTile`, two skins), reading "New Team · Create a New Team". Type a
name and the team is created (`POST /api/teams`, [Teams](../013-workspace/teams.md)), joins the
overview, and the browser enters it with its root selected, because the
point of making a team here is to file this document in it. **Signed-in
only**: teams are Clerk-only, so the host (the Explorer's
move dialog) passes the create handler only when there is a Clerk user, and
a guest never sees a tile that would lead to a 401. Folder moves pass no
handler either, since a folder can't move into a team.
So the bar never appears and disappears under the rows as you move about,
which was its own jolt.

**Motion.** Drilling into a space or folder, or backing out, swaps the whole
level, and a level that lands in one frame is a jolt. So the bar eases in
when the browser mounts (fade, short slide, height from zero) and the rows
beneath it enter as a **cascade**, each a beat (10 ms) after the one above, the whole cascade settling within the 250ms budget of [Motion](../004-interface-design/motion.md): list rows slide in and
grow from zero height so the rows below ease down with them; tiles fade,
since a grid track already holds their place. The cascade runs on every level
change and on first appearance; a folder created in place only animates its
own row. Reduced motion ([User preferences](../007-editor/user-preferences.md)) collapses both the duration and the
per-row delay, so nothing waits on a beat it will never see.

## The contract for adding a location

A save location is one id in a small module, `apps/live/lib/save-locations.ts`:

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

A signed-in user can mirror the documents in My documents to their own Google
Drive. The document still lives in livediagram (the default location): Drive
holds a copy that is kept in sync both ways while a tab is open, and a Drive
file is never the document's home. So Drive is never a save location, and a document created with
**livediagram** is mirrored like any other. Local Browser documents have no
server copy and are not mirrored. The mirror itself (connection, folder tree,
rename, move, delete to Trash, "Open with") is specified in [Google Drive mirror](../022-drive-mirror/drive-mirror.md), not
here.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`Document` / `Created` carries a `type` naming the store,
`Cloud` for livediagram and `Offline` for Local Browser. A future location adds
its own preset `type`; the location id itself never leaves as content.

## Help centre ([Help app](../018-help/help-app.md))

The Offline Mode article says a guest's new documents start in this browser and a signed-in person's on livediagram,
and how to move one either way. No article of its own: each location's article (offline today) is where the substance
is.

## Implementation map

- `apps/live/lib/save-locations.ts` (+ test): the ids and helpers above.
- `apps/live/app/new/useNewDocumentLocation.ts`: `resolveSaveLocation`, the location every create from `/new` uses.
- `apps/live/app/new/page.tsx`: derives the offline create branch from the location id.
- `apps/live/components/placement/PlacementBrowser.tsx`: the `layout` prop
  (`tiles` | `list`) on the browser, its `PlacementCard`, and `NewFolderTile`.

## References

See [Dedicated route for new-document creation](../007-editor/new-document-route.md) (the wizard),
[Offline Mode](offline-mode.md) (the browser-only store),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) (help).
