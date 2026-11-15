# Whole plan file blueprint

Derived from [plan-tabs.md](../plan-tabs.md) "Whole Plan" and "The Import dialog" (A Whole Plan), and
[api.md](../../015-api/api.md) `GET` / `POST /api/projects/:id/file`. The file is the plan's `liveplanner.project`
envelope (`packages/project/src/project-envelope.ts`), written and read by the same two functions the Drive mirror
uses (`apps/api/src/plan-room/project-file.ts` `exportProjectFile`, `readProjectFile`, `importProjectFile`).

## Domain and naming

- **Plan file**: the `.liveplanner` file (`APP_FILE_FORMATS.liveplanner`: kind `liveplanner.project`, mime
  `application/vnd.liveplanner+json`). Code says `projectFile`; copy says "plan" and ".liveplanner file", never
  "document" or "board".
- **Whole Plan**: the Export dialog's card (format key `plan` in `ExportFormatKey`, `plan-export-formats.ts`).
- **liveplanner Plan**: the Import dialog's row, in the section **A Whole Plan** (`import-whole-plan`).
- **File summary**: what the preview shows (`ProjectFileSummary`: `name`, `tabs`, `cards`, `cardTypes`, `threads`,
  `rules`, `pictures`), read in the browser by `summariseProjectFile(text)`
  (`packages/project/src/project-file-summary.ts`).

## Constants and configuration

- `PROJECT_FILE_MAX_BYTES` = 8 MiB (`project-envelope.ts`): the api's outer bound on any write body
  (`MAX_BODY_BYTES`, `apps/api/src/limits.ts`), so the editor refuses unread what the worker would refuse anyway. The api refuses past it by `Content-Length` before reading and by the text's UTF-8 length
  after; the editor refuses unread past it (`pickTabFile(..., { maxBytes })`, and a drop's `file.size`).
- `PROJECT_FILE_ACCEPT` = `.liveplanner,application/vnd.liveplanner+json,.json,application/json`.

## Interfaces and contracts

- `summariseProjectFile(text)`: `{ ok: true, summary }` or `{ ok: false, failure }` with `failure` one of
  `parseProjectEnvelope`'s (`not_json`, `wrong_kind`, `unsupported_version`, `malformed`). Counts are of the parsed
  envelope (unknown fields already dropped); `cardTypes` counts the catalogue's types, `pictures` is true when any
  card's fields hold an `attachments` list or an Image field value (`images` key or a value with an image id).
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
  name) }`. `offered` is the tools' `canImport`; `blocked` is the guest sentence when not signed in; `importFile`
  answers `{ ok: true }` (and opens the new plan) or `{ ok: false, error }` with the spec's sentence by the api's
  error code.
- `ExportTabDialog` takes `wholePlan?: { projectId, ownerId }`, given by `EditorTabDialogs` only for an Editor of the
  whole plan (`!isStructureReadOnly`) on a plan that is not This Browser's.

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
  (item-types.md "Image fields"), so a picture shows only to its uploader in the new plan.

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
  one transaction. The editor reads the file's text once for the summary and posts the same string; the summary is a
  single pass over cards. Both run only when a person presses them.

## Observability

- `[plan-file] exported` (`projectId`, `bytes`), `[plan-file] refused` (`projectId`, `reason`), `[plan-file]
  imported` (`projectId`, `tabs`, `cards`) on the api; `[plan-file] import failed` (`error`) in the editor's debug
  log. Telemetry `Project · Exported · Plan` and `Plan · Imported · Liveplanner`.

## Testing

- `apps/api/src/routes/project-file-route.test.ts`: the round trip (export, import, export again: the same tabs with
  folders, cards with keys and fields, card types, Sheets, threads, rules off), roles (owner and Editor 200;
  Participant and Viewer 403; tab-scoped 404), a malformed file, an oversized one by header and by length, a newer
  schema, unknown fields dropped, and a started plan 409.
- `packages/project/src/project-file-summary.test.ts`: the counts and every refusal.
- Editor: `ImportTabDialog.test.tsx` (the section for an Editor only, the guest's dimmed row, the preview and its
  import, refusals), `import-drop.test.ts` (a plan file's route), `ExportTabDialog.plan.test.tsx` (the card only with
  `wholePlan`, the download).
