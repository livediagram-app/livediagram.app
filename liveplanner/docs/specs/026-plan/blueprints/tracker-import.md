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
| the dialog's view | `ImportView = 'file' \| 'tracker'` (`apps/editor/components/dialogs/ImportTabDialog.tsx`)                                                                 |

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
- `trackerPriority(raw)`: `statusKey`: `urgent`, `highest`, `critical`, `blocker` → `urgent`; `high` → `high`;
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
  export; a cell without two `;` is all text, author unknown). An attachment cell `"{date};{author};{name};{url}"`.
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
to, isNew, cards }[], people: { matched, named }, comments: { count, cards }, skips: { reason, label, count }[],
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

## api (`apps/api/src/routes/item-routes.ts`)

- A bulk create carrying threads is a restore for its gate (an Editor's, as now) but its history tag is `undo` only
  when a create names a `key` or `votes` (an undo's card does; an import's never), so imported cards' first history
  entry is untagged (or `ai` from a token). No other change: threads ride `ItemCreate.threads` and
  `POST /projects` `items[].threads`, inserted by `cardBackOnThreads` (a thread `home` = this plan, not held → inserted
  on the card) with no `afterCommentPosted`: no mention, Inbox participant or email.

## Agents (`packages/agent-verbs`)

- `src/plan/tracker-import.ts` `importTrackerBoard(api, input, client)`, `input: { content, source?, projectId?,
name?, preview?, newId }`: `readTrackerFile(content, parseCsv)`; a `source` given that differs: `source_mismatch`.
  - With `projectId`: `readPlanState` and `GET /projects/:id` (its `teamId`), team members from `GET
/teams/:teamId/members` (joined, with a `userId` and `email`; `itemPersonId(userId)`; a failure reads none),
    `planTrackerImport`. Preview answers here. Not `fits`: `items_full` with the reason. Else: `PUT item-types` with
    the merged type (`expectedRev`, retried on `item_types_stale` up to `CARD_TYPES_SAVE_ATTEMPTS`), then a new tab's
    changeset `{ replace: { kind: 'board', name, elements: [board] }, base: { rev: 0 } }` (`CLIENT_HEADER`), then
    `POST /items/bulk` in `ITEM_BULK_MAX` chunks with `withImportedThreads`.
  - Without: a plan id from `newId`, `planTrackerImport` against no types and no items, then one `POST /projects`
    `{ id, name, source: client, tabs: [{ id, name, kind: 'board', elements: [board] }], itemTypes: { version,
types: [type] }, items }`.
  - Answers `{ projectId, tabId, title, source, columns, cards, leftOut, preview }`; refusals through `apiRefusalOf`.
- Verb `board.import` (`src/verbs/board-import.ts`): `file` positional (`ctx.readInput`), `--project`, `--from`,
  `--name`, `--preview`; prints `+ board "<title>" from <Source>: <n> cards, <n> columns · <link>`, a preview as the
  preview's lines.
- MCP tool `import_board` (`src/verbs/mcp-tools.ts`, shapes in `src/mcp/tracker-schema.ts`), behaviour `write`,
  handler in `apps/mcp/src/plan-tools.ts` over `importTrackerBoard(…, 'mcp')`; `content` ≤ `TRACKER_FILE_MAX_BYTES`.

## Editor

- `ImportTabDialog` takes `view` and `onView`; a two-button switch (`liveplanner File`, `Another Tool`) heads it; the
  tracker view is `TrackerImportPanel` (`components/dialogs/tracker-import/`), loaded with the dialog.
- `TrackerImportPanel`: states `choose` (a drop-zone styled button, the four sources named, the 20 MB note), `reading`,
  `preview` (`TrackerPreviewView`), `importing`, `error` (inline message, Choose Another File). The file is read with
  `pickTabFile('.json,.csv,.tsv,…', { maxBytes })` and parsed by `readTrackerFile(text, (t) => parseCsv(t).rows,
name)` after a lazy import of the parser module (`lib/tracker-import.ts`).
- `TrackerPreviewView`: sections Columns (chips with counts), Fields (a table: From, Becomes, Cards; a "New" pill),
  People, Comments, Left Out, then Where To as two radio cards (the tab card dimmed with its reason when not
  `fits`); the footer line and Import. Memoised on the plan: the preview never recomputes while the dialog renders.
- `useTrackerImport` (composed in `useEditorState`, exposed as `trackerImport`): `{ canImport, planFor(board),
run(plan, target) }`. `planFor` reads members once (`apiTeamMembers` when signed in and the plan has a team; a
  failure reads none). `run('tab')`: waits for the item store (`waitUntil`, `PLAN_IMPORT_READY_WAIT_MS`), `addTypes` or
  `saveType` for the merged type, commits a new tab `{ ...createTab(title), kind: 'board', elements: [board] }`
  after the active one, marks it loaded and opens it, then `write({ kind: 'create', creates:
withImportedThreads(…, { home: projectId }) })`. `run('plan')`: `apiCreateProject` with the tab, the catalogue and
  the creates, intent `{ mode: 'plan', tabKind: 'board' }`, then `router.push(editorPath(id))`. Telemetry `Plan` ·
  `Imported` · `TRACKER_TELEMETRY_TYPES[source]`.
- Tab menu: `Import from Another Tool…` after Import (`TabPortalMenu` prop `onImportTracker`), dimmed unless
  `canEditStructure` and the tab is unlocked; opens the dialog on `tracker`.

## Errors and edge cases

| Case                                       | Handling                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| File over 20 MB                            | refused before reading (`pickTabFile` `tooBig`), the spec's sentence                         |
| Bad JSON / unknown shape                   | `not_json` / `unknown_source`, inline                                                        |
| Over 2,000 cards / no cards                | `too_many_cards` (count) / `no_cards`, inline; nothing offered                               |
| Plan lacks room or the catalogue is full   | preview `fits: false`, tab target dimmed with `reason`, New Plan chosen; agents `items_full` |
| More than 12 statuses                      | folded into `Other`, counted                                                                 |
| A card's fields over 16 KB                 | `fitFields`, counted `shortened`                                                             |
| Item store never loads                     | nothing written; "Couldn't import those cards. Try again."                                   |
| A write fails after the type or tab landed | they stay (undo takes them), the dialog shows the failure                                    |
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
- Writes are batched: one type save, one tab, `ceil(cards / 200)` bulk requests (10 at the cap), threads inside them.
  The api inserts each card's thread one statement at a time inside its request (`cardBackOnThreads`).
- The preview is computed once per file (state), not per render.

## Observability

- Editor: `[tracker-import] read` (source, cards, refusal), `[tracker-import] done` (target, cards, skipped) and
  `[tracker-import] failed` (target, error) via `debugLog` / `console.warn`.
- Agents: `[tracker-import]` refusals surface as the verb's or tool's error with their code.

## Testing

- items: a realistic fixture per source (`src/tracker-import/fixtures/`), each reader's mapping, detection, refusals,
  text cleaning, dates, priorities, column folding, type building and merging, people, comment caps, fitting, the
  preview's counts; a perf guard at the caps.
- project: `importedCommentsThread` shape passes `isCardThread`; no author id or mentions; `withImportedThreads`.
- api: a bulk create with threads and no key is not tagged `undo`.
- agent-verbs (100% coverage): into a plan (type save, changeset, bulk chunks, stale retry), into a new plan, preview,
  refusals (`items_full`, `source_mismatch`, `forbidden` from the api), the verb's lines, the MCP tool's parity.
- editor: the dialog's switch and states, the preview's sections and dimmed target, the menu row's gating for an
  Editor, a Participant and a Viewer, and `useTrackerImport`'s writes in order.

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
