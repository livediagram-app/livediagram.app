# Page labels blueprint

Derived from [The page surface](../page-surface.md) "Page labels" and [Search and Ask](../search-and-ask.md) "By label",
"Answer From". **Built.**

## Domain and naming

| Term                       | Identifier                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a label                    | `KnowledgeLabel` (`packages/document/src/page-labels.ts`): `{ id, name, colour }`                                                                                                   |
| its id                     | `isLabelId`: 1 to 40 of `A-Z a-z 0-9 _ -`; made by `newLabelId()` (`lbl_` and 10 random base-36 characters)                                                                       |
| its name                   | `labelName(raw)`: NFC, trimmed, runs of white space made one, 1 to `LABEL_NAME_MAX` (40), no control character; else undefined. Compared by `labelKey(name)` (lower case)           |
| its colour                 | `LabelColour`: a standard colour's name (`STANDARD_COLOUR_NAMES`, drawn per appearance by `penColourHex`) or a custom `#rrggbb`; `isLabelColour`                                    |
| the knowledgebase's labels | `KnowledgeSettings.labels` (`knowledge-settings.ts`), read by `parseKnowledgeLabels`: valid entries only, the first of a repeated id or name kept, at most `MAX_KNOWLEDGEBASE_LABELS` (100) |
| a page's labels            | `Tab.labels?: string[]` (ids), read by `parseTabLabels`: ids only, no repeat, at most `MAX_PAGE_LABELS` (10); settled on every read by `withSettledLabels` (`stored-tab.ts`)        |
| shown labels               | `pageLabelsOf(ids, labels)`: the page's labels that exist, in the page's order                                                                                                     |
| a change                   | `LabelChange`: `add` (`id`, `name`, `colour`), `rename` (`id`, `name`), `recolour` (`id`, `colour`), `delete` (`id`); `applyLabelChange(labels, change)` answers `{ labels }` or `{ refusal }` |
| refusals                   | `LabelRefusal`: `invalid_label_id`, `invalid_label_name`, `invalid_label_colour`, `label_name_taken`, `label_limit`, `unknown_label`                                               |
| use counts                 | `labelPageCounts(pages)`: id to pages carrying it; `labelsByUse(labels, counts)`: most used first, then by name                                                                     |
| a scope                    | `resolveLabels(labels, values)`: each value an id or a name (ignoring case), `{ ids }` or `{ unknown }`; `pagesLabelled(pages, ids)`: the pages carrying any                     |
| the next colour            | `nextLabelColour(labels)`: the first of `LABEL_COLOUR_ORDER` (blue, green, orange, violet, teal, pink, red, yellow, grey) no label has, else round again                            |

## Data and persistence

- **No schema step.** The labels ride the `document.knowledge_settings` JSON column the Review Period is in:
  `storedKnowledgeSettings` keeps `labels` when there are any and is null only for the default period with none.
  A page's ids ride the tab's body (`tabs.data`, `$.labels`) as its icon does.
- **Summaries.** `readDocumentOutline` reads `json_extract(t.data, '$.labels')` beside the icon; `rowToTabSummary`
  answers it as `TabSummary.labels` (`labelsField`, through `parseTabLabels`); `placeholdersFromSummaries` carries it
  onto the placeholder tab, so the tree filters before any body loads, and the api's search and Ask scope from the
  same summaries with no body read.
- **Sync.** A page's labels change is the editor's own tab change (`useSetPageLabels`, one `commitTabs`), sent as a
  `tab-meta` patch (`labels`, or `clear: ['labels']`) and saved by the whole-tab save. A label change (add, rename,
  recolour, delete) is one REST write that the api tells every open editor in `document-meta` (`knowledgeSettings`,
  with the labels), as the Review Period is; the room strips `knowledgeSettings` from a socket's `document-meta`, so
  no session writes them by the room.
- **Copies, files, snapshots.** The settings travel whole (`copyDocument` keeps them, the envelope's `fileSettings`
  keeps `labels`), and the ids are in the tab bodies. A copy keeps the same ids, so nothing is remapped.
- **Offline.** `offlineSaveDocumentMeta` merges `knowledgeSettings` into the stored record; the editor applies the
  change with `applyLabelChange` and saves it there.

## Interfaces and contracts

- `GET /api/documents/<id>/labels`: `{ labels: [{ id, name, colour, pages }] }`, every role, most used first.
- `POST labels` `{ name, colour?, id? }`: `201 { label, labels }`. No colour: `nextLabelColour`. No id: `newLabelId()`.
- `PATCH labels/<label>` `{ name?, colour? }`: `{ label, labels }`; nothing to change is `400 invalid_body`.
- `DELETE labels/<label>`: `{ labels }`.
- Writes are a Writer's (`writesPages`); a token below `write` scope, a Viewer and a link visitor are `403`. A refusal is
  `400` (`invalid_*`), `404 unknown_label`, or `409` (`label_name_taken`, `label_limit`), each with words.
- `GET search?q=&labels=a,b`: `labels` split on commas, each trimmed, at most `MAX_KNOWLEDGEBASE_LABELS`;
  `resolveLabels` over the stored labels, `400 unknown_label` ("No label is called X. Labels here: A, B.").
- `POST ask` `{ ..., labels?: string[] }`: the same resolution and refusal.
- The search SQL takes `onlyTabs` (`SearchOptions`): `p.tab IN (SELECT value FROM json_each(?))`, one bound
  parameter whatever the count, so the index answers its twenty from those pages. An empty scope skips the read.
- MCP `search_pages` `labels?: string[]` (names); `list_pages` `labels?: string[]` filters its rows; rows and
  `read_page` carry `labels` (names) when a page has any (`KnowledgeTreeRow.labels`, `KnowledgePageRead.labels`).

## Behaviour and state (editor)

| Piece                                        | File                                                             |
| -------------------------------------------- | ---------------------------------------------------------------- |
| the knowledgebase's labels, outside React    | `lib/page-labels/labels-store.ts` (`knowledgeLabelsStore`)       |
| the tree's filter, per knowledgebase         | `lib/page-labels/label-filter-store.ts` (`labelFilterStore`)     |
| Ask's Answer From, per person and knowledgebase | `lib/page-labels/ask-label-scope.ts` (`askLabelScopeStore`)   |
| making, renaming, recolouring, deleting      | `lib/page-labels/label-writes.ts` (`changeLabels`)               |
| the api client                               | `lib/api/knowledge-labels.ts`                                    |
| a page's labels in the store                 | `components/page-labels/page-labels-state.ts`                    |
| the pill                                     | `components/page-labels/LabelPill.tsx`                           |
| the meta row's pills, Add Label, Edit Labels | `components/page-labels/PageLabelsNote.tsx`                      |
| the picker and its edit view                 | `components/page-labels/LabelPicker.tsx`, `LabelEditView.tsx`    |
| the tree's button and bar                    | `components/page-labels/LabelFilterButton.tsx`, `LabelFilterBar.tsx` |
| Ask's Answer From                            | `components/page-labels/AskLabelScope.tsx`                       |

- `knowledgeLabelsStore.take` is fed by `knowledgeSettingsStore.take` (the document's read and every
  `document-meta` op with settings), so the labels arrive wherever the Review Period does.
- **Optimistic writes.** `changeLabels` applies the change to the store at once, then writes it (the api, or the
  offline record) and takes the api's answer; on a refusal the labels go back to what they were unless something
  newer was set since, and the words are thrown for a toast. Creating from the picker also puts the label on the page
  in the same turn.
- **The filter** (`labelFilterStore`): `set(documentId, ids, { reveal })`, `toggle`, `clear`; `reveal` (a pill's
  press) bumps a nonce that `usePageTreeChrome` reads to unfold the tree and `PageTreeSheetHost` to open the sheet.
  Ids no label has any more are dropped as it is read (`useLabelFilter`).
- **The tree.** `usePageTreeModel` works out `pagesLabelled(tabs, filter)` once per change of the pages or the filter
  and hands it to `PageTree` as `only`; `visiblePageRows(tabs, closed, activeId, only)` keeps the matching pages and
  their ancestors, opens the ancestors, counts `subpages`, `position` and `siblings` among the rows kept, and marks an
  ancestor that does not match `context: true` (a plain field, so a row renders only when it changes). An empty
  match draws `LabelFilterBar`'s empty line.
- **Search.** `useThisKnowledgebaseSearch` reads the filter: the api is asked with `labels`, the Offline search and
  the recent pages are cut to `pagesLabelled`, and the group carries `filter: { text, onClear }`, drawn by
  `SearchPanel` in the group's heading.
- **Ask.** `askConversationFor`'s `send` adds `labels` from `askLabelScopeStore` when it holds any, and the turn
  keeps the names it was asked under (`AskTurnView.labels`), which the answer card says under its trust line.

## Security and trust

- The room relays a `tab-meta` op only from an edit-role session (`room-op-gate.ts`): a Viewer's labels never land.
  A label write is `writesPages`. Names are text: drawn as characters, never HTML. A peer's `labels` patch is
  settled by `parseTabLabels` on read and by the store's `pageLabelsOf`, so a forged id draws nothing.
- Ask and search scope by ids resolved on the server from the stored labels: a caller cannot widen a scope past the
  pages it may read (the tab scope still applies after).

## Errors and edge cases

- A page's id whose label was deleted reads as none and is dropped on its next labels write.
- A rename to the same name (ignoring case) of the same label is taken (a case change); to another label's name is
  `label_name_taken`.
- A filter whose labels are all deleted is cleared; a search scoped to no page answers no result without a read.
- Two people adding labels at once both land: the api applies each change to the labels it reads.
- A label change on a knowledgebase not yet saved (a fresh `/new`) waits for none: the offline record or the api
  write is the same call as any settings write.

## Performance and limits

- The filter: `pagesLabelled` and `visiblePageRows` are one pass each over at most 500 pages, run when the pages or
  the filter change, never per keystroke (a typing commit leaves `sameTabsForBar` equal). Measured in
  `page-labels.perf.test.ts`: 500 pages, 100 labels, under the CPU budget.
- A rename: one `UPDATE` and one relayed op, whatever the pages carrying it.
- Search and Ask: one bound parameter for the scope; the index's own LIMIT stands.
- The picker draws only while open; a pill is a plain button; a page with no labels renders no note.

## Presentation and UX, Accessibility

- A pill: 22 px tall (44 px target on touch through `touch-target`), `rounded-full`, slate-100 ground (slate-800 in
  dark), a 8 px dot ringed `ring-black/10` (`ring-white/25` in dark) so a pale colour still shows, 12 px text slate-700
  (slate-200 in dark). Hover and focus: slate-200 ground, the focus ring `outline-brand-600`.
- The picker: `ResponsivePopover` 320 px (a sheet on a phone), `role="listbox"` `aria-multiselectable`, each row
  `role="option"` with `aria-selected`, the field `aria-activedescendant`; the edit view under `BackBar`.
- The tree bar: `role="group"` `aria-label="Label filter"`; each remove button names its label; Clear.

## Testing

| Rule                                                                          | Test                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Names, colours, ids; read forgivingly; changes and refusals; counts; scope    | `packages/document/src/page-labels.test.ts`             |
| Settings keep labels; stored; envelope carries them                           | `knowledge-settings.test.ts`, `document-envelope.test.ts` |
| Summaries carry labels                                                        | `apps/api/src/tab-row.test.ts`                          |
| The label routes, by role; relay                                              | `apps/api/src/routes/knowledge-label-routes.test.ts`    |
| Search and Ask scoped by label                                                | `packages/knowledge/src/sql/search.test.ts`, `knowledge-label-scope.test.ts` |
| MCP `search_pages`, `list_pages`, `read_page`                                 | `apps/mcp/src/knowledge-tools.test.ts`                  |
| The rows a filter keeps                                                       | `components/page-tree/page-tree-view.test.ts`           |
| Stores, writes and rollback                                                   | `lib/page-labels/*.test.ts`                             |
| Pills, picker, filter bar, Ask's Answer From, by role                         | `components/page-labels/*.test.tsx`                     |

## Constants and configuration

| Constant                   | Value | Why                                                      |
| -------------------------- | ----- | -------------------------------------------------------- |
| `LABEL_NAME_MAX`           | 40    | a pill stays one short line; safe 24 to 64               |
| `MAX_KNOWLEDGEBASE_LABELS` | 100   | the settings row stays a few KB; safe 50 to 200          |
| `MAX_PAGE_LABELS`          | 10    | the meta row stays readable; safe 5 to 20                |

## Defaults ledger

- The filter matches **any** of its labels (the spec says so); not kept across reloads.
- A new label's colour is the next unused of `LABEL_COLOUR_ORDER`.
