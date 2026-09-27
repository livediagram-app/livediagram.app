# Microsoft Whiteboard import

A **Microsoft Whiteboard** format card in the Import dialog. It takes what
Microsoft Whiteboard exports of a personal board and turns it into **editable**
livediagram content: ink becomes pen strokes, notes become stickies, text stays
text, shapes and connectors become shapes and arrows, images go through the
image pipeline. A board survives Microsoft deleting it, and stays a board rather
than a picture of one. Built on [Board import](board-import.md); evidence in
[Migration readiness, section C](../../research/migration-readiness.md#c-microsoft-whiteboard-import).
Implementation detail: [blueprint](blueprints/whiteboard-import.md).

## Decisions

- **Personal-account boards.** Whiteboard for personal Microsoft accounts is
  being retired: read-only since 2026-09-25, permanently deleted on
  **2026-10-16**. Personal boards live in Azure, never as files, and no API
  reaches them, so what a user can keep is what the web app exports.
- **The Full export Zip is the primary route.** Its HTML is the app's own
  canvas markup (ink as vector paths, notes and text as positioned HTML, images
  inlined), which Microsoft describes as usable for "exporting to another
  application". Parsing it yields editable content that costs the image gallery
  only the board's own pictures.
- **The PNG is the fallback.** For a board whose Zip is missing or unreadable,
  the exported picture imports as one image, as before.
- **Browser only.** The input is a file the user already has. No Microsoft
  account connection, no Worker route, no server cost; works on self-host.
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

## The card

- One **Microsoft Whiteboard** card. It picks a file (no paste box): a `.zip`
  (the Full export), its extracted `.html`, or a picture (`.png`, and `.jpg` /
  `.webp` for users who converted).
- What the file is decides the route, by its bytes, not its name: a Zip or
  Whiteboard HTML takes the **board route**, a picture the **picture route**.
- A Zip may hold other files beside the board (a user re-zipping a folder);
  the board is the one HTML file whose markup is a Whiteboard canvas. A Zip
  with no such file, or more than one, is a named rejection.

## Where it lands

- Each import **adds a new whiteboard tab** (`kind: 'whiteboard'`,
  [Whiteboard](../023-whiteboard/whiteboard.md)) right after the active tab,
  named after the board's title (the HTML or picture file name without its
  extension), and opens it. The active tab is never touched, so a tab's kind
  stays fixed at creation.
- Adding the tab is **one undo step**: undo removes it and returns to the tab
  the import started from.
- The card therefore carries no replace warning; it says it adds a
  whiteboard tab.
- The tab carries `kind: 'whiteboard'` from the first import. Until the
  whiteboard's own presentation is built it shows as an ordinary tab, and
  becomes a whiteboard with no migration when that lands.

## The board route

### Placement

- Every board item keeps its **position, size, rotation and stacking order**.
  Board units are CSS pixels and map 1:1 to canvas units.
- The whole board is translated so its content's top-left corner sits at the
  tab's origin; the viewer then frames it.
- The board's **background colour** becomes the tab's background colour; the
  board's grid or dots, when shown, become the tab's pattern.

### Mapping

Every board item lands in exactly one of **imported**, **degraded** (imported
with a named loss) or **skipped** (named by its Whiteboard kind), as
[Board import](board-import.md) requires.

| Whiteboard item                   | Becomes                                                                   | When degraded                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Pen stroke                        | `freehand` stroke with its colour, opacity and width                      | Its centreline cannot be read: kept as its drawn outline, a filled closed `freehand`, same look |
| Highlighter stroke                | `freehand` with `pen: 'highlighter'`, its colour and width                | as for a pen stroke                                                                             |
| Ink shape (rectangle, ellipse, …) | The matching livediagram shape, with the ink's colour and width, no fill  | No livediagram match: kept as its ink strokes                                                   |
| Ink line, curve, polyline         | `freehand` stroke                                                         |                                                                                                 |
| Note                              | `sticky` with its colour and text                                         | A colour outside the sticky palette: nearest sticky colour                                      |
| Note grid                         | Its notes, as stickies where they sit                                     | Always: the grid itself is not kept                                                             |
| Text                              | `text` with its size, colour, weight and style                            | A size between presets: nearest preset                                                          |
| Shape with text                   | The matching shape with the text as its label                             | as for an ink shape                                                                             |
| Connector                         | `arrow`; attached to the items it joins when both are imported, else free | An arrowhead livediagram does not draw: the nearest one                                         |
| Image                             | `image` through the shared image pipeline                                 | Not stored (gallery full, too large, …): a placeholder with its reason                          |
| Reaction                          | `text` holding the reaction's emoji, where it sat                         |                                                                                                 |
| Link preview                      | `link-card` for its URL                                                   |                                                                                                 |
| Comment thread                    | A comment thread on the item it is anchored to                            | Anchored to nothing that was imported: skipped                                                  |
| Loop component, app frame, other  | Skipped, named by kind                                                    |                                                                                                 |

- The exact markup of notes, text, shapes' text, connectors, images and
  reactions is confirmed from real exports; the blueprint names what is
  verified and what is pending.
- Stroke widths are kept in pixels where the element supports it and otherwise
  mapped to the nearest livediagram width; a width beyond the thickest is a
  degradation, counted.
- Colours are kept exactly, including translucency (as element opacity).
- Comment authors are kept by **display name** only; email addresses in the
  comments file are never read into the diagram.

### Fitting one tab

A tab holds at most 10,000 elements (`MAX_ELEMENTS_PER_TAB`) and 4 MB of
content (`MAX_TAB_BYTES`, [Per-tab storage](../006-diagram/per-tab-storage.md));
dense handwriting approaches both. Offline tabs keep the same limits, so a
board can move between Offline Mode and the cloud.

- Stroke points are simplified to within a fraction of a pixel of the drawn
  line, then, only when the board would not fit, progressively coarser until
  it does. The report says when strokes were simplified to fit.
- A board that still does not fit is a named rejection that points to the
  picture route. It is never cut short silently.

## The picture route

- The picture becomes one `image` element at the tab's origin, sized to the
  picture's aspect ratio, through the image pipeline: resized to the longest
  side of [Board import](board-import.md) (2,048 px), WebP, uploaded, or
  embedded in an offline tab.
- The report says what the user now has: "1 board imported as a picture. Ink,
  notes and text are part of the image and cannot be edited. Import the Full
  export Zip to edit them."
- The shared 2,048 px limit stands: the Zip route keeps handwriting as vectors,
  so the picture route is for boards without one.
- A full gallery keeps the element as a placeholder, as for any import.

## The report

Shown in the Import dialog's result panel ([Board import](board-import.md)),
never collapsed to one success line when anything was degraded, skipped or left
as a placeholder. Rows are per Whiteboard kind ("Pen strokes: 214 imported, 3
kept as outlines"), plus the image totals of the image pipeline.

## Errors

Named rejections, tab untouched:

- Not a Whiteboard export (a Zip or HTML without a Whiteboard canvas, or a file
  that is neither a Zip, HTML nor a decodable picture).
- A Zip with more than one Whiteboard board inside.
- A damaged or encrypted Zip.
- A file or board past the import limits (sizes in the blueprint).
- A board with nothing on it.
- A picture larger than the browser can decode: the report suggests the
  standard-resolution export.

## Bulk

This importer **leads on bulk import**: many exported boards at once, the case
a user moving 100+ boards has. Bulk is the next piece of work after single-file
import ships, specified then; single-file import keeps it cheap: each board is one pure parse of one file with no shared state, the
plan carries a stable `sourceId` (`mswb:` plus the board title and a hash of
its item ids) so a bulk run can spot a board it already imported, and the
commit target is a parameter, so a bulk run can commit each board to a new
tab or diagram.

## Telemetry

`track('Tab', 'Imported', 'MicrosoftWhiteboard')` for the board route and
`track('Tab', 'Imported', 'MicrosoftWhiteboardPicture')` for the picture route
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).
Counts and names never leave the browser.

## Help

The **Import from Microsoft Whiteboard** help article: exporting every board
before 2026-10-16 (Zip and high-resolution PNG, one board at a time), importing
the Zip, what carries over and what does not, and the picture fallback.

## Non-goals

- Work or school boards through Microsoft Graph (`content?format=html`); the
  route exists but no user of it has asked.
- Keeping an imported board in sync with Whiteboard.
- Recreating Whiteboard's note grid, Loop components or app frames.

## Open questions

With the operator; each answer moves into the sections above.

1. **Ink as strokes or outlines**, and **widths beyond livediagram's thickest
   pen**: decided with the operator's real exports in front of us.
