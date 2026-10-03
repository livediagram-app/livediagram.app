# Article pages blueprint

Derived from [Article pages](../article-pages.md). Implementation detail only; the spec owns every
design decision. The page model, the row, page kinds and page actions are
[Illustrate pages](illustrate-pages.md); the mode and its switch are [Editor modes](editor-modes.md).

## Domain and naming

| Term                     | Identifier                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Article page             | `IllustratePage` with `kind: 'article'` and `flow`; `isArticlePage(page)`, `pageKindOf(page)`, `packages/document/src/illustrate-page.ts`                                                                                                                                                                                                                                                                    |
| Article (its writing)    | `ArticleFlow` (`{ blocks, style? }`), `Tab.articles?: Record<flow, ArticleFlow>`, read through `articlesOf(tab)`, `packages/document/src/article-flow.ts`                                                                                                                                                                                                                                                    |
| Flow id                  | `IllustratePage.flow`; minted by `nextArticleFlowId(taken)` (`art-` + 8 hex)                                                                                                                                                                                                                                                                                                                                 |
| Lead page                | The flow's first page in the row (`articlePages(tab, flow)[0]`); `flowFrame(pages, margin)` measures from it                                                                                                                                                                                                                                                                                                 |
| Block                    | `ArticleBlock` (union of `ArticleParagraphBlock`, `ArticleListBlock`, `ArticleCodeBlock`, `ArticleDividerBlock`, `ArticlePageBreakBlock`, `ArticleZoneBlock`)                                                                                                                                                                                                                                                |
| Block id                 | `nextArticleBlockId(taken)` (`b-` + 8 hex); `withFreshArticleBlockIds(flow)` on a copy                                                                                                                                                                                                                                                                                                                       |
| Text block               | `ArticleParagraphBlock` or `ArticleListBlock` (the blocks with runs)                                                                                                                                                                                                                                                                                                                                         |
| Run                      | `ArticleRun` (`text`, flags `b i u s code sup sub`, `href`, `color`, `hl`, `note`, `nk`); `normaliseRuns(v)`                                                                                                                                                                                                                                                                                                 |
| Paragraph style          | `ArticleParagraphStyle` (`body title subtitle h1 h2 h3 quote`), `ARTICLE_PARAGRAPH_STYLES`                                                                                                                                                                                                                                                                                                                   |
| List kind, align         | `ArticleListKind`, `ARTICLE_LIST_KINDS`; `ArticleAlign` (`left center right justify`), `ARTICLE_ALIGNS`                                                                                                                                                                                                                                                                                                      |
| List markers             | `articleListMarkers(blocks)` → `Map<blockId, marker>`                                                                                                                                                                                                                                                                                                                                                        |
| Zone                     | `ArticleZoneBlock` (`zone: ArticleZoneKind` `'object' \| 'drawing'`, `wrap?`, `align?`, `width`, `height`, `at?: ArticleZoneAt`)                                                                                                                                                                                                                                                                             |
| Wrap                     | `ArticleZoneWrap` (`'inline' \| 'left' \| 'right'`), `ARTICLE_ZONE_WRAPS`; Float is `ZoneFit` `'float'` in `ZoneBar.tsx`, never stored                                                                                                                                                                                                                                                                       |
| Zone place               | `ArticleZoneAt` (`{ page, x, y }` from the page's corner); `zoneCanvasRect(pages, zone)`                                                                                                                                                                                                                                                                                                                     |
| Zone membership          | `zoneAnchorOf(el, elements)`, `zoneMemberIds(elements, rect)`, `withElementsMoved`, `packages/document/src/article-zones.ts`                                                                                                                                                                                                                                                                                 |
| Drawing element          | `isDrawingElement(el)` (`DRAWING_SHAPES`, arrows, text, freehand, path), `packages/document/src/article-intake.ts`                                                                                                                                                                                                                                                                                           |
| Zone edits               | `zonePlanFor`, `withElementsIntoZone`, `looseOnArticles`, `withZonesFitted`, `withZoneContentsRemoved`, `withZoneLanded`, `withZoneWrap`, `withZoneRemoved`, `withZoneReleased`, `withZoneSize`, `objectsDraggedOut` (`article-intake.ts`); `withZonesSettled`, `drawingZoneClips` (`article-zones.ts`); `withZoneMoved` (`useArticles.ts`)                                                                  |
| Article style            | `ArticleStyle`, `parseArticleStyle`; resolved `ResolvedArticleStyle` by `resolveArticleStyle(style)`, `packages/document/src/article-style.ts`                                                                                                                                                                                                                                                               |
| Look                     | `ArticleLookId`, `ARTICLE_LOOK_IDS`, `ARTICLE_LOOKS`, `withArticleLook(style, look)`                                                                                                                                                                                                                                                                                                                         |
| Style edit               | `withArticleStyleChanged(tab, flow, { look } \| { patch })`                                                                                                                                                                                                                                                                                                                                                  |
| Measures                 | `articleMarginPx`, `articleTopMarginPx`, `articleBodyLinePx`                                                                                                                                                                                                                                                                                                                                                 |
| Article edits (row)      | `PageUnit`, `pageUnits`, `articlePages`, `withArticleFlow`, `withArticleAdded`, `withArticleRemoved`, `withUnitMoved`, `withArticleDuplicated`, `withArticlePageCount`, `packages/document/src/article-pages.ts`                                                                                                                                                                                             |
| Margin note              | `AnnotationElement.articleNote?: 'comment' \| 'action'` (`element-types.ts`); `ArticleNoteKind`, `ArticleNotePlace`, `packages/document/src/article-notes.ts`                                                                                                                                                                                                                                                |
| Note edits               | `articleNoteCorner`, `newArticleNote`, `withNotesSettled`, `withNoteMarksRemoved`, `articleNoteIds`, `withNoteMarkersRemoved`                                                                                                                                                                                                                                                                                |
| Note marker face         | `ArticleNoteFace` (`components/canvas/article/ArticleNoteFace.tsx`), routed by `ElementFaceRouter`; chip variant in `element-variant.ts`                                                                                                                                                                                                                                                                     |
| Turn Into Pages          | `articleBlocksAsRuns`, `articleAsPages`, `withArticlesAsPages`, `packages/document/src/article-to-page.ts`                                                                                                                                                                                                                                                                                                   |
| Block ops                | `ArticleOp` (`put`, `remove`, `style`), `diffArticleFlow(before, after)`, `applyArticleOps(flow, ops)`, `parseArticleOps(v)`; ids `isArticleId`, `packages/document/src/article-flow-ops.ts`                                                                                                                                                                                                                 |
| Room op                  | `RoomOp` `{ kind: 'article'; tabId; flow; ops; created? }` / `{ …; removed: true }` (mutation), `packages/api-schema/src/room-messages.ts`                                                                                                                                                                                                                                                                   |
| Caret on the wire        | `RoomOp` `'article-caret'` (presence), `ArticleCaret`, `parseArticleCaret`, `packages/api-schema/src/article-caret.ts`                                                                                                                                                                                                                                                                                       |
| Broadcast / apply        | `tabArticleOps`, `wholeTabOp`, `META_SKIP`, `mergeRemoteTab` (`tab-broadcast-ops.ts`); `applyRoomOpToTabs` case `'article'` (`room-op-apply.ts`)                                                                                                                                                                                                                                                             |
| The articles view        | `ArticlesView`, `useArticles`, `ArticleInsert`, `ZoneAction`, `ArticleStyleChange`, `apps/live/hooks/editor/useArticles.ts`                                                                                                                                                                                                                                                                                  |
| Intake                   | `useArticleIntake`, `apps/live/hooks/editor/useArticleIntake.ts`                                                                                                                                                                                                                                                                                                                                             |
| Leaving Illustrate       | `useLeaveIllustrate`, `LeaveIllustrate` (`hooks/editor/useLeaveIllustrate.ts`); `LeaveIllustrateDialog` (`components/dialogs/`)                                                                                                                                                                                                                                                                              |
| The writing (editor)     | `ArticleEditor` (lazy), `FlowLayout`, `FocusRequest`, `apps/live/components/canvas/article/ArticleEditor.tsx`                                                                                                                                                                                                                                                                                                |
| Every article on the tab | `ArticleFlows` (`ArticleFlows.tsx`): paper press layer, editors, `PageToolbar`, `ZoneBar`, `ZoneResizeGrips`, drop carets                                                                                                                                                                                                                                                                                    |
| Editor schema            | `articleSchema` (nodes `doc paragraph list_item code_block divider page_break zone text hard_break`; marks `link bold italic underline strike code sup sub color note highlight`), `lib/article/article-schema.ts`                                                                                                                                                                                           |
| Blocks ↔ editor          | `blockToNode`, `blocksToDoc`, `nodeToBlock`, `docToBlocks`, `lib/article/article-convert.ts`                                                                                                                                                                                                                                                                                                                 |
| Commands                 | `lib/article/article-commands.ts` (`setBlockStyle`, `toggleList`, `shiftLevel`, `setAlign`, `toggle*`, `setLink`, `setTextColor`, `setHighlight`, `clearFormatting`, `insertBlocksAfterCaret`, `enter`, `backspaceAtStart`, `deleteAtEnd`, `tab`, `shiftTab`, `lineBreak`, `selectAll`, `selectionStateOf`, `ArticleSelectionState`)                                                                         |
| Keys, Markdown as typed  | `articleKeymap(host)`, `articleInputRules()`, `lib/article/article-keys.ts`                                                                                                                                                                                                                                                                                                                                  |
| Pasted Markdown          | `looksLikeMarkdown`, `parseInline`, `parseMarkdownBlocks`, `plainTextBlocks`, `lib/article/article-markdown.ts`                                                                                                                                                                                                                                                                                              |
| Editor plugins           | `blockIdsPlugin`, `decorationsPlugin`, `todoTogglePlugin`, `FIRST_BODY_PLACEHOLDER` (`article-plugins.ts`); `slashPlugin`, `slashKey`, `removeSlashQuery` (`article-slash.ts`)                                                                                                                                                                                                                               |
| Slash menu               | `SLASH_ITEMS`, `SlashItem`, `SlashAction`, `filterSlashItems` (`article-slash-items.ts`); `SlashMenu` (`components/canvas/article/SlashMenu.tsx`)                                                                                                                                                                                                                                                            |
| Active article           | `ArticleEditorHandle`, `ActiveArticle`, `registerArticleHandle`, `articleHandleOf`, `setActiveArticle`, `blurActiveArticle`, `clearActiveArticle`, `useActiveArticle`, request signals, `markZoneReleased` / `takeZoneReleased`, `lib/article/article-editor-store.ts`                                                                                                                                       |
| Frame over the pages     | `FlowFrame`, `flowFrame`, `columnAt`, `pagePlaceOf`, `canvasPointOf`, `lib/article/article-flow-geometry.ts`                                                                                                                                                                                                                                                                                                 |
| Style as CSS             | `articleStyleVars(style, themeAccent, ink)`, `ArticleInk` (`lib/article/article-style-vars.ts`); stylesheet `apps/live/app/article-pages.css`                                                                                                                                                                                                                                                                |
| Page toolbar             | `PageToolbar` (`PageToolbar.tsx`); menus `StylePanel`, `ListPanel`, `AlignPanel`, `ColourPanel`, `MorePanel`, `InsertPanel` (`page-toolbar-panels.tsx`); `ToolbarPopover`, `MenuRow`, `SwatchGrid`, `LinkField` (`page-toolbar-menus.tsx`); `ARTICLE_TEXT_SWATCHES`, `ARTICLE_HIGHLIGHT_SWATCHES` (`lib/article/article-swatches.ts`); the card `TOOLBAR_CARD` etc. (`components/chrome/toolbar-surface.ts`) |
| Zone chrome              | `ZoneBar`, `ZoneResizeGrips` (`ZoneBar.tsx`); `useZoneDrag`, `ZoneDragState`, `DropCaret` (`useZoneDrag.ts`); `useObjectDropCaret` (`useObjectDropCaret.ts`); `DropCaretMark` (`ArticleFlows.tsx`)                                                                                                                                                                                                           |
| Drawing zone clip        | `publishZoneClips`, `useZoneClip`, `zoneClipPolygon`, `lib/article/zone-clip-store.ts`                                                                                                                                                                                                                                                                                                                       |
| Style tab                | `ArticleStyleSection` (`part: 'style' \| 'text'`), `ARTICLE_ACCENTS`, `components/canvas/article/ArticleStyleSection.tsx`                                                                                                                                                                                                                                                                                    |
| Carets                   | `caretOf`, `resolveCaret`, `ArticleCaretPlace` (`article-caret.ts`); local and peer store (`article-carets-store.ts`); `articlePeersPlugin`, `setArticlePeers`, `onlyPeers` (`article-peers.ts`); `useArticleCaretBroadcast` (`hooks/collab/`)                                                                                                                                                               |
| Export of the writing    | `ArticleDrawOp`, `snapshotWriting`, `snapshotBars` (`article-snapshot.ts`); `articleOpsToSvg`, `drawArticleOps` (`article-draw.ts`); `pageWriting`, `pageWritingBars`, `pageRulingOf` (`article-export.ts`)                                                                                                                                                                                                  |
| Reading frame (phone)    | `computeReadingFrame(rect, page, insetTop, margin)`, `apps/live/lib/viewport.ts`; `IllustratePagesView.readPage`                                                                                                                                                                                                                                                                                             |
| Article template         | `packages/templates/src/article-template.ts`                                                                                                                                                                                                                                                                                                                                                                 |

"Article" in code, specs and the interface for the kind of page and its run of pages; "document"
stays the livediagram file. "Writing" is the article's text as laid out; "flow" is the id that ties
an article's pages to its `ArticleFlow`. The size limits keep a `MAX_ARTICLE_*` prefix from the earlier
Document mode experiment; read it as "article". Headings keep with the next line and are never split
(`break-after` / `break-inside: avoid`), a zone is never split (`break-inside: avoid`), a page break
is `break-after: column` (`article-pages.css`).

## Constants and configuration

| Constant                                | Value                                  | Where / provenance                                                       |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `MAX_ARTICLE_BLOCKS`                    | 5000                                   | `article-flow.ts`; D34                                                   |
| `MAX_ARTICLE_RUNS`                      | 400 per block                          | `article-flow.ts`; D34                                                   |
| `MAX_ARTICLE_BLOCK_TEXT`                | 20,000 characters per block            | `article-flow.ts`; D34                                                   |
| `MAX_ARTICLE_HREF`                      | 2048 characters                        | `article-flow.ts`; D34                                                   |
| `ARTICLE_ZONE_MIN`, `ARTICLE_ZONE_MAX`  | 24, 2000 px                            | `article-flow.ts`; D35                                                   |
| `ARTICLE_LIST_MAX_LEVEL`                | 4 (five levels, 0 to 4)                | `article-flow.ts`; spec "Blocks"                                         |
| List indent                             | 28 px a level                          | `article-pages.css` (`--article-level`); spec "Blocks"                   |
| Id length read                          | 1 to 64 characters (block, flow, note) | `isArticleId` (`article-flow.ts`), `parsePage` flow; D33                 |
| `ARTICLE_TEXT_SIZE_PX`                  | 14 / 16 / 18                           | `article-style.ts`; spec "Article style"                                 |
| `ARTICLE_LINE_HEIGHT`                   | 1.3 / 1.5 / 2                          | `article-style.ts`; spec                                                 |
| `ARTICLE_PARAGRAPH_SPACE`               | 0 / 0.75 / 1.5 lines                   | `article-style.ts`; spec                                                 |
| `ARTICLE_MARGIN_PX`                     | 48 / 96 / 144                          | `article-style.ts`; spec                                                 |
| `ARTICLE_LOOKS`                         | spec "Looks"                           | `article-style.ts`; Clean is the unstyled default                        |
| `ARTICLE_TOP_MIN_PX`                    | 72                                     | `article-style.ts`; spec "The page toolbar"                              |
| Margin cap in the frame                 | 37.5% of the page's width and height   | `flowFrame`; D49                                                         |
| `ARTICLE_ACCENTS`                       | 8 presets (Blue to Slate)              | `ArticleStyleSection.tsx`; spec "eight presets", hexes D47               |
| `ARTICLE_TEXT_SWATCHES`                 | 9 colours                              | `article-swatches.ts`; spec "The page toolbar", hexes D48                |
| `ARTICLE_HIGHLIGHT_SWATCHES`            | 9 pale tints                           | `article-swatches.ts`; D48                                               |
| `UNDO_SETTLE_MS`                        | 400 ms                                 | `ArticleEditor.tsx`; D60                                                 |
| `ARTICLE_IDLE_COMMIT_MS`                | 600 ms                                 | `ArticleEditor.tsx`; spec "Commits"                                      |
| `WRITER_WINDOW_MS`                      | 3000 ms                                | `ArticleEditor.tsx`; D36                                                 |
| `SETTLE_TOLERANCE`                      | 0.75 px                                | `article-zones.ts`; D37                                                  |
| `ARTICLE_DRAWING_PAD`                   | 24 px                                  | `article-intake.ts`; spec "Zones" (24 px to spare)                       |
| `ARTICLE_DRAWING_MIN_HEIGHT`            | 200 px                                 | `article-intake.ts`; D38                                                 |
| `NEW_DRAWING_HEIGHT`                    | 240 px                                 | `useArticles.ts`; spec "Zones" (text width x 240)                        |
| `ARTICLE_WRAP_MAX_SHARE`                | 2/3 of the text width                  | `article-intake.ts`; spec "Zones"                                        |
| Wrapped zone gap                        | 14 px                                  | `article-pages.css` (`margin-left/right`); spec "Zones"                  |
| Object insert offset                    | 30 px under the caret's top            | `useArticles.insertObject`; D39                                          |
| Fallback text width                     | 600 px                                 | `textWidth` / `textWidthOf`; D52                                         |
| `ARTICLE_NOTE_SIZE`, `ARTICLE_NOTE_GAP` | 32 px, 6 px                            | `article-notes.ts`; spec "Comments and actions"                          |
| Toolbar `MARGIN_PAD`                    | 4 screen px                            | `PageToolbar.tsx`; D41                                                   |
| `TOOLBAR_MIN_SCALE`                     | 0.55                                   | `PageToolbar.tsx`; spec "to 55%"                                         |
| `PHONE_GUTTER`, `PHONE_CONTROLS_ROOM`   | 8, 64 screen px                        | `PageToolbar.tsx`; D41                                                   |
| `HOVER_SLACK`, `HOVER_GRACE_MS`         | 12 px, 250 ms                          | `PageToolbar.tsx`; spec "a moment's grace", D41                          |
| `READING_TOP_ROOM`, `READING_SIDE_ROOM` | 104, 32 screen px                      | `lib/viewport.ts`; D50                                                   |
| `SLASH_QUERY_MAX`                       | 24 characters                          | `article-slash.ts`; D44                                                  |
| Slash menu `WIDTH`, `MAX_HEIGHT`        | 260, 320 px                            | `SlashMenu.tsx`; D44                                                     |
| `ARTICLE_PEER_FRESH_MS`                 | 1500 ms                                | `article-carets-store.ts`; D40                                           |
| `BROADCAST_THROTTLE_MS`                 | 33 ms (the cursor's rate)              | `useEditorBroadcast.ts`; spec "at the cursor's rate"                     |
| `ARTICLE_CARET_MAX_ID_LEN`              | 256                                    | `packages/api-schema/src/article-caret.ts`; D43                          |
| `ARTICLE_CARET_MAX_OFFSET`              | 1,000,000                              | `article-caret.ts`; D43                                                  |
| `ARTICLE_FRAME_CHARS`                   | 200,000 characters per `article` frame | `tab-broadcast-ops.ts`; D42, under the room's `MAX_MESSAGE_CHARS` (256K) |
| `MAX_ILLUSTRATE_PAGES`                  | 100                                    | `illustrate-page.ts`; spec "Limit"                                       |
| Page number                             | 12 px, half the bottom margin          | `IllustratePages.tsx`, `pageWriting`; D46                                |
| Turn Into Pages text colour             | `#1f2937`                              | `articleAsPages`; D54                                                    |

## Data and persistence

- **Stored**: `IllustratePage.kind: 'article'` and `flow` on each page of an article
  ([Illustrate pages blueprint](illustrate-pages.md)), and `Tab.articles[flow] = { blocks,
style? }`. Saved with the tab (D1 row, `MAX_TAB_BYTES` has the last word), carried in the
  OpenAPI `Tab` schema (`ArticleFlow`, generated). Defaults are absent, never stored: `style:
'body'`, `align: 'left'`, `level: 0`, `wrap: 'inline'`, zone `align: 'center'`, an empty style.
- **Field classes**: `blocks` and `style` are document content, synced block by block; `at` on a
  zone is derived layout, written only by the writer's settle; margin-note markers are ordinary
  elements (`articleNote` set). The editor's state (caret, slash menu, active article, carets,
  zone clips, previews) is memory only.
- **Reading** (`articlesOf` → `parseArticleFlow` → `parseArticleBlock` / `normaliseRuns` /
  `parseArticleStyle`), defensive, cached per stored object (`WeakMap`) so readers can memo:
  - `articles` not a plain object: none. A flow key that is not an id: dropped.
  - A block with no id, an unknown `type`, a list with an unknown `list`, a zone with an unknown
    `zone` or a non-finite `width` / `height`: dropped. A repeated id: dropped after the first.
    At most `MAX_ARTICLE_BLOCKS`. An article with no block reads as one empty paragraph
    (`<flow>-b0`), so it is never empty.
  - Runs: non-string or empty text dropped; flags kept only when `true`; `sup` and `sub` together
    keep `sup`; `href` kept only through `isSafeArticleHref`; `color` / `hl` only as hex; `note`
    only as an id (`isArticleId`), `nk` only `'action'`. Neighbours of one format merge; text and
    link addresses together capped at `MAX_ARTICLE_BLOCK_TEXT` over at most `MAX_ARTICLE_RUNS` runs.
  - `level` floored and capped to `ARTICLE_LIST_MAX_LEVEL`; `checked` only on a to-do; zone
    `width` / `height` rounded and clamped to `ARTICLE_ZONE_MIN..MAX`; `at` kept only with an id
    page and finite `x`, `y`; code text sliced to the cap.
  - Style: each field kept when valid (`look` a look id, fonts `^[a-z0-9-]{1,40}$`, `accent` hex,
    booleans, the five enums); an empty style is dropped.
- **Pages read**: an article page with no readable flow reads as an article of its own (its id);
  `withArticlesTogether` puts a flow's pages in one run at its first page, each taking the
  first's size, orientation and background ([Illustrate pages blueprint](illustrate-pages.md)).
- **Sync** (`tabBroadcastOps`): `articles` is in `META_SKIP`, so never in a `tab-meta` patch; a
  whole-tab op is sent without it (`wholeTabOp`), followed by `tabArticleOps`. `tabArticleOps`
  compares `articles` by identity first; per flow gone: `{ kind: 'article', removed: true }`; per
  flow changed: `diffArticleFlow(was, now)` chunked into frames under `ARTICLE_FRAME_CHARS`
  (ops in order; frames compose), each frame of a flow the sender did not have before marked
  `created: true`. Receiving (`applyRoomOpToTabs`): a flow that is not an id changes nothing; a
  removal deletes an own-property flow; ops are read through `parseArticleOps` (each `put` block
  parsed as a stored block, ids bounded, malformed ops dropped; a non-list frame changes nothing)
  and applied only when the flow is known here, the frame is `created`, or one of the tab's pages
  carries the flow (writing for an article removed meanwhile is dropped). The `articles` field is
  dropped with its last flow. `mergeRemoteTab` keeps the local `articles` through a whole-tab
  merge.
- **`diffArticleFlow`**: removes first, then a `put` for each block new or moved (not in the
  longest increasing run of kept positions, O(n log n)), placed `after` its predecessor and
  `before` its successor; a block only changed in its place is a `put` with neither (replaced
  where it stands on the receiver, so a collaborator's block added beside it keeps its place);
  then a `style` op when the style differs (`sameArticleValue`, key-order blind). A block whose
  neighbour merely changed is not resent.
- **`applyArticleOps`**: a `put` with no place replaces the block where it is (appended when
  missing); a placed `put` removes the block if present, then inserts after `after`, else before
  `before`, else at its old index, else at the end; a missing `remove` is a no-op; never empty
  (`b-empty` paragraph).
- **Turn Into Pages** (`withArticlesAsPages`): Page elements (`createShape('page')`) per article
  page under every other element; article pages become `kind: 'infographic'` (`flow` dropped);
  `articles` deleted; `articleNote` dropped from markers. One edit.
- **Snapshot, restore**: the writing is tab data, so history, undo, offline store, export JSON
  and version restore carry it unchanged. No migration: every field is new and optional; a tab
  without `articles` has none.

## Behaviour and state

### Composition (`useEditorState`)

- `localEditSeqRef` counts this person's `commitTabs` (never a remote op, an undo or a tick).
- `useArticles({ activeTab, on: illustratePages !== null, pages, localEditSeq, placeAt, canEdit,
commitTabs, tickTabs, undo, redo, clearSelection, openNote })` returns `ArticlesView` or null
  outside Illustrate mode; it is spread onto the pages view (`illustratePages.articles`).
- `openNote(id, kind)`: a comment opens `openComments(id)`; an action opens its popover when the
  marker has actions, else `openAssignActionDialog(id)`.
- A new article's title takes the caret: `useIllustratePages({ onArticleCreated })` calls
  `articles.requestFocus(flow, 'start')` (through `articleFocusRef`); the editor that takes it calls
  `onFocusTaken(seq)` and `focusTaken` clears the request, so a remounted editor never takes it
  again.
- `placeAt` is `useElementCreation.placeIntentAt(intent, x, y)` (through `placeIntentAtRef`): an
  element of its default size at a canvas point, refused while edits are blocked.

### The writing (`ArticleEditor`)

- One per flow, mounted by `ArticleFlows` under `Suspense` (`lazy(() => import('./ArticleEditor'))`),
  keyed by flow; created once (refs for everything it reads).
- **Box**: one `.article-flow` element positioned at `flowFrame(pages, margin)`: `x/y` the lead's
  corner plus margin and top, `column-count` = pages, `column-gap` = `2 * margin +
ILLUSTRATE_PAGE_GAP`, so the browser breaks lines between pages and wraps text round floated
  zones; `height` the page less top and bottom margins.
  Writing past the last column waits under the page clip (`pagesClipPath`).
- **Commit**: `dispatchTransaction` schedules `flush` `ARTICLE_IDLE_COMMIT_MS` after a local doc
  change; `flush` runs `docToBlocks(doc, committed.blocks)` and, when changed, `onCommit(flow,
blocks)` → one `commitTabs` (`withArticleFlow`, the style kept); `onCommit` returns false when
  the host refuses (no rights, a locked tab), and the blocks then stay local, uncommitted, for the
  next commit. Also flushed on blur, on
  Escape, before undo / redo, before every handle edit (`insertZone`, `moveZone`, `markNote`
  take the writing as written themselves), on unmount and on Turn Into Pages.
- **Merge in**: when `props.doc !== committed`, local changes since the last commit are diffed
  (`diffArticleFlow(base, local)`, style ops dropped), applied over the incoming flow, and the
  editor content replaced between the first and last differing positions (`replaceContent`,
  `article-remote` meta, `addToHistory: false`), so a caret in an untouched block stays. An undo /
  redo from the writing marks itself for `UNDO_SETTLE_MS`; writing that comes back meanwhile takes
  the caret (at the end of what changed), and the mark lapses so a later collaborator's edit never
  does. Remaining local ops schedule a commit.
- **Measure** (one `requestAnimationFrame` after a doc change, a props change, `document.fonts`
  `loadingdone`): `pagesNeeded` from the rightmost client rect's column; each `.article-zone`'s
  page index and corner (half-px rounded); each first `[data-note-id]` rect as an
  `ArticleNotePlace`; `local` = a local change within `WRITER_WINDOW_MS` or the view has focus.
  Reported as `onLayout(FlowLayout)`.
- **Publish**: on focus and each transaction while focused: `setLocalArticleCaret(flow,
caretOf(state))` (editable only), `setActiveArticle({ handle, pageId: caretPage, selection,
focused: true })`. On blur: an open slash menu closes; a tick later (one pending timer, cleared on
  unmount), unless refocused, `blurActiveArticle(flow)` and the local caret cleared.
- **Peers**: `useArticlePeers(flow)` dispatches `setArticlePeers` (meta only); `onlyPeers(tr)`
  transactions skip commit and publish.
- **Paste**: `clipboardTextParser` reads Markdown (`looksLikeMarkdown` → `parseMarkdownBlocks`)
  or several plain lines (`plainTextBlocks`) as blocks, open at both text ends; into code or a
  single plain line, as typed. `handlePaste` with plain text into an empty text block replaces
  the block with the pasted blocks. HTML paste goes through the schema's `parseDOM` (see
  Security). `ArticlePaste` fires for Markdown only.
- **Handle** (`ArticleEditorHandle`, registered by flow): `run`, `can`, `insert`, `flush`, `undo`,
  `redo`, `focus`, `selection`, `claimLayout` (stamps the writer window), `caretRect`,
  `blocksByPage`, `markNote`, `boundaryNear`, `moveZone`, `insertZone`, `snapshot`, `bars`,
  `focusAt`, `caretCanvasPoint`.
- **Press**: a pointerdown on `.article-flow > *` while `interactive` stops propagation and calls
  `onWritingPress` (the canvas selection clears); the paper layer (`[data-article-paper]`, one per
  shown page, editable and interactive only) calls `focusAt(clientX, clientY)`: into the pressed
  page's column, then `posAtCoords`, else the end.
- `interactive` is false while a draw is pending or the spotlight or avatar tool is in hand
  (`Canvas`); `data-inert` then drops the writing's pointer events.

### Keys, rules, slash menu

- `articleKeymap` first after the slash plugin, then `baseKeymap`; bindings as the spec's
  "Keyboard", plus `Mod-y` redo. Undo / redo go to the host history (`onUndo` / `onRedo`), never
  ProseMirror's. Escape flushes and blurs.
- `enter`: code takes `\n` (an empty last line leaves it for a paragraph); at the end of a heading
  with an empty body paragraph next, the caret moves into it; an empty list item steps out
  (`shiftLevel(-1)`); an empty quote becomes body; else `splitBlockAs` (a list item keeps kind and
  level, unticked; after a heading at its end, body; a quote stays a quote).
- `backspaceAtStart`: list steps out; a non-body paragraph becomes body; a divider or page break
  before is deleted; a zone before is selected (an empty text block goes with the move); else
  `baseKeymap` joins. `deleteAtEnd` mirrors it forwards. `Backspace` first tries
  `undoInputRule`.
- `tab`: list in; code two spaces; body at offset 0 becomes a bullet; otherwise swallowed (focus
  stays). `shiftTab` list out.
- Input rules (`articleInputRules`): block rules only at offset 0 of a paragraph; `#`/`##`/`###`,
  `>`, `-*+`, `1.`/`1)`, `[ ]`/`[x]` followed by a space; ` ``` ` (code) and `---`/`***`/
  `___` (divider) as the paragraph's whole text; inline closing-mark rules, never in code.
- `blockIdsPlugin` (`appendTransaction`, no history): a missing or repeated block id gets a fresh
  one. `decorationsPlugin`: list markers as `data-marker` node decorations; placeholders while
  editable (title, subtitle, headings, quote, list "List", to-do "To-do"; the first body paragraph
  of an article of at most three blocks `FIRST_BODY_PLACEHOLDER`; else an empty block holding the
  caret "Type / for blocks"). `todoTogglePlugin`: a mousedown in a to-do's left padding toggles
  `checked` (one transaction, so one commit).
- `slashPlugin`: opens on a typed `/` at offset 1 or after whitespace (never by paste or remote);
  closes on a selection, the caret leaving the `/`, a leading space, a newline, past
  `SLASH_QUERY_MAX`, Escape (meta `close`). While open it takes ↑ ↓ Enter Tab Escape;
  `filterSlashItems` orders name-starts, name-contains, keyword-starts. A pick removes the query
  (`removeSlashQuery`) then: a style, a list, a divider or a page break (+ paragraph) via
  `insertBlocksAfterCaret`, or `onInsert(flow, what)`.

### The page toolbar (`PageToolbar`)

- Shown for `useActiveArticle()`, else for the article page under the pointer
  (`useHoveredArticlePage`: `pointermove`, rAF, `HOVER_SLACK`, `HOVER_GRACE_MS`; touch ignored;
  over `[data-article-keep-active]` keeps it). Only while `articles.editable`.
- `useOffPagePressClears`: a capture-phase pointerdown off the active article's sheets and off
  every `[data-article-keep-active]` (the toolbar, its popovers, the zone bar, the page's cog row
  and panel) runs `clearActiveArticle(flow)`.
- Placement each frame (rAF while a page is active) against `[data-illustrate-page-id]`: desktop,
  centred in the top margin (`topRoomOf(pageId)` = `articleTopMarginPx(style) * zoom`), scaled
  `clamp(TOOLBAR_MIN_SCALE, (room - 2 * MARGIN_PAD) / h, 1)`, kept inside the page and the canvas
  (`maxWidth`, scrolls sideways), hidden when its page's top is out of the canvas or under the
  Toolbar strip; phone (`useIsMobileViewport`), a bar across the bottom: right above the keyboard
  (`visualViewport`) when it is up, else `PHONE_CONTROLS_ROOM` above the canvas bottom.
- Buttons never take focus (`onMouseDown` preventDefault); `handle.run` refocuses the writing.
  ⌘K (`requestArticleLink`) opens the link field; ⌘⌥M (`requestArticleComment`) adds a comment
  when text is selected. A menu closes with the article (`!active`).
- **More › Article style**: flush, then `requestStylePanel(pageId)`; `IllustratePages` opens that
  page's panel on Style.
- **Insert**: blocks through `handle.insert` (divider; page break + paragraph; quote paragraph;
  code block); objects through `articles.insertObject(handle.flow, what)`, and Comment / Assign
  Action through `articles.addNote(handle.flow, kind)`: the article the toolbar shows for, worked
  on or hovered.

### Zones

- **Intake** (`useArticleIntake`, a `useLayoutEffect` on the tab): runs only after a local edit
  (`localEditSeq` moved, or an element gesture from `ELEMENT_GESTURES` just ended, measured from
  its start), on the same tab, in Illustrate mode, editable. In one `tickTabs` (folded into the
  edit's undo step):
  1. `objectsDraggedOut(before, now)`: each object zone whose object's centre left the zone onto
     the same article's pages: `handle.moveZone(zoneId, at)`; landed: `withZoneLanded` and the
     object to the new rect; not moved (dropped by its own place): the object back to its zone
     rect.
  2. Markers deleted: `withNoteMarksRemoved`; note text gone: `withNoteMarkersRemoved`.
  3. Zones gone from the writing (and not `takeZoneReleased`): `withZoneContentsRemoved` (their
     members, then arrows pinned or riding them, to a fixed point).
  4. Elements just added and loose on an article page (`looseOnArticles`) per flow:
     `zonePlanFor(els, all, textWidth)` (one non-drawing box: an object zone of its size, scaled to
     the text width; else a drawing zone the text width, `max(ARTICLE_DRAWING_MIN_HEIGHT, h + 2 *
ARTICLE_DRAWING_PAD)` tall), `handle.insertZone(spec, centre)`, `withZoneLanded`,
     `withElementsIntoZone` (centred, scaled about the box corner). `ArticleDrawing` /
     `ArticleObject`.
  5. `withZonesFitted` per article: an object zone takes its object's size (capped to the text
     width) and pins it to its corner; an object zone with no object leaves the writing; a drawing
     zone grows right and down to keep members `ARTICLE_DRAWING_PAD` inside, never shrinks.
- **`insertZone(spec, near)`**: at `boundaryNear(near)` or after the caret's block; an empty
  paragraph holding the caret beside the boundary gives its place; a paragraph is appended when the
  zone ends the writing; the caret goes after it. Returns `LandedZone` (blocks taken as written,
  page index, corner).
- **`boundaryNear(point, skipId)`**: over the top-level nodes' client rects in the point's column
  (24 screen px slack each side), nearest by vertical distance, before the block when in its upper
  half; with the caret line across the column.
- **Settle** (`useArticles.onLayout`, local only): one `tickTabs`: `withArticlePageCount(flow,
pagesNeeded)` (adds pages like the last; removes trailing pages with no elements; never under
  one or past the limit), then `withZonesSettled` (each zone's `at` from its measured place,
  members read before any move so none is handed to another zone; a page index not yet present
  waits), then `withNotesSettled`.
- **Zone bar actions** (`zoneAction`): a choice already in force (the same tab back) is no edit;
  else `claimLayout`, then one `commitTabs`: remove
  (`withZoneRemoved`), float (`markZoneReleased` then `withZoneReleased`), size (`withZoneSize`:
  height `max(least, h)` up to `ARTICLE_ZONE_MAX`, width up to the text width or its wrap share,
  never under the members' need), wrap / align (`withZoneWrap`: a wrapped zone over 2/3 of the text
  width is scaled down with its members).
- **Embed** (a floating object's In line / Wrap): `zonePlanFor` + `insertZone` at the objects'
  centre, landed, members moved in, then `withZoneWrap` for a side wrap.
- **Move by grip** (`useZoneDrag`): window pointer listeners, rAF ghost and caret
  (`boundaryNear(point, zoneId)`), `.article-zone-lifted` dims the zone; release with a caret calls
  `moveZone` → `handle.moveZone` (`null` when dropped beside itself) → `withZoneMoved` (landed,
  members carried by the delta). Escape or `pointercancel` drops it.
- **Object drop caret** (`useObjectDropCaret`): while the canvas gesture is `move` with one object
  selected in an object zone, each frame reads the element's screen box and shows
  `boundaryNear` once its centre is off the zone and on the article's pages.
- **Clip**: `drawingZoneClips(rowPages, flows, elements, isDrawingElement)` (a member by anchor,
  else a box overlapping a zone), the selection removed while it moves (`selectionMoving`),
  published by `publishZoneClips` (identity kept per rect); element views read `useZoneClip(id)`
  and apply `zoneClipPolygon`. Exports clip the same set (`exportZoneClips`).
- Quick-connect pluses are off for a selected non-drawing element on an article page
  (`Canvas.plusAllowed`).

### Margin notes

- `addNote(flow, kind)`: `id = crypto.randomUUID()`; `handle.markNote(id, kind)` adds the `note`
  mark over the selection and returns blocks plus the first rect's place; one `commitTabs`: the
  blocks written and `newArticleNote(id, kind, articleNoteCorner(page, margin, place))` appended;
  then `openNote`.
- Settled with the layout (`withNotesSettled`): in writing order, centred in the right margin,
  level with the first line; a note on a page whose last marker's bottom is lower is pushed down
  to it plus `ARTICLE_NOTE_GAP`; moved only past 0.5 px.
- Plain click on `[data-note-id]` with a collapsed DOM selection opens it (`article-note-action`
  class says which).

### Style

- `setStyle(flow, change)`: preview cleared; the look or value already in force is no edit; else
  `claimLayout`, telemetry, one `commitTabs` (`withArticleStyleChanged`, which returns the same tab
  for a look already chosen or a patch already so). A look writes every look field and `look`, keeping `accent`,
  `margins`, `pageNumbers`; a patch drops `look`. Choosing Notebook adds `pattern: 'lines'` to the
  article's pages; leaving Notebook for another look removes it.
- Preview: `setStylePreview({ flow, style })` on hover; `ArticleEditor.styleOverride` and the
  margin follow it; `ArticleStyleSection` clears it on pointer leave and on unmount (the panel
  closing by Escape or a press elsewhere).
- Ink (`ArticleFlows.inkOf`): the lead page's (preview-aware) fill tone, else the paper per
  chrome; `articleStyleVars` makes the CSS variables; the accent goes through `legibleOn`.
- Ruling: `pageSheetStyle(background, { pitch: articleBodyLinePx, inset: margin, top })` and the
  export's `pageExportFrame({ ruling })` draw Lines on the body baseline pitch inside the margins.

### Leaving Illustrate (`useLeaveIllustrate`)

Wraps `useSwitchSetsOpensIn(useEditorMode(...))`. `setMode(next)` asks (sets `pending`) only when
the mode is `'illustrate'`, `next` is not, the person may edit, the tab is unlocked and has an
article; else it switches. `convert`: per flow, `flush()` then `blocksByPage()`; `ArticlesToPages`;
one `commitTabs(withArticlesAsPages(t, splits))`; then switches. `keep` switches; `cancel` clears.
Shift+D reaches the wrapped `setMode`; Opens in uses the raw one, so it never asks.

### Collaboration

- Writing: commits go out as `article` ops (Data and persistence); a peer's land in `tabs`, and
  `ArticleEditor` merges them in. Only the writer settles consequences (`FlowLayout.local`).
- Carets: `useArticleCaretBroadcast({ roomRef, live, activeId, hidden })` subscribes to the local
  caret; sends `{ kind: 'article-caret', tabId, flow, blockId, offset }` at most every
  `BROADCAST_THROTTLE_MS` with the last place following; on losing the caret (or unmount, or a
  hide-cursors vote opening) sends `{ flow: null }` once if one was shown. Sends nothing while the
  room is not live. `setArticleCaretsTab(activeId)` scopes drawing to this tab.
- Receiving (`useRoomConnection`): `parseArticleCaret(op)` then `receiveArticleCaret(from,
caret)`; `syncArticlePeople(participants)` names and colours carets and drops those who left;
  `resetArticlePeers()` when the room closes. `articlePeersOf(flow)` returns carets on this tab
  from known people, kept by identity until a change; a caret is `fresh` for
  `ARTICLE_PEER_FRESH_MS` after it moves.
- The room relays `article-caret` as presence (unordered, never logged or replayed, from any
  session); `article` as a mutation (edit role only, sequenced, in the catch-up log).

### Everywhere else

- **Export** (`renderTabToCanvas` / `renderTabToSvg` with `opts.page`): `pageWriting(tab, page)`
  takes `handle.snapshot()` ops on that page (1 px slack) plus the page number; the SVG gets
  `articleOpsToSvg` after the font defs (fonts `headingFont`, `bodyFont`, `roboto-mono` added);
  the canvas awaits `document.fonts.ready` then `drawArticleOps`, before the elements.
  Margin-note markers are left out (`isArticleNoteMarker`). PDF renders each page through the
  canvas (`exportPagesAsPdf`).
- **The Map and slide thumbnails**: `pageWritingBars(page, ink)` (`handle.bars`) as soft rects
  through `articleOpsToSvg`; the Map recomputes on `writing` identity.
- **Present** (`presentedPages`): the view narrowed to the page, `rowPages` the whole row (the
  writing lays out across all its pages), `articles.editable: false`.
- **Phone framing**: `ArticleFlows` calls `view.readPage(pageId)` once each time the writing takes
  focus on a phone (`computeReadingFrame` with the margin, so the column fills the width).
- **Isometric**: `ArticleFlows` is not mounted (`canvasTool !== 'isometric'`).

## Interfaces and contracts

- `articlesOf(tab): Readonly<Record<string, ArticleFlow>>`: never throws; same object per stored
  object.
- `parseArticleFlow(v, fallbackId?)`: never empty. `parseArticleBlock(v)`: a block or undefined.
- `diffArticleFlow(before | undefined, after): ArticleOp[]`; `applyArticleOps(flow | undefined,
ops): ArticleFlow` (never empty). For any `a`, `b`: `applyArticleOps(a, diffArticleFlow(a, b))`
  equals `b` by value.
- `withArticleAdded`, `withArticleDuplicated`: null at the page limit (or a taken id);
  `withArticleRemoved`: null for the only unit or an unknown flow; `withUnitMoved`: null when
  nothing moves. `withArticlePageCount`, `withZonesSettled`, `withNotesSettled`,
  `withZonesFitted`, `withZoneWrap`, `withZoneSize`, `withArticleStyleChanged`,
  `withArticlesAsPages`: the same tab back when nothing changes or the flow is unknown.
- `withZoneLanded(tab, flow, landed): { tab, rect | null }`: rect null when the article or the
  landed page is gone.
- `ArticleEditorHandle` methods returning a landing (`insertZone`, `moveZone`, `markNote`) return
  null when nothing happens (no selection, no boundary, dropped in place).
- `parseArticleOps(v): ArticleOp[] | null`: null when `v` is not a list; else only well-formed
  ops, each `put` block parsed as a stored one.
- `parseArticleCaret(op): ArticleCaret | null`: `tabId` an id; `flow: null` allowed; else `flow`
  and `blockId` ids (1 to 256 chars) and `offset` an integer in 0..1,000,000.
- `ArticlesView` (null outside Illustrate): see `useArticles.ts`; every action is a no-op for a
  person who cannot edit or a locked tab.
- `LeaveIllustrate`: `{ pending, convert, keep, cancel }`.

## Errors and edge cases

| Case                                               | Handling                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Malformed stored writing                           | Read defensively (Data and persistence); an empty article reads as one paragraph                        |
| Article page with no flow                          | Its own article (flow = page id); writing created empty on first read                                   |
| Flow's pages split by crossed edits                | `withArticlesTogether` rejoins them at the first page, each taking its size and paint                   |
| Commit to an article deleted meanwhile             | `onCommit` skips the tab (no writing for a missing flow)                                                |
| Commit refused (tab locked meanwhile)              | `onCommit` false: the writing stays local and goes with the next commit                                 |
| Malformed `article` frame from a peer              | `parseArticleOps` drops it (or its bad ops); nothing applied                                            |
| Writing for an article removed here meanwhile      | Dropped unless `created` or its pages are present                                                       |
| A copied article's margin notes                    | Relinked to the copied markers (`withNotesRelinked`); a note whose marker was not copied loses its mark |
| An undo that touches no writing                    | The undo mark lapses after `UNDO_SETTLE_MS`; no stray caret jump                                        |
| A zone or style choice already in force            | No edit, no undo step                                                                                   |
| Remote change while typing                         | Local block ops re-applied over it; the caret's block untouched                                         |
| Two people in one paragraph                        | Last commit wins for that block (spec non-goal: no character merge)                                     |
| A block op naming a missing neighbour              | Placed by the other neighbour, its old index, or the end                                                |
| A frame over the room's cap                        | Ops split into `ARTICLE_FRAME_CHARS` frames; a single larger block is not split                         |
| Writing past the page limit                        | `withArticlePageCount` stops at `MAX_ILLUSTRATE_PAGES`; the rest is clipped from view                   |
| Trailing page that holds elements                  | Kept; trailing removal stops at it                                                                      |
| Zone measured on a page not yet added              | Waits (`withZonesSettled` skips it) until the settle that adds the page                                 |
| A zone moving into another's old place             | Members read before any move: neither steals the other's elements                                       |
| Object zone whose object was deleted               | `withZonesFitted` drops the zone                                                                        |
| Zone floated (released)                            | `markZoneReleased` so the intake keeps its elements                                                     |
| Zone dropped beside itself / Escape                | `moveZone` returns null; nothing written                                                                |
| Note marker deleted / note text deleted            | Tint removed / marker removed, in the same step (undo brings both)                                      |
| Layout reported by a non-writer                    | Ignored (`local` false); their client settles their own                                                 |
| Fonts arriving late                                | `loadingdone` re-measures                                                                               |
| Export with no editor laid out                     | `pageWriting` returns null: the page exports bare                                                       |
| Malformed peer caret op                            | `parseArticleCaret` null: dropped                                                                       |
| Caret for a block that went                        | `resolveCaret` null: not drawn                                                                          |
| Caret from someone not in the room, or another tab | Not drawn                                                                                               |
| `getBoundingClientRect` / `coordsAtPos` throws     | Caught: caret page falls back to the first page, caret rect null                                        |
| Leaving Illustrate on a locked tab or as a visitor | Switches straight away (no dialog)                                                                      |
| Stale dev bundle                                   | Not a code path; restart the dev server (wipe `.next-dev`)                                              |

## Security and trust

- No server path is added: the writing is tab data, written by the existing save and room, read
  defensively by every client (`articlesOf`); the room enforces the edit role on `article` ops and
  the presence rules on `article-caret` (any session; never stored or replayed).
- **Links**: only `http:`, `https:` and `mailto:` (`isSafeArticleHref`, at most `MAX_ARTICLE_HREF`) are
  stored, pasted (`parseDOM` `getAttrs` returns false), parsed from Markdown or set
  (`setLink` refuses); rendered with `rel="noopener noreferrer nofollow"`. The link field
  normalises a bare domain to `https://` and an address to `mailto:` (D45).
- **Paste**: HTML is parsed through `articleSchema` only: headings, paragraphs, quotes, `pre`,
  `hr`, `br`, lists and `strong b i em u s del strike code sup sub a[href]` survive; `color`,
  `highlight` and `note` marks have no `parseDOM` (never from a paste); zones never parse. Google
  Docs' `<b style="font-weight:normal">` wrapper is not bold.
- **CSS injection**: colours reach style attributes only as validated hex (`isArticleHex`,
  `safeMarkColor`); fonts resolve through the catalogue (`resolveFontStack`), stored ids match
  `^[a-z0-9-]{1,40}$`.
- **Export markup**: every string in `articleOpsToSvg` goes through `xmlEscape`; zone clip ids are
  stripped to `[a-zA-Z0-9-]`.
- **Presence trust**: a caret op is checked field by field; names and colours come from the room's
  presence list, never the op; carets are `aria-hidden` decorations and never written.
- `window.__articleView` (the editor view) is exposed only when `NODE_ENV !== 'production'`, and
  removed with its editor.

## Performance and limits

- Worst case per article: 5000 blocks x 20,000 characters is far past `MAX_TAB_BYTES` (1.99 MB):
  the tab cap binds first; the block caps bound parse time and op size.
- `articlesOf` is cached per stored object; `docToBlocks` and `diffArticleFlow` keep identity for
  unchanged blocks, so an idle commit diff is O(blocks) and sends only changed blocks.
- `diffArticleFlow` is O(n log n) (longest increasing subsequence); `applyArticleOps` O(ops x n).
- `article` frames stay under 200,000 characters, inside the room's 256K message cap; ops are
  sent only on commit (at most every 600 ms while typing).
- Carets: one op per 33 ms per writer at most; the peer store re-renders only the article whose
  carets changed (`useSyncExternalStore`, per-flow snapshots); a caret change is a meta
  transaction, never a commit or a canvas render.
- Measure: once per animation frame; layout settles only for the writer and only when something
  moved (`SETTLE_TOLERANCE`, 0.5 px for markers).
- Zone clips: O(elements x zones) per render of `ArticleFlows`, published per element so only a
  view whose clip changed re-renders.
- Page toolbar and drop carets follow by rAF while shown, writing styles directly (no React
  render per frame).
- At most `MAX_ILLUSTRATE_PAGES` (100) pages; one editor per article, columns per page.

## Presentation and UX

Copy and layout as the spec. Labels: toolbar **Article formatting**; buttons **Style: <style>**,
**Bold**, **Italic**, **Underline**, **Colour**, **Link**, **Lists**, **Alignment**, **More
formatting**, **Insert**, **Comment**, **Assign Action** (each tooltip with its shortcut, ⌘ or
Ctrl spelled by platform via `keyLabel`); menus **Text style**, **Lists** (with **Increase
indent** / **Decrease indent** while in a list), **Alignment**, **Colour** (**Text** / **Highlight**,
**Default colour** / **No highlight**), **Link** (placeholder "Paste or type a link", **Apply**,
**Remove**), **Insert**, **More formatting** (**Strikethrough**, **Inline code**, **Superscript**,
**Subscript**, **Clear formatting**, **Article style**); slash menu **Insert a block** with each
entry's hint; zone bar **Drag to move**, **In line**, **Wrap left**, **Wrap right**, **Float**,
**Align left / centre / right**, **Delete** (**Delete drawing** on a drawing); grips **Drawing
height / width / size**; placeholders "Title", "Subtitle", "Heading 1..3", "Quote", "List",
"To-do", "Start writing, or press / for blocks", "Type / for blocks"; page break "Page break"; the
Style tab sections **Looks**, **Accent** (**Headings in the Accent**), **Page** (**Margins**,
**Page Numbers**); the Text tab **Fonts** (**Headings**, **Body**), **Size and Spacing** (**Text
Size**, **Line Spacing**, **Paragraph Spacing**, **Lines Under Text**); the dialog **Turn Articles
Into Pages?** with **Cancel**, **Keep as Articles**, **Turn Into Pages** (focused). Empty states:
a new article is a Title and an empty paragraph with placeholders; loading: the editor's chunk
loads behind `Suspense` with no fallback (the sheets show meanwhile); errors: none surfaced (every
failure is a silent no-op with a debug log).

## Accessibility

- The writing: `role="textbox"`, `aria-multiline="true"`, `aria-label="Article text"`,
  `spellcheck`, `aria-readonly="true"` for a viewer; native caret, selection, IME, dictation and
  emoji input; all formatting reachable by keyboard (spec "Keyboard").
- Toolbar `role="toolbar"`; toggles `aria-pressed`; menu buttons `aria-haspopup="menu"` and
  `aria-expanded`; names carry the shortcut; disabled Comment / Assign Action while no text is
  selected. Popovers `role="dialog"` named; menus `role="menu"` with `menuitemradio` rows and
  `aria-checked`; swatches `role="radiogroup"` / `role="radio"`; Escape closes (capture) and the
  caret returns.
- Slash menu `role="listbox"` with `role="option"` and `aria-selected`; keys stay in the writing.
- Zone bar `role="toolbar"` named "Drawing" or "Object in the text"; grips `role="separator"`
  with orientation and names; every control has a Tooltip naming it.
- Style tab: looks, accents and segmented fields are radiogroups; toggles `role="switch"` with
  `aria-checked`.
- Decorative parts are `aria-hidden`: page numbers, drop carets, ghosts, peer carets.
- Contrast: the accent is passed through `legibleOn` against the page; ink is slate-800 on light
  and slate-200 on dark (AA on paper and on Midnight).
- Reduced motion: zone, to-do box and peer-name transitions off (`article-pages.css`); swatch
  hover scale off (`motion-reduce:hover:scale-100`).

## Web Experience

- **LCP**: ProseMirror and the editor (`ArticleEditor`) load only when a tab shows an article
  (`React.lazy`); the canvas and the sheets paint first.
- **CLS**: the writing, toolbar, zone bar and carets are absolutely positioned in canvas or
  screen space; peer carets take no room (negative margins); the page toolbar is placed by
  transform while `visibility: hidden` until measured. Nothing shifts surrounding chrome.
- **INP**: typing dispatches into ProseMirror only; the tab is written at the idle commit, not per
  key; measuring and settling run in the next frame; caret broadcasts are throttled; peer carets
  never re-render the canvas.

## Observability

- `debugLog` fingerprints (all `[article]`): `writing mounted`, `writing committed`, `layout
settled`, `zone changed`, `floating elements put in the writing`, `margin note added`, `zone
moved`, `style changed`, `zone took elements in`, `object dropped in the writing`, `zone drag
ended`, `articles turned into pages`. Page-level edits log `[illustrate-page] …` (Illustrate
  pages blueprint).
- Telemetry as the spec's Telemetry section, charted in `apps/telemetry/app/catalogue/features.ts`
  (`ILLUSTRATE_PAGES`: `ArticleAdded`, `ArticlesToPages`, `PageKind*`; `ARTICLE_INSERTS`;
  `ARTICLE_FORMATTING`; `ARTICLE_LOOKS`), explained in `event-explanations.ts`. Never text.

## Testing

| Spec rule                                                                                                           | Test                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Writing read defensively, caps, style fields, cache, words, a new article                                           | `packages/document/src/article-flow.test.ts` "article writing: reading it"                       |
| Block ops: round trip, no resend, two writers merge and converge, missing neighbours, a peer's ops read defensively | `article-flow.test.ts` "article writing: block ops"                                              |
| Numbered lists by level, bullets restart                                                                            | `article-flow.test.ts` "list markers"                                                            |
| Article as a unit: add, remove, move, duplicate, grow and shrink                                                    | `packages/document/src/article-pages.test.ts` "articles in the row"                              |
| A duplicated article's notes point at the copied markers                                                            | `article-pages.test.ts` "a duplicated article keeps its margin notes to itself"                  |
| First page's choice                                                                                                 | `article-pages.test.ts` "the first page's own choice of kind"                                    |
| Zones settle with their elements, never swap, drawing clip, objects whole                                           | `packages/document/src/article-zones.test.ts`                                                    |
| Margin notes: place, follow, stack, untint, go with their text                                                      | `packages/document/src/article-notes.test.ts`                                                    |
| Turn Into Pages                                                                                                     | `packages/document/src/article-to-page.test.ts`                                                  |
| Article pages read, flow fallback, kept together                                                                    | `packages/document/src/illustrate-page.test.ts` "page kinds"                                     |
| Blocks to editor and back, identity kept                                                                            | `apps/live/lib/article/article-convert.test.ts`                                                  |
| Pasted Markdown, safe links only, plain text                                                                        | `apps/live/lib/article/article-markdown.test.ts`                                                 |
| Writing synced as block ops, frames, never in tab-meta, merge keeps ours                                            | `apps/live/app/document/[id]/tab-broadcast-ops.test.ts` "articles"                               |
| A peer's block ops applied, malformed frames ignored, late writing for a removed article dropped, removal           | `apps/live/app/document/[id]/room-op-apply.test.ts` "documents"                                  |
| Caret by block and offset                                                                                           | `apps/live/lib/article/article-caret.test.ts`                                                    |
| Collaborators' carets: names, freshness, tab scope, leaving                                                         | `apps/live/lib/article/article-carets-store.test.ts`                                             |
| Peer carets drawn as decorations, follow their block                                                                | `apps/live/lib/article/article-peers.test.ts`                                                    |
| Caret broadcast throttled, null on leaving, hidden by a vote                                                        | `apps/live/hooks/collab/useArticleCaretBroadcast.test.tsx`                                       |
| `article-caret` on the wire                                                                                         | `packages/api-schema/src/article-caret.test.ts`; room relay `apps/api/src/document-room.test.ts` |
| Into pages never takes an article's pages                                                                           | `packages/document/src/illustrate-paginate.test.ts` "into pages never loses an article"          |
| Export cuts a drawing at its zone                                                                                   | `apps/live/lib/export-tab.test.ts` "an article page export cuts a drawing off at its zone"       |
| Reading frame                                                                                                       | `apps/live/lib/viewport.test.ts` "computeReadingFrame"                                           |
| Article edits through the page panel (add, turn, paint, move, delete)                                               | `apps/live/hooks/editor/illustrate-page-edits.test.ts` "documents"                               |

Not covered by a unit test (browser-checked): `ArticleEditor` (keys, input rules, slash menu,
measure and commit timing, paste into an empty block), `PageToolbar` placement and hover,
`useArticles` / `useArticleIntake` orchestration, zone drag and grips, `useLeaveIllustrate` and
its dialog, `snapshotWriting` and the exported writing, the Style tab.

## Assets and external resources

| Asset                           | Source / licence                                                                                                                                                                                        | Path                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ProseMirror                     | npm `prosemirror-model` 1.25, `-state` 1.4, `-view` 1.42, `-commands` 1.7, `-keymap` 1.2, `-inputrules` 1.5, `-gapcursor` 1.4, `-transform` 1.12, MIT; listed on `/licences` by `@livediagram/licences` | `apps/live/package.json`; lazy chunk with `ArticleEditor`        |
| Writing stylesheet              | Own                                                                                                                                                                                                     | `apps/live/app/article-pages.css` (imported by `globals.css`)    |
| Fonts                           | The font catalogue ([Fonts](../../004-interface-design/fonts.md)), Roboto Mono for code                                                                                                                 | `resolveFontStack`; embedded in SVG by `svgFontDefs`             |
| Toolbar, zone bar glyphs        | Lucide (ISC AND MIT, vendored geometry), via `@livediagram/icons/lucide`; listed on `/licences`                                                                                                         | `packages/icons/lucide-manifest.json`, `src/lucide.generated.ts` |
| Page kind miniatures, note face | Own inline SVG                                                                                                                                                                                          | `page-kind-cards.tsx`, `ArticleNoteFace.tsx`                     |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D33 to D54 and D60.
