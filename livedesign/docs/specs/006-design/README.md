# Design

Follow the references below only as needed; never upfront.

- ./design.md - when naming things: a design holds tabs, a tab holds pages; one tab kind and one editor mode (Pages)
- ./design-structure.md - when working on Design structure: Designs contain tabs; elements can link across tabs
- ./per-tab-storage.md - when working on Per-tab storage: Split tabs into their own rows so autosave scope shrinks
- ./tab-design-many-to-many.md - when working on Tab ↔ design many-to-many: Link table so a tab can live in multiple designs
- ./tab-folders.md - when working on Tab folders: Group a design's tabs into one-level named folders that fan out from one chip
- ./design-snapshots.md - when working on Design SVG snapshots: One R2-cached SVG per design, rendered on-read-if-stale: Explorer row thumbnails (owner-authed) + the live image share embed ([Live image share link](../013-workspace/live-image-share.md), share-code-scoped). Gated on the optional R2 binding
- ./layers.md - when working on Layers: Photoshop-style per-tab layers: Tab.layers bands + element layerId, active layer receives new elements, visibility/lock/reorder, band-scoped z-order, a Layers panel (a popover over its bottom-right cluster button), hidden layers excluded from exports behind an export-dialog toggle
- ./offline-mode.md - when working on Offline Mode: Per-design mode (the This Browser save location: the default for a guest, opt-in for a signed-in person) that saves only to the browser (IndexedDB), never to the API, and opens instantly without waiting on the server — images embedded locally, server-only features (teams / AI / live) hidden and Share explaining and offering Sync Design, which converts the open design in place with no reload, an "Offline" badge in the header + Explorer. Convertible both ways: "Save to your account" (Offline → Cloud) and "Take offline" (Cloud → Offline, deleting the server copy, with confirmation). Folded into the marketing privacy area + a help article
- ./name-length.md - when working on Tab and design name length: Tab + design names capped at 60 chars with whitespace collapsed and word-boundary ellipsis truncation; enforced by the api worker on every stored name (editor, API tokens, MCP, copies) and at the editor's mutation points (auto-naming, renames, `/new`) with `maxLength` on the inputs as a visible second line of defence
- ./save-locations.md - when working on where a new design is stored: livedesign or This Browser, nobody asked, the default by who is creating (This Browser for a guest), the start screen's Sync Design to Server switch, the folder browser, and the `lib/save-locations.ts` catalogue a new store is added to
- ./stroke-points.md - when reading or writing a freehand stroke's points: the `packedPoints` binary block (16-bit x, y and optional 8-bit pressure per point, base64), its precision guarantee, lazy memoised decoding, validation rejections and the migration of stored `{ nx, ny }` points
- ./blueprints/README.md - when implementing or changing a design-model feature from its blueprint
