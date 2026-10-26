# Hide a design from Recent

Status: shipped, on liveworkspace's index and the shared Explorer ([`@liveworkspace/explorer`](../../../../packages/explorer/README.md))

Every item's menu has **Hide from Recent**, or **Show in Recent** once it is hidden. A hidden item never appears in
**Recent** or in Home's **Jump Back In**, and behaves as before everywhere else. The choice is per person, kept on
the person's own row in liveworkspace's index (`PUT` / `DELETE /recent-hidden/:itemId`, `hiddenFromRecent` on every
item; [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Folders, favourites, defaults"), and filtered there before Recent and Jump Back In are cut.

livedesign adds nothing of its own: the menu, the filtering and the toast on a refused write are the shared
Explorer's, on the Explorer page and in the editor's Explorer panel alike. There is no badge anywhere else; the menu
label states the current state where it can be changed.
