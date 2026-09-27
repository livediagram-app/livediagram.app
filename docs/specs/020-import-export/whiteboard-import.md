# Microsoft Whiteboard import

A **Microsoft Whiteboard** format card in the Import dialog. It takes the
picture Microsoft Whiteboard exports of a board and places it on the tab as one
image, so a board survives Microsoft deleting it. Built on
[Board import](board-import.md); evidence in
[Migration readiness, section C](../../research/migration-readiness.md#c-microsoft-whiteboard-import).

## Decisions

- **Personal-account boards, image route.** Whiteboard for personal Microsoft
  accounts is being retired: read-only since 2026-09-25, permanently deleted on
  **2026-10-16**. Personal boards live in Azure, never as files, and no API
  reaches them, so what a user can keep is what the app exports. v1 imports the
  exported **PNG**.
- **No Microsoft account connection.** The input is a file the user already
  has. No Worker route, no server cost, works on self-host.
- **Not the internal Whiteboard API.** It is undocumented, needs a token lifted
  from the browser, and is being shut down.

## What Whiteboard exports

From the web app (`whiteboard.cloud.microsoft`, build 26.10910.101) and its
shipped strings. The standalone Windows, iOS and Android apps retired on
2026-09-14.

| Export                         | Contents                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Quick export, Image, standard  | PNG, longest side up to 5,000 px                                                               |
| Quick export, Image, high      | PNG, longest side up to 16,200 px                                                              |
| Quick export, PDF              | Windows desktop app only, behind a feature flag                                                |
| Full export, Zip (HTML + JSON) | `<title>.html`: a snapshot of the rendered canvas with images inlined; `<title>-comments.json` |

## Import (PNG)

- The card accepts `.png` (and `.jpg`, `.webp` for users who converted).
- The image becomes one `image` element at the tab's origin, sized to the
  picture's aspect ratio, through the asset stage: resized to the longest side
  of [Board import](board-import.md) (2,048 px), WebP, uploaded, or embedded in an
  offline tab.
- The report says what the user now has: "1 board imported as a picture. Ink,
  notes and text are part of the image and cannot be edited."
- A full gallery keeps the element as a placeholder, as for any import.

## Full export Zip

The Zip is the richest thing Whiteboard produces for a personal board: its HTML
is the app's own canvas markup (ink as vector paths, notes and text as
positioned HTML, images inlined), and Microsoft describes it as usable for
"exporting to another application". v1 does not parse it, because the markup is
Whiteboard's internal DOM and its mapping can only be specified from real
exports. The help article tells users to keep the Zip beside the PNG, so a
later version can import the same files with editable ink and notes.

## Errors

- A file that is not a decodable image: named rejection, tab untouched.
- A PNG larger than the browser can decode (very large high-resolution
  exports): the asset stage decodes with `createImageBitmap` and a resize option
  first; if that still fails, the report says so and suggests the standard
  resolution export.

## Non-goals

- Structured import of the Full export Zip (see above).
- Work or school boards through Microsoft Graph (`content?format=html`); the
  route exists but no user of it has asked.
- Bulk import of many exported boards.

## Open questions

1. Board pictures at 2,048 px lose handwriting on large boards. Keep the shared
   limit, raise it for whole-board pictures, or tile the picture?
2. The hosted cap is 100 images per owner, so more than 100 Whiteboard boards
   cannot all arrive as pictures. Accept placeholders, or treat board pictures
   differently?
