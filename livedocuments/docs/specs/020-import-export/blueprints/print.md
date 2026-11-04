# Print blueprint

Derived from [Print](../print.md). Everything lives in `apps/editor`.

## Domain and naming

| Term (spec)                   | Identifier                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------- |
| the Print format              | `'print'` in `Format` (`apps/editor/components/dialogs/ExportTabDialog.tsx`) |
| Current Page / Whole Document | `PrintScope` = `'page' \| 'document'` (`lib/print-pages.ts`)                 |
| a sheet                       | `PrintSheet` = `{ tab: Tab; page: LaidOutPage }`                             |
| the sheets for a scope        | `printSheets(scope, current, documentTabs)`                                  |
| the print document            | `printDocumentHtml(sheets, svgOf)`                                           |
| the print frame               | `printInFrame(html)` (`lib/print-frame.ts`), `PRINT_FRAME_ATTR`              |
| the panel                     | `PrintPanel` (`components/dialogs/PrintPanel.tsx`)                           |

## Constants

| Constant                 | Value              | Provenance                                   |
| ------------------------ | ------------------ | -------------------------------------------- |
| `PRINT_FRAME_CLEANUP_MS` | 60000              | Spec ("after a minute")                      |
| `PRINT_FRAME_ATTR`       | `data-print-frame` | Marks the one frame, so a second replaces it |

## Pure parts (`lib/print-pages.ts`)

- `printSheets(scope, { tab, pages, page }, documentTabs)`:
  - `'page'`: `[{ tab, page }]`.
  - `'document'`: for each of `documentTabs` in order, the current tab (by id) as `{ tab, pages }` from the
    dialog, any other as `laidOutPagesOf(other)`; a tab whose pages `offersPageKindChoice` (only page, no kind,
    no elements) gives none.
- `printDocumentHtml(sheets, svgOf)`: one `<style>` then one `<section class="sheet">` per sheet holding
  `svgOf(sheet)`. Each distinct page size gets one named rule, `@page s<W>x<H> { size: <W>px <H>px; margin: 0 }`,
  and its sheets `page: s<W>x<H>`, `width`/`height` the page's px, `break-after: page` (none on the last).
  `html, body { margin: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact }`.
  The svg is set to `width: 100%; height: 100%; display: block`.

## The frame (`lib/print-frame.ts`)

`printInFrame(html, doc = document)`: removes any earlier frame, appends an `<iframe>` with the attribute,
`sandbox="allow-same-origin allow-modals"`, `aria-hidden`, `tabindex=-1`, styled `position: fixed; right: 0;
bottom: 0; width: 0; height: 0; border: 0; visibility: hidden` (laid out, so printable). Sets `srcdoc` to
`trustedHtml(html)`, and on `load` calls `frame.contentWindow.print()`; resolves once called. Removes the frame on
the frame window's `afterprint` or after `PRINT_FRAME_CLEANUP_MS`.

## The dialog

`'print'` follows `'pdf'` in `PAGES_FORMATS`. The panel takes the scope, the page index (shared with the other
formats' picker), the counts for its line, and `onPrint(scope)`. `ExportTabDialog.runPrint(scope)` ensures icon
catalogues, loads images per tab (`loadTabImages`, the current tab's reused from the preview), draws each sheet
with `renderTabToSvg(sheet.tab, { images, page: sheet.page, resolveTabWindow })`, calls `printInFrame`, tracks, and
closes.

## Tests

- Format visibility: Print on every page kind; PowerPoint only on a slide tab, Word only on an article tab.
- `printSheets`: current page; whole document across tabs, in tab order, skipping a Start-screen tab, the current
  tab's live pages used.
- `printDocumentHtml`: one named rule per size, each sheet its size, no break after the last, colour adjust set.
- `printInFrame`: one frame, sandboxed, `print()` called on load, a second replaces the first, removed after print.
- A CPU-time budget for a 200-page document's HTML.
