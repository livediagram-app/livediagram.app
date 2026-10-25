# Explorer Home data blueprint

**Retired (October 2026).** What this blueprint built is livediagram's own Explorer, which the index and the shared
Explorer package replace. [Explorer Home](../explorer-home.md) says what livediagram does: recording a canvas's opens and giving Home its words. The document is
[one-explorer.md](../../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../../liveworkspace/docs/one-explorer-contracts.md).

What remains in code is `packages/api-schema/src/home.ts`: `DOCUMENT_OPEN_HEADER` and `readDocumentOpen` (the open
marker the editor sends and the api reads), and `WITHIN_REACH_USE_WINDOW_DAYS` with `windowStartOf` (the use window
the This Browser opens keep). Home's response shapes, verbs, limits and rejections went with the reads, and so did
its rate limiter.
