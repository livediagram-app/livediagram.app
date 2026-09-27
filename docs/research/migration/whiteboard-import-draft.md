# Microsoft Whiteboard import (proposed spec)

Status: **proposed**, not yet a spec, and **blocked on samples** (see below).
Promote into `docs/specs/020-import-export/` once the samples are in and the
open questions are answered.
Evidence: [Migration readiness, section C](../migration-readiness.md#c-microsoft-whiteboard-import).
Builds on [Import pipeline (proposed spec)](./import-pipeline-draft.md).

## What it is

A **Microsoft Whiteboard** card in the Import dialog that accepts the files
Microsoft itself produces from a board, best first:

| Input                          | Where the user gets it                                                                                       | Expected fidelity                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `.html` (Graph conversion)     | Work or school boards only: Microsoft's `Export-WhiteboardHtml` cmdlet, or a later "Connect OneDrive" button | Structured, to be confirmed by sample |
| `.svg` (image export)          | Whiteboard for the web, export menu, if SVG is still offered                                                 | Vector ink and text, to be confirmed  |
| `.png` / `.jpg` (image export) | Any Whiteboard app: Settings, Export Image                                                                   | One image element                     |

No Microsoft account connection is needed for v1: every input is a file the
user already has. That keeps the server cost at zero and works on self-host.

## Why not the other routes

- `.whiteboard` files are undocumented Fluid Framework documents; Microsoft Graph
  already converts them to HTML and PDF, so we parse Microsoft's conversion
  rather than its storage format.
- Personal-account boards are not files at all (Azure storage, board picker
  only). The only reachable content is the app's image export.
- The web app's internal API is undocumented and needs a token lifted from the
  browser; not a product path.

## Mapping (provisional, fixed after samples)

| Whiteboard content | livediagram                                                           |
| ------------------ | --------------------------------------------------------------------- |
| pen ink            | `freehand`, one element per stroke, colour and width kept             |
| highlighter        | `freehand` at reduced opacity                                         |
| sticky note        | `sticky`, nearest palette colour                                      |
| note grid          | one `sticky` per note, laid out as in the grid                        |
| text box           | `text`                                                                |
| shape              | `shape`, nearest kind                                                 |
| connector / arrow  | `arrow`; pinned only when the source says what it connects            |
| image              | `image` through the asset stage                                       |
| reaction           | skipped, counted                                                      |
| PNG / JPG export   | a single `image` element sized to the export, through the asset stage |

## Later: Connect OneDrive (work or school)

A button that lists the user's `Whiteboards` folder with Microsoft Graph
(`Files.Read`, delegated) and converts a chosen board with
`GET /me/drive/items/{id}/content?format=html`. Graph answers with a 302 that a
browser `fetch` carrying `Authorization` cannot follow (CORS), and conversions
have no `@microsoft.graph.downloadUrl`. So one api Worker route resolves the
302 and returns only the `Location` URL; the browser downloads the converted
bytes from that pre-authenticated URL itself. One Worker request per board.
Unverified: that the pre-authenticated URL serves CORS headers (same class of
URL as `downloadUrl`, which Microsoft says is fetchable from JavaScript).

## Samples needed before this becomes a spec

From the operator's Windows app and account:

1. Account type: **personal** Microsoft account, or **work or school**.
2. One test board with pen ink, highlighter, a sticky note, a note grid, a text
   box, two shapes joined by a connector with an arrowhead, an image and a
   reaction.
3. Windows app: Settings, Export Image, at standard and high resolution.
4. [whiteboard.cloud.microsoft](https://whiteboard.cloud.microsoft): every export
   format the menu offers, SVG especially.
5. Work or school only: the `.whiteboard` file from OneDrive's `Whiteboards`
   folder, and the output of
   `Install-Module WhiteboardAdmin; Export-WhiteboardHtml -Mode User -Environment AzureCloud`.
6. A screenshot of the board as ground truth.

## Open questions

1. Personal-account retirement (reported: view and export end 2026-10-16) means
   personal boards can only ever arrive as images. Build the PNG path first, or
   treat it as a one-off manual migration for the operator?
2. Is "Connect OneDrive" worth an Entra app registration (multi-tenant, some
   tenants block user consent), or is the file route enough?
