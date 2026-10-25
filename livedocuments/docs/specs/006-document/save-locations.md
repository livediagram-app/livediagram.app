# Save Locations

A new document is stored in one of a small set of **save locations**: on the server (livedocuments) or in this browser
only (This Browser, [Offline Mode](offline-mode.md)). More stores may come (GitHub is plausible).

**Nobody is asked.** `/new` ([Dedicated route for new-document creation](../007-editor/new-document-route.md))
has no Location step: every new document is stored in the default location for who is creating it, below. A document
moves between the two afterwards with [Offline Mode](offline-mode.md)'s **Sync Document** and **Take Offline**.
(The wizard used to end on a Location step with a Save location chooser, a tile per location, the This Browser
data-loss warning and a folder browser; it was removed, as most people answered it with the default before they had
anything on the canvas. A document in This Browser still says what it is on the document itself: the editor header's
**This Browser** badge and its legend, [Offline Mode](offline-mode.md#this-browser-badge--explorer).)

| Location          | What it means                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **livedocuments** | A normal cloud document, saved to the api (its Durable Object), reachable from any device.                   |
| **This Browser**  | Offline Mode ([Offline Mode](offline-mode.md)): saved only in this browser's IndexedDB, never to the server. |

## The default depends on who is creating

| Who                | Default           |
| ------------------ | ----------------- |
| A guest            | **This Browser**  |
| A signed-in person | **livedocuments** |

Why a guest starts local: [Auth + guest access → Guest documents start local](../014-identity/auth-and-guest-access.md#guest-documents-start-local).
A document in This Browser is still in the shared Explorer: its This Browser row and view, and Jump Back In, list this
browser's documents beside the index's ([liveworkspace/docs/one-explorer.md](../../../../liveworkspace/docs/one-explorer.md),
[Offline Mode → This Browser badge + Explorer](offline-mode.md#this-browser-badge--explorer)).

- One function answers it: `defaultSaveLocationFor({ signedIn })` in
  `apps/editor/lib/save-locations.ts`. Every create from `/new` asks it at commit, through
  `resolveSaveLocation` in `useNewDocumentLocation` (`apps/editor/app/new/useNewDocumentLocation.ts`): the create on
  mount, its Retry, and the links that name a start (`/new?template=`, `/new?blank=1`).
- A `/new?folder=` / `?team=` context names a server place, so it is
  livedocuments whoever is creating.
- Before sign-in has answered, `signedIn` is the `ldoc_signed_in` hint cookie
  ([Who is a guest, before sign-in answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers)).
  A browser that looks signed in waits for the settled answer before creating, so a signed-in person is never handed
  a document in This Browser; a guest never waits.
- There is no per-person override: no setting chooses the store. A preference that once did both, "Always save new documents in <place> and skip this step" (`skipLocationStep`),
  is retired and no longer read ([User preferences](../007-editor/user-preferences.md)).

## On the start screen

Nobody is asked, but the start screen offers one switch, **Sync Document to Server**, in a quiet strip under its choices
(Start Making Pages), so a new document can change place while it is still empty without a trip to the Explorer. It reflects
where the document is **now**, so it starts as the default above: **off** for a guest (This Browser), **on** for a signed-in
person (livedocuments).

- **The whole row is the switch**, as a Settings row is: a press anywhere on it (its icon, label or line) flips
  it, and it tints on hover. Screen readers still hear one switch, named by the label and described by the line.
- **Turned on** it syncs the document in place ([Offline Mode → Syncing in place](offline-mode.md#syncing-in-place)), a
  guest's as their guest id; **turned off** it takes it offline in place
  ([Offline Mode → Taking offline in place](offline-mode.md#taking-offline-in-place)). No confirmation: the document is
  empty and nobody else has it, so nothing can be lost. No reload: the person stays on the start screen.
- **While it moves** the switch is busy (a spinner in its knob, `aria-busy`) and its line reads "Syncing to the
  server…" or "Moving to this browser…"; a polite status says the same, then "Synced to the server." or "Moved to
  this browser.". **A failure** shows the conversion's toast (`syncFailureMessage`, or "Couldn’t move this to this
  browser. It stays safe on the server.") and the switch returns to where the document still is.
- **The line under the label** follows the state, with a small cloud or browser-window icon beside it:

  | State          | Line                                                                        |
  | -------------- | --------------------------------------------------------------------------- |
  | Off, signed in | Saved in this browser only. Turn on to open it anywhere and share it.       |
  | Off, guest     | Saved in this browser only. Turn on to save it to our servers and share it. |
  | On, signed in  | Saved to your account, on every device.                                     |
  | On, guest      | Saved on liveworkspace servers. Sign in to open it on any device.           |

- **When it shows** (`showsSaveSwitch`): the document has loaded and the reader and their sign-in are known; the reader
  owns it and can edit it; it has one tab with nothing on it; it has no live share link, is not open through one and
  is not in a team; nobody else is in it; and the editor is not embedded or in another app's workbench. Anywhere else
  the row is hidden, and the Explorer's Sync Document and Take Offline stay the way to move it. Once a move has started the
  row stays until it lands.
- **Built once.** The switch (`Switch`) and the row (`SaveSwitch`, `SaveSwitchRow`, its words and `showsSaveSwitch`)
  are `@liveworkspace/ui`'s (`packages/ui/src/Switch.tsx`, `packages/ui/src/save-switch/`), shared by every app. This
  app hands in only its kind's word, what it knows of the open document and its two in-place moves
  (`apps/editor/components/start/StartSaveSwitch.tsx`). It reads only state the editor already holds and loads with the
  start's own chunk, so the start screen's first paint makes no request for it.

## The folder browser

Where a document goes within livedocuments is chosen with the shared Explorer's `PlacementBrowser`
(in `@liveworkspace/explorer`), in its Move dialog
([liveworkspace/docs/one-explorer.md](../../../../liveworkspace/docs/one-explorer.md)).
It renders in its **`list` layout**: stacked
rows, icon beside label, the kind caption ("Top level", "Folder", "Open
folder") pinned right like a file explorer's Type column, with the inline New
Folder row last. Same browse, same placement strings, same double-click
commit; only the shape differs. The `tiles` layout remains on the browser as a prop, not a second
browser, so the product still has exactly one way to choose where a document
lives.

**Subfolder count.** A destination that holds more folders says so with a
small badge beside its name, "1 Subfolder" / "3 Subfolders": the space cards
on the overview (root folders of My Work or the team), the "save here" card
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
My Work is offered**, even when it is the only space: choosing where
a document lives starts with choosing the space, deliberately, and that
screen is where a "create a team" option belongs for someone who has no
team yet. An earlier version dropped a lone My Work space straight into
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
only**: teams are for accounts only, so the host (the Explorer's
move dialog) passes the create handler only when someone is signed in, and
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

A save location is one id in a small module, `apps/editor/lib/save-locations.ts`:

- `SaveLocationId` is the closed union of location ids (`'livedocuments' |
'browser'` today).
- `defaultSaveLocationFor` decides which one a new document gets.
- `isOfflineLocation(id)` says whether an id resolves to the browser-only store.
  It is the only place `/new` touches [Offline Mode](offline-mode.md)'s notion of "offline".

Adding a location (say, GitHub) means: a new id in the union, a rule in `defaultSaveLocationFor`
for who gets it, and a create branch in `/new` that hands the document to that store.

The wire between the wizard and `/new` is `NewDocumentSettings.saveLocation:
SaveLocationId`.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`Document` / `Created` carries a `type` naming the store,
`Cloud` for livedocuments and `Offline` for This Browser. A future location adds
its own preset `type`; the location id itself never leaves as content.

## Help centre ([Help app](../018-help/help-app.md))

The Offline Mode article says a guest's new documents start in this browser and a signed-in person's on
livedocuments, and how to move one either way. No article of its own: each location's article (offline today) is where the substance
is.

## Implementation map

- `apps/editor/lib/save-locations.ts` (+ test): the ids and helpers above.
- `apps/editor/app/new/useNewDocumentLocation.ts`: `resolveSaveLocation`, the location every create from `/new` uses.
- `apps/editor/components/start/StartSaveSwitch.tsx`: the start screen's Sync Document to Server switch, over `@liveworkspace/ui`'s `SaveSwitch` ([On the start screen](#on-the-start-screen)).
- `apps/editor/app/new/page.tsx`: derives the offline create branch from the location id.
- `@liveworkspace/explorer`: the `PlacementBrowser` the Move dialog uses.

## References

See [Dedicated route for new-document creation](../007-editor/new-document-route.md) (the wizard),
[Offline Mode](offline-mode.md) (the browser-only store),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) (help).
