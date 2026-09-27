# Import pipeline (proposed spec)

Status: **proposed**, not yet a spec. Promote into
`docs/specs/020-import-export/` once the open questions below are answered.
Evidence: [Migration readiness](../migration-readiness.md).

## What it is

One shape for every "bring a board from another tool" import (draw.io, Miro,
Excalidraw, Microsoft Whiteboard): a single source file or payload becomes one
livediagram diagram, its images go through the existing image pipeline, and the
user always gets a result plus an honest report. Built for one file at a time;
nothing in it assumes it is the only import running, so a bulk queue can call it
per file later without rework.

## Stages

Each stage is a pure function of its input except where marked; every stage
returns `{ ok: true, value } | { ok: false, error }` and never throws.

1. **Read** (browser): an `ImportSource` becomes a raw payload. Sources are a
   dropped or picked file, a paste (`text/html`, `text/plain`), or a connector
   that fetches from the other tool's API with a user token.
2. **Parse** (pure): payload to an `ImportPlan`:
   `{ source: ImportSourceKind, title, tabs: [{ name, elements }], assets: AssetRef[], report: ImportReport }`.
   No network, no ids from the server. Element ids are minted fresh, with a map
   so connectors follow. Unknown input yields a named rejection, not a partial
   guess.
3. **Assets** (browser, network): each `AssetRef` is fetched, decoded, resized
   so the **longest side is at most 2048 px** (never upscaled), encoded, hashed
   (SHA-256) and uploaded with `POST /api/images` ([Images](../../specs/009-elements/images.md)),
   which dedupes by hash. Uploads run with bounded concurrency.
4. **Commit** (network): the plan becomes a new diagram in the chosen place,
   through the same create path as the New Diagram wizard, so offline and team
   placement behave as they do today.
5. **Report**: shown in the import dialog itself (reserved space, no toast),
   and kept on the diagram's activity log.

## Images and the gallery cap

- The server cap is the existing one: hosted 100 images or 100 MB per owner,
  unlimited on self-host by default.
- A `403 gallery_full` response stops further uploads for this import. Every
  remaining image element is committed as a **placeholder** (`imageId: null`,
  original size, source name as its title). The import still succeeds.
- The report states the count: "12 images imported, 30 kept as placeholders:
  your image gallery is full (100 of 100)". It links to the Explorer image
  gallery, where freeing space lets the user re-link placeholders later.
- A single image that fails to fetch or decode becomes a placeholder too, with
  its own reason in the report. No image failure fails the import.
- Encoding: WebP where the browser can encode it. **Safari cannot**:
  `canvas.toBlob` and `OffscreenCanvas.convertToBlob` with `image/webp` are
  unsupported there (MDN browser-compat-data 8.1.3, 2026-09-24) and silently
  return PNG. The encoder checks the returned blob's type and falls back (see
  open question 2).

## The report

`ImportReport` is a list of rows `{ sourceType, imported, degraded, skipped, reason? }`
plus image totals (`uploaded`, `deduped`, `placeholders`, `placeholderReason`).
Rules:

- Every source item lands in exactly one of imported, degraded (imported with a
  documented loss) or skipped (named by its source type).
- A partial import that looks complete is the worst outcome, so the report is
  never collapsed to a single success line when anything was degraded or skipped.
- Telemetry: one `track('Import', 'Completed', <ImportSourceKind>)` per import;
  counts stay out of telemetry.

## Bulk readiness (not built)

- Stages take one source and share no module state; a future queue calls them
  in sequence and aggregates reports.
- The gallery cap is enforced by the server per upload, so a queue needs no
  budget of its own.
- A future bulk run must not import the same board twice; the plan carries a
  stable `sourceId` (tool plus the tool's board id where it has one) so a later
  spec can decide how to record it.

## Open questions

1. Does the report persist on the diagram (activity log) or only in the dialog?
2. Safari encoding: bundle a WASM WebP encoder (about 100 to 300 KB, lazy
   loaded), or accept JPEG (opaque) and PNG (alpha) on Safari?
