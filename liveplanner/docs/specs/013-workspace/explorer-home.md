# Explorer Home

**Moved to liveworkspace's index (October 2026).** liveplanner's own Home (Jump Back In with its Within reach set, then What Happened, read from `/api/home`) is gone. `/explorer` and `/explorer/home` render the shared Explorer's Home view: Jump back in (your most recently opened items, from every app) and Shared with you recently, both read from the index. What Happened went with the [Timeline](timeline.md).

What liveplanner still does is say when a plan is opened: the editor records the open with the index (`POST /items/:id/open`, debounced there to one write a minute) when it loads the plan, and that is what Recent and Jump back in sort by.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
