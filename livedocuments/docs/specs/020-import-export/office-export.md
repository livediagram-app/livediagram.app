# PowerPoint and Word export

A slide tab's pages exported as a **PowerPoint deck** (`.pptx`), and an article tab's writing as a **Word document**
(`.docx`), each with its text kept as real, editable text. A deck that cannot become a `.pptx` cannot go to a client
or a conference, and a report that cannot become a `.docx` cannot go through a review in Word; Google Slides,
Google Docs and Keynote open both formats, so one export covers them too. It is the way back out of
[Word and PowerPoint import](office-import.md).

## Where it is offered

The Export dialog ([Pages](../007-editor/pages-mode.md) "Export") offers one more format card, chosen by the tab's
kind (its first page's, [Pages](../007-editor/pages-mode.md) "One kind a tab"), after GIF and before JSON:

| Tab kind    | Card           | Copy                                                                                       |
| ----------- | -------------- | ------------------------------------------------------------------------------------------ |
| Slide       | **PowerPoint** | "Every page as an editable slide, with its notes. Opens in Keynote and Google Slides too." |
| Article     | **Word**       | "The article as an editable document, its headings as Word styles. Opens in Google Docs."  |
| Infographic | none           | PNG, SVG and PDF already fit a laid-out page.                                              |
| Flashcard   | none           | A card is spoken from, not handed over.                                                    |

A tab with no page yet, and an export of a selection, show neither card.

- **Share roles**: as every Export dialog format. Whoever can open the Export dialog (an Editor, a Participant and a
  Viewer alike) can export; it reads the tab and changes nothing.

## The panel

The card opens a panel with the shared back bar ("All formats" › PowerPoint / Word) and the dialog's subtitle
"Download the tab as a PowerPoint deck." / "Download the article as a Word document.":

- **What the file holds**, one line: "12 slides, one a page, with the speaker notes of 3." (no notes: "12 slides, one
  a page."; one page: "1 slide.") / "The article's 9 pages of writing, its pictures and drawings as images." (one
  page: "The article's writing, its pictures and drawings as images.").
- **What stays editable**, a short list under it: for PowerPoint "Text boxes keep their font, size, colour and
  alignment", "Rectangles, circles and other basic shapes stay shapes", "Charts, icons, pictures and arrows come as
  pictures"; for Word "Headings, quotes and code as Word styles", "Bulleted, numbered and to-do lists", "Links, bold,
  italic and the rest of the text formatting", "Pictures, charts and drawings as images".
- The **preview** shows the tab's first page, as the image formats' preview does ("Preparing preview…" until ready).
- **Download PowerPoint** / **Download Word** makes the file. While it is made the button reads
  **Making the deck… 40%** / **Making the document… 40%** (the share of slides, or of the article's zones, drawn) beside a progress bar, a **Cancel** button stops it,
  and the back bar is disabled. The download is named `<document> - <tab>.pptx` / `.docx`.

## PowerPoint: one slide a page

**Every page of the tab**, in order, is one slide; the deck is the page's shape: 16:9 at PowerPoint's own
widescreen size (13.33 x 7.5 in), 4:3 at its standard size (10 x 7.5 in). A page is scaled to the slide by one factor,
so every place, size and font size keeps its proportion (a 48 px heading on a 1920 px page is 24 pt).

What is on a page, in its paint order (the canvas's back to front, so what overlaps keeps overlapping the same way):

- **A text element** becomes a **text box** in its box: its text, with its font (the face's name, so an app with the
  face installed shows it and any other substitutes), size, colour, bold, italic, underline, strikethrough, its
  horizontal alignment and its vertical anchor (top, middle, bottom), and a line break as a new paragraph. Rich text
  keeps each run's colour, size, bold and italic. A turned element keeps its turn.
- **A basic shape** becomes a **native shape** of the same kind, with its fill, border colour, border width and dash,
  corner radius, and its label as the shape's text, formatted as a text box's: rectangle (rounded or square),
  circle, diamond, triangle, hexagon, parallelogram, trapezoid, stadium, star, cloud, cylinder and document. A shape
  that carries what a native shape cannot (an icon in its label, the Sketch finish, a shadow, an animated or
  gradient fill, a colour the file cannot name) comes as a picture instead, so it looks as it does.
- **Everything else** (pictures, charts, tables, icons, stickers, arrows, sticky notes, web components, drawings, tab
  windows and the rest) comes as a **picture** of exactly what the page shows of it, in its place, at twice the
  page's resolution, cut at the page's edge as the page cuts it. A picture is one element, so each can be moved on
  its own.
- **The background**: a plain page is the slide's white; a solid colour is the slide's background colour; a
  gradient, an animated background (as it stands when the slide opens), a picture or a pattern is the slide's
  background picture.
- **Speaker notes**: the notes of the page's slide in the [Slide Deck](../012-collaboration/presentation-mode.md)
  become the slide's notes, which the presenter view of PowerPoint, Keynote and Google Slides shows.
- **A hidden slide** (the page's slide hidden in the Slide Deck) is a hidden slide in the deck.
- **Not in the deck**: the editor's own chrome (selections, page headers, comments' badges, cursors), animations and
  transitions (a slide is its resting frame, as in every export), and links on elements.

## Word: the article as a document

**Every article of the tab**, in the order its pages run, is the document's body; a second article starts on a new
page. The document's paper is the article's page size and orientation (A4, US Letter, A3, ...), its margins the
article's margins.

| In the article                                                 | In the document                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Title, Subtitle, Heading 1, Heading 2, Heading 3, Quote        | Paragraphs in Word's Title, Subtitle, Heading 1 to 3 and Quote styles  |
| Body paragraph                                                 | Normal                                                                 |
| Bulleted and numbered list items, level 0 to 4                 | Word list items at that level (•, ◦, ▪; 1, a, i), each run numbered 1  |
| To-do item                                                     | A list item starting ☐, or ☒ struck through when done                  |
| Code block                                                     | One paragraph in a Code style (monospace, shaded), its lines kept      |
| Divider                                                        | An empty paragraph with a rule under it                                |
| Page break                                                     | A page break                                                           |
| Alignment (left, centre, right, justify)                       | The same alignment                                                     |
| Bold, italic, underline, strikethrough, superscript, subscript | The same formatting                                                    |
| Inline code                                                    | A run in the Code font, shaded                                         |
| A link (http, https or mailto)                                 | A hyperlink in Word's Hyperlink style                                  |
| Text colour, highlight                                         | The same colour; the highlight as the run's shading                    |
| A line break inside a block                                    | A line break                                                           |
| An object or drawing zone                                      | An image of the zone as the page shows it, its size, inline or wrapped |

- **The style travels as styles**: the article's heading and body fonts, text size, line and paragraph spacing,
  accent (headings in it when **Headings in the Accent** is on, links and the quote bar always), and **Lines Under
  Text** (a rule under the title, or every heading) are set on the styles themselves, so restyling the document in
  Word restyles every heading at once.
- **A zone** keeps its wrap: **In Line** is an image on its own line, aligned as the zone is; **Wrap Left** and **Wrap
  Right** float the image at that side with the text running beside it, 14 px clear. A zone's image is drawn at twice
  its size, its elements exactly as the page shows them, cut at a drawing zone's edge.
- **Page numbers** (when the style has them) are a page number field centred in the footer.
- **Not in the document**: comments and actions (the margin notes are review furniture, as in every export), loose
  elements on an article page (in no zone), the page's background, pattern and ruled lines (Word's page is white and
  its text dark), and the editor's own chrome.

## Errors

Each failure is named under the panel, in the dialog's error style; nothing downloads and the panel stays ready.

| Failure  | Message                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- |
| `draw`   | "This Browser couldn't draw a picture for the file. Try Chrome, Edge or Firefox, or a PDF." |
| `gone`   | "This tab has no pages to export any more."                                                 |
| `failed` | "Couldn't make the file. Try again, or export a PDF."                                       |

**Cancel** discards everything made so far; nothing downloads.

## Performance

- **Built in the browser**, as every export is: the api stays static and nothing leaves the device.
- **No library**: the files are written by a small writer of our own on the shared zip writer
  (`@liveworkspace/workbench/lib/zip-writer`), as the PDF export writes its own PDF. The writer is its own chunk,
  loaded the first time the PowerPoint or Word card opens, so the editor's first load does not grow.
- **Measured** on a 50-slide deck and a 30-page article: the writer chunk is 42 KB minified (16 KB gzip), and the
  build and write take about 100 ms and 50 ms before the pictures; the details are in the
  [blueprint](blueprints/office-export.md) "Performance and limits".
- The main thread yields between slides and between zones, so the editor stays responsive and the progress moves.

## Telemetry

`Document · Exported · PagesPPTX` and `PagesDOCX`, once the file is downloaded. Never a page name, a count or a size.

## Implementation

`apps/editor/lib/office-export/` holds the writers and the mapping; `apps/editor/components/dialogs/office/` the
panel. See the [blueprint](blueprints/office-export.md).

## Non-goals

- PowerPoint for an infographic or flashcard tab, Word for a slide or infographic tab, or either for a selection.
- Element animations, slide transitions and auto-advance in the deck; links on elements.
- Tables as native tables, charts as native charts, arrows as native connectors: each is a picture.
- Embedding the fonts in the file.
- Comments, actions and loose elements in the Word document; the page's background in it.
- OpenDocument (`.odp`, `.odt`), Keynote's own format and Google's own formats: each app opens `.pptx` and `.docx`.
