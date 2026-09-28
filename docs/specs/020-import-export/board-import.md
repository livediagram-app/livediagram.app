# Board import

One shape for every "bring a board from another tool" import: a single source
file or connected board becomes the contents of one tab, its images go through
the [Import image pipeline](import-image-pipeline.md), and the user always gets
a result plus an honest report. [Miro import](miro-import.md) and
[Microsoft Whiteboard import](whiteboard-import.md) are built on it, as the
[Excalidraw](excalidraw-import-export.md) importer already is. Evidence for the platform facts below:
[Migration readiness](../../research/migration-readiness.md).

## Where it lives

- Each source is a **format card in the Import dialog**, next to Markdown,
  Mermaid and Excalidraw, with the same **replace-the-tab** semantics and a
  **single undo step**. A user moving a board creates a diagram, then imports
  into its tab. No new surface is added.
- Each importer is its own module in `apps/live/lib/` (beside
  `excalidraw-import.ts`), reusing the shared image stage
  (`apps/live/lib/import-images/`). Lazy-loaded by `useTabImport` like the other importers. Nothing
  here is needed by the MCP worker, so it stays in `apps/live`.

## Stages

Every stage returns `{ ok: true, value } | { ok: false, error }` and never
throws. Only the parse stage has to be pure.

1. **Read** (browser): an `ImportSource` becomes a raw payload. A source is a
   picked or dropped file, or a connected board fetched from the other tool's
   API with a user token held by the tab.
2. **Parse** (pure): payload to an `ImportPlan`
   `{ sourceKind, sourceId, title, elements, assets, report }`. No network.
   Element ids are minted fresh, with a map so connectors follow. Input the
   parser does not recognise is a named rejection, never a partial guess.
3. **Assets** (browser, network): every image goes through the
   [Import image pipeline](import-image-pipeline.md), which owns resizing,
   encoding, upload, deduplication, concurrency and every image failure.
4. **Commit**: the elements replace the tab in one undoable step. The commit
   target is a parameter of the stage, so a later bulk importer can commit to a
   new diagram without touching stages 1 to 3.
5. **Report**: shown in the Import dialog's result panel, in space the panel
   reserves before the import starts (no toast, no layout shift). It is not
   persisted.

## Images

Owned entirely by the [Import image pipeline](import-image-pipeline.md): the
2,048 px WebP resize (a WASM encoder where the canvas cannot encode WebP), the
gallery cap (every image is still tried, since a duplicate costs nothing),
named per-image failures that become placeholders, and Offline Mode embedding.
An importer only turns its source images into pipeline requests. No image
failure fails an import.

## The report

Every importer uses the one shared import report and its summary step in the
Import dialog (see the [Import image pipeline](import-image-pipeline.md)); a board importer adds its
own kinds to that report rather than a second one.

- Every source item lands in exactly one of **imported**, **degraded**
  (imported with a documented loss) or **skipped** (named by its source type).
- When anything is degraded, skipped or a placeholder, the report lists the
  rows; it is never collapsed to a single success line. A partial import that
  looks complete is the failure this rule exists to prevent.
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): one
  `Tab·Imported·<Format>` per import, like every other importer (for example
  `Miro`, `Whiteboard`). Counts and names
  never leave the browser.

## Bulk readiness

Bulk import is not built. What keeps it cheap to add:

- Stages take one source and share no module state; a queue calls them in turn
  and aggregates reports.
- The gallery cap is enforced by the server per upload, so a queue needs no
  budget of its own.
- The plan carries a stable `sourceId` (tool plus the tool's board id where it
  has one), so a bulk importer can detect a board it already imported.

## Non-goals

- Bulk import of many files or boards at once.
- Keeping an imported board in sync with its source.
- Persisting the report beyond the dialog.
