# Explorer filters

**Moved to liveworkspace's index (October 2026).** liveplanner's filter lens on the Explorer (the `opens-in:`, `kind:`, `template:`, `made-by:ai`, `edited:`, `people:` and `space:` tokens, the chip row and `?q=`) is gone from the Explorer. The shared Explorer has a search field (title, tag and folder search over the index, `/explorer/search?q=`) and one filter, this app's items or All.

The lens's parser and matcher are still a pure package, `packages/explorer-lens`, but nothing in the Explorer reads it now.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
