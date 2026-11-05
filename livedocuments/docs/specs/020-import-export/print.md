# Print

Print pages straight from the Export dialog: the **current page**, or the **whole document** (every tab's pages,
in tab order). A PDF download already prints, but a person who wants paper should not have to save a file, find it
and open it in another app first.

## Where it is offered

The Export dialog ([Pages](../007-editor/pages-mode.md) "Export") offers a **Print** card on every tab with pages,
whatever their kind (infographic, slide, article, flashcard), after PDF: "Send the current page or the whole
document to your printer, each page its own sheet." A selection's export (no pages) does not offer it. Print sits
where Export sits, so whoever may export may print, a Viewer included.

## The panel

The card opens a panel behind the dialog's `BackBar` ("All formats", the chip **Print**):

- A segmented control, **Current Page** or **Whole Document**, starting on Current Page.
- With Current Page, the page picker (the export's page select), starting on the page in view. With one page
  there is nothing to pick.
- A line saying what will print: "1 page." or "12 pages from 3 tabs."
- A **Print** button. While the pages are drawn it reads **Preparing…** and is disabled; then the browser's own
  print dialog opens and the Export dialog closes. An error renders inline, as the image formats' do.

## What prints

- **Current Page**: the chosen page of this tab.
- **Whole Document**: every tab's pages in tab order, each tab's in its row order (a stack's in its stack order). A
  tab still on the Start screen (its only page still offering the choice of kind) has nothing to print and is
  skipped. This tab's pages are drawn as they stand in the editor; another tab's as its stored pages, its
  article writing set as a closed article's is.
- Each page is **its own sheet, exactly its size**: an A4 page prints A4 portrait, a 16:9 slide landscape at its
  size, a card at the card size, each through its own named `@page` rule (`size` in CSS px, `margin: 0`), so a
  document mixing kinds prints each at its own size. The browser fits a sheet the printer cannot hold, as it fits
  any page.
- A page prints as the PDF export draws it (`renderTabToSvg` with the page, the same picture PNG and PDF
  rasterise): its background, pattern and elements clipped to its edges, the plain paper white. Printed as
  vector SVG, not a picture of one, so text stays sharp. Hidden layers stay out, as in every page export.
- No headers, footers, page numbers or editor chrome: the print document holds only the sheets, with
  `print-color-adjust: exact` so backgrounds print.

## How it prints

The pages are drawn into a **print frame**: an `<iframe>` off screen (not `display: none`, which some browsers
refuse to print), `sandbox="allow-same-origin allow-modals"` (no script runs in it), its document written through
`srcdoc` as `TrustedHTML` (our own builder's markup, [Trusted Types](../../../../livediagram/docs/specs/016-platform/trusted-types.md)).
Once it loads, its window's `print()` opens the dialog; the frame is removed after `afterprint`, or after a minute
where a browser never sends it. Only one print frame exists at a time: a second Print replaces the first.

This works the same on a phone: iOS and Android open their print sheet from the frame's `print()`.

## Performance

Drawing is the PDF export's per-page SVG, with no rasterising, so a page costs what its SVG preview costs.
Images are loaded once per tab (`loadTabImages`), as an export loads them. Whole Document draws every page of every
tab before the dialog opens: a 100-page document is 100 SVGs in one frame, a few MB of markup. Nothing is
drawn until Print is pressed.

## Telemetry

`UI · Used · PrintPage` or `UI · Used · PrintDocument` once the print dialog opens: the scope, nothing about the
pages. The emitter takes a type and no properties, so the scope is in the type, as `PagesPDF` / `PagesPDFPages`
carry the PDF's.

## Implementation

`apps/editor/lib/print-pages.ts` picks the sheets (`printSheets`) and builds the print document
(`printDocumentHtml`); `apps/editor/lib/print-frame.ts` runs the frame; `apps/editor/components/dialogs/PrintPanel.tsx`
is the panel. See the [blueprint](blueprints/print.md).

## Non-goals

- Choosing pages beyond these two scopes (a range, several tabs): the browser's print dialog picks pages from what
  is sent.
- Print settings of our own (margins, scale, copies): the browser's print dialog has them.
- Printing a canvas tab without pages.
