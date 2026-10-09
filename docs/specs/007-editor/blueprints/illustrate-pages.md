# Illustrate pages blueprint

Derived from [Illustrate pages](../illustrate-pages.md). Implementation detail only; the spec owns
every design decision. The mode itself (the switch, the opening mode, the pages' basics) is
[Editor modes](editor-modes.md); an article page's writing is [Article pages](article-pages.md).

## Domain and naming

| Term                        | Identifier                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page                        | `IllustratePage` (`{ id, orientation, size?, fit?, rowAt?, background?, name?, kind?, flow? }`), `packages/document/src/illustrate-page.ts`                                                                                                                                                |
| Fit to Content sides        | `PageSides` (`{ width, height }`), `parsePageSides`, `clampPageSide`, `FIT_PAGE_MIN_SIDE`, `FIT_PAGE_MAX_SIDE`, `packages/document/src/illustrate-page-fit.ts`                                                                                                                             |
| Row anchor                  | `RowAt` (`{ x, y }`), `parseRowAt` (`illustrate-page-fit.ts`); `rowAnchorOf(pages)`, `withOneRowAnchor` and `withRowAnchorKept` (private), `illustrate-page.ts`                                                                                                                            |
| Page kind                   | `PageKind` (`'infographic' \| 'article' \| 'slide'`); `pageKindOf(page)` (absent reads infographic), `isArticlePage(page)`, `newSlidePage(id, size?)`                                                                                                                                      |
| The first page's choice     | `offersPageKindChoice(pages, pageId, contentCount)`, `withPageKindChosen(tab, pageId, kind, flow)`, `packages/document/src/article-pages.ts`                                                                                                                                               |
| Units of the row            | `PageUnit` (`{ pageIds, flow? }`), `pageUnits`, `withUnitMoved` (`article-pages.ts`); `laidOutUnits` (`usePageReorderDrag.ts`)                                                                                                                                                             |
| A flow's pages together     | `withArticlesTogether(pages)`, private to `illustrate-page.ts`, run by `illustratePagesOf`                                                                                                                                                                                                 |
| A page laid out             | `LaidOutPage` (`IllustratePage & { index, rect: PageRect }`)                                                                                                                                                                                                                               |
| Page size                   | `PageSizeId` (`'a4' \| 'letter' \| 'a3' \| 'square' \| 'social' \| 'wide' \| 'slide' \| 'slide-classic' \| 'logo' \| 'fit'`), `PAGE_SIZES` (`landscapeOnly` on the slide sizes, `fitOnly` on `fit`), `PAGE_SIZE_IDS`, `SLIDE_PAGE_SIZE_IDS`, `pageSizesFor(kind)`, `pageSizeChoices(page)` |
| Orientation                 | `PageOrientation`, `PAGE_ORIENTATIONS`; `pageHasOrientation(page)`                                                                                                                                                                                                                         |
| Page background             | `PageBackground` (`{ fill?: PageFill; pattern?: PagePattern }`)                                                                                                                                                                                                                            |
| Fill                        | `PageFill` (`{ kind: 'solid'; color }` \| `{ kind: 'gradient'; from; to; angle }`)                                                                                                                                                                                                         |
| Pattern                     | `PagePattern` (`'dots' \| 'grid' \| 'lines'`), `PAGE_PATTERNS`                                                                                                                                                                                                                             |
| The tab's pages             | `illustratePagesOf(tab)` (never empty), `layOutIllustratePages(pages)`                                                                                                                                                                                                                     |
| A page's measures           | `pageDimensions`, `pageSizeLabel`, `pageLabel(page, index, count)`, `pageMargin`                                                                                                                                                                                                           |
| Page edit carrying content  | `withIllustratePages(tab, next)`                                                                                                                                                                                                                                                           |
| What is on a page           | `elementAnchorPoint`, `elementIdsOnPage`, `packages/document/src/illustrate-page-content.ts`                                                                                                                                                                                               |
| Duplicate / replace content | `withDuplicatedPage`, `withPageContentReplaced`                                                                                                                                                                                                                                            |
| Page surface                | `pageFillTone`, `pageSurface`, `pageIsDark`, `elementPageSurfaces`                                                                                                                                                                                                                         |
| Re-inking                   | `legibleOn(color, tone)`, `withPageInkFor(tab, pageId, background)`                                                                                                                                                                                                                        |
| Re-fit                      | `withContentFittedToPage(tab, ids, pageId, { centre?, keepSize? })`                                                                                                                                                                                                                        |
| Snap boxes                  | `illustratePageSnapBoxes(pages)` (ids `page-snap:<id>`, `page-margin:<id>`)                                                                                                                                                                                                                |
| Into pages                  | `contentClusters`, `pageAround(box, id)`, `withContentOnAPage(tab)`, `withPageSplit(tab, pageId)`, `packages/document/src/illustrate-paginate.ts`; `IllustratePageEdits.splitPage`; `SplitPagesIcon` (`packages/ui/src/icons/actions.tsx`)                                                 |
| Page layout                 | `PageLayoutId`, `PageLayout`, `PAGE_LAYOUTS` (`page-layouts.ts`); `SlideLayoutId`, `SLIDE_LAYOUTS`, `SLIDE_LAYOUT_CATEGORIES` (`slide-layouts.ts`); `layoutCatalogueFor(kind)`, `pageLayoutById` (`layout-catalogue.ts`), all `packages/templates/src/`                                    |
| Layout kit                  | `kit(box)`, `Kit`, `heading`, `verticalSteps`, `LayoutBox`, `page-layout-kit.ts`                                                                                                                                                                                                           |
| Extra layouts               | `quotePage`, `teamPage`, `factsGridPage`, `checklistPage`, `eventPage`, `page-layouts-extra.ts`                                                                                                                                                                                            |
| More layouts                | `buildSectionDivider`, `buildPoster`, `buildSurveyResults`, `buildProgressReport`, `buildRoadmap`, `buildAgenda`, `buildQuestions`, `buildProfile`, `page-layouts-more.ts`                                                                                                                 |
| Layout category             | `PageLayoutCategoryId` (`'covers' \| 'data' \| 'steps' \| 'people'`), `PAGE_LAYOUT_CATEGORIES`, `PageLayout.category`, `page-layouts.ts`                                                                                                                                                   |
| A layout for a page         | `buildPageLayout(layout, page)`, `apps/live/lib/page-layout-build.ts`                                                                                                                                                                                                                      |
| Background catalogue        | `PAGE_COLOUR_GROUPS` (`page-background-custom.tsx`), `PAGE_GRADIENT_PRESETS`, `themeBackgroundPresets`, `backgroundCategoryOf`, `isCustomGradient`, `customGradientSeed`, `apps/live/lib/illustrate-page-paint.ts`                                                                         |
| Sheet paint                 | `pageSheetStyle`, `pagePatternInk`, `fillCss`, `sameFill`, `gradientFill`, `withBackgroundPatch`                                                                                                                                                                                           |
| The pages view              | `IllustratePagesView`, `useIllustratePages`, `apps/live/hooks/editor/useIllustratePages.ts`                                                                                                                                                                                                |
| Page edits                  | `IllustratePageEdits`, `illustratePageEdits`, `apps/live/hooks/editor/illustrate-page-edits.ts`                                                                                                                                                                                            |
| Sheets and title bars       | `IllustratePages` (`PageCog`, `LayoutInvite`, `ReorderMarker`, `AddPageButton`), `apps/live/components/canvas/IllustratePages.tsx`                                                                                                                                                         |
| Add a page                  | `AddPagePopover` (`AddPagePopover.tsx`); `PAGE_KINDS`, `PageKindChoice`, `PageKindCard` (`page-kind-cards.tsx`)                                                                                                                                                                            |
| The strip's +               | `AddPageStripButton` (`components/palette/AddPageStripButton.tsx`), `ToolbarPalette` `onAddPage`                                                                                                                                                                                           |
| First page's choice card    | `FirstPageChoice` (`components/canvas/FirstPageChoice.tsx`)                                                                                                                                                                                                                                |
| Page navigator              | `PageNavigator` (`components/canvas/PageNavigator.tsx`)                                                                                                                                                                                                                                    |
| Page panel                  | `IllustratePagePanel` (`PagePanelTab` `'page' \| 'layouts' \| 'style' \| 'text'`, `PagePreview`, `NameField`, `PanelTabs`, `PageActions`)                                                                                                                                                  |
| Background hover preview    | `setPageBackgroundPreview`, `usePageBackgroundPreview`, `previewedBackground`, `withPreviewedBackgrounds`, `apps/live/lib/page-background-preview.ts`                                                                                                                                      |
| Theme accent                | `themeAccent(theme)`, `illustrate-page-paint.ts`; `IllustratePagesView.themeAccent`                                                                                                                                                                                                        |
| Panel sections              | `SizeSection`, `OrientationSection` (`illustrate-page-panel-sections.tsx`), `BackgroundSection` (`page-background-section.tsx`)                                                                                                                                                            |
| Layouts section             | `LayoutsSection` (state: `category` open or null for the overview, `pending`), `infographic-page-layouts-section.tsx`; tile art `LayoutThumb`                                                                                                                                              |
| Layout hover preview        | `InfographicLayoutPreview`; `IllustratePagesView.layoutPreview`                                                                                                                                                                                                                            |
| Page clip                   | `IllustratePageClip` (`hiddenPageId`), `pagesClipPath`                                                                                                                                                                                                                                     |
| Per-element surface         | `PageSurfacesProvider`, `useElementSurface(id)`, `CanvasSurfaceContext.tsx`                                                                                                                                                                                                                |
| Reorder drag                | `usePageReorderDrag`, `reorderSlot`, `PageReorder` (`{ pageId, pageIds, slot }`), `apps/live/hooks/canvas/usePageReorderDrag.ts`                                                                                                                                                           |
| Something in view           | `useOffscreenContent(elements, offset, zoom, mainRef, pages)`, `apps/live/hooks/canvas/useOffscreenContent.ts`                                                                                                                                                                             |
| Page export                 | `pageExportFrame`, `PageExportFrame`, `EXPORT_PAPER` (`apps/live/lib/export-page.ts`); `ImageExportOpts.page`; `exportPagesAsPdf`                                                                                                                                                          |
| Export pages                | `PageScope`, `PageExportFormat`, `DEFAULT_PAGE_SCOPE`, `exportPages`, `exportPageLabel`, `zipEntryName`, `sanitizeFilename` (`apps/live/lib/export-pages.ts`); `writeZip`, `crc32` (`apps/live/lib/zip-writer.ts`)                                                                         |
| Export page row             | `ExportPagePicker` (scope + page); `ImageExportPanel` `pagePicker`; `ILLUSTRATE_FORMATS`, `ILLUSTRATE_CARD_COPY` (`ExportTabDialog.tsx`)                                                                                                                                                   |
| Import formats              | `ImportTabDialog` `formats` (`['json']` in Illustrate mode, from `EditorTabDialogs`)                                                                                                                                                                                                       |
| Page slide                  | `Slide.pageId`, `slideFrame(slide, tab)` (`packages/document/src/slide-deck.ts`); `newPageSlide`; `PageSlidePicker`                                                                                                                                                                        |
| Slides button               | `SlidesClusterButton`; dock panel `'slides'` (`useDockPopovers`)                                                                                                                                                                                                                           |

"Page" in code and specs; "sheet" only for the drawn view of one. "Layout" is what goes onto one
page; "template" stays the whole-tab starting point.

## Constants and configuration

| Constant                        | Value                                                           | Where / provenance                                                   |
| ------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `A4_SHORT_SIDE`, `A4_LONG_SIDE` | 794, 1123                                                       | `illustrate-page.ts`; A4 at 96 px per inch                           |
| `PAGE_SIZES`                    | spec "Sizes" table                                              | `illustrate-page.ts`                                                 |
| `ILLUSTRATE_PAGE_GAP`           | 96 px                                                           | Editor modes "The pages"                                             |
| `MAX_ILLUSTRATE_PAGES`          | 100                                                             | Spec "Page actions"                                                  |
| `PAGINATE_MAX_PAGES`            | 20 pages per Split Into Pages                                   | `illustrate-paginate.ts`; spec "Into pages"                          |
| `FIT_PAGE_MIN_SIDE`             | 200 px                                                          | `illustrate-page-fit.ts`; spec "Sizes"                               |
| `FIT_PAGE_MAX_SIDE`             | 19200 px (14400 pt, a PDF's largest page, at 0.75 pt per px)    | `illustrate-page-fit.ts`; spec "Sizes"                               |
| Add a page popover              | 332 px wide, 10 px from the +                                   | `AddPagePopover` `WIDTH`, `GAP`; D55                                 |
| First page's choice card        | 340 px wide                                                     | `FirstPageChoice`; D56                                               |
| Page navigator                  | 12 screen px under the page                                     | `PageNavigator`; D57                                                 |
| `PAGE_NAME_MAX`                 | 60                                                              | D23                                                                  |
| `PAGE_MARGIN_FRACTION`          | 0.07                                                            | Spec "Layouts", "Snapping"                                           |
| `PAGE_GRADIENT_ANGLE`           | 160 (CSS degrees)                                               | Spec "Backgrounds"                                                   |
| `PAGE_PATTERN_PITCH`            | 24 px                                                           | Spec "Backgrounds"                                                   |
| Pattern ink                     | `rgb(15 23 42 / 0.1)` light, `rgb(255 255 255 / 0.14)` dark     | `pagePatternInk`; D24                                                |
| `FALLBACK_ACCENT`               | `#0ea5e9`                                                       | `themeBackgroundPresets`; the brand blue                             |
| Theme tints / shades            | wash 0.93, tint 0.8, deep 0.6, glow 0.85 / 0.7, dusk 0.65 / 0.4 | spec "From the theme" (wash, tint, deep); D25 (glow, dusk)           |
| Default gradient angle on read  | 180                                                             | `parseFill`; D31                                                     |
| `PAGE_INK_FLOOR`                | 3 (contrast)                                                    | Spec "Colours of their own are re-inked"                             |
| `PAGE_INK_CONTRAST`             | 4.5 (contrast)                                                  | Spec, WCAG AA text                                                   |
| `WIDE_RATIO`                    | 1.15                                                            | `page-layout-kit.ts`; spec "Layouts" tall / wide                     |
| `TITLE_FILL`, `GLYPH_WIDTH`     | 0.72, 0.6                                                       | `page-layout-kit.ts`; D26                                            |
| Panel `WIDTH`, `GAP`            | 304 px, 6 px                                                    | `IllustratePagePanel.tsx`; D27                                       |
| `PAGE_EASE_MS`                  | 200 ms                                                          | Editor modes "Turning, adding and deleting animate"                  |
| `COG_ROOM`, `LABEL_MIN`         | 32 px, 40 px                                                    | `IllustratePages.tsx`; spec "The label fits its page" (40); D28 (32) |
| `INVITE_WIDE`, `INVITE_ICON`    | 150 px, 30 px                                                   | `IllustratePages.tsx`; D28                                           |
| `THUMB_W`                       | 76 px                                                           | `infographic-layout-thumb.tsx`; D29                                  |
| `DRAG_THRESHOLD`                | 6 px                                                            | `usePageReorderDrag.ts`; spec "Drag a page's label"                  |
| `PAGINATE_CLUSTER_GAP`          | 120 px                                                          | `illustrate-paginate.ts`; spec "Into pages"                          |
| `LANDSCAPE_RATIO`               | 1.1                                                             | `illustrate-paginate.ts`; spec "Into pages"                          |
| `EXPORT_PAPER`                  | `#ffffff`                                                       | `export-page.ts`; spec "Export"                                      |
| `PT_PER_PX`                     | 0.75                                                            | `export-tab-pdf.ts`; spec "Export"                                   |
| Hover preview layer             | `z-[1]` over the element layer                                  | `InfographicLayoutPreview`; D30                                      |

## Data and persistence

- `Tab.pages?: IllustratePage[]`, in row order, stored with the tab (synced and saved as any tab
  field). Absent: one page in the legacy `pageOrientation` (Editor modes "The pages"), its kind
  unchosen. An article page's writing is `Tab.articles` ([Article pages](article-pages.md)).
- **Parsing** (`parsePage`, `parseFill`, `parseBackground`, private to `illustrate-page.ts`):
  - no string `id` or no valid `orientation`: the page is skipped;
  - `size` kept when a `PageSizeId` other than `'a4'` (A4 is stored as absent); `'fit'` only on a
    non-article page with valid `fit` sides (`parsePageSides`: both finite and positive, rounded,
    clamped to `FIT_PAGE_MIN_SIDE`..`FIT_PAGE_MAX_SIDE`), else read as A4 with no `fit`;
  - `rowAt` kept when both `x` and `y` are finite (rounded); `withOneRowAnchor` keeps it on the
    first page carrying it and drops it from any other;
  - a fill kept when `solid` with a 3- or 6-digit hex `color`, or `gradient` with hex `from` / `to`;
    a gradient's `angle` defaults to 180 when not a finite number and is normalised to 0..359;
  - `pattern` kept when one of `PAGE_PATTERNS`; a background with neither fill nor pattern is
    dropped;
  - `name` trimmed and cut to `PAGE_NAME_MAX`; empty is dropped;
  - `kind: 'article'` kept with `flow` (a string of 1 to 64 characters, else the page's own id);
    `kind: 'infographic'` kept without a flow; anything else: no kind (unchosen);
  - a repeat of an id already read is skipped; at most `MAX_ILLUSTRATE_PAGES` are read;
  - then `withArticlesTogether`: each flow's pages join its first page's run, in stored order,
    each taking the first's `orientation`, `size` and `background`; the same array back when
    nothing moved.
- Writes keep the same shape: `size: 'a4'`, an empty name and an empty background are deleted, not
  stored (`setSize`, `rename`, `setBackground`); a size set away from `'fit'` deletes `fit`.
- Layout: `layOutIllustratePages` centres the first page on `rowAnchorOf(pages)` (the origin when
  no page carries `rowAt`); `pageDimensions` reads `fit` for a `'fit'` page.
  `withIllustratePages(tab, next)` hands the current anchor to `next[0]` when no page of `next`
  carries one (`withRowAnchorKept`), so deleting the carrier keeps the row in place.
- `Slide.pageId?: string` (document presentation blob): a page slide; `isSlide` rejects an empty or
  non-string `pageId`. `elementIds` is `[]` on a page slide.
- `kind: 'infographic'` is written explicitly once chosen (the first page's choice, a template's
  pages, Turn Into Pages), so an unchosen page is told from a chosen one.
- No migration: every new field is optional and absent on old data; old pages parse unchanged (as
  unchosen infographic pages, their row on the origin).

## Behaviour and state

### The view (`useIllustratePages`)

Returns null outside a page look (`hasPageLook(mode)`), else `IllustratePagesView`:
`pages` (laid out), `rowPages?` (the whole row while a page slide presents, `presentedPages`),
`focusPage(id)` (frames one page whatever its kind: `computeFitBelow` of
`illustratePageFitBox(page)` below the Toolbar strip), `readPage(id)` (an article page on a phone:
`computeReadingFrame` with its margin, gliding there), `panFrom?` (a finger's pan from the view
now; stops a glide), `themeBackgrounds`, `themeAccent`, `articles?` (composed
in by `useEditorState`), `tabFont`, `layoutPreview` / `setLayoutPreview` (state held here so the
clip and the overlay share it), and `edit` (absent for a viewer or a locked tab).

On `[on, tabLoaded, tabId]` (and `canEdit`): `putOnAPage()` (Into pages, below) then a frame later `centre()`
(frames the first page). After `onCreated(id)` (add, duplicate) the hook frames that page once it
appears in the row (`goTo` state, consumed in a `requestAnimationFrame`); `onArticleCreated(flow)`
(a new article, the first page chosen as an article) hands the flow on so its title takes the
caret.

### Edits (`illustratePageEdits`)

Every edit is one `commitTabs` call that re-reads the tab at commit time (refused by `mayEdit()`
or a locked tab). `sharing(pages, id)` is the page, or every page of its flow: a page-wide change
reaches them all.

- `setOrientation`, `setSize`: `claimArticleLayout(id)` (an article's re-flow is this person's to
  settle: `articleHandleOf(flow).claimLayout()`), then `reshapePage`: every page in `sharing`
  patched; an article page: `withIllustratePages` only (its writing reflows, zones follow); an
  infographic page: ids = `elementIdsOnPage` before, `withIllustratePages`, then
  `withContentFittedToPage(tab, ids, pageId)`.
- `rename(id, raw)`: trimmed, cut to `PAGE_NAME_MAX`; a no-op when unchanged; that page only.
- `setBackground(id, patch)`: a no-op when it changes nothing (`sameFill`, same pattern); else
  `withBackgroundPatch` on every page in `sharing`; when the patch carries `fill`,
  `withPageInkFor(tab, id, background)` for each, in the same commit. `previewInk(preview)` shows
  the re-ink as a local drag preview (`setLocalPreview`), cleared with the preview.
- `movePageTo(id, unitIndex)`, `movePage(id, ±1)`, `canMove(id, ±1)`: over units (`pageUnits`: a
  page, or a whole article), `withUnitMoved`; content follows its page.
- `addPage(kind)` (absent at the limit): `'infographic'` takes the last infographic page's size and
  orientation (else A4 portrait; a `'fit'` model gives no `size`, A4), `nextIllustratePageId(current)`; `'article'` uses
  `withArticleAdded` with the last page's size and orientation when it is a paper size (A4, US
  Letter, A3), else A4 portrait, and a `nextArticleFlowId`; then `onCreated(id)` (and
  `onArticleCreated(flow)`).
- `choosePageKind(id, kind)`: `withPageKindChosen` (null once the page no longer offers the
  choice); an article hands its flow to `onArticleCreated`.
- `duplicatePage(id)` (absent at the limit): an infographic page `withDuplicatedPage` with
  `crypto.randomUUID` element ids; an article page `withArticleDuplicated(t, flow, newFlow)`
  (null, so no edit, when the copy would pass the limit), framing the copy's first page.
- `removePage(id)` (absent with one unit): an infographic page `withPageContentReplaced(tab, id,
[])` then the page list without it; an article page `withArticleRemoved(t, flow)`.
- `applyLayout(id, layout)`: `withPageContentReplaced(tab, id, buildPageLayout(layout, page))`,
  then `onLayoutPlaced` (clears the selection).
- `contentCount(id)`: `elementIdsOnPage(elements, laidOut, id).size`.

### Re-fit (`withContentFittedToPage`)

Bounds of the given ids (boxes, free arrow ends). `s = min(1, roomW / w, roomH / h)` against the
margin box. Scaled (`s < 1`) or `centre`: the content's centre goes to the page's centre; else it
keeps its place. Then nudged so its scaled half-extents sit inside the margin box (centred when it
cannot). Boxes map position and size; text elements also multiply `textScale` by `s`; free arrow
ends map; pinned ends follow. Returns the same tab when nothing moves.

### Into pages (`withContentOnAPage`, `withPageSplit`)

- `pageAround(box, id)`: an infographic page (`kind: 'infographic'`), landscape when wider than
  `LANDSCAPE_RATIO` x its height; A4 (no `size`) when the box fits A4's margin box that way round;
  else `size: 'fit'` with `fit` = the box plus `m` all round, where `m` starts at
  `ceil(min side x 0.07)` and grows to the page's own `pageMargin` until it holds (or a side reaches
  `FIT_PAGE_MAX_SIDE`, where the content runs off, unscaled). Never sets `rowAt`.
- `withContentOnAPage(tab)` (entering the mode): no elements: null. The content box is the union of
  every element's bounds (an arrow by its resolved ends).
  - No `pages` stored: null when the box lies inside the first page (1 px slack); else one page
    `pageAround(box)` with `rowAt` the box's centre (rounded). Elements are returned as they are
    (same array); `pageOrientation` dropped.
  - `pages` stored: null when any page has been made something of (a `flow`, `locked`, a `kind`
    other than `'infographic'`, a `name` or a `background`), or any element's anchor point
    (`elementAnchorPoint` over `elementIndexFor`, linear) is on a page; else the stored pages are
    replaced by that one page.
  - Run inside an editor's switch (`withEditorModeSwitched`, [Editor modes blueprint](editor-modes.md)
    "The tab's mode"), in the same commit, with the toast "Put onto a page that fits it. Undo
    switches back to <from>."; and by `useIllustratePages` `putOnAPage` for a tab already in
    Illustrate when an editor opens it (unlocked; a no-op after a switch, the page being stored),
    one `commitTabs`, toast "Put onto a page that fits it. Undo takes the page away.";
    `track('Tab', 'Changed', 'PageFitToContent')`; log `[illustrate-page] content put onto a page`.
- `withPageSplit(tab, pageId)` (Split Into Pages): null unless the page exists, is `'fit'` and
  unlocked, and its content (`elementIdsOnPage`) makes 2 or more clusters. Room =
  `min(MAX_ILLUSTRATE_PAGES - (pages - 1), PAGINATE_MAX_PAGES)`, null under 2; clusters past the
  room merge into the last. Each cluster gets `pageAround(its box, nextIllustratePageId)` with the
  split page's `background` and its `name` (the first as is, the rest `"<name> <n>"`, the name cut to
  `PAGE_NAME_MAX - 4` first); the new pages replace the
  page in the row through `withIllustratePages` (the split page's content stays put, later pages
  move with theirs, the anchor is kept), then each cluster goes onto its page with
  `withContentFittedToPage(..., { centre: true, keepSize: true })`: moved, never scaled.
- `contentClusters`: union-find over pinned arrow ends and pairs of bounds within the gap (edge to
  edge, O(n²) on the split page's content, run once per press); reading order by rows
  (`top < row's first bottom`) then x.
- `splitPage(id)` (`illustrate-page-edits.ts`): refused on a locked page (log `refused: page
locked`); at `MAX_ILLUSTRATE_PAGES` refused with the toast "A tab holds at most 100 pages: delete
  one to split this page." (log `split refused: page limit`); null from `withPageSplit`: toast "This page is one group: nothing to split.", log
  `split: one group`; else `PagesLaidOut`, toast "Split into n pages. Undo puts it back.", the view
  goes to the first new page, log `page split`.
- `setSize(id, 'fit')` is refused (log `size refused: fit to content`), as is any size outside
  `pageSizesFor(pageKindOf(page))` (log `size refused: not offered for the kind`).
- `refusedLocked(id, edit, shared = true)`: with `shared`, any locked page of the page's article
  refuses; `rename` and `startBlank` pass `shared: false` (the page's own lock only).

### Surfaces and ink

- `elementPageSurfaces(elements, pages)`: an element's page by its anchor point; only pages with a
  fill are entered. `IllustratePageClip` wraps the element views in `PageSurfacesProvider`, whose
  value keeps its identity while the entries do (keyed on `id:surface` pairs).
- `useElementSurface(id)`: the page's surface, else the canvas's; used by `BoxedElementView`,
  `TableView`, `useBoxedElementAnimation`, `ArrowView`.
- `withPageInkFor`: for elements on the page: text elements' `textColor`, arrows' and icons'
  `strokeColor`, each through `legibleOn` against `pageFillTone(fill)` (white for paper). Shapes
  with their own fill are untouched. `legibleOn` keeps a colour at or over `PAGE_INK_FLOOR`; else
  tints (dark tone) or shades (light tone) in steps of 0.1 from 0.2 until `PAGE_INK_CONTRAST`,
  falling back to `#ffffff` / `#0f172a`.

### Locking a page

- Data: `IllustratePage.locked?: true` (`packages/document/src/illustrate-page.ts`), parsed for every
  kind; `withDuplicatedPage` and `withArticleDuplicated` drop it from a copy.
- `packages/document/src/page-lock.ts`: `elementsOnLockedPages(elements, laidOutPages)` (centre by
  `elementBounds`, arrows resolved) and `guardLockedPages(prev, next, prevPages, nextPages)`:
  while the pages' layout and locks are unchanged, an element held by a locked page whose place
  (bounds and rotation) changed gets its previous `x`/`y`/`width`/`height`/`rotation` back (look
  fields pass), a new element landing on one is left out, and an existing one moved onto one is put
  back; deletions pass; `blocked` reports it.
- `apps/live/lib/page-lock-guard.ts`: `guardLockedPagesIn(prevTabs, nextTabs, guard)` in
  `useEditorState`'s `commitTabs` before layer stamping and in its `tickTabs` (a `useCallback` over
  the history's tick: drag landings, nudges, resizes), for `pageLockGuardRef` (the active tab
  while Illustrate mode's pages exist); `onBlocked` defers `announcePageLocked` (a toast at most
  every 2.5 s) with `queueMicrotask`, the guard running inside a state update.
- Inert: `usePageLockedIds(elements, illustratePages?.pages)` (`hooks/editor/usePageLockedIds.ts`)
  feeds `useLayersState`'s `extraInertIds`, joining `layerInertIds` (selection, marquee, select-all,
  pruning).
- Edits (`illustrate-page-edits.ts`): `isLocked`, `setLocked` (`Tab · Changed · PageLocked /
PageUnlocked`, tracked before the change); rename, orientation, size, background, layout, kind
  and delete are refused for a locked page, or (all but rename) any page of its article
  (`[illustrate-page] refused: page locked`). `useArticles.onLayout` leaves a flow with a locked
  page as it is.
- UI: `PageLockButton` (`components/canvas/PageLockButton.tsx`) before the cog, named for its
  press ("Lock page" / "Unlock page", no `aria-pressed`), its room `pageLockRoom(locked, !mobile)`;
  the title bar's fixed room (cog, lock, deck button, logo buttons) is taken before the invite
  chooses its wide or icon form; a locked page shows no layout invite, card or kind choice. The
  panel (`IllustratePagePanel`) shows a `role="status"` notice and renders its name and sections
  `inert` at 50% opacity; Delete page is disabled. `ArticleFlows` makes a flow with a locked page
  read-only (`editable` false, no paper press).

### Panel, previews, reorder

- Background section (`apps/live/components/canvas/page-background-section.tsx`): a `Background
kind` radiogroup (the segmented control: `theme` while `themePresets` is non-empty, `solid`,
  `gradient`), opening on `backgroundCategoryOf(fill, themePresets)` and holding a chosen category
  in local state (no edit). Theme: the theme swatches. Solid: the one colour picker inline
  (`ColourPicker`, `docs/specs/004-interface-design/blueprints/colour-picker.md`): Paper
  (`noColour('paper', 'Paper')`, no fill), then `PAGE_COLOUR_GROUPS` (soft light hexes "Light",
  strong light hexes "Dark"), Custom colours and + (no board warning); a hover or focus previews
  `{ kind: 'solid', color }`, a pick commits. Gradient: `PAGE_GRADIENT_PRESETS` then
  **Custom gradient** (`customGradientSeed(fill)` on press and hover); while
  `isCustomGradient(fill)`, `CustomGradientEditor` (`page-background-custom.tsx`): From and To
  `ColourSwatchButton`s opening the picker with `PAGE_COLOUR_GROUPS` in a popover (each hover
  previews the gradient, a pick commits, Escape or unmounting drops the preview), Angle
  (`MenuSliderRow`, 0 to 355 by 5, previewed in local state, one commit on release when changed) and
  Swap (one commit). Pattern follows, not on a logo page. The section drops its preview on pointer
  leave and on a blur whose `relatedTarget` is outside it. The panel's outside-press and Escape
  handling leave a `[data-anchored-popover]` alone.
- Panel opened from a cog (tab Page) or the invite (tab Layouts); `opened = { id, cog, tab }` in
  `IllustratePages`. Desktop: fixed, beside the cog when it fits (`a.right + GAP + WIDTH + EDGE
<= innerWidth`), else right-aligned under it; re-placed on resize and `PAGE_EASE_MS + 20` after
  the page's rect changes. Mobile (`useIsMobileViewport`): `BottomSheet`.
- Closes: outside pointerdown (`useClickOutside`, the trigger whitelisted by
  `[data-page-panel-trigger]`), Escape (capture; restores focus to the cog), a wheel outside it.
- Background preview: a shared store (`page-background-preview.ts`), set by the panel through
  `IllustratePages`; each sheet paints `previewedBackground(page, pages, preview)` (an article's
  preview covers every page of its flow); `IllustratePageClip` inks elements with
  `withPreviewedBackgrounds`, and the writing takes the previewed ink; `edit.previewInk` shows
  own-coloured elements re-inked; cleared on leave, on commit and on unmount.
- Panel tabs: an infographic page has **Page** / **Layouts**; an article page **Page** / **Style**
  / **Text** (`articleStyle(part)` renders `ArticleStyleSection`); an initial tab the kind lacks
  opens as Page. The page toolbar's Article style opens the panel on Style
  (`useStylePanelRequest`). Actions read `Duplicate / Move … / Delete article` on an article page.
  The panel and the cog row carry `data-article-keep-active`.
- Layout preview: `view.layoutPreview` set on tile pointerenter / focus; the clip drops that page
  (`hiddenPageId`); `InfographicLayoutPreview` draws `svgBoxed` / `svgArrow` markup of
  `buildPageLayout` over the sheet. While Replace is pending, leaving the grid restores the
  pending layout's preview. Cleared on apply and on unmount (through a latest-callback ref).
- Reorder: `usePageReorderDrag` on the label (`cursor-grab` only while `pageUnits(pages).length > 1`): pointer capture; with two or more units, past
  `DRAG_THRESHOLD` sideways it is a drag (`reorder = { pageId, pageIds, slot }`, `pageIds` the
  unit's pages, all dimmed); release calls `movePageTo(id, slot)`; the following click is
  swallowed (`endsDrag`); Escape cancels. `reorderSlot` = count of other units (`laidOutUnits`)
  whose centre is left of the dragged unit's centre (unit rect centre + screen dx / zoom); the
  marker sits in the gap between units.
- Bare sheets: `IllustratePages` `bare` (zen, presenting, the isometric view) drops `edit`,
  labels, the navigator and the first page's choice.

### Kinds, adding, getting around

- **Add a page**: `AddPageButton` (the + after the last page, `aria-expanded`, brand-filled while
  open, `data-add-page-trigger`) and `AddPageStripButton` (in `ToolbarPalette` after a `Divider`,
  while `onAddPage` is passed, i.e. Illustrate mode with `addPage`) both open `AddPagePopover`:
  desktop a `Portal`led card under the anchor, centred on it, kept in the window (above it when
  there is no room below), first card focused; phone a `BottomSheet`. Arrow keys cycle the cards
  (`moveBetweenKindCards` in `page-kind-cards.tsx`, shared with `FirstPageChoice`: Left / Right one
  card, Up / Down a row, wrapping); a card `onClose(false)` then `onAdd(kind)`; Escape closes and
  refocuses the +; an outside press closes (the + trigger whitelisted).
- **First page's choice**: `IllustratePages` renders `FirstPageChoice` on a page when `edit`, not
  `bare`, and `offersPageKindChoice(pages, page.id, edit.contentCount(page.id))`; the layout
  invite is withheld meanwhile; an article page never shows the invite. Cards call
  `edit.choosePageKind(page.id, kind)`. The card is scaled `1 / zoom` and centred on the sheet,
  stopping pointer and double-click propagation.
- **Page navigator**: `PageNavigator` under each sheet while not `bare` and `pages.length > 1`:
  `TOOLBAR_CARD`, previous / "n of m" / next, disabled at the ends; `onGo(i)` = `focusPage`.
- **The label** reads `pageLabel(page, index, count)`, ending in the kind.
- **Something in view**: `useOffscreenContent` unions the boxed elements' bounds with every page
  rect (`Canvas` passes `illustratePages.pages`), so the Fit nudge never shows while a page is on
  screen.

### Snapping

`useEditorDrag` passes `pageSnapBoxes` (`illustratePageSnapBoxes(view.pages)`, from
`useEditorState`) to `resolveBoxedMove` / `resolveBoxedResize`, which add them to the alignment
targets (`snapToAlignment`, `snapResizeBounds`, `alignmentGuides`) but not to `distributionSnap`.

### Export

`ImageExportOpts.page` makes `renderTabToCanvas` / `renderTabToSvg` use `pageExportFrame(page)`:
bounds = the page rect, no padding, no isometric, no tab backdrop or pattern; background =
`backgroundSvg` (rect fill or `<linearGradient>` along the CSS gradient line, then a `<pattern>`
anchored at the page's corner); surface = `pageSurface(page) ?? 'light'`; elements filtered to
those whose bounds meet the page (arrows kept). The canvas rasterises `backgroundSvg` first.
`exportPagesAsPdf` renders each page and writes one PDF page per image with a MediaBox of the page
size x `PT_PER_PX`. The dialog's `pages` prop (Illustrate mode, tab scope) selects the page row.

The dialog offers `ILLUSTRATE_FORMATS` (pdf, png, svg, file) with `ILLUSTRATE_CARD_COPY` for
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

The Import dialog takes `formats`; in Illustrate mode `EditorTabDialogs` passes `['json']`.

### Slides

`resolveSlide` of a page slide: the tab's elements on that page (`elementIdsOnPage`).
`slideFrame(slide, tab)`: the page rect, else `slideBounds(resolveSlide(...))`. Presenting a page
slide sets `presentingPageId`; `EditorCanvasHost` passes the view with only that page.
`newPageSlide(pageId)` appends `{ id, tabId: activeTabId, elementIds: [], pageId }`. Thumbnails
prepend the page's `backgroundSvg`.

- **Deck button**: `PageDeckButton` (`apps/live/components/canvas/PageDeckButton.tsx`) between the
  layout invite and `PageCog`, on `kind === 'slide'` pages and on any other page the deck has a
  slide of (`view.deck.slideOf(page.id)`), for an editor, not on a phone; the label room (and the
  invite's) loses `DECK_ROOM` (28 px). It reads `view.deck: PageDeckControls` (`slideOf(pageId)`, `add`,
  `toggleHidden`), built by `pageDeckControls(deck, tabId, canEdit, { newPageSlide,
toggleSlideHidden })` (`apps/live/lib/page-deck-controls.ts`) and memoised into the view in
  `useEditorState`. States (`data-page-deck-button`): `add` (SlideDeckIcon, "Add to slide deck"),
  `shown` (EyeIcon, "Hide from the presentation"; no `aria-pressed`, the name says the press), `hidden` (EyeOffIcon, dimmed,
  "Show in the presentation").
- **Full screen**: `slideFitOptions(slide, config)` (`lib/presentation-config.ts`) gives a page
  slide `{ maxZoom, padding: 0 }`; `fitToBounds` passes `padding` to `computeFitToScreen` (default
  `FIT_TO_SCREEN_PADDING`). `presentedPages` sets `letterbox: true`, and `IllustratePages` then
  draws the sheet's shadow as `0 0 0 LETTERBOX_SPREAD px #000` (`LETTERBOX_SPREAD` 100 000 canvas px).

### Slide pages

- `parsePage` reads `kind: 'slide'` as landscape in a slide size (`'slide'` when the stored size is
  not one), dropping any flow. `pageDimensions` draws a `landscapeOnly` size landscape whatever the
  stored orientation; `pageHasOrientation` is false for it, so `OrientationSection` is absent.
- `withPageKindChosen(tab, id, 'slide', flow)` stores `newSlidePage(id)` keeping name and
  background. `addPage('slide')` appends `newSlidePage(id, lastSlide?.size)`; `addPage('infographic')`
  models on the last page that is neither an article's nor a slide.
- `setOrientation` is refused on a page without an orientation; `setSize` refuses a size the kind
  does not offer; both log `[illustrate-page] … refused`.
- `SizeSection` lists `pageSizeChoices(page)` four to a row (the kind's sizes, `'fit'` first on a
  Fit to Content page, and on a landscape page only one of `'wide'` / `'slide'`, the two being one
  shape: `'wide'` while the page is in it, else `'slide'`); `LayoutBrowser` reads
  `layoutCatalogueFor(pageKindOf(page))`.
- `PAGE_KINDS` holds three cards (grid of three; the popover and first-page card are 420 px).
- Telemetry: `KIND_CHOSEN_EVENT` (`PageKindSlide`) and `KIND_ADDED_EVENT` (`SlidePageAdded`).
- Tests: `illustrate-page-slide.test.ts`, `article-pages.test.ts`, `illustrate-page-edits.test.ts`
  "slide page edits", `apps/live/lib/slide-layouts.test.ts`, `page-deck-controls.test.ts`,
  `PageDeckButton.test.tsx`.

## Interfaces and contracts

- `IllustratePageEdits`: `setOrientation(id, o)`, `setSize(id, size)`, `rename(id, name)`,
  `setBackground(id, Partial<PageBackground>)` (`{ fill: undefined }` = paper), `movePage(id, -1 |
1)`, `movePageTo(id, unitIndex)`, `canMove(id, -1 | 1)`, `addPage?(kind: PageKind)`,
  `choosePageKind(id, kind)`, `duplicatePage?(id)`, `removePage?(id)`, `applyLayout(id,
PageLayoutId)`, `contentCount(id)`, `previewInk(preview | null)`. An unknown page id commits
  nothing.
- `offersPageKindChoice(pages, id, count)`: true only for the only page, unchosen, empty.
  `withPageKindChosen`: null when the page no longer offers it.
- `PageLayout.build(box: LayoutBox): Element[]`: pure; every element inside the box (1 px slack);
  arrows only between the layout's own elements; fresh ids each call.
- `withContentOnAPage(tab)`, `withPageSplit(tab, pageId)`: the tab with `pages`, or null (nothing
  to do); `pageAround(box, id)`: always a page.
- `slideFrame(slide, tab)`: a rect or null (nothing to frame).
- `pageExportFrame(page, paper?)`: never throws; the paint is decorative and a rasterise failure
  leaves the paper.

## Errors and edge cases

| Case                                   | Handling                                                    |
| -------------------------------------- | ----------------------------------------------------------- |
| Malformed stored page / field          | Skipped / dropped by `parsePage` (Data and persistence)     |
| Edit to a page removed meanwhile       | The commit's `find` misses; the tab is unchanged            |
| Duplicate or add at the limit          | The control is absent / disabled; the commit also refuses   |
| An article's copy past the limit       | `withArticleDuplicated` null: no edit (the control stays)   |
| Kind chosen on a page no longer alone  | `withPageKindChosen` null: no edit                          |
| Stored page with a repeated id         | Skipped after the first                                     |
| A flow's pages apart in the row        | Rejoined at the first, each taking its size and paint       |
| Two quick edits                        | Each re-reads the tab at commit time                        |
| Duplicated arrow pinned off the page   | Not copied                                                  |
| Re-fit of content larger than the room | Scaled down, never up                                       |
| Lone page under a layout preview       | `pagesClipPath([])` returns a clip that hides everything    |
| Page slide whose page is gone          | Resolves to no elements, frames to null; shown, fixable     |
| Split past 20 clusters or the limit    | The rest share the last new page, sized around them         |
| Split of a page with one cluster       | No edit; a toast says there is nothing to split             |
| Content wider than `FIT_PAGE_MAX_SIDE` | The page stops at the limit; the content runs off, unscaled |
| Carrier of the row anchor deleted      | The anchor moves to the new first page; the row stays       |
| Malformed `fit` or `rowAt`             | Read as A4 / dropped (the row on the origin)                |
| Gradient rasterise failure in export   | Caught; the paper stays                                     |
| A page fails to render in a .zip       | The export rejects; the dialog's existing error path shows  |
| A page label with path characters      | `sanitizeFilename` replaces them in zip and download names  |
| One page in the tab                    | No page `Select`; All and One give the same page            |
| Name field closed without blur         | Committed on unmount                                        |
| Stale dev bundle                       | Not a code path; restart the dev server (wipe `.next-dev`)  |

## Security and trust

No server path is added: pages and page slides are tab and presentation data, written by the
existing tab sync and validated on read (`parsePage`, `isSlide`). Colours are validated hex before
they reach CSS or SVG; SVG markup escapes every colour (`xmlEscape`). The layout preview injects
only the renderer's own markup, whose labels are escaped.

## Performance and limits

- At most 100 pages; per-render layout is O(pages); `withArticlesTogether` is O(pages) and
  returns the same array when nothing moves; `laidOutUnits` O(pages) per drag frame.
- `elementPageSurfaces` and `illustratePageSnapBoxes` run per render: O(elements x pages) and
  O(pages); the provider's value is stable while the entries are, so element views do not
  re-render during a drag that keeps elements on their pages.
- Entering the mode (`withContentOnAPage`) is O(elements): one bounds pass and one anchor-point
  pass over `elementIndexFor` (measured 1.4 ms at 3000 elements, against 67 ms for the clustering
  it replaced; guarded by a 5000-element budget test). `contentClusters` is O(n²) in the split
  page's elements, run only when Split Into Pages is pressed (57 ms at 3000).
- A Fit to Content page's image export is drawn at 2x, lowered by `exportScale` so no canvas side
  passes `MAX_EXPORT_CANVAS_SIDE` (16384 px); its PDF page is at most 14400 pt.
- Layout thumbnails build once per page shape (`useMemo` on the rect); the overview draws two per category (8), a category at most six.
- PDF export renders each page at scale 2; memory is one canvas at a time.
- An all-pages .zip holds every page's bytes at once (20 pages max) and is stored uncompressed
  (PNG and SVG gain little from deflate); `crc32` is a 256-entry table, O(bytes).

## Presentation and UX

Copy and layout as the spec: **Add a Page** over the two cards (**Infographic**, "A page to lay
out: layouts, icons, charts and media."; **Article**, "A page to write on, flowing onto new pages
as it grows."), each over its miniature; the strip +'s HoverCard **Add page**, "A new infographic or
article page after the last."; the first page's card **What Is This Page For?**, "Choose now: a
page keeps its kind once you start."; the navigator **Previous page**, "n of m", **Next page**;
the panel's tabs **Page** / **Layouts** (an article page **Page** / **Style** / **Text**), sections **Size**,
**Orientation**, **Background**, **Pattern**, **Start From a Layout**; the confirm **Replace this
page's content?**, "The n elements on it make way for <layout>. Undo brings them back.",
**Cancel** / **Replace**; actions **Duplicate page**, **Move page left**, **Move page right**,
**Delete page**; the invite **Start from a layout**; the export row **All pages** / **One page** with the outcome line ("n pages, one PDF.", "A .zip of n PNG files, one per page.", "A one-page PDF.", "One PNG."), the subtitle "Pick a format to export the pages."; the slide picker
**Add as slide**; the size tile **Fit** (tooltip "Sized around the board it was made for"), the
action **Split Into Pages**; the toasts "Put onto a page that fits it. Undo switches back to
<Mode>.", "Put onto a page that fits it. Undo takes the page away.",
"Split into n pages. Undo puts it back.", "This page is one group: nothing to split.", "A tab holds
at most 100 pages: delete one to split this page."

## Accessibility

- The cog: `aria-haspopup="dialog"`, `aria-expanded`, named `<page> settings`; the panel
  `role="dialog"` named `<page> settings`; Escape restores focus to the cog.
- Tabs `role="tablist"` / `role="tab"` with `aria-selected`; size, orientation, swatches and
  patterns are `role="radiogroup"` / `role="radio"` with `aria-checked` and names; previews follow
  focus as well as hover.
- The page label is a button named by its text (a HoverCard describes the press); the invite and
  Slides buttons are named; Tooltips repeat names only.
- The + (both): `aria-haspopup="dialog"`, `aria-expanded`, named **Add page**; the popover
  `role="dialog"` named "Add a Page" around a `role="group"`; cards are buttons (name and line as
  text), arrow keys cycle, Escape returns focus to the +.
- The first page's card `role="group"` named "What is this page for?"; the navigator
  `role="navigation"` named "Page n of m", its arrows named and disabled at the ends.
- Reduced motion: the sheets' ease and the swatch hover scale are off
  (`motion-reduce:transition-none`, `motion-reduce:hover:scale-100`), the preview's fade off.

## Web Experience

No new route or loaded asset; the panel, preview, picker, Add a page popover and the first page's
card mount on demand. Layout thumbnails, the preview and the kind miniatures are inline SVG (no
network). No layout shift: the title bar, the navigator and the first page's card are absolutely
positioned over the canvas; the strip's + is one more fixed 36 px control at the strip's end, there
for the whole of Illustrate mode.

## Observability

- `debugLog` fingerprints: `[illustrate-page] orientation set`, `size set`, `renamed`,
  `background set`, `moved`, `page added`, `document added`, `duplicated`, `document duplicated`,
  `page removed`, `document removed`, `first page kind chosen`, `layout placed`, `framed`,
  `content put onto a page`, `page split`, `split: one group`, `size refused: fit to content`,
  `press off the pages ignored`.
- Telemetry as the spec's Telemetry section, charted in `apps/telemetry/app/catalogue/features.ts`
  (`PAGE_ORIENTATION`, `ILLUSTRATE_PAGES`, `ILLUSTRATE_PAGE_SETUP`,
  `ILLUSTRATE_PAGE_BUILDING`) and `collaboration.ts` (`SLIDES_ADDED`, `SLIDE_DECK_OPENED`), with
  explanations in `event-explanations.ts`.

## Testing

| Spec rule                                                           | Test                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A page's fields, parsing, sizes, labels, mixed row                  | `packages/document/src/illustrate-page-model.test.ts`                                    |
| Content on a page, duplicate, replace                               | `illustrate-page-model.test.ts` "page content"                                           |
| Dark pages, per-element surface, re-inking                          | `illustrate-page-model.test.ts` "page backgrounds", "page ink"                           |
| Into pages: page around content, nothing moved, split, limits       | `packages/document/src/illustrate-paginate.test.ts`                                      |
| Fit to Content sides and the row anchor read and laid out           | `packages/document/src/illustrate-page.test.ts` "Fit to Content pages", "the row anchor" |
| No template changes entering Illustrate (issue #491, Sailboat)      | `packages/templates/src/template-into-pages.test.ts`                                     |
| Entering puts the board on a page, toast and telemetry              | `apps/live/hooks/editor/useIllustratePages.into-pages.test.ts`                           |
| Fit size refused, sides dropped, Split Into Pages                   | `illustrate-page-edits.test.ts` "Fit to Content page edits"                              |
| The Fit tile and Split Into Pages in the panel                      | `apps/live/components/canvas/IllustratePagePanel.fit.test.tsx`                           |
| Page slides resolve and frame                                       | `packages/document/src/slide-deck.test.ts` "page slides"                                 |
| Edits: rename, size, move, delete, duplicate, paint, layout, re-fit | `apps/live/hooks/editor/illustrate-page-edits.test.ts`                                   |
| Edits on articles: add by kind, shared reshape and paint, as a unit | `illustrate-page-edits.test.ts` "documents"                                              |
| Kinds read, flow fallback, a flow's pages kept together             | `packages/document/src/illustrate-page.test.ts` "page kinds"                             |
| The label ends in the kind                                          | `illustrate-page-model.test.ts`                                                          |
| The first page's choice offered and taken                           | `packages/document/src/article-pages.test.ts`                                            |
| Reorder by units                                                    | `usePageReorderDrag.test.ts` "reorderSlot with documents"                                |
| Into pages never replaces an article or locked page                 | `illustrate-paginate.test.ts` "never replaces a locked page or an article page"          |
| Split makes at most 20 pages, never past the limit                  | `illustrate-paginate.test.ts` "withPageSplit"                                            |
| A page counts as something in view                                  | `apps/live/hooks/canvas/useOffscreenContent.test.tsx`                                    |
| Every layout fits every size and orientation; each in a category    | `apps/live/lib/page-layouts.test.ts`                                                     |
| Sheet paint, presets, theme backgrounds                             | `apps/live/lib/illustrate-page-paint.test.ts`                                            |
| Snapping to page edges, centre lines, margins                       | `apps/live/hooks/canvas/boxed-drag-resolve.test.ts`                                      |
| Reorder slot                                                        | `apps/live/hooks/canvas/usePageReorderDrag.test.ts`                                      |
| The clip, and a clip with no page                                   | `apps/live/components/canvas/IllustratePageClip.test.ts`                                 |
| Export defaults, zip entry names, filename sanitising               | `apps/live/lib/export-pages.test.ts`                                                     |
| Zip writer: CRC, round trip                                         | `apps/live/lib/zip-writer.test.ts`                                                       |
| Import offers JSON only in Illustrate mode                          | `apps/live/components/dialogs/ImportTabDialog.test.tsx`                                  |

Not covered by a unit test (browser-checked): panel placement, hover previews, the bottom sheet,
the Slides popover, PDF bytes, the Add a page popover and the strip +, the first page's card, the
page navigator.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D23 to D32 and D55 to D58.
