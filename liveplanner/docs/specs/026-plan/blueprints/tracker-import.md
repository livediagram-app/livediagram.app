# Importing from another tool blueprint

Derived from [Importing from another tool](../tracker-import.md). Implementation contract for reading a Trello,
Asana, Jira or Linear export, planning what it makes, and writing it from the editor, the MCP and the CLI.

## Domain and naming

| Spec term         | Identifier                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| another tool      | `TrackerSource = 'trello' \| 'asana' \| 'jira' \| 'linear'`, its name `TRACKER_SOURCE_NAMES`                                                              |
| a file, read      | `TrackerBoard` (`packages/items/src/tracker-import/tracker-model.ts`)                                                                                     |
| a card, read      | `TrackerCard { title, column, description, assignee?, priority?, estimate?, start?, due?, labels, checklist, comments, links, extras }`                   |
| an extra field    | `TrackerExtra { key, label, kind: 'text' \| 'choice' \| 'person' }`                                                                                       |
| what is left out  | `TrackerSkips` (counts by `TrackerSkipReason`)                                                                                                            |
| reading           | `readTrackerFile(text, parseRows)` → `TrackerBoard \| TrackerRefusal` (`read-tracker-file.ts`)                                                            |
| the preview       | `TrackerPreview` (`tracker-preview.ts`)                                                                                                                   |
| what it makes     | `TrackerImportPlan { preview, type, columns, creates, room }` from `planTrackerImport(board, ctx)` (`tracker-plan.ts`)                                    |
| imported comments | `importedCommentsThread(input)` (`packages/project/src/imported-thread.ts`)                                                                               |
| the writes        | editor `useTrackerImport` (`apps/editor/hooks/plan/useTrackerImport.ts`); agents `importTrackerBoard` (`packages/agent-verbs/src/plan/tracker-import.ts`) |
| a whole import    | `POST /items/import` parts (`importParts`, `packages/items/src/create-batches.ts`), landed by `apps/api/src/routes/item-import-route.ts`                  |
| the tool rows     | `TOOL_ROWS` (`apps/editor/components/dialogs/import/import-options.tsx`) in the one Import dialog, `ImportTabDialog`                                      |

## Package `@liveplanner/items`: `src/tracker-import/` (pure)

### Model and limits (`tracker-model.ts`)

- `TRACKER_FILE_MAX_BYTES = 20 * 1024 * 1024`; `TRACKER_CARDS_MAX = ITEMS_MAX` (2,000);
  `TRACKER_COMMENTS_MAX = 20_000`; `TRACKER_CARD_COMMENTS_MAX = 200` (project's `THREAD_COMMENTS_MAX`);
  `TRACKER_COMMENT_TEXT_MAX = 2_000` (`THREAD_COMMENT_TEXT_MAX`); `TRACKER_THREAD_BUDGET = 120_000` (characters of
  comment JSON a thread is planned to, under project's `THREAD_BYTES` 131,072 with room for the authors);
  `TRACKER_CHOICE_MAX = 20` (`CUSTOM_CHOICE_OPTIONS_MAX`).
- `TrackerSkipReason = 'archivedCards' | 'archivedLists' | 'untitledRows' | 'commentsOverCap' |
'attachmentLinks' | 'attachmentsNoLink' | 'otherColumn' | 'shortened'`.

### Text (`tracker-text.ts`)

- `cleanText(raw: unknown, max)`: a string (numbers as their text, anything else `''`), CRLF to LF, every C0/C1
  control but `\n` and `\t` dropped, trimmed, cut to `max` with `…` as its last character when cut.
- `httpLink(raw)`: the trimmed string when `new URL()` reads it with protocol `http:` or `https:`, else undefined.
- `trackerDay(raw)`: `cardDateOf` (board-csv.ts), else Jira's `d/MMM/yy` or `d/MMM/yyyy` (an optional time after a
  space; English month abbreviations), else the date part of an ISO 8601 instant; undefined when none or no real day.
- `trackerPriority(raw)`: `statusKey`: `urgent`, `highest`, `critical`, `blocker` → `urgent`; `high`, `major` → `high`;
  `medium`, `normal` → `medium`; `low`, `lowest`, `minor`, `trivial` → `low`; anything else undefined.
- `trackerEstimate(raw)`: a finite number 0 to `ITEM_NUMBER_MAX`, else undefined.
- `commentHeader(author, at)`: `"{author} · {d MMM yyyy}"` (UTC, `"Unknown"` for no author, the date left off when
  `at` is null).

### CSV columns (`tracker-columns.ts`)

- `headerIndex(header)`: each header's `statusKey` to its first index, and `allIndexes(header, key)` for repeated
  headers (Jira's Labels, Comment, Sprint, Attachment, Component/s). `cellAt(row, i)` is `row[i] ?? ''`.

### Readers (`trello.ts`, `asana.ts`, `jira.ts`, `linear.ts`)

Each answers a `TrackerBoard { source, title, columns: string[], cards, extras: TrackerExtra[], skips }` and never
throws: a value of the wrong type reads as empty.

- **Trello** `readTrelloBoard(json)`: lists sorted by `pos` (open ones; closed counted `archivedLists`); a card is
  kept when open and on an open list (else `archivedCards`); cards sorted by list order then `pos`. Labels: `name`,
  else the colour's name; a label whose `trackerPriority` is set is the priority. Members by `idMembers` through
  `members[]` (`fullName`, else `username`): the first the assignee, all of them the `members` extra (Person, holds
  several) when any card has two or more. Checklists by `idChecklists` (else `idCard`), items by `pos`, prefixed
  `"{checklist}: "` when the card has more than one. Comments: `actions[]` of `type === 'commentCard'` by
  `data.card.id`, author `memberCreator.fullName`, `date`, `data.text`. Attachments `{ name, url }`. Title: `name`.
- **Asana** `readAsanaRows(rows)`: columns `name`, `sectioncolumn`, `notes`, `assigneeemail`, `assignee`,
  `startdate`, `duedate`, `tags`, `completedat`, `projects`, `priority`. A row with a `completedat` value goes to a
  `Completed` column after every section. Extra `projects` (Text).
- **Jira** `readJiraRows(rows)`: `summary`, `issuekey`, `issuetype`, `status`, `priority`, `assignee`, `reporter`,
  `description`, `duedate`, any header whose key contains `startdate`, any containing `storypoint`, every `labels`,
  `comment`, `sprint`, `attachment`, `components`/`component`. A comment cell is `"{date};{author};{text}"` (Jira's
  export; a cell without two `;` is all text, author unknown). An attachment cell `"{date};{author};{name};{url}"`: the url starts at the last `;http://` or `;https://`, so a `;`
  in the name stays the name's; a cell that is only a url is named by it.
  Extras `issuekey` (Text), `issuetype` (Choice when ≤ `TRACKER_CHOICE_MAX` distinct values, else Text), `reporter`
  (Person), `sprint` (Text, the last sprint), `components` (Text, joined ", ").
- **Linear** `readLinearRows(rows)`: `id`, `title`, `description`, `status`, `priority`, `estimate`, `assignee`,
  `labels` (comma list), `started`, `duedate`, `project`, `cyclename` (else `cyclenumber`), `team`. Extras `id`
  (Text), `project`, `cycle`, `team` (Text).
- A CSV row whose title cell is empty and has any other cell is `untitledRows`; an all-empty row is nothing.
- An email-looking person (`isEmailAddress`) is `{ name: localPart, email }`, else `{ name }`.

### Reading a file (`read-tracker-file.ts`)

- `readTrackerFile(text, parseRows, fileName?)`: `text.trimStart()` starting `{` is JSON (`JSON.parse` in a try:
  `not_json`); an object with array `lists` and `cards` is Trello, else `unknown_source`. Otherwise `parseRows(text)`
  (the Sheet's `parseCsv(text).rows`, injected: this package imports no other) and the header row's keys decide:
  `issuekey`+`summary` Jira, `taskid`+`sectioncolumn` Asana, `id`+`title`+`status`+`team` Linear, else
  `unknown_source`. A board with more than `TRACKER_CARDS_MAX` cards: `too_many_cards` (with the count). A board
  with no cards: `no_cards`. The title falls back to `fileName` without its extension, then `Imported Board`.
- `TrackerRefusal = { refusal: 'not_json' | 'unknown_source' | 'too_many_cards' | 'no_cards'; count? }`;
  `trackerRefusalMessage(r)` gives the spec's sentences.

### Planning (`tracker-plan.ts`, `tracker-type.ts`, `tracker-fit.ts`)

- `planTrackerImport(board, ctx)`, `ctx: { types, statuses, people, members, room, random }` (`members:
{ email, person }[]`, lower-cased emails; `room = ITEMS_MAX - items held`; `random` for ids):
  1. **Columns**: `board.columns` in order (an empty name `No Status`), past `PLAN_COLUMNS_MAX` folded into `Other`
     (`otherColumn` counts the cards moved). `placeBoard({ columns, title, types: [typeId] }, [], ctx.statuses, id,
random)` makes the setup; its columns give each source column its status.
  2. **Type** (`trackerCardType(source, used, extras, statuses, existing)`): id `TRACKER_TYPE_IDS[source]`, label
     `TRACKER_TYPE_LABELS[source]`, glyph and colour from `TRACKER_TYPE_LOOKS`; fields `title`, `description`,
     `status`, then each built-in the cards use in `TRACKER_FIELD_ORDER` (`assignee`, `priority`, `estimate`,
     `start`, `due`, `labels`, `checklist`), then `comments` when any card has comments, then the extras used, as
     custom fields `f-{slug}` (`kind` text, choice with its options, or person with `several: true` for Trello's
     Members). An existing type of that id keeps its id, label, look and fields, gaining the missing fields (a custom
     field matched by label keeps its id) and statuses. `typeFits(catalogue)` is false when the type is new and the
     catalogue holds `ITEM_TYPES_MAX`, or the merged type breaks `validateItemTypeCatalogue`.
  3. **People** (`trackerPerson(p, ctx, cache)`): an email in `members` → that person; else `personNamed(name,
known)` where `known` grows with each new person, so one name is one person.
  4. **Cards** (`trackerCreate`): `{ id: newItemId(random), type, fields, place: { status } }` in board order;
     fields as the spec's table; links appended to the description (`\n\nAttachments\n- {name}: {url}`); then
     `fitFields(fields)` (`tracker-fit.ts`): while `validateFields(fields, 'create')` answers `fields_too_large`,
     shorten the description to fit (binary search on its length, `…` at the cut), then drop checklist rows from the
     end; `shortened` counts the cards changed.
  5. **Comments**: per card the newest `TRACKER_CARD_COMMENTS_MAX` that fit `TRACKER_THREAD_BUDGET` (each counted
     as `JSON.stringify(text).length + 160`), kept oldest first; a running total stops at `TRACKER_COMMENTS_MAX`;
     the rest `commentsOverCap`. Each kept comment is `{ text: commentHeader + '\n' + body, at }`, the body cut to
     what is left of `TRACKER_COMMENT_TEXT_MAX`.
  6. **Fits**: `fits = creates.length <= room && typeFits`; `reason` names the room or the full catalogue.
- `TrackerImportPlan.creates: TrackerCreate[]` = `ItemCreate & { id: string; comments: TrackerCommentOut[] }`.
- `trackerPreview` (in the plan): `{ source, sourceName, title, cards, columns: { name, cards }[], fields: { from,
to, isNew, cards }[], people: { matched, onPlan, named }, comments: { count, cards }, skips: { reason, label, count }[],
fits, reason?, summary }` with `summary` the footer line.

## Package `@liveplanner/project`: `src/imported-thread.ts`

- `IMPORTED_THREAD_TITLE = 'Imported comments'`; `importedAuthorName(sourceName)` = `"{Source} import"`;
  `IMPORTED_AUTHOR_COLOR = '#71717a'`.
- `importedCommentsThread({ id, home, itemId, sourceName, comments, random })`: a `CardThread` (`startThread` for the
  first, then each comment appended as stored) with comment ids `newCommentId(random)`, `createdAt` each comment's
  `at` (the import's time when null), no `authorId`, no `mentions`, title `IMPORTED_THREAD_TITLE`, `resolved:
false`, `updatedAt` the last comment's; comments past `THREAD_BYTES` are dropped (none, given the plan's budget).
- `withImportedThreads(creates, { home, sourceName, random })`: each create's `comments` become `threads: [thread]`
  (none when empty); the `comments` key is dropped. Shared by the editor and agents.
- Caps: the thread is an ordinary `CardThread`, one per create, so `threadsOnCard` counts it toward `CARD_THREADS_MAX`
  (50) like any other; nothing exempts it or caps it apart (`imported-thread.test.ts` "counts as an ordinary thread").

## api (`apps/api/src/routes/item-routes.ts`)

- A bulk create carrying threads is a restore for its gate (an Editor's, as now) but its history tag is `undo` only
  when a create names a `key` or `votes` (an undo's card does; an import's never), so imported cards' first history
  entry is untagged (or `ai` from a token). No other change: threads ride `ItemCreate.threads` and
  `POST /projects` `items[].threads`, inserted by `cardBackOnThreads` (a thread `home` = this plan, not held → inserted
  on the card) with no `afterCommentPosted`: no mention, Inbox participant or email.

### A whole import (`POST /items/import`, `apps/api/src/routes/item-import-route.ts`)

The import's cards land in one transaction of the plan's Durable Object, however many requests carry them
(docs/specs/026-plan/tracker-import.md "The import"). Gate `edit` on the whole plan (a tab-scoped grant is refused,
as `/items/bulk`).

- Body `ItemsImportRequest { importId, part, parts, items }` (`packages/api-schema/src/items.ts`; the parts made by
  `importParts(importId, creates, firstBytes?)` over `createBatches`): `importId` `/^[A-Za-z0-9_-]{8,64}$/`, `part`
  `0 ≤ part < parts`, `parts ≤ ITEMS_MAX`, `items` 1 to `ITEM_BULK_MAX` creates. Each create is read as `/items/bulk`
  reads it (`readCreate`, Calculated and Time Spent refusals, required fields); its threads must be new threads homed
  in this plan (an import's are, `withImportedThreads`; `field_value_invalid` otherwise).
- **A part before the last** is held aside, nothing written to the cards: its reads go into `item_import_parts`
  (`plan_id, import_id, part, seq, body, created_at`; plan schema step 13, `ITEM_IMPORTS_SCHEMA` in
  `apps/api/src/plan-room/item-imports-schema.ts`; statements in `apps/api/src/db/item-imports.ts`) as one chunked
  insert, replacing a part sent again. 202 `ItemsImportStaged { staged }` (cards held for this import). A part past
  the plan's room (held + this + stored `> ITEMS_MAX`) is refused `413 items_full` and the import's parts cleared.
- **The last part** lands the import: every part must be held (`409 import_incomplete` otherwise), the held reads and
  its own are checked for room (`413 items_full`) and Blocked By loops (`blockersRefused`, once over all of them),
  then made as `createMany` makes cards (`buildCreates`: free keys, one placer) and written in **one
  `PLAN_DB.batch`**: the import's held parts deleted, then for each `ITEM_BULK_MAX` of the cards a store rev raise
  and their rows through the copy's chunked insert (`insertItemRowsStatements`, `plan-room/plan-content.ts`,
  1 MB JSON chunks), then every thread with its link (`insertThreadStatement`, `insertLinkStatement`). A throw rolls
  all of it back; a lost key race retries up to `ITEM_WRITE_RETRIES`, then `409 item_busy` (the parts kept, so a
  resend of the last part can land it). Any other refusal of the last part clears the import's parts.
- Once landed: the room hears an `items` op per `ITEM_BULK_MAX` cards (its own rev, in order) and a `threads` op per
  the same cards; history is appended once (`appendItemHistory`, untagged, or `ai` from a token: never `undo`, best
  effort as for every write). 201 `ItemsResponse` with every card.
- Abandoned parts: every import request first deletes held parts older than `ITEM_IMPORT_HOLD_MS` (one hour), and
  the plan's daily upkeep (`PlanRoom.maintain`) does the same.

## Agents (`packages/agent-verbs`)

- `packages/agent-verbs/src/plan/tracker-import.ts` `importTrackerBoard(api, input, client)`, `input: { content,
fileName?, source?, projectId?, name?, preview? }`: `readTrackerInput` refuses a file over `TRACKER_FILE_MAX_BYTES`
  (`file_too_large`), reads it with `readTrackerFile(content, parseCsv)`, and refuses a `source` given that differs
  (`source_mismatch`).
  - With `projectId`: `readPlanState`, then `planTrackerImport` with `members: []`: an API token never reads a team's
    people, so an agent matches people by name only. Preview answers here. Not `fits`: `items_full` with the reason.
    Else: `PUT item-types` with the merged type (`expectedRev`, retried on `item_types_stale` up to
    `CARD_TYPES_SAVE_ATTEMPTS`), then a new tab's changeset (`CLIENT_HEADER`), then the cards with
    `withImportedThreads` as one whole import (`postImport`: `importParts` to `POST /items/import`). A failure there
    removes the tab it made (`DELETE /tabs/:tabId`, best effort) and answers the failure.
  - Without: a new plan id, `planTrackerImport` against no types and no items, then one `POST /projects` carrying the
    tab and the card type, then the cards as one whole import. A failure there deletes the new plan
    (`DELETE /projects/:id?permanent=1`, best effort) and answers the failure.
  - Answers `{ ok, written, projectId, newPlan, tabId, preview, summary }`; refusals through `apiRefusalOf`.
- Verb `board.import` (`packages/agent-verbs/src/verbs/board-import.ts`): `file` positional (`ctx.readInput`),
  `--project`, `--from`, `--name`, `--preview`; prints the summary with the plan's link, a preview as its lines.
- MCP tool `import_board` (`packages/agent-verbs/src/verbs/mcp-tools.ts`, shapes in
  `packages/agent-verbs/src/mcp/tracker-schema.ts`), behaviour `write`, handler in `apps/mcp/src/plan-tools.ts` over
  `importTrackerBoard(…, 'mcp')`.

## Editor

- `ImportTabDialog` is the one Import dialog ([Import dialog](../plan-tabs.md#the-import-dialog)); its list is
  `ImportChooseView` (`apps/editor/components/dialogs/import/`): `Into This Tab` (`intoTabOf(tab)`, `into-tab.ts`)
  then, when `tracker.canImport`, `A Board from Another Tool`, both `OptionRows kind="action"`. The tool rows are
  `TOOL_ROWS` (`import-options.tsx`: source, file type, the line naming the file and where it lives, `ToolMark` from
  `tool-marks.tsx`), each `aria-label` "<Tool>: <line>". A row calls `flow.pick(source)`; the row being read says
  "Reading the File…" (`flow.reading`).
- The dialog (`ariaLabel="Import"`, `initialFocus="container"`, the fallback) is opened from the tab menu, the command
  palette's `openImport` and Start Planning's Import card (`StartPlanning` `onImport`, given by `EditorStartPanels`
  only when `trackerImport.canImport`). On a fine pointer `ImportChooseView` focuses its first enabled row as it
  mounts (before the trap's effect, which keeps a focus already inside), never the help link; on a coarse pointer
  the panel keeps it. It is
  headed **Import**, "Choose what to bring in, or drop a file here." (the drop clause `pointer-coarse:hidden`). Each
  section's `OptionRows` roves (one row in the Tab order, ArrowUp / ArrowDown / Home / End), its hint a wrapping
  line; the tool list is `aria-busy` while a file is read. A dimmed Into This Tab row's reason is a full-contrast line
  under it, not the dimmed row's own text. The liveplanner Tab step is the paste panel (`TextImportPanel`, its
  `initialText` a dropped tab's JSON) under the **All Imports** back bar; with nothing else in the list
  (`!tracker.canImport`, a JSON tab that is not locked) the dialog opens on it with no back bar.
- `useTrackerFlow(tracker, onDone, tasks = trackerTasks())` (`apps/editor/components/dialogs/tracker-import/useTrackerFlow.ts`): `{ preview, busy, reading, error, pick,
show, changeTarget, run, back }`. `pick` opens `pickTabFile(TRACKER_FILE_ACCEPT, { maxBytes })` and reads by the
  worker's `read` task (`readTrackerText(text, name)`, `apps/editor/lib/tracker-file.ts`), whose refusal carries its
  code; `show` previews a board already read (a drop). The file's own source wins over the row pressed. The preview
  holds `board: TrackerBoardRef` (`{ key, source, cards }`), its `plans` and their `keys`
  (`trackerContextKey(ctx)`, the JSON of the context's types, statuses, people, members and room: everything a plan
  reads but its fresh `boardId`).
- The worker (`apps/editor/lib/tracker-worker/`): `tracker-tasks.ts` (`createTrackerRunner`: `read` keeps the board
  under a key, at most `TRACKER_BOARDS_KEPT` = 2, the oldest dropped, and answers `{ board: { key, source, cards } }`
  or the refusal; `plan` runs `planTrackerImport` on a kept board, `TRACKER_BOARD_GONE` when it was dropped;
  `answerTrackerRequest` turns a throw into `{ ok: false, error }`), `tracker.worker.ts` (one runner, each message
  answered in turn) and `tracker-worker-client.ts` (`createTrackerTasks(make)`: one module worker, made on first use
  and kept, tasks by id; with no `Worker`, a factory that throws, or an `error` event, it runs on the page with its
  own runner from then on, re-running what the worker held; `trackerTasks()` is the page's one set). The context
  crosses without `random`. The page never receives the board, only its summary and the plans.
- A drop on the list: `await routeImportDrop(text, name, { intoTab, tools }, readTool)` (`apps/editor/components/dialogs/import/import-drop.ts`, `readTool` the worker's `read`) after the 20 MB
  check. A tab's JSON is told by `"kind": "liveplanner.tab"` in its first 512 characters, a tool's CSV by its first
  line (`isTrackerCsvHead`), so a file is parsed once, by the import it goes to.
- `TrackerImportPanel` (`{ head, flow, preview }`): the preview under the dialog's `BackBar` (**All Imports**, the
  tool's name as its chip, `flow.back`), an inline error, and the footer (`DialogFooter`): the summary line,
  **Choose Another File** (`flow.pick(preview.board.source)`, a cancel keeps the preview) and **Import**. The dialog
  is headed "Import from <Tool>" while it shows.
- `TrackerPreviewView`: sections Columns (chips with counts), Fields (a table: From, Becomes, Cards; a "New Field"
  pill), People, Comments, Left Out, then Where To as `OptionRows` (the tab row dimmed with its reason when not
  `fits`, with an amber note). The preview is planned once per file and target (state), never per render. Import into a
  tab reads `contextFor('tab')` again: the same `trackerContextKey` imports the preview's plan as it is (its
  `boardId` still unused, `[tracker-import] plan reused`), a different one plans the kept board again; a plan that fails
  (the board dropped from the worker) dims the tab with `TRACKER_FILE_LOST` and moves to the new plan when one was
  planned already, else says `TRACKER_UNREADABLE` (the file is chosen again).
- `useTrackerImport` (`apps/editor/hooks/plan/useTrackerImport.ts`, composed in `useEditorState`, exposed as
  `trackerImport`): `{ canImport, contextFor(target), importPlan(plan, target) }`. `contextFor('tab')` waits for the
  item store (`waitUntil`), reads members (`apiTeamMembers` when signed in and the plan has a team; a failure reads
  none), people and statuses; `contextFor('plan')` is an empty plan. `importPlan(…, 'tab')`: `saveType` for the
  merged type when it changed, commits a new Board tab (`trackerBoardTab`: the board Detailed) after the active one,
  marks it loaded and opens it, then `write({ kind: 'create', creates: withImportedThreads(…), whole: true })`, each
  a step of Undo. A `whole` create (`ItemWrite`, `packages/items/src/store.ts`) goes to the api as one whole import
  (`lib/api/items.ts` `writeItem`: `importParts` to `POST /items/import`), never in `/items/bulk` writes; on a
  failure nothing landed, so the store reloads without the cards. `importPlan(…, 'plan')`: signed in,
  `apiCreateProject` with the tab and the catalogue, then `writeItem` with the cards as one whole import; a failure
  deletes the plan for good (`indexClient.deleteItem(id, { permanent: true })`). A guest, the plan is made in
  This Browser (`offlineCreateProject`, `offlineWriteItem`, one local write); a failure deletes it
  (`offlineDeleteProject`). Then it opens. Telemetry `Plan` · `Imported` · the source's name.
  Any failure: "Couldn’t import those cards. Try again."
- Entry points: none of its own. The tab menu's `Import…` (`TabPortalMenu`, lit by `canImport`: TabBar's
  `canImportFromTool || !intoTabOf(tab).blocked`) and the palette's `import` command open the one dialog; the tool
  section shows only when `canImport` (`!isStructureReadOnly`: an Editor's, so Participants and Viewers never see it).
  A locked tab does not dim the section: the import makes a new tab and leaves the locked one alone.

## Errors and edge cases

| Case                                       | Handling                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| File over 20 MB                            | refused before reading (`tracker-file.ts`; agents `file_too_large`), the spec's sentence     |
| Bad JSON / unknown shape                   | `not_json` / `unknown_source`, inline                                                        |
| Over 2,000 cards / no cards                | `too_many_cards` (count) / `no_cards`, inline; nothing offered                               |
| Plan lacks room or the catalogue is full   | preview `fits: false`, tab target dimmed with `reason`, New Plan chosen; agents `items_full` |
| More than 12 statuses                      | folded into `Other`, counted                                                                 |
| A card's fields over 16 KB                 | `fitFields`, counted `shortened`                                                             |
| Item store never loads                     | nothing written; "Couldn’t import those cards. Try again."                                   |
| A card write fails part way                | no card lands (one transaction); held parts cleared, or swept within the hour                |
| A write fails after the type or tab landed | editor: they stay (undo takes them); agents: the tab is removed; a new plan is deleted       |
| Comments past caps                         | newest kept, rest counted                                                                    |
| Attachment with no http(s) link            | left out, counted `attachmentsNoLink`                                                        |
| A source given that is not the file's      | agents: `source_mismatch`                                                                    |

## Security and trust

- The file is the importer's but its content is anyone's: every value goes through `cleanText`, links through
  `httpLink`; nothing becomes HTML (descriptions are plain text, no rich runs) and nothing is evaluated. No
  `DOMParser` and no markup parser is used.
- Caps before work: the byte cap before reading, the card cap before planning, per-card and total comment caps.
- Comments carry no `authorId`, no `mentions` and no token id, so they reach nobody's Inbox and send no email; the
  api's restore reading (`readRestoredThread`) strips any author id that is not the caller's regardless.
- Writes keep their gates: item types and new tabs are an Editor's; `/items/bulk` an Editor's; `POST /projects` the
  creator's own.

## Performance and limits

- Reading and planning are linear in the file: lists, members, checklists and comments are indexed by id once (maps),
  never searched per card. Worst case (2,000 cards, 20,000 comments, 50 checklist items each) is held under a
  budget by `tracker-import.perf.test.ts` (well under a second on CI).
- Writes are batched: one type save, one tab, then import parts of up to `ITEM_BULK_MAX` cards and
  `ITEM_WRITE_BYTES` (6 MB, `packages/items/src/create-batches.ts` `createBatches`) each, under the api's 8 MB body
  cap, threads inside them. The parts are held in the plan's SQLite (one chunked insert each) and landed by one
  transaction: rows through 1 MB JSON chunks (a statement per chunk, three parameters, no compound select), a
  thread and a link statement per card with comments. At the caps (2,000 cards, 20,000 comments) that is under
  4,100 statements in one batch, held under a CPU budget by `item-import-route.test.ts`.
- The preview is computed once per file (state), not per render.
- Reading and planning run in a Web Worker (`tracker-worker/`). Measured at the caps on a laptop (the 7.7 MB Trello
  board of `tracker-import.perf.test.ts`): read 71 ms and plan 69 ms, now off the main thread; what the page still
  pays is receiving the plan (a structured clone of about 24 ms for the whole plan; the board's own 37 ms clone is
  never paid, since the board stays in the worker) and, into a tab, nothing more when the plan is reused. The
  worker holds two boards at most.

## Observability

- Editor: `[tracker-import] read` (source, cards, refusal), `[tracker-import] done` (target, cards, skipped) and
  `[tracker-import] failed` (target, error) via `debugLog` / `console.warn`.
- Agents: `[tracker-import]` refusals surface as the verb's or tool's error with their code.

## Testing

- items: a realistic fixture per source (`src/tracker-import/fixtures/`), each reader's mapping, detection, refusals,
  text cleaning, dates, priorities, column folding, type building and merging, people, comment caps, fitting, the
  preview's counts; a perf guard at the caps.
- project: `importedCommentsThread` shape passes `isCardThread`; no author id or mentions; `withImportedThreads`.
- api: a bulk create with threads and no key is not tagged `undo`. `/items/import`: parts held then landed whole,
  a failure in the landing batch (and a refused or missing part) leaves no card and no held part, room and gates
  (Editor only; Participant, Viewer and a tab-scoped grant refused), a resend replacing its part, the hour's sweep,
  and an import at the caps under a CPU budget.
- agent-verbs (100% coverage): into a plan (type save, changeset, import parts, stale retry, a failed part removing
  the tab and writing no card), into a new plan (a failed part deleting it), preview,
  refusals (`items_full`, `source_mismatch`, `forbidden` from the api), the verb's lines, the MCP tool's parity.
- editor: the dialog's list (sections, rows, keys, the tool section only for an Editor), a dropped file's route
  (`import-drop.test.ts`), the preview's sections and dimmed target, the menu row's single `Import…` and its dimming,
  and `useTrackerImport`'s writes in order: a whole create, and a failed part leaving no card (the plan deleted for
  the New Plan target). `lib/api/items.ts`: a whole create's parts, and a failure answering nothing landed.

## Constants and configuration

| Constant                    | Value   | Why                                                  |
| --------------------------- | ------- | ---------------------------------------------------- |
| `TRACKER_FILE_MAX_BYTES`    | 20 MB   | a large Trello board with its actions fits           |
| `TRACKER_CARDS_MAX`         | 2,000   | `ITEMS_MAX`                                          |
| `TRACKER_COMMENTS_MAX`      | 20,000  | ten per card at the cap; bounds the write            |
| `TRACKER_CARD_COMMENTS_MAX` | 200     | `THREAD_COMMENTS_MAX`                                |
| `TRACKER_COMMENT_TEXT_MAX`  | 2,000   | `THREAD_COMMENT_TEXT_MAX`                            |
| `TRACKER_THREAD_BUDGET`     | 120,000 | under `THREAD_BYTES` with room for the comment shape |
| `TRACKER_CHOICE_MAX`        | 20      | `CUSTOM_CHOICE_OPTIONS_MAX`                          |
| `ITEM_IMPORT_HOLD_MS`       | 1 hour  | how long an import's parts wait for its last part    |
