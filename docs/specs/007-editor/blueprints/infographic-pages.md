# Infographic pages blueprint

Derived from [Infographic pages](../infographic-pages.md). Implementation detail only; the spec owns
every design decision. The mode itself (the switch, the opening mode, the pages' basics) is
[Editor modes](editor-modes.md).

## Domain and naming

| Term                        | Identifier                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page                        | `InfographicPage` (`{ id, orientation, size?, background?, name? }`), `packages/document/src/infographic-page.ts`                                                                                                  |
| A page laid out             | `LaidOutPage` (`InfographicPage & { index, rect: PageRect }`)                                                                                                                                                      |
| Page size                   | `PageSizeId` (`'a4' \| 'letter' \| 'a3' \| 'square' \| 'social' \| 'wide'`), `PAGE_SIZES`, `PAGE_SIZE_IDS`                                                                                                         |
| Orientation                 | `PageOrientation`, `PAGE_ORIENTATIONS`; `pageHasOrientation(page)`                                                                                                                                                 |
| Page background             | `PageBackground` (`{ fill?: PageFill; pattern?: PagePattern }`)                                                                                                                                                    |
| Fill                        | `PageFill` (`{ kind: 'solid'; color }` \| `{ kind: 'gradient'; from; to; angle }`)                                                                                                                                 |
| Pattern                     | `PagePattern` (`'dots' \| 'grid' \| 'lines'`), `PAGE_PATTERNS`                                                                                                                                                     |
| The tab's pages             | `infographicPagesOf(tab)` (never empty), `layOutInfographicPages(pages)`                                                                                                                                           |
| A page's measures           | `pageDimensions`, `pageSizeLabel`, `pageLabel(page, index, count)`, `pageMargin`                                                                                                                                   |
| Page edit carrying content  | `withInfographicPages(tab, next)`                                                                                                                                                                                  |
| What is on a page           | `elementAnchorPoint`, `elementIdsOnPage`, `packages/document/src/infographic-page-content.ts`                                                                                                                      |
| Duplicate / replace content | `withDuplicatedPage`, `withPageContentReplaced`                                                                                                                                                                    |
| Page surface                | `pageFillTone`, `pageSurface`, `pageIsDark`, `elementPageSurfaces`                                                                                                                                                 |
| Re-inking                   | `legibleOn(color, tone)`, `withPageInkFor(tab, pageId, background)`                                                                                                                                                |
| Re-fit                      | `withContentFittedToPage(tab, ids, pageId, { centre? })`                                                                                                                                                           |
| Snap boxes                  | `infographicPageSnapBoxes(pages)` (ids `page-snap:<id>`, `page-margin:<id>`)                                                                                                                                       |
| Into pages                  | `contentClusters`, `withContentPaginated`, `packages/document/src/infographic-paginate.ts`                                                                                                                         |
| Page layout                 | `PageLayoutId`, `PageLayout`, `PAGE_LAYOUTS`, `pageLayoutById`, `packages/templates/src/page-layouts.ts`                                                                                                           |
| Layout kit                  | `kit(box)`, `Kit`, `heading`, `verticalSteps`, `LayoutBox`, `page-layout-kit.ts`                                                                                                                                   |
| Extra layouts               | `quotePage`, `teamPage`, `factsGridPage`, `checklistPage`, `eventPage`, `page-layouts-extra.ts`                                                                                                                    |
| More layouts                | `buildSectionDivider`, `buildPoster`, `buildSurveyResults`, `buildProgressReport`, `buildRoadmap`, `buildAgenda`, `buildQuestions`, `buildProfile`, `page-layouts-more.ts`                                         |
| Layout category             | `PageLayoutCategoryId` (`'covers' \| 'data' \| 'steps' \| 'people'`), `PAGE_LAYOUT_CATEGORIES`, `PageLayout.category`, `page-layouts.ts`                                                                           |
| A layout for a page         | `buildPageLayout(layout, page)`, `apps/live/lib/page-layout-build.ts`                                                                                                                                              |
| Background catalogue        | `PAGE_SOLID_PRESETS`, `PAGE_GRADIENT_PRESETS`, `themeBackgroundPresets`, `apps/live/lib/infographic-page-paint.ts`                                                                                                 |
| Sheet paint                 | `pageSheetStyle`, `pagePatternInk`, `fillCss`, `sameFill`, `gradientFill`, `withBackgroundPatch`                                                                                                                   |
| The pages view              | `InfographicPagesView`, `useInfographicPage`, `apps/live/hooks/editor/useInfographicPage.ts`                                                                                                                       |
| Page edits                  | `InfographicPageEdits`, `infographicPageEdits`, `apps/live/hooks/editor/infographic-page-edits.ts`                                                                                                                 |
| Sheets and title bars       | `InfographicPages` (`PageCog`, `LayoutInvite`, `ReorderMarker`, `AddPageButton`)                                                                                                                                   |
| Page panel                  | `InfographicPagePanel` (`PagePanelTab`, `PagePreview`, `NameField`, `PanelTabs`, `PageActions`)                                                                                                                    |
| Panel sections              | `SizeSection`, `OrientationSection`, `BackgroundSection`, `infographic-page-panel-sections.tsx`                                                                                                                    |
| Layouts section             | `LayoutsSection` (state: `category` open or null for the overview, `pending`), `infographic-page-layouts-section.tsx`; tile art `LayoutThumb`                                                                      |
| Layout hover preview        | `InfographicLayoutPreview`; `InfographicPagesView.layoutPreview`                                                                                                                                                   |
| Page clip                   | `InfographicPageClip` (`hiddenPageId`), `pagesClipPath`                                                                                                                                                            |
| Per-element surface         | `PageSurfacesProvider`, `useElementSurface(id)`, `CanvasSurfaceContext.tsx`                                                                                                                                        |
| Reorder drag                | `usePageReorderDrag`, `reorderSlot`, `PageReorder`, `apps/live/hooks/canvas/usePageReorderDrag.ts`                                                                                                                 |
| Page export                 | `pageExportFrame`, `PageExportFrame`, `EXPORT_PAPER` (`apps/live/lib/export-page.ts`); `ImageExportOpts.page`; `exportPagesAsPdf`                                                                                  |
| Export pages                | `PageScope`, `PageExportFormat`, `DEFAULT_PAGE_SCOPE`, `exportPages`, `exportPageLabel`, `zipEntryName`, `sanitizeFilename` (`apps/live/lib/export-pages.ts`); `writeZip`, `crc32` (`apps/live/lib/zip-writer.ts`) |
| Export page row             | `ExportPagePicker` (scope + page); `ImageExportPanel` `pagePicker`; `INFOGRAPHIC_FORMATS`, `INFOGRAPHIC_CARD_COPY` (`ExportTabDialog.tsx`)                                                                         |
| Import formats              | `ImportTabDialog` `formats` (`['json']` in Infographic mode, from `EditorTabDialogs`)                                                                                                                              |
| Page slide                  | `Slide.pageId`, `slideFrame(slide, tab)` (`packages/document/src/slide-deck.ts`); `newPageSlide`; `PageSlidePicker`                                                                                                |
| Slides button               | `SlidesClusterButton`; dock panel `'slides'` (`useDockPopovers`)                                                                                                                                                   |

"Page" in code and specs; "sheet" only for the drawn view of one. "Layout" is what goes onto one
page; "template" stays the whole-tab starting point.

## Constants and configuration

| Constant                        | Value                                                           | Where / provenance                                                    |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `A4_SHORT_SIDE`, `A4_LONG_SIDE` | 794, 1123                                                       | `infographic-page.ts`; A4 at 96 px per inch                           |
| `PAGE_SIZES`                    | spec "Sizes" table                                              | `infographic-page.ts`                                                 |
| `INFOGRAPHIC_PAGE_GAP`          | 96 px                                                           | Editor modes "The pages"                                              |
| `MAX_INFOGRAPHIC_PAGES`         | 20                                                              | Spec "Page actions"                                                   |
| `PAGE_NAME_MAX`                 | 60                                                              | D23                                                                   |
| `PAGE_MARGIN_FRACTION`          | 0.07                                                            | Spec "Layouts", "Snapping"                                            |
| `PAGE_GRADIENT_ANGLE`           | 160 (CSS degrees)                                               | Spec "Backgrounds"                                                    |
| `PAGE_PATTERN_PITCH`            | 24 px                                                           | Spec "Backgrounds"                                                    |
| Pattern ink                     | `rgb(15 23 42 / 0.1)` light, `rgb(255 255 255 / 0.14)` dark     | `pagePatternInk`; D24                                                 |
| `FALLBACK_ACCENT`               | `#0ea5e9`                                                       | `themeBackgroundPresets`; the brand blue                              |
| Theme tints / shades            | wash 0.93, tint 0.8, deep 0.6, glow 0.85 / 0.7, dusk 0.65 / 0.4 | spec "From the theme" (wash, tint, deep); D25 (glow, dusk)            |
| Default gradient angle on read  | 180                                                             | `parseFill`; D31                                                      |
| `PAGE_INK_FLOOR`                | 3 (contrast)                                                    | Spec "Colours of their own are re-inked"                              |
| `PAGE_INK_CONTRAST`             | 4.5 (contrast)                                                  | Spec, WCAG AA text                                                    |
| `WIDE_RATIO`                    | 1.15                                                            | `page-layout-kit.ts`; spec "Layouts" tall / wide                      |
| `TITLE_FILL`, `GLYPH_WIDTH`     | 0.72, 0.6                                                       | `page-layout-kit.ts`; D26                                             |
| Panel `WIDTH`, `GAP`            | 304 px, 6 px                                                    | `InfographicPagePanel.tsx`; D27                                       |
| `PAGE_EASE_MS`                  | 200 ms                                                          | Editor modes "Turning, adding and deleting animate"                   |
| `COG_ROOM`, `LABEL_MIN`         | 32 px, 40 px                                                    | `InfographicPages.tsx`; spec "The label fits its page" (40); D28 (32) |
| `INVITE_WIDE`, `INVITE_ICON`    | 150 px, 30 px                                                   | `InfographicPages.tsx`; D28                                           |
| `THUMB_W`                       | 76 px                                                           | `infographic-layout-thumb.tsx`; D29                                   |
| `DRAG_THRESHOLD`                | 6 px                                                            | `usePageReorderDrag.ts`; spec "Drag a page's label"                   |
| `PAGINATE_CLUSTER_GAP`          | 120 px                                                          | `infographic-paginate.ts`; spec "Into pages"                          |
| `LANDSCAPE_RATIO`               | 1.1                                                             | `infographic-paginate.ts`; spec "Into pages"                          |
| `STRAY_SHARE`                   | 0.5                                                             | `infographic-paginate.ts`; spec "Into pages"                          |
| `EXPORT_PAPER`                  | `#ffffff`                                                       | `export-page.ts`; spec "Export"                                       |
| `PT_PER_PX`                     | 0.75                                                            | `export-tab-pdf.ts`; spec "Export"                                    |
| Hover preview layer             | `z-[1]` over the element layer                                  | `InfographicLayoutPreview`; D30                                       |

## Data and persistence

- `Tab.pages?: InfographicPage[]`, in row order, stored with the tab (synced and saved as any tab
  field). Absent: one page in the legacy `pageOrientation` (Editor modes "The pages").
- **Parsing** (`parsePage`, `parseFill`, `parseBackground`, private to `infographic-page.ts`):
  - no string `id` or no valid `orientation`: the page is skipped;
  - `size` kept when a `PageSizeId` other than `'a4'` (A4 is stored as absent);
  - a fill kept when `solid` with a 3- or 6-digit hex `color`, or `gradient` with hex `from` / `to`;
    a gradient's `angle` defaults to 180 when not a finite number and is normalised to 0..359;
  - `pattern` kept when one of `PAGE_PATTERNS`; a background with neither fill nor pattern is
    dropped;
  - `name` trimmed and cut to `PAGE_NAME_MAX`; empty is dropped.
- Writes keep the same shape: `size: 'a4'`, an empty name and an empty background are deleted, not
  stored (`setSize`, `rename`, `setBackground`).
- `Slide.pageId?: string` (document presentation blob): a page slide; `isSlide` rejects an empty or
  non-string `pageId`. `elementIds` is `[]` on a page slide.
- No migration: every new field is optional and absent on old data; old pages parse unchanged.

## Behaviour and state

### The view (`useInfographicPage`)

Returns null outside a page look (`hasPageLook(mode)`), else `InfographicPagesView`:
`pages` (laid out), `focusPage(id)` (frames one page: `computeFitBelow` of
`infographicPageFitBox(page)` below the Toolbar strip), `themeBackgrounds`, `tabFont`,
`layoutPreview` / `setLayoutPreview` (state held here so the clip and the overlay share it), and
`edit` (absent for a viewer or a locked tab).

On `[on, tabLoaded, tabId]`: `paginate()` (Into pages, below) then a frame later `centre()`
(frames the first page). After `onCreated(id)` (add, duplicate) the hook frames that page once it
appears in the row (`goTo` state, consumed in a `requestAnimationFrame`).

### Edits (`infographicPageEdits`)

Every edit is one `commitTabs` call that re-reads the tab at commit time:

- `setOrientation`, `setSize`: `reshapePage`: ids = `elementIdsOnPage` before; pages patched;
  `withInfographicPages`; then `withContentFittedToPage(tab, ids, pageId)`.
- `rename(id, raw)`: trimmed, cut to `PAGE_NAME_MAX`; a no-op when unchanged.
- `setBackground(id, patch)`: `withBackgroundPatch`; when the patch carries `fill`,
  `withPageInkFor(tab, id, background)` in the same commit.
- `movePageTo(id, index)`, `movePage(id, ±1)`: reorder the list; content follows its page.
- `addPage`: the last page's size and orientation; `nextInfographicPageId(current)`; absent at
  the limit.
- `duplicatePage(id)`: `withDuplicatedPage` with `crypto.randomUUID` element ids; absent at the
  limit.
- `removePage(id)`: `withPageContentReplaced(tab, id, [])` then the page list without it; absent
  with one page.
- `applyLayout(id, layout)`: `withPageContentReplaced(tab, id, buildPageLayout(layout, page))`,
  then `onLayoutPlaced` (clears the selection).
- `contentCount(id)`: `elementIdsOnPage(elements, laidOut, id).size`.

### Re-fit (`withContentFittedToPage`)

Bounds of the given ids (boxes, free arrow ends). `s = min(1, roomW / w, roomH / h)` against the
margin box. Scaled (`s < 1`) or `centre`: the content's centre goes to the page's centre; else it
keeps its place. Then nudged so its scaled half-extents sit inside the margin box (centred when it
cannot). Boxes map position and size; text elements also multiply `textScale` by `s`; free arrow
ends map; pinned ends follow. Returns the same tab when nothing moves.

### Into pages (`withContentPaginated`)

- No elements: null.
- No `pages` stored: null when every element's bounds lie inside the first page (1 px slack);
  else paginate everything afresh.
- `pages` stored: clusters with less than `STRAY_SHARE` of their bounding box area on the pages are
  stray; none: null; all elements stray: afresh (stored pages replaced); else new pages after the
  stored ones.
- `contentClusters`: union-find over pinned arrow ends and pairs of bounds within the gap (edge to
  edge, O(n²)); reading order by rows (`top < row's first bottom`) then x.
- `paginate`: room = `MAX_INFOGRAPHIC_PAGES - kept.length` (at least 1); clusters past the room
  merge into the last; each cluster a page (`nextInfographicPageId`), landscape when wider than
  `LANDSCAPE_RATIO` x its height; each fitted with `{ centre: true }`.
- Run only by an editor on an unlocked tab; one `commitTabs`; a toast, `PagesLaidOut`.

### Surfaces and ink

- `elementPageSurfaces(elements, pages)`: an element's page by its anchor point; only pages with a
  fill are entered. `InfographicPageClip` wraps the element views in `PageSurfacesProvider`, whose
  value keeps its identity while the entries do (keyed on `id:surface` pairs).
- `useElementSurface(id)`: the page's surface, else the canvas's; used by `BoxedElementView`,
  `TableView`, `useBoxedElementAnimation`, `ArrowView`.
- `withPageInkFor`: for elements on the page: text elements' `textColor`, arrows' and icons'
  `strokeColor`, each through `legibleOn` against `pageFillTone(fill)` (white for paper). Shapes
  with their own fill are untouched. `legibleOn` keeps a colour at or over `PAGE_INK_FLOOR`; else
  tints (dark tone) or shades (light tone) in steps of 0.1 from 0.2 until `PAGE_INK_CONTRAST`,
  falling back to `#ffffff` / `#0f172a`.

### Panel, previews, reorder

- Panel opened from a cog (tab Page) or the invite (tab Layouts); `opened = { id, cog, tab }` in
  `InfographicPages`. Desktop: fixed, beside the cog when it fits (`a.right + GAP + WIDTH + EDGE
<= innerWidth`), else right-aligned under it; re-placed on resize and `PAGE_EASE_MS + 20` after
  the page's rect changes. Mobile (`useIsMobileViewport`): `BottomSheet`.
- Closes: outside pointerdown (`useClickOutside`, the trigger whitelisted by
  `[data-page-panel-trigger]`), Escape (capture; restores focus to the cog), a wheel outside it.
- Background preview: `PagePreview` state in `InfographicPages`; the sheet paints
  `withBackgroundPatch(page, preview.patch)`; cleared on leave, on commit and on unmount.
- Layout preview: `view.layoutPreview` set on tile pointerenter / focus; the clip drops that page
  (`hiddenPageId`); `InfographicLayoutPreview` draws `svgBoxed` / `svgArrow` markup of
  `buildPageLayout` over the sheet. While Replace is pending, leaving the grid restores the
  pending layout's preview. Cleared on apply and on unmount (through a latest-callback ref).
- Reorder: `usePageReorderDrag` on the label: pointer capture; past `DRAG_THRESHOLD` sideways it is
  a drag (`reorder = { pageId, slot }`); release calls `movePageTo(id, slot)`; the following click
  is swallowed (`endsDrag`); Escape cancels. `reorderSlot` = count of other pages whose centre is
  left of the dragged page's centre (rect centre + screen dx / zoom).
- Bare sheets: `InfographicPages` `bare` (zen, presenting) drops `edit` and labels.

### Snapping

`useEditorDrag` passes `pageSnapBoxes` (`infographicPageSnapBoxes(view.pages)`, from
`useEditorState`) to `resolveBoxedMove` / `resolveBoxedResize`, which add them to the alignment
targets (`snapToAlignment`, `snapResizeBounds`, `alignmentGuides`) but not to `distributionSnap`.

### Export

`ImageExportOpts.page` makes `renderTabToCanvas` / `renderTabToSvg` use `pageExportFrame(page)`:
bounds = the page rect, no padding, no isometric, no tab backdrop or pattern; background =
`backgroundSvg` (rect fill or `<linearGradient>` along the CSS gradient line, then a `<pattern>`
anchored at the page's corner); surface = `pageSurface(page) ?? 'light'`; elements filtered to
those whose bounds meet the page (arrows kept). The canvas rasterises `backgroundSvg` first.
`exportPagesAsPdf` renders each page and writes one PDF page per image with a MediaBox of the page
size x `PT_PER_PX`. The dialog's `pages` prop (Infographic mode, tab scope) selects the page row.

The dialog offers `INFOGRAPHIC_FORMATS` (pdf, png, svg, file) with `INFOGRAPHIC_CARD_COPY` for
the page formats. Each image format holds its own `PageScope` (state `scopes`, unset =
`DEFAULT_PAGE_SCOPE`: pdf `all`, png and svg `one`). `exportPages({ tab, pages, page, scope,
format, opts })`:

- pdf: `exportPagesAsPdf(tab, scope === 'all' ? pages : [page], opts)`.
- png / svg, one: `exportTabAsPng` / `exportTabAsSvg` with `{ ...opts, page }`.
- png / svg, all: each page rendered in turn, then `writeZip` (stored, no compression, UTF-8
  names, DOS date and time of now) of `zipEntryName(page, count, ext)` =
  `NN <sanitizeFilename(exportPageLabel(page, count))>.<ext>`; returns `ext: 'zip'`.

The download is `<baseName>.<ext>`, with ` - <page label>` for one page. `ExportPagePicker`
renders the **All pages** / **One page** `SegmentSlider` group, the page `Select` (more than one
page; "Page to export", or "Page to preview" with `Preview: ` options under All pages) and the
outcome line.

The Import dialog takes `formats`; in Infographic mode `EditorTabDialogs` passes `['json']`.

### Slides

`resolveSlide` of a page slide: the tab's elements on that page (`elementIdsOnPage`).
`slideFrame(slide, tab)`: the page rect, else `slideBounds(resolveSlide(...))`. Presenting a page
slide sets `presentingPageId`; `EditorCanvasHost` passes the view with only that page.
`newPageSlide(pageId)` appends `{ id, tabId: activeTabId, elementIds: [], pageId }`. Thumbnails
prepend the page's `backgroundSvg`.

## Interfaces and contracts

- `InfographicPageEdits`: `setOrientation(id, o)`, `setSize(id, size)`, `rename(id, name)`,
  `setBackground(id, Partial<PageBackground>)` (`{ fill: undefined }` = paper), `movePage(id, -1 |
1)`, `movePageTo(id, index)`, `addPage?()`, `duplicatePage?(id)`, `removePage?(id)`,
  `applyLayout(id, PageLayoutId)`, `contentCount(id)`. An unknown page id commits nothing.
- `PageLayout.build(box: LayoutBox): Element[]`: pure; every element inside the box (1 px slack);
  arrows only between the layout's own elements; fresh ids each call.
- `withContentPaginated(tab)`: the tab with `pages`, or null (nothing to do).
- `slideFrame(slide, tab)`: a rect or null (nothing to frame).
- `pageExportFrame(page, paper?)`: never throws; the paint is decorative and a rasterise failure
  leaves the paper.

## Errors and edge cases

| Case                                   | Handling                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| Malformed stored page / field          | Skipped / dropped by `parsePage` (Data and persistence)    |
| Edit to a page removed meanwhile       | The commit's `find` misses; the tab is unchanged           |
| Duplicate or add at the limit          | The control is absent / disabled; the commit also refuses  |
| Two quick edits                        | Each re-reads the tab at commit time                       |
| Duplicated arrow pinned off the page   | Not copied                                                 |
| Re-fit of content larger than the room | Scaled down, never up                                      |
| Lone page under a layout preview       | `pagesClipPath([])` returns a clip that hides everything   |
| Page slide whose page is gone          | Resolves to no elements, frames to null; shown, fixable    |
| Pagination past 20 clusters            | The rest share the last page                               |
| Gradient rasterise failure in export   | Caught; the paper stays                                    |
| A page fails to render in a .zip       | The export rejects; the dialog's existing error path shows |
| A page label with path characters      | `sanitizeFilename` replaces them in zip and download names |
| One page in the tab                    | No page `Select`; All and One give the same page           |
| Name field closed without blur         | Committed on unmount                                       |
| Stale dev bundle                       | Not a code path; restart the dev server (wipe `.next-dev`) |

## Security and trust

No server path is added: pages and page slides are tab and presentation data, written by the
existing tab sync and validated on read (`parsePage`, `isSlide`). Colours are validated hex before
they reach CSS or SVG; SVG markup escapes every colour (`xmlEscape`). The layout preview injects
only the renderer's own markup, whose labels are escaped.

## Performance and limits

- At most 20 pages; per-render layout is O(pages).
- `elementPageSurfaces` and `infographicPageSnapBoxes` run per render: O(elements x pages) and
  O(pages); the provider's value is stable while the entries are, so element views do not
  re-render during a drag that keeps elements on their pages.
- `contentClusters` is O(n²) in elements, run once per mode entry.
- Layout thumbnails build once per page shape (`useMemo` on the rect); the overview draws two per category (8), a category at most six.
- PDF export renders each page at scale 2; memory is one canvas at a time.
- An all-pages .zip holds every page's bytes at once (20 pages max) and is stored uncompressed
  (PNG and SVG gain little from deflate); `crc32` is a 256-entry table, O(bytes).

## Presentation and UX

Copy and layout as the spec: the panel's tabs **Page** / **Layouts**, sections **Size**,
**Orientation**, **Background**, **Pattern**, **Start from a layout**; the confirm **Replace this
page's content?**, "The n elements on it make way for <layout>. Undo brings them back.",
**Cancel** / **Replace**; actions **Duplicate page**, **Move page left**, **Move page right**,
**Delete page**; the invite **Start from a layout**; the export row **All pages** / **One page** with the outcome line ("n pages, one PDF.", "A .zip of n PNG files, one per page.", "A one-page PDF.", "One PNG."), the subtitle "Pick a format to export the pages."; the slide picker
**Add as slide**; the toasts "Laid out into n pages. Undo puts it back." / "Laid out onto a page.
Undo puts it back."

## Accessibility

- The cog: `aria-haspopup="dialog"`, `aria-expanded`, named `<page> settings`; the panel
  `role="dialog"` named `<page> settings`; Escape restores focus to the cog.
- Tabs `role="tablist"` / `role="tab"` with `aria-selected`; size, orientation, swatches and
  patterns are `role="radiogroup"` / `role="radio"` with `aria-checked` and names; previews follow
  focus as well as hover.
- The page label is a button named by its text (a HoverCard describes the press); the invite and
  Slides buttons are named; Tooltips repeat names only.
- Reduced motion: the sheets' ease and the swatch hover scale are off
  (`motion-reduce:transition-none`, `motion-reduce:hover:scale-100`), the preview's fade off.

## Web Experience

No new route or loaded asset; the panel, preview and picker mount on demand. Layout thumbnails
and the preview are inline SVG (no network). No layout shift: the title bar is absolutely
positioned over the canvas.

## Observability

- `debugLog` fingerprints: `[infographic-page] orientation set`, `size set`, `renamed`,
  `background set`, `moved`, `page added`, `duplicated`, `page removed`, `layout placed`,
  `framed`, `content laid out into pages`.
- Telemetry as the spec's Telemetry section, charted in `apps/telemetry/app/catalogue/features.ts`
  (`PAGE_ORIENTATION`, `INFOGRAPHIC_PAGES`, `INFOGRAPHIC_PAGE_SETUP`,
  `INFOGRAPHIC_PAGE_BUILDING`) and `collaboration.ts` (`SLIDES_ADDED`, `SLIDE_DECK_OPENED`), with
  explanations in `event-explanations.ts`.

## Testing

| Spec rule                                                           | Test                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| A page's fields, parsing, sizes, labels, mixed row                  | `packages/document/src/infographic-page-model.test.ts`          |
| Content on a page, duplicate, replace                               | `infographic-page-model.test.ts` "page content"                 |
| Dark pages, per-element surface, re-inking                          | `infographic-page-model.test.ts` "page backgrounds", "page ink" |
| Into pages: clusters, reading order, stray, limits                  | `packages/document/src/infographic-paginate.test.ts`            |
| Page slides resolve and frame                                       | `packages/document/src/slide-deck.test.ts` "page slides"        |
| Edits: rename, size, move, delete, duplicate, paint, layout, re-fit | `apps/live/hooks/editor/infographic-page-edits.test.ts`         |
| Every layout fits every size and orientation; each in a category    | `apps/live/lib/page-layouts.test.ts`                            |
| Sheet paint, presets, theme backgrounds                             | `apps/live/lib/infographic-page-paint.test.ts`                  |
| Snapping to page edges, centre lines, margins                       | `apps/live/hooks/canvas/boxed-drag-resolve.test.ts`             |
| Reorder slot                                                        | `apps/live/hooks/canvas/usePageReorderDrag.test.ts`             |
| The clip, and a clip with no page                                   | `apps/live/components/canvas/InfographicPageClip.test.ts`       |
| Export defaults, zip entry names, filename sanitising               | `apps/live/lib/export-pages.test.ts`                            |
| Zip writer: CRC, round trip                                         | `apps/live/lib/zip-writer.test.ts`                              |
| Import offers JSON only in Infographic mode                         | `apps/live/components/dialogs/ImportTabDialog.test.tsx`         |

Not covered by a unit test (browser-checked): panel placement, hover previews, the bottom sheet,
the Slides popover, PDF bytes.
