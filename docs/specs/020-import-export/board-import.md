# Board import

One shape for every "bring a board from another tool" import: a single source
file or connected board becomes the contents of one tab, its images go through
the existing image pipeline, and the user always gets a result plus an honest
report. [Miro import](miro-import.md) and
[Microsoft Whiteboard import](whiteboard-import.md) are built on it; the
[Excalidraw](excalidraw-import-export.md) importer predates it and keeps its own
path until it is folded in. Evidence for the platform facts below:
[Migration readiness](../../research/migration-readiness.md).

## Where it lives

- Each source is a **format card in the Import dialog**, next to Markdown,
  Mermaid and Excalidraw, with the same **replace-the-tab** semantics and a
  **single undo step**. A user moving a board creates a diagram, then imports
  into its tab. No new surface is added.
- Importers live in `apps/live/lib/board-import/`: one module per source
  (`miro.ts`, `whiteboard.ts`) plus the shared stages (`assets.ts`,
  `report.ts`). Lazy-loaded by `useTabImport` like the other importers. Nothing
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
3. **Assets** (browser, network): each `AssetRef` is fetched, decoded, resized
   so the **longest side is at most 2048 px** (never upscaled), encoded to
   **WebP**, hashed (SHA-256) and uploaded with `POST /api/images`
   ([Image element + per-owner gallery](../009-elements/images.md)), which dedupes by hash. At most four
   uploads run at once.
4. **Commit**: the elements replace the tab in one undoable step. The commit
   target is a parameter of the stage, so a later bulk importer can commit to a
   new diagram without touching stages 1 to 3.
5. **Report**: shown in the Import dialog's result panel, in space the panel
   reserves before the import starts (no toast, no layout shift). It is not
   persisted.

## Images

- **Encoding.** WebP from `canvas.toBlob` where the browser encodes it. Safari
  cannot (its `toBlob` / `convertToBlob` ignore `image/webp` and return PNG), so
  the encoder checks the returned blob's type and, when it is not WebP,
  lazy-loads a **WASM WebP encoder** and encodes with it. The encoder is loaded
  only on that path, so other browsers never download it.
- **Gallery cap.** The server cap is the existing one: hosted 100 images or
  100 MB per owner, unlimited on self-host by default. A `403 gallery_full`
  stops further uploads for this import; every remaining image is committed as a
  **placeholder** (`imageId: null`, original size, source name as title). The
  import still succeeds.
- **Per-image failure.** An image that cannot be fetched or decoded becomes a
  placeholder with its own reason. No image failure fails an import.
- **Offline diagrams.** An offline tab embeds the resized image as a `data:` URI
  ([Offline Mode](../006-diagram/offline-mode.md)); no upload, no gallery cap.

## The report

`ImportReport` is a list of rows `{ sourceType, imported, degraded, skipped, reason? }`
plus image totals `{ uploaded, deduped, placeholders, placeholderReason? }`.

- Every source item lands in exactly one of **imported**, **degraded**
  (imported with a documented loss) or **skipped** (named by its source type).
- When anything is degraded, skipped or a placeholder, the report lists the
  rows; it is never collapsed to a single success line. A partial import that
  looks complete is the failure this rule exists to prevent.
- Copy for the cap: "12 images imported, 30 kept as placeholders: your image
  gallery is full (100 of 100)." with a link to the Explorer image gallery.
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): one
  `track('Import', 'Completed', <sourceKind>)` per import. Counts and names
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
