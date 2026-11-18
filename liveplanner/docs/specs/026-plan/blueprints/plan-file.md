# Whole plan file blueprint

Derived from [plan-tabs.md](../plan-tabs.md) "Whole Plan" and "The Import dialog" (A Whole Plan), and
[api.md](../../015-api/api.md) `GET` / `POST /api/projects/:id/file`. The file is the plan's `liveplanner.project`
envelope (`packages/project/src/project-envelope.ts`), written and read by the same two functions the Drive mirror
uses (`apps/api/src/plan-room/project-file.ts` `exportProjectFile`, `readProjectFile`, `importProjectFile`).

## Domain and naming

- **Plan file**: the `.liveplanner` file (`APP_FILE_FORMATS.liveplanner`: kind `liveplanner.project`, mime
  `application/vnd.liveplanner+json`). Code says `projectFile`; copy says "plan" and ".liveplanner file", and no
  other word for the plan (domain-language.md).
- **Whole Plan**: the Export dialog's card (format key `plan` in `ExportFormatKey`, `plan-export-formats.ts`).
- **liveplanner Plan**: the Import dialog's row, in the section **A Whole Plan** (`import-whole-plan`).
- **File summary**: what the preview shows (`ProjectFileSummary`: `name`, `tabs`, `cards`, `cardTypes`, `threads`,
  `rules`, `pictures`), read in the browser by `summariseProjectFile(text)`
  (`packages/project/src/project-file-summary.ts`).

## Constants and configuration

- `PROJECT_FILE_MAX_BYTES` = 20 MiB (`project-envelope.ts`; Work Tracker 1019): the api's outer bound on this one
  write body (`writeBodyCap`, `apps/api/src/limits.ts`, for `POST /api/projects/:id/file` only; every other write
  keeps `MAX_BODY_BYTES`, 8 MiB), so a full plan's export (5,000 cards with long descriptions) imports back, and the
  editor refuses unread what the worker would refuse anyway. Safe range 8 to 24 MiB: the import's peak heap grows
  about 3 bytes for each byte of file (below). The api refuses past it by `Content-Length` before reading and by the text's UTF-8 length
  after; the editor refuses unread past it (`pickTabFile(..., { maxBytes })`, and a drop's `file.size`).
- `PROJECT_FILE_ACCEPT` = `.liveplanner,application/vnd.liveplanner+json,.json,application/json`.

## Interfaces and contracts

- `summariseProjectFile(text)`: `{ ok: true, summary }` or `{ ok: false, failure }` with `failure` one of
  `parseProjectEnvelope`'s (`not_json`, `wrong_kind`, `unsupported_version`, `malformed`). Counts are of the parsed
  envelope (unknown fields already dropped); `cardTypes` counts the catalogue's types, `pictures` is true when any
  card holds a non-empty `attachments` list (`ATTACHMENTS_FIELD`) or an id in a field the file's catalogue defines as
  an Image field (`storedImageIds`).
- `GET /api/projects/:id/file` (`apps/api/src/routes/project-file-route.ts` `handleProjectFile`): no grant 404; a
  grant whose tab scope is set 404; a grant below edit 403; no started plan 404; else 200 with the envelope text,
  `Content-Type` the mime, `Content-Disposition: attachment; filename="<sanitised name>.liveplanner"` and
  `Cache-Control: no-store`.
- `POST /api/projects/:id/file`: `requireOwner` (400 without identity); the grant as above (404 / 403); a started plan
  409 `{ error: 'exists' }`; `Content-Length` past the cap 413 `{ error: 'too_large' }`; the body text past it the same;
  `readProjectFile(text)` refusals as 400 `{ error: 'invalid_file' }` / 413 `{ error: 'too_large' }`; else
  `importProjectFile(env, id, { copy, name, ownerId, teamId: grant.team })` and 201 `{ project }`.
- Editor `apiExportProjectFile(ownerId, id)` (`apps/editor/lib/api/project-file.ts`): the response's text, or throws
  `ApiError`. `apiImportProjectFile(ownerId, text, title)`: mints the id, `indexClient.createItem({ id, app:
'liveplanner', title, source: 'import' })`, seeds the grant, posts the text with `X-Index-Grant`; any failure after
  the index made the item deletes it for good (`deleteItem(id, { permanent: true })`) and rethrows. Answers the id.
- `PlanFileImportActions` (`apps/editor/hooks/plan/usePlanFileImport.ts`): `{ offered, blocked, importFile(text,
name) }`. `offered` is the tools' `canImport`; `blocked` is the offline sentence while `navigator.onLine` is false, else
  null (a guest imports as a signed-in Editor does: the api owns the new plan by the caller's guest id); `importFile`
  answers `{ ok: true }` (and opens the new plan) or `{ ok: false, error }` with the spec's sentence by the api's
  error code.
- `ExportTabDialog` takes `wholePlan?: { projectId, ownerId }`, which `EditorTabDialogs` sets from
  `wholePlanOffer({ projectId, ownerId, isOffline, isStructureReadOnly })`
  (`apps/editor/components/dialogs/whole-plan-offer.ts`): only for an Editor of the whole plan
  (`isStructureReadOnly` is a Participant's, a Viewer's and a tab-scoped link's) on a plan that is not This
  Browser's.

## Behaviour and state

- The Import dialog's steps gain `plan`: the list's row (or a drop) reads the file, summarises it, and on success
  shows `WholePlanPreview` (`apps/editor/components/dialogs/import/WholePlanPreview.tsx`) under the All Imports back
  bar; a refusal stays on the step it came from as `ImportError`. Import runs once (`busy`); Back is held while it runs.
- `routeImportDrop` tells a plan file by `"kind": "liveplanner.project"` in its first 512 characters, before any
  other JSON test: `{ to: 'plan' }` when the section is offered and not blocked, else the blocked sentence or
  `DROP_UNKNOWN`.
- The Export dialog's `plan` card opens `WholePlanExportPanel`
  (`apps/editor/components/dialogs/WholePlanExportPanel.tsx`); Download fetches, saves a Blob of the text as
  `<sanitised plan name>.liveplanner`, tracks `Project · Exported · Plan` and closes the dialog.

## Data and persistence

- Nothing new is stored. The import writes through `importPlanCopy` in one transaction (refused when the plan already
  holds content), then `initPlan`. Picture ids stay in the cards' fields; `importProjectFile` drops any `imageGrants`
  (item-types.md "Image fields"), so a picture shows only to its uploader in the new plan. Before the content is
  written it sends the media service the pictures the cards' Attachments hold as the new plan's unconfirmed
  references (`claimImportedImages`, items.md "A plan file vouches for itself"); a refusal throws `ImportClaimRefused`,
  so nothing lands: `POST /api/projects/:id/file` answers it 503 `media_unavailable` (the editor's Try again), the
  Drive door's `importItemAs` undoes the index item and answers 503.

## Errors and edge cases

- A file whose `exportedAt` is missing reads as 0; a file with no items, types, Sheets, threads or rules imports as
  the tabs alone. A thread on no card of the file and a rule that does not check are left behind (as the Drive
  import does). A Retry after a failure mints a new id: the failed one was deleted at the index.

## Security and trust

- The body is untrusted: capped before it is read, parsed once by `parseProjectEnvelope`, which rebuilds the envelope
  from its known fields only (anything else at the top level or on `project` is dropped, items, Sheets, threads and
  rules that do not look like theirs are left behind), checks the kind and refuses a schema newer than
  `PROJECT_SCHEMA_VERSION`; every tab passes the tab gate (`isValidTab`, `MAX_TAB_BYTES`), every card the store's ids,
  keys and cap, the catalogue `validateItemTypeCatalogue`, every Sheet `validateSheetCreate`. No grants travel. The
  export holds no author account ids (`threadForRoom`).

## Performance and limits

- The export is one read of each store inside the plan's object (as the Drive mirror's); the import is one parse and
  one transaction.
- **The import's memory** (Work Tracker 1019). The route runs inside the new plan's Durable Object (128 MB). It reads
  the body's text in its own function (`readBodyFile`), so the text is let go once the content is read, before the
  write. A full plan's file at the cap (5,000 cards, 20 MB of ASCII text) peaks at 62.4 MB of live heap, the text
  counted (82 MB while the route still held the text through the write); the request's bytes (20 MB, outside the
  heap) are the rest. It costs about 0.3 s of CPU (node, unloaded). A file of mostly non-Latin text holds its text
  at two bytes a character, about 20 MB more at the cap, still inside the object.
  `project-file-import-memory.test.ts` holds it to 80 MB of heap and a CPU budget. The editor reads the file's text once for the summary and posts the same string; the summary is a
  single pass over cards. Both run only when a person presses them.

## Observability

- `[plan-file] exported` (`projectId`, `bytes`), `[plan-file] refused` (`projectId`, `reason`), `[plan-file]
imported` (`projectId`, `tabs`, `cards`) on the api; `[plan-file] import failed` (`error`) in the editor's debug
  log. Telemetry `Project · Exported · Plan` and `Plan · Imported · Liveplanner`.

## Testing

- `apps/api/src/routes/project-file-route.test.ts`: the round trip (export, import, export again: the same tabs with
  folders, cards with keys and fields, card types, Sheets, threads, rules off), roles (owner, Editor and a guest Editor 200,
  a guest's import 201 owned by their guest id; Participant and Viewer 403; tab-scoped 404), rules exported
  without maker and editor ids, a malformed file, an oversized one by header and by length, a newer
  schema, unknown fields dropped, and a started plan 409.
- `apps/api/src/routes/project-file-import-memory.test.ts`: a full plan's 20 MB file imports, under the heap budget
  (sampled with a forced collection at every tenth statement and the batch) and a CPU budget.
- `apps/api/src/index.test.ts` "the write body cap": a plan file past 8 MB reaches its route up to 20 MB, past it 413
  by length and by header; every other write keeps 8 MB.
- `packages/project/src/project-file-summary.test.ts`: the counts and every refusal.
- Editor: `ImportTabDialog.plan-file.test.tsx` (the section for an Editor only, the offline dimmed row, the preview
  and its import, refusals, drops), `import-drop.test.ts` (a plan file's route), `ExportTabDialog.whole-plan.test.tsx`
  (the card on every kind only with `wholePlan`, the download, a failure), `whole-plan-offer.test.ts` (by role),
  `usePlanFileImport.test.ts` (offered, blocked, the api's refusals as sentences) and `lib/api/project-file.test.ts`
  (the index's item first, deleted when the write fails).
