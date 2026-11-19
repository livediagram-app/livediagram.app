# Vector PDF

Status: shipped

Every product's PDF export (livediagram, livedocuments, livedesign, liveplanner, livehuddle) is written by one writer,
`@liveworkspace/vector-export` (`packages/vector-export`). It draws the SVG each product already makes for its SVG
export into a PDF as vectors, so a PDF from any product has real text and sharp lines, like the PDFs Google Docs,
Word, Canva, Figma, Lucid and draw.io make.

## What a PDF holds

- **Shapes and lines are vector paths.** Every SVG shape (path, rect, circle, ellipse, line, polyline, polygon) is a
  PDF path with its fill, stroke, width, caps, joins, miter limit, dashes, fill rule and paint order. Transforms, nested
  `<svg>` viewports, clip paths, opacity (a translucent group is a transparency group), CSS blend modes, linear and
  radial gradients (as shading patterns) and user-space tiling patterns (as tiling patterns, their tiles vector too)
  all have their PDF form. A knockout mask (one opaque white shape with opaque black shapes cut out of it, as
  livediagram cuts a connector under its label) is an even-odd clip.
- **Text selects, searches and reads aloud.** Each `<text>` is laid out by the browser in the mounted SVG; its glyphs
  are drawn as outlines in the faces the SVG embeds, with the Logo Kit's outlining code (Work Tracker 860), so the
  page looks exactly as the SVG does with no font in the file. Each glyph of a face is written once and placed
  wherever it is used (a plain filled letter; stroked or gradient-filled letters keep their own path), so a long
  article stays small. Text in a stack the SVG embeds no face of (a system stack such as livediagram's default
  `system-ui, sans-serif`) is set in Inter, as the Logo Kit sets it: the product hands the writer Inter's faces, asked
  for only when a page has such text, and the text is laid out and drawn in them. Over the outlines lies an invisible text layer (text
  render mode 3, the way a scanned page is made searchable): every character where the browser put it, words on one
  baseline joined into lines with their spaces, each line stretched to the width its outlines span. A reader selects,
  copies and finds the text, and a screen reader reads it, in reading order.
- **Pictures stay pictures.** A JPEG keeps its own bytes; any other picture goes in losslessly with its transparency,
  at no more than three device pixels per CSS pixel of the size it shows. One picture used on many pages (a deck's
  repeated animated background) is stored once.
- **Link areas** the product hands in (livedocuments' contents entries and links in an article's text,
  [article-pages.md](../../../livedocuments/docs/specs/007-editor/article-pages.md) "Everywhere a page goes") lie over
  each page as link annotations: to another page of the PDF, or to an address.
- **Tags** where the page knows its structure, so a screen reader reads it as it reads a web page:
  - **An article's writing** is tagged block by block: headings H1 to H6, paragraphs P, a quote BlockQuote, a list
    L of LI items, each holding its marker (Lbl) and its words (LBody), a deeper level's list inside its item's
    LBody, and a table Table of TR rows of TD cells, a header row's cells TH (column headers, `/Scope /Column`). Each
    line of the text layer is marked content of its block's element, a block running over two pages keeping one
    element.
  - **A picture with alt text** (an image's **Alt Text**, in any product) is a Figure
    whose `/Alt` is that text, so a screen reader reads the description where the picture stands: on its page, before
    the first block that starts below the picture's top edge. A picture with no alt text is decoration, an artifact
    a screen reader skips, as a web page's `alt=""` is. A picture drawn as part of a fallback picture or a
    translucent group is still a Figure, the group's described pictures' words joined.
  - The outlines and every other drawing are artifacts. A PDF with neither (a diagram with no described picture, a
    board) stays untagged; a page that has a described picture but no article writing is tagged with each line of its
    text a P. A tagged PDF names its language (the page's `lang`) and every PDF its title (the tab's name), shown by
    a reader in place of the file name.

## Pictures and the fallback

- An element PDF has no vector form for is drawn by the browser on its own, transparent around it, and placed as a
  picture exactly where it sits; the rest of the page stays vector. These are: a filter (a shadow, a blur), any other mask, a
  `<foreignObject>`, a `<use>`, a marker, a clip PDF can't take (text in it, a clip on a clip), a translucent gradient
  stop, a reflected or repeated gradient, a pattern in bounding-box units, and a text whose letters the embedded faces
  don't hold (a script outside the embedded Latin subsets, or a system face when Inter can't be fetched, offline). Text inside such a picture still goes into
  the text layer.
- A page the vector path can't draw at all (anything throws) is drawn by the product's raster path instead, a picture
  of the page laid on white, exactly as every PDF was drawn before. No export comes out worse than it did.

## Page size

A page is the SVG's CSS size at 0.75 pt per px (96 to 72 per inch): an A4 page is 595 x 842 pt and a canvas prints at
the size it shows. A page past the PDF limit of 14400 pt (200 inches) a side shrinks uniformly to fit it; vectors keep
every detail at any size.

## Performance

- The writer is a chunk loaded only when a PDF is exported: every app reaches `@liveworkspace/vector-export/pdf` by a
  dynamic `import()`, and fontkit (the face reader the outlines need) loads only when a page has text. No app's first
  load carries either; each app's tests fail on a static import of them.
- Export-time work only, never per frame: one walk of each page's SVG, one outline per character, streams compressed
  by the browser's own `CompressionStream`. A fallback picture costs the element it draws, not the page.
- A vector page is far smaller than the old picture of it, and stays sharp at any zoom or print size: measured, a
  nine-page article is 176 KB against 2.4 MB, and livediagram's System Architecture template 82 KB against 228 KB.

## Who may export

Exporting is reading: whoever may open a document (Editor, Participant, Viewer) may export it as a PDF, as with every
other export. The writer reads only the SVG the export already makes; it sends nothing anywhere.
