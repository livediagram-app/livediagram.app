# Folder location on Recent rows

Status: shipped, in the shared Explorer ([`@liveworkspace/explorer`](../../../../packages/explorer/README.md))

Lists that span places (Recent, Favourites, Search, Shared With Me) carry a quiet location chip on each row and
card, which opens that place instead of the design: its folder (the immediate parent only), its team for a team item
in no folder, **My Work** for one of yours in none, and **This Browser** for an
[Offline Mode](../006-design/offline-mode.md) design. An item reached through a link lives in someone else's library
and has none. It is the shared Explorer's `FolderChip` (`packages/explorer/src/explorer/badges.tsx` at the repo
root); livedesign adds nothing of its own.
