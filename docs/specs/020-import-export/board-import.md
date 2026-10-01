# Board import

One shape for every "bring a board from another tool" import: a source file,
folder or connected board becomes a [board scene](board-scene.md), the scene
lands as the contents of a tab, its images go through the
[Import image pipeline](import-image-pipeline.md), and the user always gets a
result plus an honest report. [Miro import](miro-import.md) and
[Microsoft Whiteboard import](whiteboard-import.md) are built on it, as the
[Excalidraw](excalidraw-import-export.md) importer already is. Evidence for the platform facts below:
[Migration readiness](../../research/migration-readiness.md).

## Where it lives

- Each source is a **format card in the Import dialog**, next to Markdown,
  Mermaid and Excalidraw, with a **single undo step** per import. No new
  surface is added.
- Each importer is its own module in `apps/live/lib/` (beside
  `excalidraw-import.ts`) that parses its source into a board scene; the one
  landing (`apps/live/lib/board-scene/`) and the shared image stage
  (`apps/live/lib/import-images/`) do the rest. Lazy-loaded by `useTabImport`
  like the other importers. Nothing here is needed by the MCP worker, so it
  stays in `apps/live`.

## Stages

Every stage returns `{ ok: true, value } | { ok: false, error }` and never
throws. Only the parse stage has to be pure.

1. **Read** (browser): an `ImportSource` becomes a raw payload. A source is a
   picked or dropped file, or a connected board fetched from the other tool's
   API with a user token held by the tab.
2. **Parse** (pure): payload to a [board scene](board-scene.md) (`BoardScene`:
   items, assets, a title and the parser's notes). No network. Input the parser
   does not recognise is a named rejection, never a partial guess.
3. **Land** (pure): `landBoardScene` turns the scene into elements for the
   target tab's profile (whiteboard or diagram), with ids minted fresh and a map
   so connectors follow, one image request per image, the tab's patch and the
   report.
4. **Assets** (browser, network): every image goes through the
   [Import image pipeline](import-image-pipeline.md), which owns resizing,
   encoding, upload, deduplication, concurrency and every image failure.
5. **Commit** to one of three targets:
   - **replace-tab**: the elements replace the active tab, one undoable step
     (the Excalidraw card);
   - **new-document**: each board becomes **its own new document** with one
     whiteboard tab, **named after the board** (an untitled board: "Whiteboard,
     14 Aug 2020", its created date) and **dated as the board** (its created
     and last-modified dates, see [Document dates](../015-api/api.md#document-dates)),
     filed in the folder the import was started from (the Explorer's), else
     Unsorted (the Microsoft Whiteboard import). A board that cannot land is
     named in the report and the rest still do; an open document is left as it
     was. It needs no open document: from the editor, an Offline Mode document
     makes Offline Mode documents too, as a copy does; from the Explorer, the
     caller says which;
   - **insert-at-point**: the elements join the active tab at a point and are
     selected (a paste or a drop).

   The target is a parameter of the stage, so stages 1 to 4 never change with it.

6. **Report**: shown in the Import dialog's result panel, in space the panel
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
Import dialog (see the [Import image pipeline](import-image-pipeline.md)); a board importer adds the
[board scene](board-scene.md)'s report to it (counts per landed kind, every degraded and skipped
rule) rather than a second one.

- Every source item lands in exactly one of **imported**, **degraded**
  (imported with a documented loss) or **skipped** (named by its source type).
- When anything is degraded, skipped or a placeholder, the report lists the
  rows; it is never collapsed to a single success line. A partial import that
  looks complete is the failure this rule exists to prevent.
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): one
  `Tab·Imported·<Format>` per import, like every other importer (for example
  `Miro`, `MicrosoftWhiteboard`, `Excalidraw`). Counts and names
  never leave the browser.

## Bulk readiness

Bulk import is not built. What keeps it cheap to add:

- Stages take one source and share no module state; a queue calls them in turn
  and aggregates reports.
- The gallery cap is enforced by the server per upload, so a queue needs no
  budget of its own.
- The scene carries a stable `sourceId` (tool plus the tool's board id where it
  has one), so a bulk importer can detect a board it already imported.
- Several boards of one export already land as several new documents in one
  import (new-document), see [Microsoft Whiteboard import](whiteboard-import.md).

## Non-goals

- Bulk import of many unrelated files at once.
- Keeping an imported board in sync with its source.
- Persisting the report beyond the dialog.
