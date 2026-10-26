# Empty design clean-up

Status: shipped, on liveworkspace's index

A design that has held nothing for 30 days moves to the [Trash](trash.md) on its own, marked `empty`, and waits
the Trash's usual 30 days there. The sweep is liveworkspace's index's, once for every app, in its daily run
(`sweepEmpty` in `liveworkspace/apps/index/src/purge.ts`; [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Items"). livedesign runs no sweep of its own.

## What livedesign does

- **Says whether a design is empty.** A design is empty when none of its tabs holds an element (a design with no
  tabs is empty too); a name, blank tabs, a tab's settings, a share link, a star or a folder never keep it. Each
  design's Durable Object pushes its summary to the index after every save, and the summary carries `hasContent`
  ([API](../015-api/api.md) "Storage"). A tab shared with another design
  ([Tab ↔ design many-to-many](../006-design/tab-design-many-to-many.md)) counts in every design that holds it.
- **Leaves Offline Mode alone.** [Offline Mode](../006-design/offline-mode.md) designs live only in the browser and
  are never swept.
- **Says why on the Trash row.** `GET /api/trash` rows carry `reason`: `deleted` or `empty`
  (`apps/api/src/routes/trash.ts`), and the MCP server's `list_trash` carries the same field
  ([MCP server](../015-api/mcp-server.md)). Offline Mode's local Trash rows are always `deleted`. The shared Trash
  view words an `empty` row "Moved here {d MMM} because it was empty".
- **No telemetry.** The sweep is not a person; the Trash's `Restored` event says whether anyone comes back.
