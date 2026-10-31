# Word and PowerPoint import

Import a Word document (`.docx`) onto the current tab as an **article**, or a PowerPoint deck (`.pptx`) as **slide
pages**, replacing the tab's contents in one undo step. Teams already keep their writing in Word, Google Docs,
PowerPoint and Google Slides; without a way in, every trial starts from a blank page.

Google Docs and Google Slides come in through their own downloads: **File › Download › Microsoft Word (.docx)** and
**File › Download › Microsoft PowerPoint (.pptx)**. There is no Google sign-in and no Drive picker: the file is
read in the browser like any other.

## How it's triggered

The Import dialog ([Markdown import](markdown-import.md) "How it's triggered") offers two more format cards beside
JSON and Markdown: **Word** ("A .docx from Word or Google Docs. Becomes an article.") and **PowerPoint** ("A .pptx
from PowerPoint or Google Slides. Becomes slide pages."). Neither is text, so neither opens the paste panel: each
opens a **file panel** (`FileImportPanel`) with the same `BackBar`, the warning above it, and:

- A **drop area** across the dialog (a dashed, rounded box) naming the format ("Drop a Word document here" /
  "Drop a PowerPoint deck here") with **Choose a File** under it. Dropping a file on it, or choosing one, starts
  the import. A file dragged over it lights it in the brand colour.
- A quiet footnote with the Google route ("From Google Docs: File › Download › Microsoft Word") and the help
  link.
- While importing, the drop area shows a spinner and the stage in words: **Reading the document…**, then
  **Saving images (3 of 12)…** while images are stored, then it closes or shows the report. Every control is
  disabled meanwhile.
- An error renders under the drop area, in the dialog's error style, and the panel stays ready for another file.
  Cancelling the file picker leaves the panel as it was.

The chosen card decides the parser, as for the text formats: a `.pptx` dropped on the Word panel is refused with
"This is a PowerPoint file. Go back and choose PowerPoint to import it." (and the other way round).

A `.docx` or `.pptx` dropped on the canvas is refused like a Markdown file is, pointing to Import in the tab
menu.

## Word becomes an article

The tab's content is replaced by one article ([Article pages](../007-editor/article-pages.md)) holding the
document's body, in the order it is written. The article flows onto as many pages as the writing needs.

| In the document                                                              | In the article                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Title, Subtitle styles                                                       | Title, Subtitle paragraphs                                            |
| Heading 1, Heading 2, Heading 3 to 9 (by style name or outline level)        | Heading 1, Heading 2, Heading 3                                       |
| Quote, Intense Quote styles                                                  | Quote paragraphs                                                      |
| A list paragraph (bulleted or numbered by its numbering definition), level   | A bulleted or numbered list item at that level (deepest 5 levels)     |
| A paragraph in a code style, or every run of it in a monospace font          | A code block; consecutive ones join into one                          |
| Bold, italic, underline, strikethrough, superscript, subscript, a code font  | The same marks                                                        |
| A hyperlink to an http, https or mailto address (relationship or field)      | A link (anything else keeps its text, unlinked)                       |
| A page break (a break run, or "page break before" on a paragraph)            | A page break                                                          |
| A line break                                                                 | A line break in the block; a tab is a space                           |
| A picture, inline or floating                                                | An in-line object zone holding an image, at most the text's width     |
| Paragraph alignment (centre, right, justify)                                 | The same alignment                                                    |
| A table                                                                      | Each row a bulleted item, its cells joined by " · " (reported)        |
| Empty paragraphs (spacing)                                                   | Left out                                                              |
| Tracked insertions; tracked deletions                                        | Kept as written; left out                                             |
| Content controls, smart tags, fields                                         | Their content or result                                               |

What is **not** brought across, and named in the report when the document had it: footnotes and endnotes,
comments, headers and footers, text boxes and shapes, charts, diagrams (SmartArt), equations, embedded objects
and linked pictures. Colours, fonts, highlighting and the document's page setup are not brought across and not
reported: the article takes the tab's theme and its own style.

## PowerPoint becomes slide pages

The tab's content is replaced by **one slide page per slide**, in the deck's order, each landscape in the slide
size nearest the deck's shape (16:9 **Slide**, or 4:3 **Classic slide**). What is on a slide is placed where it
sits on the slide, scaled from the deck's size to the page's.

- **Text boxes and placeholders** (a title, a body, any shape holding text) become **text** elements with the
  box's place and size, a placeholder with no place of its own taking its layout's, then its master's. A
  paragraph with a bullet starts with "• " (a numbered one with its number), indented two spaces a level; the
  text size is the first run's (or the placeholder's default: a title 44 pt, a body 28 pt, else 18 pt), as px
  on the page; bold or italic when every run is; the first paragraph's alignment.
- **Pictures** become **image** elements in the picture's box; a cropped picture fills its box (cover).
- **Groups** are opened: their members are placed through the group's own scaling.
- **Speaker notes** become the slide's notes in the Slide Deck, the same notes the page's **Notes** button and
  the presenter view show.
- A **hidden slide** is a page whose slide is hidden in the Slide Deck.

What is **not** brought across, and named in the report when the deck had it: tables, charts and diagrams
(SmartArt), videos and audio, embedded objects, linked pictures, and shapes and lines with no text. Colours,
fonts, slide backgrounds and animations are not brought across and not reported: the pages take the tab's theme.

## One undo step

The replace is a single `commitTabs` step, as every import is: **Undo** brings the previous content back, and
the warning above the panel says so. The deck's speaker notes and hidden slides ride the slide pages' own slides
(`page:<tab>:<page>`): an undo takes those slides out with the pages, and a redo brings them back, notes and all,
as any deleted page's slides come back ([Pages](../007-editor/pages-mode.md) "Slides"). Each import mints new
page ids, so notes from an earlier import never land on a new page.

## Images

Every picture goes through the [import image pipeline](import-image-pipeline.md): resized and re-encoded in the
browser, uploaded to the importer's gallery (or embedded in an Offline Mode document), one import session per
file. A picture the pipeline cannot store stays an **empty image placeholder** of the same size, and the report
names why (gallery full, too large, no image storage, …). The pictures are read only from inside the file: a
linked picture (an address outside the file) is never fetched.

At most **100 images** are stored per import (the hosted gallery's own count); pictures past that stay
placeholders and are reported.

## The report

Once the tab has been replaced, an import that left anything out shows the Import dialog's report
(`ImportReport`) instead of closing: one line per kind of thing, with the count, for example "**Tables** · 2
tables were written as lists: an article's text holds no tables." or "**Images** · 3 images couldn't be saved:
your image gallery is full." An import that brought everything across closes the dialog.

## Untrusted files

The file is someone else's work, read in the browser, and never trusted:

- **Sizes are bounded before work is done**: the file at most **50 MB**; at most **4,000** entries in it; any one
  part unpacked at most **32 MB** (a picture: the image pipeline's 50 MB); everything unpacked in one import at
  most **256 MB**, counted as it unpacks, so a file that claims small sizes and unpacks huge stops at the cap.
- **XML is read by a small reader of our own** that refuses any document type declaration, so no entity is ever
  expanded and nothing external is ever loaded; a part nested deeper than **256** levels or holding more than
  **1,000,000** elements is refused.
- **Nothing in the file runs or is fetched**: macros, embedded objects, ActiveX and external relationships are
  never read; a link keeps only an http, https or mailto address, as typed links do; linked pictures are
  reported, never loaded.
- **What it makes is bounded as a tab is**: at most **5,000** article blocks, at most **100** slides (a tab's page
  cap), at most **300** elements on a slide, and a finished tab no larger than a tab may be saved.
- **Older formats** (`.doc`, `.ppt`) and **password-protected** files are not zip packages, and are refused with
  a named error that says how to get a `.docx` or `.pptx`.

## Errors

Each failure is named and shown in the panel; nothing on the tab changes.

| Failure          | Message                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `too-large`      | This file is over 50 MB, more than an import takes.                                                         |
| `legacy`         | This file is password protected or in the older .doc format. Save it as a .docx without a password first. |
| `not-a-package`  | This isn't a Word document (.docx), or it is damaged.                                                       |
| `wrong-format`   | This is a PowerPoint file. Go back and choose PowerPoint to import it.                                     |
| `unpacks-too-large` | This file unpacks to more than an import takes.                                                          |
| `too-many-slides` | This deck has 140 slides; a tab holds at most 100.                                                         |
| `too-many-blocks` | This document makes 6,200 blocks; an article holds at most 5,000.                                          |
| `too-large-for-tab` | This is more than one tab holds. Split it into smaller files and import each into its own tab.          |

(The PowerPoint messages say "PowerPoint deck (.pptx)", ".ppt" and "Word" in place of their Word wording.)

## Performance

The reader (zip, XML, both formats) is its own chunk, loaded on the first Word or PowerPoint import only, so the
editor's first load does not grow; unzipping uses the browser's own `DecompressionStream`, so no compression
library is shipped. A part is unpacked only when it is read. Images are stored three at a time (the pipeline's
own limit) while the stage line counts them.

## Share roles

Import is an Editor's: the tab menu that holds it is not offered to a Participant or a Viewer, and a locked tab
greys it out ([Markdown import](markdown-import.md)).

## Telemetry

`Tab · Imported · Word` and `Tab · Imported · PowerPoint`, once the tab has been replaced. Never the file's name
or content.

## Implementation

`apps/editor/lib/office-import/` holds the reader; `apps/editor/components/dialogs/FileImportPanel.tsx` the file
panel; `useTabImport` runs it. See the [blueprint](blueprints/office-import.md).

## Non-goals

- The older binary formats (`.doc`, `.ppt`), OpenDocument (`.odt`, `.odp`), PDF and Excel.
- Importing from Google Drive directly (a sign-in and a picker for what a download already does).
- Keeping a document's or deck's colours, fonts, backgrounds, animations and transitions.
- Tables as tables (a table element in a zone) and charts as charts.
- Exporting to Word or PowerPoint.
