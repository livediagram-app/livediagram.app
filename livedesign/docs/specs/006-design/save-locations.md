# Save Locations

A new design is stored in one of a small set of **save locations**: on the server (livedesign) or in this browser
only (This Browser, [Offline Mode](offline-mode.md)).

**Nobody is asked.** `/new` ([New design route](../007-editor/new-design-route.md#what-new-makes)) stores every new
design in the default location for who is creating it, below. A design moves between the two afterwards with
[Offline Mode](offline-mode.md)'s **Sync Design** and **Take Offline**, or the start screen's switch (below). A design
in This Browser says what it is on the design itself: the editor header's **This Browser** badge and its legend
([Offline Mode](offline-mode.md#this-browser-badge--explorer)).

| Location         | What it means                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **livedesign**   | A normal cloud design, saved to the api (its Durable Object), reachable from any device.                     |
| **This Browser** | Offline Mode ([Offline Mode](offline-mode.md)): saved only in this browser's IndexedDB, never to the server. |

## The default depends on who is creating

| Who                | Default          |
| ------------------ | ---------------- |
| A guest            | **This Browser** |
| A signed-in person | **livedesign**   |

Why a guest starts local: [Auth + guest access → Guest designs start local](../014-identity/auth-and-guest-access.md#guest-designs-start-local).

- One function answers it: `defaultSaveLocationFor({ signedIn })` in
  `apps/live/lib/save-locations.ts`. Every create from `/new` asks it at commit, through
  `resolveSaveLocation` in `useNewDesignLocation` (`apps/live/app/new/useNewDesignLocation.ts`), whatever its
  params (`/new?template=`, `/new?blank=1`).
- A `/new?folder=` / `?team=` context names a server place, so it is
  livedesign whoever is creating.
- Before sign-in has answered, `signedIn` is the `ldes_signed_in` hint cookie
  ([Who is a guest, before sign-in answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers)).
  A browser that looks signed in waits for its session's own answer before creating, up to 15 seconds, so a
  signed-in person is never handed a design in This Browser; a guest never waits. The page's 5-second give-up on
  sign-in (it then carries on as a guest) is not that answer. Only a known account saves on livedesign; a session that
  still hasn't answered after the wait keeps the design in This Browser, where nothing is lost.
- There is no per-person override: no setting chooses the store. Where a design is **filed** on livedesign is the
  person's to set, in Settings > Designs > Default Folders ([Default folders](../013-workspace/default-folders.md)).

## On the start screen

Nobody is asked, but the start screen offers one switch, **Sync Design to Server**, in a quiet strip under its choices
(its template start), so a new design can change place while it is still empty without a trip to the Explorer. It reflects
where the design is **now**, so it starts as the default above: **off** for a guest (This Browser), **on** for a signed-in
person (livedesign).

- **The whole row is the switch**, as a Settings row is: a press anywhere on it (its icon, label or line) flips
  it, and it tints on hover. Screen readers still hear one switch, named by the label and described by the line.
- **Turned on** it syncs the design in place ([Offline Mode → Syncing in place](offline-mode.md#syncing-in-place)), a
  guest's as their guest id; **turned off** it takes it offline in place
  ([Offline Mode → Taking offline in place](offline-mode.md#taking-offline-in-place)). No confirmation: the design is
  empty and nobody else has it, so nothing can be lost. No reload: the person stays on the start screen.
- **While it moves** the switch is busy (a spinner in its knob, `aria-busy`) and its line reads "Syncing to the
  server…" or "Moving to this browser…"; a polite status says the same, then "Synced to the server." or "Moved to
  this browser.". **A failure** shows the conversion's toast (`syncFailureMessage`, or "Couldn’t move this to this
  browser. It stays safe on the server.") and the switch returns to where the design still is.
- **The line under the label** follows the state, with a small cloud or browser-window icon beside it:

  | State          | Line                                                                        |
  | -------------- | --------------------------------------------------------------------------- |
  | Off, signed in | Saved in this browser only. Turn on to open it anywhere and share it.       |
  | Off, guest     | Saved in this browser only. Turn on to save it to our servers and share it. |
  | On, signed in  | Saved to your account, on every device.                                     |
  | On, guest      | Saved on liveworkspace servers. Sign in to open it on any device.           |

- **When it shows** (`showsSaveSwitch`): the design has loaded and the reader and their sign-in are known; the reader
  owns it and can edit it; it has one tab with nothing on it; it has no live share link, is not open through one and
  is not in a team; nobody else is in it; and the editor is not embedded or in another app's workbench. Anywhere else
  the row is hidden, and the Explorer's Sync Design and Take Offline stay the way to move it. Once a move has started the
  row stays until it lands.
- **Built once.** The switch (`Switch`) and the row (`SaveSwitch`, `SaveSwitchRow`, its words and `showsSaveSwitch`)
  are `@liveworkspace/ui`'s (`packages/ui/src/Switch.tsx`, `packages/ui/src/save-switch/`), shared by every app. This
  app hands in only its kind's word, what it knows of the open design and its two in-place moves
  (`apps/live/components/start/StartSaveSwitch.tsx`). It reads only state the editor already holds and loads with the
  start's own chunk, so the start screen's first paint makes no request for it.

## The folder browser

Where a design goes within livedesign is chosen with the shared Explorer's `PlacementBrowser`
(`@liveworkspace/explorer`, [`packages/explorer/README.md`](../../../../packages/explorer/README.md)), in the
Explorer's Move dialog ([Folders](../013-workspace/folders.md)) and the default folder picker
([Default folders](../013-workspace/default-folders.md)). Its levels, bar, subfolder counts, New Folder and New Team
tiles and motion are the shared Explorer's, and the folders and teams it lists are liveworkspace's index's. The
editor's own tab-folder dialogs build their places from the workbench's `PlacementCard`
(`../packages/workbench/src/components/placement/PlacementCard.tsx`, in `apps/live/components/dialogs/TabOrganiseDialogs.tsx`).

## The contract for adding a location

A save location is one id in a small module, `apps/live/lib/save-locations.ts`:

- `SaveLocationId` is the closed union of location ids (`'livedesign' | 'browser'`).
- `defaultSaveLocationFor` decides which one a new design gets.
- `isOfflineLocation(id)` says whether an id resolves to the browser-only store.
  It is the only place `/new` touches [Offline Mode](offline-mode.md)'s notion of "offline".

Adding a location (say, GitHub) means: a new id in the union, a rule in `defaultSaveLocationFor`
for who gets it, and a create branch in `/new` that hands the design to that store.

Inside `/new`, the location travels as `NewDesignSettings.saveLocation: SaveLocationId`.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`Document` / `Created` carries a `type` naming the store,
`Cloud` for livedesign and `Offline` for This Browser. The location id itself never leaves as content.

## Help centre ([Help app](../018-help/help-app.md))

The Offline Mode article says a guest's new designs start in this browser and a signed-in person's on livedesign,
and how to move one either way. Locations have no article of their own.

## Implementation map

- `apps/live/lib/save-locations.ts` (+ test): the ids and helpers above.
- `apps/live/app/new/useNewDesignLocation.ts`: `resolveSaveLocation`, the location every create from `/new` uses.
- `apps/live/components/start/StartSaveSwitch.tsx`: the start screen's Sync Design to Server switch, over `@liveworkspace/ui`'s `SaveSwitch` ([On the start screen](#on-the-start-screen)).
- `apps/live/app/new/page.tsx`: derives the offline create branch from the location id.
- `../packages/workbench/src/components/placement/PlacementCard.tsx`: the selectable destination card the tab-folder
  dialogs build from. The Move dialog's browser is the shared Explorer's `PlacementBrowser` (`@liveworkspace/explorer`).

## References

See [New design route](../007-editor/new-design-route.md) (`/new`),
[Offline Mode](offline-mode.md) (the browser-only store),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) (help).
