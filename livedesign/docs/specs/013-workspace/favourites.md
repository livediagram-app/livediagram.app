# Favourite designs

Status: shipped, on liveworkspace's index and the shared Explorer ([`@liveworkspace/explorer`](../../../../packages/explorer/README.md))

A **Favourite** / **Unfavourite** toggle on every item's menu, and a **Favourites** view at
`/explorer/favourites` that collects every starred design, personal or team, in one place. A star is personal: one
row per person and item in liveworkspace's index (`GET /favourites`, `PUT` / `DELETE /favourites/:itemId`; [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
"Folders, favourites, defaults"), unlimited, granting no access, and listed only while the person can still reach
the item. The view, the star beside a starred name, the location chip and the optimistic toggle are the shared
Explorer's. The view is a row in the sidebar's More group and in the editor's Explorer panel.

## What livedesign does

- **Stars an Offline Mode design in this browser.** An [Offline Mode](../006-design/offline-mode.md) design is not
  in the index, so its star is kept on the offline record itself (`offlineSetFavourite`,
  `apps/live/lib/offline/offline-store.ts`), which the shared Explorer reads with the rest of the This Browser list.
  The Favourites view lists both kinds together.
- **Carries the star across a conversion.** Take Offline reads the index's star onto the offline record
  (`apps/live/lib/offline/offline-convert.ts`); Sync Design stars the new cloud design (`offline-sync.ts`).

## Spelling

**Favourite**, as everywhere else in the codebase.
