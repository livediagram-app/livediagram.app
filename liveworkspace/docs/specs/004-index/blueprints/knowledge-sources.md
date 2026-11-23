# Knowledge sources: blueprint

Derived from [knowledge-sources.md](../knowledge-sources.md). The spec decides; this file adds engineering precision.

## Files

| File                                                                                                                | Role                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/index-client/src/knowledge-sources.ts`                                                                    | The contract: `KNOWLEDGE_SOURCE_APPS`, the caps, `KnowledgePlace`, `KnowledgeChunk`, `KnowledgeText`, `isKnowledgeText`, `readKnowledgeSourceChange`, `knowledgePlaceHash`, `askCitationOf` |
| `packages/index-client/src/knowledge-client.ts`                                                                     | `createKnowledgeSourcesClient`: `sources`, `text`, `reach`, `likely`, for liveknowledge's server                                                                                            |
| `packages/index-app/src/knowledge-text.ts`                                                                          | `canvasKnowledgeChunks(file)`: a canvas app's export file walked into chunks (shapes, notes, articles), bounded                                                                             |
| `packages/index-app/src/knowledge-text-plan.ts`                                                                     | `planKnowledgeChunks(file)`: a plan's cards (title, status, fields, comments), newest first, then its tabs                                                                                  |
| `packages/index-app/src/knowledge-source-doors.ts`                                                                  | The two doors every app answers: `GET knowledge-text`, `POST knowledge-source-changed`; `knowledgeTextFromExport`                                                                           |
| `packages/app-doors/src/doors.ts`                                                                                   | `readKnowledgeText(app, itemId)`: the index's client of the text door                                                                                                                       |
| `liveworkspace/apps/index/src/knowledge-sources.ts`                                                                 | The four routes (`knowledge-sources`, `knowledge-text`, `knowledge-reach`, `knowledge-likely`), `knowledgeWatchers`, `signalKnowledgeSources`                                               |
| `liveworkspace/apps/index/src/app-routes.ts`                                                                        | Routes `/app/items/:kb/knowledge-*`; a summary push that moves `updatedAt` signals the item's watchers                                                                                      |
| `liveworkspace/apps/index/src/items/item-routes.ts`                                                                 | Trash signals the item's watchers with `gone: true`                                                                                                                                         |
| `livediagram/apps/api/src/routes/internal-items.ts` (and liveplanner's, livedocuments', livedesign's, livehuddle's) | `knowledgeText` over the room's `exportFile` (`format: 'file'`)                                                                                                                             |
| `packages/workbench/src/components/ask/AskCitationBar.tsx`                                                          | The Cited by Ask bar, drawn by `EditorCornerActions`                                                                                                                                        |

## The text door

- `GET /api/internal/items/:id/knowledge-text` (INDEX_KEY of the app): the item's whole-item export file, parsed, then
  walked. The answer is checked with `isKnowledgeText` before it leaves the app: over a cap is a `500`, never a
  truncated lie.
- Walk bounds: depth 8, 2,000 nodes a tab, text keys only (label, text, note, notes, title, caption, description, alt,
  name, fn, `runs` and `richText` joined). `data:` URLs and bare links are dropped. A connected tab is skipped (its
  item is its own source). An article's draft flow is skipped (only saved writing counts).
- Chunks: at most `KNOWLEDGE_CHUNK_MAX_CHARS` (1,200) characters, `KNOWLEDGE_CHUNKS_PER_SOURCE` (200) and
  `KNOWLEDGE_SOURCE_MAX_CHARS` (60,000) a source; a place names a tab and up to `KNOWLEDGE_PLACE_ELEMENTS_MAX` (12)
  element ids, or a card.

## The index's routes

All `POST /app/items/:kb/<route>` with liveknowledge's app key; `:kb` must be a live liveknowledge item.

- `knowledge-sources {folderId}`: confirmed connections from `:kb` to a source app's live item, then (a folder in
  `:kb`'s own scope) every live item in that folder's tree (`FOLDER_TREE`, depth 8). At most `KNOWLEDGE_SOURCES_MAX`
  (500); each `{itemId, app, title, origin, updatedAt}`.
- `knowledge-text {itemId, folderId}`: `404` unless the item is still a source of `:kb` (connected, or filed in the
  folder's tree in the same scope); else the app's text door through `doorsFor(env).readKnowledgeText`.
- `knowledge-reach {personId, teams, itemIds, folderId}`: the ids, kept to live items of a source app in `:kb`'s
  scope, connected to it or in its folder, then to those `lookupItems` grants the person (owner, team member, or a
  link they opened). Never a connection's pass. A guest id is refused.
- `knowledge-likely {personId, teams, words, exclude}`: live items of `:kb`'s scope in a source app whose title holds
  every word (escaped `LIKE`, at most `KNOWLEDGE_LIKELY_WORDS_MAX` (8) words), not excluded, at most 20 candidates, kept
  to the person's own access, the first `KNOWLEDGE_LIKELY_MAX` (3) answered.

## Keeping in step

- A summary push whose `updatedAt` moves, for an item of a source app, runs `signalKnowledgeSources` in `waitUntil`;
  trash runs it with `gone: true`.
- `knowledgeWatchers`: liveknowledge hosts of a confirmed connection to the item, plus team knowledgebases of the
  item's scope whose summary `knowledgeFolder` is the item's folder or an ancestor (up to 8 levels), at most
  `KNOWLEDGE_WATCHERS_MAX` (20). Each is told by `POST /api/internal/items/:kb/knowledge-source-changed`
  `{app, itemId, gone?}` (`callApp`, bounded concurrency); a failure is logged and dropped (the daily look repairs it).

## Errors and edge cases

- An app that does not answer the text door: the index answers `502`; the room counts a try and retries.
- A folder of another scope: treated as no folder.
- A knowledgebase in the Trash: every route `404`s.

## Security

- Every route is liveknowledge's alone (`callerApp`), and every answer is bounded. Reach and likely use the reader's
  own grants, as `/items/lookup` does.
- No item text is stored in the index; the text door's answer passes through to the room.

## Performance

- Measured on a 500-item team (see the tests): `knowledge-sources` one recursive read, `knowledge-reach` one read
  plus `lookupItems`, `knowledge-likely` one read of at most 20 rows. A summary push with no watchers costs two
  indexed reads.

## Testing

- index-client: validators, caps, `knowledgePlaceHash` round trip with `askCitationOf`.
- index-app: the walkers' bounds (depth, nodes, chunk sizes, skipped tabs), the doors' answers.
- index: each route's refusals (wrong app, trashed kb, guest), the folder scope, reach by owner, team and link, and
  the 500-item measure under a CPU budget.
