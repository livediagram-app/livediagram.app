# Pages blueprint

Derived from [Pages](../pages-mode.md). Implementation detail only; the spec owns
every design decision.

## Domain and naming

| Term                        | Identifier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page                        | `Page` (`{ id, orientation, size?, fit?, rowAt?, background?, name?, kind?, locked?, startedBlank? }`), `packages/design/src/page.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Fit to Content sides        | `PageSides` (`{ width, height }`), `parsePageSides`, `clampPageSide`, `FIT_PAGE_MIN_SIDE`, `FIT_PAGE_MAX_SIDE`, `../packages/model-core/src/page-fit.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Row anchor                  | `RowAt` (`{ x, y }`), `parseRowAt` (`page-fit.ts`); `rowAnchorOf(pages)`, `withOneRowAnchor` and `withRowAnchorKept` (private), `page.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Page kind                   | `PageKind` (`'logo' \| 'wireframe' \| 'photo'`); `pageKindOf(page)` (absent, or a kind livedesign does not have, reads `null`: a blank page), `tabPageKind(pages)` (the first page's, `null` for a blank one), `lastPageOfTabKind(pages)` (what the + adds another of), `newLogoPage(id)`, `newWireframePage(...)` ([Logo pages](logo-pages.md))                                                                                                                                                                                                                                                                                                       |
| The first page's choice     | `offersPageKindChoice(pages, pageId, contentCount)`, `withPageKindChosen(tab, pageId, kind, device?)`, `packages/design/src/page-units.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Units of the row            | `PageUnit` (`{ pageIds }`, one page each), `pageUnits`, `withUnitMoved` (`page-units.ts`); `laidOutUnits` (`usePageReorderDrag.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| A page laid out             | `LaidOutPage` (`Page & { index, rect: PageRect }`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Page size                   | `PageSizeId` (`'a4' \| 'logo' \| 'device' \| 'photo' \| 'fit'`), `PAGE_SIZES` (`logoOnly` on `logo`, `deviceOnly` on `device`, `photoOnly` on `photo`, `fitOnly` on `fit`), `PAGE_SIZE_IDS`, `pageSizesFor(kind)`, `pageSizeChoices(page)`                                                                                                                                                                                                                                                                                                                                                                                                             |
| Orientation                 | `PageOrientation`, `PAGE_ORIENTATIONS`; `pageHasOrientation(page)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Page background             | `PageBackground` (`{ fill?: PageFill; pattern?: PagePattern }`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Fill                        | `PageFill` (`{ kind: 'solid'; color }` \| `{ kind: 'gradient'; from; to; angle }` \| `PageImageFill`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Picture fill                | `PageImageFill` (`{ kind: 'image'; imageId; tone?; overlay?: PageImageOverlay; position?: PageImagePosition; credit?: ImageCredit; preview? }`), `PageImageOverlay` (`{ kind: PageImageOverlayKind; strength; color? }`), `PageImageOverlayKind` (`'light' \| 'dark' \| 'tint' \| 'fade'`), `PageImagePosition` (`'top' \| 'bottom'`, absent is centre), `isPageImageId`, `parsePageImageFill`, `samePageImage`, `pageImageTone`, `pageImageOverlayColor`, `mixHex`, `defaultPageImageOverlay`, `pageImageIds`, `withPageImageIds`, `packages/design/src/page-image.ts`                                                                                |
| Picture paint               | `pageImageOverlayCss`, `pageImagePositionCss`, `pageImageCssUrl`, `pageImageSrc`, `pageImageSvg` (`apps/live/lib/page-image-paint.ts`); `sampleImageTone`, `averageTone` (`../packages/workbench/src/lib/page-image-tone.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Picture access and sources  | `PageImageAccessProvider`, `usePageImageAccess`, `usePageImageSources` (`apps/live/components/canvas/page-image-access.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Image category              | `ImageBackgroundChoices`, `pageImageFilters` (`apps/live/components/canvas/page-background-image.tsx`); `themePresetAccent` (`page-paint.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Pattern                     | `PagePattern` (`'dots' \| 'grid' \| 'lines'`), `PAGE_PATTERNS`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| The tab's pages             | `pagesOf(tab)` (never empty), `layOutPages(pages)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| A page's measures           | `pageDimensions`, `pageSizeLabel`, `pageLabel(page, index, count)`, `pageMargin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Pure page edits             | `PageEdit`, `PageEditRefusal`, `pagesSharing`, `pageLockRefuses`, `pageLockSet`, `pageRenamed`, `pageTurned`, `pageResized`, `pageBackgroundSet`, `pageBackgroundStored`, `pageAdded`, `pageDuplicated`, `pageRemoved`, `pageMovedTo`, `pageLaidOut`, `packages/design/src/pages-edits.ts` (shared with the agents' page changes)                                                                                                                                                                                                                                                                                                                      |
| Background edit             | `sameFill`, `withBackgroundPatch`, `PAGE_GRADIENT_ANGLE`, `packages/design/src/page-paint.ts` (re-exported by `apps/live/lib/page-paint.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Copying a background        | `backgroundPatchFor`, `pageBackgroundCopied`, `pageBackgroundSpread`, `BackgroundSpread`, `BackgroundCopyRefusal` (`packages/design/src/pages-background-copy.ts`); `backgroundCopyEdits`, `BackgroundCopyEdits` (`applyToAllReach`, `applyBackgroundToAll`, `copyBackground`), `KIND_PAGES`, `appliedToAllMessage` (`apps/live/hooks/editor/pages-background-copy-edits.ts`); `ApplyBackgroundToAll` (`components/canvas/page-background-apply-all.tsx`); `pageBrush`, `brushPageId`, `pagePaintPress`, `formatBannerMessage` (`../packages/workbench/src/lib/format-page-brush.ts`); `pageIdAtPress` (`hooks/canvas/page-guard.ts`); `CanvasProps.onFormatPagePress` |
| The page an element is on   | `pageIdAt`, `pageIdOf`, `crossesPages` (`packages/design/src/page-of.ts`); `reachableFrom` (`apps/live/hooks/canvas/arrow-endpoint-resolve.ts`), `connectArrowTo` (`useArrowConnect.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Page edit carrying content  | `withPages(tab, next)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| What is on a page           | `elementAnchorPoint`, `elementIdsOnPage`, `packages/design/src/page-content.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Duplicate / replace content | `withDuplicatedPage`, `withPageContentReplaced`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Page surface                | `pageFillTone`, `pageSurface`, `pageIsDark`, `elementPageSurfaces`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Re-inking                   | `pageInkFor(tab, pageId, background, memory?)` / `withPageInkFor`, `pagesInkFor(tab, inks, memory?)`, `PageInk` (`page-ink.ts`), `inkToward`, `worstContrast`, `mixHex` (`page-ink-contrast.ts`), `pageGroundUnder`, `gradientPosition` (`page-ink-ground.ts`), `inkKindOf`, `INK_ROLE_CONTRAST` (`page-ink-rules.ts`); `InkMemory`, `InkRecall`; `pageInkMemory`, `rememberPageInk` (`apps/live/lib/page-ink-memory.ts`); `legibleOn(color, tone)` (other callers' single-tone helper)                                                                                                                                                                |
| Chart ink (render time)     | `chartMarkInk(color, ground)`, `chartTextInk(color, ground)`, `chartPageGrounds(elements, pages, layers?)`, `isPaletteChart` (`chart-ink.ts`); `chartFrame(el, palette, ground?)`, `sankeyFrame(el, palette, ground?)`; `BoxedExportOptions.chartGrounds`; canvas `ChartGroundsProvider` / `useChartGround` (`CanvasSurfaceContext.tsx`, provided by `PageClip`); `exportChartInk(tab, page)` (`apps/live/lib/export-chart-ink.ts`)                                                                                                                                                                                                                    |
| Re-fit                      | `withContentFittedToPage(tab, ids, pageId, { centre?, keepSize? })`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Snap boxes                  | `pageSnapBoxes(pages)` (ids `page-snap:<id>`, `page-margin:<id>`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Into pages                  | `contentClusters`, `pageAround(box, id)`, `withContentOnAPage(tab)`, `withPageSplit(tab, pageId)`, `packages/design/src/paginate.ts`; `PageEdits.splitPage`; `SplitPagesIcon` (`../packages/ui/src/icons/actions.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Page layout                 | `PageLayoutId` (`LogoLayoutId \| WireframeLayoutId`, `page-layouts.ts`); `layoutCatalogueFor(kind)`, `pageLayoutById` (`layout-catalogue.ts`), all `packages/templates/src/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Carried content             | `carryPageContent(previous, placed)`, `warmLayoutPlaceholders()`, `packages/templates/src/page-layout-carry.ts`; roles `title`, `large`, `body`, `figure`; the page's elements `elementsOnPage` (`packages/design/src/page-content.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Layout kit                  | `kit(box)`, `Kit`, `heading`, `LayoutBox`, `page-layout-kit.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A layout for a page         | `buildPageLayout(layout, page)`; with the page's content carried in, `buildPageLayoutOver(layout, page, previous)`, `packages/templates/src/page-layout-build.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Background catalogue        | `PAGE_COLOUR_GROUPS` (`page-background-custom.tsx`), `PAGE_GRADIENT_PRESETS`, `themeBackgroundPresets`, `backgroundCategoryOf`, `isCustomGradient`, `customGradientSeed`, `apps/live/lib/page-paint.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Sheet paint                 | `pageSheetStyle`, `pagePatternInk`, `fillCss`, `gradientFill` (`apps/live/lib/page-paint.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| The pages view              | `PagesModeView`, `usePagesMode`, `apps/live/hooks/editor/usePagesMode.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Page edits                  | `PageEdits`, `pageEdits`, `apps/live/hooks/editor/page-edits.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Sheets and title bars       | `CanvasPages` (`PageCog`, `LayoutInvite`, `ReorderMarker`), `apps/live/components/canvas/CanvasPages.tsx`; `AddPageButton` (`AddPageButton.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Background beside the cog   | `PageBackgroundButton`, `pageBackgroundRoom` (`components/canvas/PageBackgroundButton.tsx`) over `TitlePopoverButton`, `titleButtonClass` (`TitlePopoverButton.tsx`); body `BackgroundSection`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Title-bar room              | `titleBarFixedRoom`, `titleBarNamed` (buttons named only while the page on screen holds them named plus `LABEL_MIN`), `components/canvas/page-title-bar-room.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Kind cards                  | `PAGE_KINDS`, `PageKindChoice`, `PageKindCard`, `moveBetweenKindCards` (`page-kind-cards.tsx`, the first page's choice alone); a screen of another device `AddScreenPopover` (`AddScreenPopover.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| In-page layout card         | `EmptyPageLayouts` (`components/canvas/EmptyPageLayouts.tsx`), `showsLayoutCard` (in `CanvasPages`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| First page's choice card    | `FirstPageChoice` (`components/canvas/FirstPageChoice.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Page navigator              | `PageNavigatorClusterStrip` (`components/canvas/PageNavigatorClusterStrip.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Page panel                  | `PagePanel` (`PagePanelTab` `'page' \| 'background' \| 'layouts' \| 'style' \| 'text'`, `pagePanelTabs`, `PagePreview`, `NameField`, `PanelTabs`, `PageActions`, `ActionButton`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Background hover preview    | `setPageBackgroundPreview`, `usePageBackgroundPreview`, `previewedBackground`, `withPreviewedBackgrounds`, `apps/live/lib/page-background-preview.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Theme accent                | `themeAccent(theme)`, `page-paint.ts`; `PagesModeView.themeAccent`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Panel sections              | `SizeSection`, `OrientationSection` (`page-panel-sections.tsx`), `BackgroundSection` (`page-background-section.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Layouts section             | `LayoutsSection` around `LayoutGallery` (`apps/live/components/canvas/layout-gallery/LayoutGallery.tsx`; state: `category` (`ALL_LAYOUTS` or a category id), `query`, `rolling`, the last Surprise Me pick), `page-layouts-section.tsx`; pure rules `gallerySections`, `categoryCounts`, `matchesQuery`, `surprisePick` (`layout-gallery-filter.ts`); columns `tileColumns` / `useTileWidth`; tile `LayoutTile` (drawn once seen, `useSeen`); tile art `LayoutThumb`                                                                                                                                                                                   |
| Layout hover preview        | `PageLayoutPreview`; `PagesModeView.layoutPreview`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Page clip                   | `PageClip` (`hiddenPageId`), `pagesClipPath`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Per-element surface         | `PageSurfacesProvider`, `useElementSurface(id)`, `CanvasSurfaceContext.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Reorder drag                | `usePageReorderDrag`, `reorderSlot`, `PageReorder` (`{ pageId, pageIds, slot }`), `apps/live/hooks/canvas/usePageReorderDrag.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Something in view           | `useOffscreenContent(elements, offset, zoom, mainRef, pages)`, `apps/live/hooks/canvas/useOffscreenContent.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Page export                 | `pageExportFrame`, `PageExportFrame`, `EXPORT_PAPER` (`apps/live/lib/export-page.ts`); `ImageExportOpts.page`; `exportPagesAsPdf`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Export pages                | `PageScope`, `PageExportFormat`, `DEFAULT_PAGE_SCOPE`, `exportPages`, `exportPageLabel`, `zipEntryName`, `sanitizeFilename` (`apps/live/lib/export-pages.ts`); `writeZip` (`../packages/workbench/src/lib/zip-writer.ts`), on `crc32` (`../packages/workbench/src/lib/crc32.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Export page row             | `ExportPagePicker` (scope + page); `ImageExportPanel` `pagePicker`; `PAGES_FORMATS`, `PAGES_CARD_COPY` (`ExportTabDialog.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Animated background export  | `motionParts`, `MotionNode`, `MotionBox`, `MotionWave`, `MotionGroup`, `MotionGrid`, `MotionFill`, `MotionAnim`, `wavePath`, `waveLine` (`apps/live/lib/page-motion-parts.ts`; the fourth carousel page's motions in `page-motion-parts-page-four.ts`); `openingPhase`, `openingPose`, `poseAt`, `cubicBezier`, `ANIM_ORIGIN`, `animOrigin` (`page-motion-frame.ts`); `paintMotionFrame`, `MotionFrameCache`, `motionFrameHref`, `blurredDisc`, `rgba` (`page-motion-canvas.ts`); `pageGradientLine`, `pageExportFrame`'s `overFill`                                                                                                                   |
| Import formats              | `ImportTabDialog` `formats` (`['json']` in Pages mode, from `EditorTabDialogs`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Page slide                  | `Slide.pageId`, `slideFrame(slide, tab)` (`packages/design/src/slide-deck.ts`); `newPageSlide`; `PageSlidePicker`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Slides button               | `SlidesClusterSegment`, in `PagesClusterStrip` after `ContentsClusterSegment`; dock panel `'slides'` (`useDockPopovers`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Contents                    | `usePageContents` (`apps/live/hooks/ui/usePageContents.ts`): rows, Find a Page, thumbnails, `current` (here), `go`, keys, reorder, add; laid out by `PageContentsList.tsx` (`ContentsList` `variant` `'list' \| 'film'`, `ContentsFind`) and `ContentsAddPage.tsx`                                                                                                                                                                                                                                                                                                                                                                                     |
| Contents popover            | `PageContentsPanel` (a `MovablePanel` popover, a `BottomSheet` on a phone; `onDock` adds Dock as Sidebar, absent on a phone or with one page), opened by `ContentsClusterSegment`; dock panel `'contents'`; a row's ⋯ is `PageMenu` (`useRowMenu`, `EllipsisTriggerButton`, `PortalMenu`)                                                                                                                                                                                                                                                                                                                                                              |
| Contents sidebar            | `PageContentsSidebar` (`data-contents-sidebar`, `data-contents-side`, header `data-contents-handle`, drop outline `data-contents-drop`), `CONTENTS_SIDEBAR_SELECTOR`; a row's toolbar is `PageToolbar`; wired by `useContentsChrome` (`contentsDocked`, `contentsSide`, `contentsSidebarEl`, `contentsPopoverEl`)                                                                                                                                                                                                                                                                                                                                      |
| Contents placement          | `ContentsPlacement` `'sidebar' \| 'button'`, `UserPreferences.contentsPlacement`, `readContentsPlacement`, `withContentsPlacement`; `ContentsSide` `'left' \| 'right'`, `CONTENTS_SIDE_STORAGE_KEY`, `readContentsSide` (`apps/live/lib/contents-placement.ts`)                                                                                                                                                                                                                                                                                                                                                                                        |
| Side insets                 | `sideChromeInsets(canvas)`, `sideInsetsOf` (`apps/live/lib/side-chrome-insets.ts`), `besideSideInsets(frame, insets)` (`../packages/workbench/src/lib/viewport.ts`), `contentsSidebarClearancePx(panelScale)`; Fit's `PagesModeView.fitPageInView`                                                                                                                                                                                                                                                                                                                                                                                                     |
| Resting on a page           | `pageSnap` (`PageSnap`, `SnapBand`, `SnapFrame`, `clampAxis`; `apps/live/lib/page-snap.ts`), `usePageSnap` (`flickVelocity`, `SnapMeasure`; `apps/live/hooks/editor/usePageSnap.ts`), `restingRect` and `translateOf` (`side-chrome-insets.ts`); `snapSuspended` on `usePagesMode`                                                                                                                                                                                                                                                                                                                                                                     |
| Page thumbnails             | `usePageThumbnails(tab, pageIds, settleMs)`, `pageElementBuckets(elements, pages)` (`apps/live/lib/page-element-buckets.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

"Page" in code and specs; "sheet" only for the drawn view of one. "Layout" is what goes onto one
page; "template" stays the whole-tab starting point.

## Constants and configuration

| Constant                                                                   | Value                                                                              | Where / provenance                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `A4_SHORT_SIDE`, `A4_LONG_SIDE`                                            | 794, 1123                                                                          | `page.ts`; A4 at 96 px per inch                                                                                                          |
| `PAGE_SIZES`                                                               | spec "Sizes" table                                                                 | `page.ts`                                                                                                                                |
| `PAGE_GAP`                                                                 | 96 px                                                                              | Editor modes "The pages"                                                                                                                 |
| `MAX_PAGES`                                                                | 100                                                                                | Spec "Page actions"                                                                                                                      |
| `CONTENTS_SIDEBAR_WIDTH`, `CONTENTS_SIDEBAR_GAP`                           | 236 px (at the panels' UI scale), flush to its edge; 16 px for what starts past it | `contents-placement.ts`; spec "Contents"                                                                                                 |
| `CONTENTS_SIDEBAR_SETTLE_MS`                                               | 250 ms                                                                             | `PageContentsSidebar.tsx`; spec "Contents" "Cost"; safe 100 to 1000                                                                      |
| `CONTENTS_FOLLOW_SETTLE_MS`                                                | 150 ms                                                                             | `PageContentsSidebar.tsx`; spec "Following the view"; safe 50 to 500                                                                     |
| `SNAP_FIT_TOLERANCE`                                                       | 1.02                                                                               | `page-snap.ts`; spec "The view rests on a page"; D88; safe 1 to 1.1                                                                      |
| `SNAP_SWIPE_FRACTION`                                                      | 0.2 of the band's width                                                            | `page-snap.ts`; spec "The view rests on a page"; D88; safe 0.1 to 0.5                                                                    |
| `SNAP_FLICK_PX_PER_MS`, `SNAP_FLICK_MIN_PX`                                | 0.5 px/ms, 24 px                                                                   | `page-snap.ts`; spec "The view rests on a page"; D88                                                                                     |
| `SNAP_EDGE_ROOM`                                                           | `READING_TOP_ROOM` (104 px)                                                        | `page-snap.ts`; spec "The view rests on a page": the reading frame never moves on release                                                |
| `VIEW_REST_MS`, `FLICK_WINDOW_MS`                                          | 250 ms, 80 ms                                                                      | `usePageSnap.ts`; spec "The view rests on a page"; D88; rest safe 150 to 500                                                             |
| `CONTENTS_DRAW_AHEAD_PX`                                                   | 400 px                                                                             | `usePageContents.ts`; rows drawn this far past the list's visible part; safe 0 to 1000                                                   |
| `CONTENTS_FIND_AFTER`                                                      | 6 pages                                                                            | `page-contents.ts`; spec "Contents" "Header"                                                                                             |
| `CONTENTS_SIDEBAR_MIN_PAGES`                                               | 2 pages                                                                            | `contents-placement.ts`; spec "Contents": one page keeps the button                                                                      |
| `ADD_PAGE_CLOSE_MS`                                                        | 150 ms                                                                             | `ContentsAddPage.tsx`; spec "Adding"; safe 50 to 400                                                                                     |
| Filmstrip picture                                                          | up to 172 x 124 px (`FILM_MAX_W`, `FILM_MAX_H`)                                    | `PageContentsList.tsx`; spec "The list"                                                                                                  |
| `PAGINATE_MAX_PAGES`                                                       | 20 pages per Split Into Pages                                                      | `paginate.ts`; spec "Into pages"                                                                                                         |
| `FIT_PAGE_MIN_SIDE`                                                        | 200 px                                                                             | `page-fit.ts`; spec "Sizes"                                                                                                              |
| `FIT_PAGE_MAX_SIDE`                                                        | 19200 px (14400 pt, a PDF's largest page, at 0.75 pt per px)                       | `page-fit.ts`; spec "Sizes"                                                                                                              |
| Add a Screen popover                                                       | 300 px wide, 10 px from its button                                                 | `AddScreenPopover` `WIDTH`, `GAP`; D55                                                                                                   |
| `ADD_PAGE_SIZE`, `ADD_PAGE_CLEARANCE`                                      | 36 px, 12 px                                                                       | `AddPageButton.tsx`; spec "Adding a page"                                                                                                |
| First page's choice card                                                   | 420 px wide                                                                        | `FirstPageChoice` (`w-[420px]`); D56                                                                                                     |
| `LAYOUT_CARD_MIN_WIDTH`, `LAYOUT_CARD_MAX_WIDTH`, `LAYOUT_CARD_MAX_HEIGHT` | 340 px, 900 px, 660 px                                                             | `page-layout-card.ts`; spec "An empty page offers its layouts", D78                                                                      |
| `LAYOUT_CARD_MARGIN`, `LAYOUT_CARD_MIN_HEIGHT`                             | 16 px, 380 px                                                                      | `page-layout-card.ts`; spec "too small on screen to hold it", D78                                                                        |
| `MIN_TILE_LANDSCAPE`, `MIN_TILE_PORTRAIT`, `TILE_GAP`, `TILE_PAD`          | 156 px, 112 px, 8 px, 12 px                                                        | `LayoutGallery.tsx`; spec "The layout gallery", D89                                                                                      |
| `DRAW_AHEAD_PX`, `WIREFRAME_TILE_MAX_H`                                    | 320 px, 200 px                                                                     | `LayoutTile.tsx`: how far past the scrolling area a tile starts drawing; the tallest a wireframe page's tile stands; D89                 |
| `DESCRIBED_MIN_WIDTH`, `CARD_CHROME_HEIGHT`                                | 520 px, 168 px                                                                     | `EmptyPageLayouts.tsx`: a card wide enough for descriptions and the badge; the card's height less its gallery's                          |
| `PAGE_PAPER_DARK`                                                          | `#0f172a`                                                                          | `layout-render-thumb.tsx`: a plain page's paper in dark chrome, as `CanvasPages` paints it (slate-900)                                   |
| Page navigator                                                             | the bottom-right cluster, right of Undo / Redo                                     | `PageNavigatorClusterStrip`; D57                                                                                                         |
| `PAGE_NAME_MAX`                                                            | 60                                                                                 | D23                                                                                                                                      |
| `PAGE_MARGIN_FRACTION`                                                     | 0.07                                                                               | Spec "Layouts", "Snapping"                                                                                                               |
| `PAGE_GRADIENT_ANGLE`                                                      | 160 (CSS degrees)                                                                  | `packages/design/src/page-paint.ts`; spec "Backgrounds"                                                                                  |
| `ANGLE_STEP`                                                               | 5 (the Angle slider runs 0 to 355)                                                 | `page-background-custom.tsx`; spec "Custom gradient"                                                                                     |
| `PAGE_PATTERN_PITCH`                                                       | 24 px                                                                              | Spec "Backgrounds"                                                                                                                       |
| Pattern ink                                                                | `rgb(15 23 42 / 0.1)` light, `rgb(255 255 255 / 0.14)` dark                        | `pagePatternInk`; D24                                                                                                                    |
| `FALLBACK_ACCENT`                                                          | `#0ea5e9`                                                                          | `themeBackgroundPresets`; the brand blue                                                                                                 |
| Theme tints / shades                                                       | wash 0.93, tint 0.8, deep 0.6, glow 0.85 / 0.7, dusk 0.65 / 0.4                    | spec "From the theme" (wash, tint, deep); D25 (glow, dusk)                                                                               |
| Default gradient angle on read                                             | 180                                                                                | `parseFill`; D31                                                                                                                         |
| `PAGE_INK_FLOOR`                                                           | 3 (contrast)                                                                       | `legibleOn` default floor; WCAG 1.4.3 large text (re-inked text uses `PAGE_INK_CONTRAST`)                                                |
| `PAGE_INK_CONTRAST`                                                        | 4.5 (contrast)                                                                     | Text under it is re-inked; WCAG 1.4.3 AA                                                                                                 |
| `PAGE_INK_TARGET`                                                          | 7 (contrast)                                                                       | Re-inked text reaches it; WCAG 1.4.6 AAA; safe range 4.5 to 10; spec "Re-inking"                                                         |
| `PAGE_LINE_CONTRAST`                                                       | 3 (contrast)                                                                       | Lines, glyphs, marks: floor and target; WCAG 1.4.11                                                                                      |
| `PAGE_CARD_FLOOR`, `PAGE_CARD_TARGET`                                      | 1.25, 1.4 (contrast); safe 1.1 to 1.5                                              | Spec "Re-inking" Cards; D83                                                                                                              |
| `CHART_MARK_CONTRAST`, `CHART_TEXT_CONTRAST`, `CHART_TEXT_TARGET`          | 3, 4.5, 7 (contrast)                                                               | `chart-ink.ts`: series floor and target (WCAG 1.4.11); a chart's text floor (AA) and target (AAA); spec "Charts adapt as they are drawn" |
| `CHART_INK_MEMORY`                                                         | 512 adapted colours; safe 64 to 4096                                               | `chart-ink.ts`: the render-time cache, cleared when full                                                                                 |
| `GRADIENT_SAMPLES`                                                         | 5 points across the element                                                        | `page-ink-ground.ts`; D84                                                                                                                |
| `INK_SEARCH_STEPS`, `INK_REFINE_STEPS`                                     | 20 steps of 0.05, then 8 halvings                                                  | `page-ink-contrast.ts`: the least change to within 0.0002                                                                                |
| `PAPER_TONE`                                                               | `#ffffff`                                                                          | Spec "Re-inking": the paper as printed                                                                                                   |
| Ink memory `MAX_TABS`                                                      | 20 tabs                                                                            | `apps/live/lib/page-ink-memory.ts`; D85                                                                                                  |
| `WIDE_RATIO`                                                               | 1.15                                                                               | `page-layout-kit.ts`; spec "Layouts" tall / wide                                                                                         |
| `LARGE_PX`, `FIGURE_MAX_CHARS`, `ROW_TOLERANCE`                            | 32 px (the large size), 12 chars, 4 px                                             | `page-layout-carry.ts`; spec "Content carries over", D86                                                                                 |
| `MIN_SHRINK`, `GLYPH_WIDTH`, `BOLD_GLYPH_WIDTH`, `LINE_HEIGHT`             | 0.4, 0.55, 0.6, 1.25                                                               | `page-layout-carry.ts`; spec "Words fit their new place", D86                                                                            |
| `REFERENCE_BOXES`                                                          | 760 x 1075 and 1700 x 956 px                                                       | `page-layout-carry.ts`: the boxes every layout's placeholders are gathered from, D86                                                     |
| `TITLE_FILL`, `GLYPH_WIDTH`                                                | 0.72, 0.6                                                                          | `page-layout-kit.ts`; D26                                                                                                                |
| Panel `WIDTH`, `GAP`                                                       | 304 px, 6 px                                                                       | `PagePanel.tsx`; D27                                                                                                                     |
| `PAGE_EASE_MS`                                                             | 200 ms                                                                             | Editor modes "Turning, adding and deleting animate"                                                                                      |
| `COG_ROOM`, `LABEL_MIN`                                                    | 32 px, 40 px                                                                       | `page-title-bar-room.ts`; spec "The label fits its page" (40); D28 (32)                                                                  |
| `INVITE_WIDE`, `INVITE_ICON`                                               | 150 px, 30 px                                                                      | `CanvasPages.tsx`; D28                                                                                                                   |
| `DECK_ROOM`, `DECK_LABELLED_ROOM`, `NOTES_ROOM`, `NOTES_LABELLED_ROOM`     | 28, 112, 28, 88 px                                                                 | `PageDeckButton.tsx`, `PageNotesButton.tsx`; each button and its gap, icon or named                                                      |
| `BACKGROUND_ROOM`, `BACKGROUND_LABELLED_ROOM`, `POPOVER_WIDTH`             | 28 px, 104 px, 304 px                                                              | `PageBackgroundButton.tsx`; the button and its gap (icon, or named); panel `WIDTH`                                                       |
| `LETTERBOX_SPREAD`                                                         | 100 000 canvas px                                                                  | `CanvasPages.tsx`; spec "A page slide presents full screen", D79                                                                         |
| `THUMB_W`                                                                  | 120 px (a tile outside the gallery; the gallery sizes its own from its columns)    | `layout-thumb.tsx`; D29                                                                                                                  |
| `DRAG_THRESHOLD`                                                           | 6 px                                                                               | `usePageReorderDrag.ts`; spec "Drag a page's label"                                                                                      |
| `VIEW_GLIDE_MS`                                                            | 280 ms                                                                             | `../packages/workbench/src/lib/viewport-glide.ts`; spec "The page navigator"                                                             |
| `LAST_PAGE_SETTLE_MS`                                                      | 400 ms                                                                             | `apps/live/lib/last-page.ts`; spec "Back to the page you were on"; D87                                                                   |
| `LAST_PAGE_MAX`                                                            | 200 tabs                                                                           | `apps/live/lib/last-page.ts`; about 20 KB of local storage; D87                                                                          |
| `NOTICE_GAP_MS`                                                            | 2500 ms                                                                            | `page-lock-guard.ts`; the locked-page notice at most this often, D80                                                                     |
| `PAGINATE_CLUSTER_GAP`                                                     | 120 px                                                                             | `paginate.ts`; spec "Into pages"                                                                                                         |
| `LANDSCAPE_RATIO`                                                          | 1.1                                                                                | `paginate.ts`; spec "Into pages"                                                                                                         |
| `EXPORT_PAPER`                                                             | `#ffffff`                                                                          | `export-page.ts`; spec "Export"                                                                                                          |
| `PAGE_IMAGE_OVERLAY_MAX`                                                   | 0.9                                                                                | `page-image.ts`; spec "Image backgrounds" (Strength 0% to 90%)                                                                           |
| `PAGE_IMAGE_DEFAULT_STRENGTH`                                              | 0.6                                                                                | `page-image.ts`; spec "A picture is readable by default"                                                                                 |
| `PAGE_IMAGE_LIGHT`, `PAGE_IMAGE_DARK`                                      | `#ffffff`, `#0f172a`                                                               | `page-image.ts`; the Light and Dark washes                                                                                               |
| `PAGE_IMAGE_UNKNOWN_TONE`                                                  | `#808080`                                                                          | `page-image.ts`; a picture whose tone was not sampled                                                                                    |
| `PAGE_IMAGE_TONE_SAMPLE`, `TONE_TIMEOUT_MS`                                | 16 px, 4000 ms                                                                     | `page-image-tone.ts`; spec "Tone and ink"; a slow picture reads as mid grey                                                              |
| `STRENGTH_STEP`                                                            | 5 (%)                                                                              | `page-background-image.tsx`; spec "Overlay"                                                                                              |
| `PT_PER_PX`                                                                | 0.75                                                                               | `export-tab-pdf.ts`; spec "Export"                                                                                                       |
| Hover preview layer                                                        | `z-[1]` over the element layer                                                     | `PageLayoutPreview`; D30                                                                                                                 |

## Data and persistence

- `Tab.pages?: Page[]`, in row order, stored with the tab (synced and saved as any tab
  field). Absent: one page in the legacy `pageOrientation` (Editor modes "The pages"), its kind
  unchosen.
- **Parsing** (`parsePage`, `parseFill`, `parseBackground`, private to `page.ts`):
  - no string `id` or no valid `orientation`: the page is skipped;
  - `size` kept when a `PageSizeId` other than `'a4'` (A4 is stored as absent); `'fit'` only on a
    page with valid `fit` sides (`parsePageSides`: both finite and positive, rounded,
    clamped to `FIT_PAGE_MIN_SIDE`..`FIT_PAGE_MAX_SIDE`), else read as A4 with no `fit`;
  - `rowAt` kept when both `x` and `y` are finite (rounded); `withOneRowAnchor` keeps it on the
    first page carrying it and drops it from any other;
  - a fill kept when `solid` with a 3- or 6-digit hex `color`, or `gradient` with hex `from` / `to`;
    a gradient's `angle` defaults to 180 when not a finite number and is normalised to 0..359;
  - an `image` fill kept by `parsePageImageFill` when `isPageImageId(imageId)` (a gallery id
    `/^[A-Za-z0-9_-]{1,128}$/`, or a `data:image/(png|jpeg|gif|webp);base64,` URI); `tone` kept when
    a 6-digit hex; `overlay` kept when its kind is one of `PAGE_IMAGE_OVERLAY_KINDS` with a finite
    `strength` (clamped to 0..`PAGE_IMAGE_OVERLAY_MAX`, rounded to 0.01) and, for `tint`, a 6-digit
    hex `color`; `position` kept when `top` or `bottom`; `credit` kept when `isImageCredit`;
    `preview` never kept;
  - `pattern` kept when one of `PAGE_PATTERNS`; a background with neither fill nor pattern is
    dropped;
  - `name` trimmed and cut to `PAGE_NAME_MAX`; empty is dropped;
  - `kind: 'logo'` read as the `logo` size, portrait, its fill kept unless a picture, and no pattern
    ([Logo pages](logo-pages.md)); `'wireframe'` and `'photo'` as their specs say; anything else (a
    stored `infographic`, `slide` or `article` page included): no kind (a blank page), its size kept
    only when it is `a4` or a valid `fit`;
  - the `logo` size on any page but a logo page is read as A4 (`logoOnly`);
  - `locked` and `startedBlank` kept only when `true`;
  - a repeat of an id already read is skipped; at most `MAX_PAGES` are read.
- Writes keep the same shape: `size: 'a4'`, an empty name and an empty background are deleted, not
  stored (`setSize`, `rename`, `setBackground`); a size set away from `'fit'` deletes `fit`.
- Layout: `layOutPages` centres the first page on `rowAnchorOf(pages)` (the origin when
  no page carries `rowAt`); `pageDimensions` reads `fit` for a `'fit'` page.
  `withPages(tab, next)` hands the current anchor to `next[0]` when no page of `next`
  carries one (`withRowAnchorKept`), so deleting the carrier keeps the row in place.
- `Slide.pageId?: string` (design presentation blob): a page slide; `isSlide` rejects an empty or
  non-string `pageId`. `elementIds` is `[]` on a page slide.
- No migration: every new field is optional and absent on old data; old pages parse unchanged (as
  blank pages, their row on the origin).
- The page you were last on, per person (`lib/last-page.ts`, local storage key
  `livedesign:v2:last-illustrate-page`, `{ [lastPageKey(designId, tabId)]: pageId }`,
  the key `<designId>:<tabId>` so a tab id repeated across designs never borrows another's
  page, the latest `LAST_PAGE_MAX` = 200 entries, a re-recorded entry moved to the most
  recent, an unchanged write skipped). Read through `safeJson`; a malformed value or a non-string
  entry reads as absent. Not a synced preference (capped at 4 KB) and never in the design.

## Behaviour and state

### The view (`usePagesMode`)

Returns null outside a page look (`hasPageLook(mode)`), else `PagesModeView`:
`pages` (laid out), `rowPages?` (the whole row while a page slide presents, `presentedPages`),
`focusPage(id)` (frames one page whatever its kind: `computeFitBelow` of
`pageFitBox(page)` below the Toolbar strip), `panFrom?` (a finger's pan from the view
now; stops a glide), `themeBackgrounds`, `themeAccent`, `tabFont`, `layoutPreview` / `setLayoutPreview` (state held here so the
clip and the overlay share it), and `edit` (absent for a viewer or a locked tab).

On `[on, tabLoaded, tabId]` a frame later `centre()` (`frameLanding`: the remembered page, else
the first, at once); `frameFirstPageRef` is handed the same `frameLanding` for the tab-entry fit
(`useTabEntryEffects`). Back to the page you were on: `useLastPage` (given `designId`
and the viewport store by `useEditorState`) subscribes to the store in a layout effect while on
with two pages or more; each view change restarts a `LAST_PAGE_SETTLE_MS` timer, whose
end writes `pageNearestPoint(pages, computeViewportCenter(canvas size, offset))` under
`lastPageKey(designId, tabId)`. Nothing is written until `frameLanding` has armed the
key (the view before it may be the last tab's). A pending timer is flushed on the effect's cleanup
(a tab switch: a layout cleanup, so before anything frames the next tab) and on `pagehide`. On
`[on,
tabLoaded, tabId, canEdit]` `putOnAPage()` (Into pages, below), its own effect so an editor role
resolved after the load still gets the page. After `onGoTo(id)` (add, duplicate, a turn or a new
size, the page before a deleted one, the first page of a split) the hook frames that page once it
is in the row (`goTo` state, consumed in a `requestAnimationFrame`), gliding there
(`glideViewport`, `VIEW_GLIDE_MS`; instant under reduced motion), as `focusPage` does.

### Resting on a page (`usePageSnap`, `pageSnap`)

`usePagesMode` composes `usePageSnap` while on, handing it the laid-out `pages`, the viewport store,
`measure()` (the canvas's `offsetWidth`/`offsetHeight`, `topStripInset`, `sideChromeInsets`, as a
`SnapBand` of `{ left: sides.left, right: width - sides.right, top: inset, bottom: height }`),
`fitOf(page)` (`frameFor`: the same `computeFitBelow` + `besideSideInsets` as `focusPage`),
`glideTo` (`glideViewport` through the hook's one `glide` ref, so any later frame or a gesture
cancels it), `cancelGlide`, and `suspended` (`snapSuspended`: `useEditorState` passes
`presenting || followingRef.current !== null`).

- **Triggers**: `subscribeCanvasGesture`. Idle to open: clear the rest timer, cancel a glide, take
  `from = pageInView(...)` beside the band, reset `panned` and the samples. Any `'pan'` sets
  `panned`. Open to idle: snap a frame later with `swipe = panned`, or, with a pointer still held,
  owe it to the last pointer's release. While a gesture is open each viewport change pushes
  `{ t, x: offset.x * zoom }` (kept to the last 16 of 32); while idle each change restarts a
  `VIEW_REST_MS` timer that snaps without a swipe. Window capture `pointerdown` adds the pointer and
  clears the timer; `pointerup` / `pointercancel` removes it and, the last one gone, settles what was
  owed or restarts the timer; `blur` and `visibilitychange` forget held pointers.
- **Snap**: nothing while `suspended()`, a gesture is open, or a pointer is held. `pageSnap` picks
  `pageInView` beside the band; with a swipe (`from`, `velocity = flickVelocity(samples, now)`),
  when `from` is still that page and seen whole (`zoom <= fit x SNAP_FIT_TOLERANCE`), the band's
  middle `SNAP_SWIPE_FRACTION` of its width from the page's middle, or `SNAP_FLICK_MIN_PX` with the
  content moving at `SNAP_FLICK_PX_PER_MS` the same way, turns to `pages[index +/- 1]` (none past
  either end). At or under `fit x SNAP_FIT_TOLERANCE` the frame is `fitOf(page)`; above, the zoom is
  kept and `clampAxis` holds each axis: centred when the page spans no more than the band less
  `2 x SNAP_EDGE_ROOM`, else its near edge within `[bandEnd - room - span, bandStart + room]`. A frame
  within half a screen px and `1e-4` of zoom is null. A swiped result sends `UI · Used · PageSwipe`;
  every snap logs `[page] snapped`.
- **The sidebar's resting place**: `sideChromeInsets` and the sidebar's own `readHere` measure
  `restingRect(el)`: its bounding rect less its computed `translate` (`translateOf`, px only), so
  the frame on a side change, a frame after the drop while the sidebar slides home, centres beside
  where it lands.

### Edits (`pageEdits`)

Every edit is one `commitTabs` call that re-reads the tab at commit time (refused by `mayEdit()`
or a locked tab) and runs its pure edit from `pages-edits.ts` (`edited(t, pageX(t, ...))`:
the next tab, or no change when refused or unchanged); the panel's checks, telemetry and logs sit
in front of it. `pagesSharing(pages, id)` is the page a page-wide change reaches.

- `setOrientation`, `setSize`: `pageTurned` / `pageResized` (`reshaped`:
  every page in `pagesSharing` patched; a blank or wireframe page: ids = `elementIdsOnPage` before,
  `withPages`, then `withContentFittedToPage(tab, ids, pageId)`), then `onGoTo(id)` to
  frame the page in its new shape.
- `rename(id, raw)` (`pageRenamed`): trimmed, cut to `PAGE_NAME_MAX`; a no-op when unchanged; that
  page only.
- `setBackground(id, patch)` (`pageBackgroundSet`): a pattern on a logo page is refused (log
  `pattern refused: a logo page`); a no-op when it changes nothing (`sameFill`, same pattern);
  else `withBackgroundPatch` on every page in `pagesSharing` (`pageBackgroundStored`, which answers
  the pages to re-ink); when the patch carries `fill`, `pagesInkFor(tab, inks, memory)` over them
  in one walk, in the same commit, threading the tab's
  session memory (`pageInkMemory(tabId)` in, `rememberPageInk(tabId, memory)` out; log
  `re-inked` with the count). `previewInk(preview)` shows the re-ink, memory included, as a local
  drag preview (`setLocalPreview`), cleared with the preview. An AI tool's `pageBackgroundSet`
  passes no memory.
- `movePageTo(id, unitIndex)` (`pageMovedTo`, clamped to the row), `movePage(id, ±1)`,
  `canMove(id, ±1)`: over units (`pageUnits`: one per page), `withUnitMoved`;
  content follows its page.
- `addPage(kind, device?)` (absent at the limit, `pageAdded`), `nextPageId(current)`: a `kind` other
  than `tabPageKind(current)` (any, on a blank tab) is refused (`kind_not_offered`, no edit, log `add
refused: another kind`);
  `'logo'` as in [Logo pages](logo-pages.md), `'wireframe'` as in [Wireframe pages](../wireframe-pages.md),
  `'photo'` as in [Photo pages](../../031-photo/photo-pages.md); `addPageLike(id)` (`pageAddedLike`) adds
  one like a page, refused for a blank page and for a page not of the tab's kind; `addPhotoPage(after,
size?)` (Edit as Photo) is absent unless `tabPageKind(current) === 'photo'`; then
  `onGoTo(id)`. Telemetry `KIND_ADDED_EVENT` (`LogoPageAdded`, `WireframePageAdded`,
  `PhotoPageAdded`).
- `choosePageKind(id, kind, device?)`: `withPageKindChosen` (null once the page no longer offers
  the choice).
- `duplicatePage(id)` (absent at the limit, `pageDuplicated`; the button also asks
  `canDuplicate(id)`, false at the limit): `withDuplicatedPage` with `crypto.randomUUID` element
  ids, framing the copy.
- `removePage(id)` (always present; refused on a locked page): with one unit left it clears the
  tab (`elements: []`, `pages: []`, one commit),
  `restoreEmptyCard(startClosedKey(tabId, 'pages'))` so Start Making Pages comes back, log
  `last page removed`; else `onGoTo` the page before it (the next when the first goes), then
  `pageRemoved`: `withPageContentReplaced(tab, id, [])` then the page list without it. (`pageRemoved`
  itself refuses the last unit, `last_page`, the agents' rule.)
- `applyLayout(id, layout)` (`pageLaidOut`): `withPageContentReplaced(tab, id,
buildPageLayoutOver(layout, page, elementsOnPage(tab.elements, pages, id)))`, then
  `onLayoutPlaced` (clears the selection). The agents' `layout` change keeps `buildPageLayout`
  alone (a plain replace).
- `startBlank(id)`: sets `startedBlank: true` (a logo page's Start From Scratch, [Logo
  pages](logo-pages.md)); the page's own lock refuses it.
- `contentCount(id)`: `elementIdsOnPage(elements, laidOut, id).size`.

### Re-fit (`withContentFittedToPage`)

Bounds of the given ids (boxes, free arrow ends). `s = min(1, roomW / w, roomH / h)` against the
margin box. Scaled (`s < 1`) or `centre`: the content's centre goes to the page's centre; else it
keeps its place. Then nudged so its scaled half-extents sit inside the margin box (centred when it
cannot). Boxes map position and size; text elements also multiply `textScale` by `s`; free arrow
ends map; pinned ends follow. Returns the same tab when nothing moves.

### Carried content (`carryPageContent`)

`carryPageContent(previous, placed)` returns `placed` (same ids and order, so pinned arrows hold)
with content copied in; geometry and look are always the placed element's.

- Placeholders: built once (`placeholders()`, memoised in the module; warmed by
  `warmLayoutPlaceholders` through `prefetchWhenIdle` when a `LayoutGallery` mounts) from every
  `PAGE_LAYOUTS` and `LOGO_LAYOUTS` entry in each `REFERENCE_BOXES` box: every text
  label (trimmed) and every shape's `contentKey` (`[shape, SHAPE_CONTENT fields]` as JSON).
- Words: `previous` texts whose trimmed label is not a placeholder, and every `placed` text, sort
  into roles (`byRole`): `figure` when `isFigure(label)` (at most `FIGURE_MAX_CHARS`, a digit, no run
  of three letters); else `title` for the page's most prominent word text (largest `typePx` =
  `LABEL_FONT_PX[textSize] x textScale`, topmost on a tie; decided over all of the page's texts, so a
  placeholder title keeps the role) when at least `LARGE_PX`; else `large` when at least `LARGE_PX`;
  else `body`. Each role pairs in reading order (`readingOrder`: top, then left within
  `ROW_TOLERANCE`). Leftovers walk `ROLE_FALLBACK` (`title` to large, body; `large` to body, title;
  `body` to large, title; `figure` none), taking the next free slot.
- `withWords(slot, from)`: the slot with `from.label`, and `from.richText` (or none); `textScale`
  multiplied by `fitShrink`: 1 when the estimated wrapped height fits (`lines x px x LINE_HEIGHT`,
  a line's glyphs at `GLYPH_WIDTH` or `BOLD_GLYPH_WIDTH` of px), else the largest factor in
  [`MIN_SHRINK`, 1] that fits (12 bisection steps), rounded to 0.01.
- Pictures: `previous` images with an `imageId`, largest area first, into `placed` images largest
  first: `IMAGE_CONTENT` (`imageId`, `naturalWidth`, `naturalHeight`, `credit`, `alt`) and
  `objectFit: 'cover'`.
- Shapes: `previous` shapes with content (`hasContent`: a non-blank string or any value in
  `SHAPE_CONTENT`) and a non-placeholder `contentKey`, in reading order, each into the next free
  `placed` shape of the same `shape` kind: its `SHAPE_CONTENT` fields.
- Everything else (arrows, unmatched elements, other types) is not carried.
- The hover preview (`PageLayoutPreview`, given `view.elements` and `view.pages`) builds
  `buildPageLayoutOver` in a `useMemo` on the layout, the rect and the content, and resolves carried
  pictures through `useImageSources(ids)` (`page-image-access.tsx`; `usePageImageSources` is it over
  the pages' background ids), `data:` ids painted as they are.

### Into pages (`withContentOnAPage`, `withPageSplit`)

- `pageAround(box, id)`: a blank page (no `kind`), landscape when wider than
  `LANDSCAPE_RATIO` x its height; A4 (no `size`) when the box fits A4's margin box that way round;
  else `size: 'fit'` with `fit` = the box plus `m` all round, where `m` starts at
  `ceil(min side x 0.07)` and grows to the page's own `pageMargin` until it holds (or a side reaches
  `FIT_PAGE_MAX_SIDE`, where the content runs off, unscaled). Never sets `rowAt`.
- `withContentOnAPage(tab)` (entering the mode): no elements: null. The content box is the union of
  every element's bounds (an arrow by its resolved ends).
  - No `pages` stored: null when the box lies inside the first page (1 px slack); else one page
    `pageAround(box)` with `rowAt` the box's centre (rounded). Elements are returned as they are
    (same array); `pageOrientation` dropped.
  - `pages` stored: null when any page has been made something of (`locked`, a `kind`,
    a `name` or a `background`), or any element's anchor point
    (`elementAnchorPoint` over `elementIndexFor`, linear) is on a page; else the stored pages are
    replaced by that one page.
  - Run by `usePagesMode` `putOnAPage` when an editor opens the tab (unlocked; a no-op once a page
    is stored), one `commitTabs`, toast "Put onto a page that fits it. Undo takes the page away.";
    `track('Tab', 'Changed', 'PageFitToContent')`; log `[page] content put onto a page`.
- `withPageSplit(tab, pageId)` (Split Into Pages): null unless the page exists, is `'fit'` and
  unlocked, and its content (`elementIdsOnPage`) makes 2 or more clusters. Room =
  `min(MAX_PAGES - (pages - 1), PAGINATE_MAX_PAGES)`, null under 2; clusters past the
  room merge into the last. Each cluster gets `pageAround(its box, nextPageId)` with the
  split page's `background` and its `name` (the first as is, the rest `"<name> <n>"`, the name cut to
  `PAGE_NAME_MAX - 4` first); the new pages replace the
  page in the row through `withPages` (the split page's content stays put, later pages
  move with theirs, the anchor is kept), then each cluster goes onto its page with
  `withContentFittedToPage(..., { centre: true, keepSize: true })`: moved, never scaled.
- `contentClusters`: union-find over pinned arrow ends and pairs of bounds within the gap (edge to
  edge, O(n²) on the split page's content, run once per press); reading order by rows
  (`top < row's first bottom`) then x.
- `splitPage(id)` (`page-edits.ts`): refused on a locked page (log `refused: page
locked`); at `MAX_PAGES` refused with the toast "A tab holds at most 100 pages: delete
  one to split this page." (log `split refused: page limit`); null from `withPageSplit`: toast "This page is one group: nothing to split.", log
  `split: one group`; else `PagesLaidOut`, toast "Split into n pages. Undo puts it back.", the view
  goes to the first new page, log `page split`.
- `setSize(id, 'fit')` is refused (log `size refused: fit to content`), as is any size outside
  `pageSizesFor(pageKindOf(page))` (log `size refused: not offered for the kind`).
- `refusedLocked(id, edit)`: the page's own lock refuses (`pageLockRefuses`).

### Surfaces and ink

- `elementPageSurfaces(elements, pages)`: an element's page by its anchor point; only pages with a
  fill are entered. `PageClip` wraps the element views in `PageSurfacesProvider`, whose
  value keeps its identity while the entries do (keyed on `id:surface` pairs).
- `useElementSurface(id)`: the page's surface, else the canvas's; used by `BoxedElementView`,
  `TableView`, `useBoxedElementAnimation`, `ArrowView`, `ElementFaceRouter` (the faces' own fills and accents).
- Re-inking (`pageInkFor`, spec "Re-inking"; `pagesInkFor` for several pages, which lays out the
  pages, indexes the elements and sorts them onto their pages once, then inks each page in `inks`
  order with one memory, pruned once at the end): the page's elements in paint
  order (`layerBands(..., { includeHidden: true })`), anchors precomputed over `elementIndexFor`.
  Each element's ground is the topmost earlier **cover** whose box holds its anchor, else
  `pageGroundUnder(background, page.rect, box)`; a cover of unknown tone (`null`) leaves the
  element alone. `inkKindOf(el)`:
  - `ink` (text, arrows, open paths and sketches, line-art icons, actor, progress, rail, rating,
    process, charts): `strokeColor` as `line` (an arrow's as `text` when labelled with no `textColor`;
    not a chart's), `arrowheadColor` as `line`, `textColor` as `text` (a text element always,
    others when labelled), all against the ground's `tones`.
  - `box` (`BOX_KINDS` shapes, stat rows, closed paths and sketches, annotations): no drawn fill
    (`boxFill` null) is an outline: `strokeColor` as `line`, label as `text`. A fill of its own is a
    `card` when labelled or holding a later element's anchor (`holdsAny`), else a `mark`; a card is
    measured against the ground's `mean`, a mark against its `tones`; a border (`boxBorder`: not
    `strokeWidth: 'none'`, own or default stroke) at its floor keeps the fill (`restore`: the
    recalled author fill back). A stat row's `strokeColor` (figures) and `textColor` (captions)
    are `text` on its fill. Otherwise the label is `text` against `labelFill` (the fill as
    re-inked); the box becomes a cover in that fill.
  - `table`: `strokeColor` `line` on the ground; `textColor` on its own fill else the ground;
    `headerTextColor` on `headerFill` else that; a filled table is a cover.
  - `keep`: sticky and link card (a cover in their fill), image, video and every other shape kind
    (a `null` cover), Technology icons and emoji (no cover).
- A field (`field`): only a `#rrggbb` (`isOpaqueHex`) is read. Its base is the recalled `from` when
  the recall's `to` equals it, else itself; `inkToward(base, tones, floor, target)` from
  `INK_ROLE_CONTRAST[role]`; the result `=== base` drops the recall, else records
  `{ from: base, to: next }`. The memory drops ids not on the tab (`memoryFor`).
- No colour of its own (`UNSET`, the empty string, as a recall's `from`): judged (`onCard`) on a
  cover whose `canvasSurface` differs from the page's (`fresh` is the card surface's default), and
  straight on a page with a fill whose ground tones are not all `PAPER_TONE` (`fresh` is the
  page's own default, `drawn` too); on the plain paper, a white fill and a cover of the page's own
  lightness it is not judged. It covers a text element's or label's `textColor`
  (`defaultTextColor`), an ink kind's and an unfilled box's `strokeColor` (`defaultStrokeColor`),
  an unfilled box's label, an arrow's `strokeColor` (`defaultArrowStrokeColor`, read only when a
  hex), and the label of a box with a fill of its own; never with a `penColour` /
  `penTextColour`. The page's ink (`drawn`) at its floor stays unset; else `inkToward(fresh)` is
  written. A patch value of `undefined` deletes the field (back to unset).
- `inkToward`: unchanged at or over `floor`; else, toward white (`tint`) and toward black
  (`shade`), the least amount whose `worstContrast` reaches `max(floor, target)` (20 even steps,
  then 8 halvings in the first passing step); the smaller amount wins (a tie goes lighter); when
  neither reaches it and `target` is over `floor`, the same search for `floor`; when neither
  reaches that, the end with the higher worst contrast.
- `pageGroundUnder`: paper `PAPER_TONE`; solid and image `pageFillTone`; a gradient's box corners
  placed by `gradientPosition` (CSS angle: direction `(sin a, -cos a)`, line length
  `|w sin a| + |h cos a|`, clamped 0 to 1), `GRADIENT_SAMPLES` `mixHex` tones across `[lo, hi]`
  (deduplicated) and the mean at `(lo + hi) / 2`. An image fill's tone comes from
  `pageImageTone` through `pageFillTone`: the image background work owns that estimate.
- `legibleOn(color, tone, floor)` stays for single-tone callers (image
  placeholders): tints or shades in steps of 0.1 from 0.2 until `PAGE_INK_CONTRAST`.

### Image backgrounds

- Category: `BackgroundSection` offers `['solid', 'gradient', 'image']`, `['solid', 'gradient']` on a
  logo page; `backgroundCategoryOf` answers `'image'` for a picture. The Image category is
  `ImageBackgroundChoices(page, accent = themePresetAccent(themePresets), onPick, onPreview)`;
  `onPick(fill)` is the section's `onBackground({ fill })` (one `setBackground`, so the re-inking of
  "Surfaces and ink" runs in the same commit), `onPreview(fill | null)` its preview store.
- Access: `Canvas` wraps `CanvasPages` in `PageImageAccessProvider access={props.imageContext}`;
  without it the category says "Pictures are not available here." and a sheet paints the tone.
- Without a picture: `ImageSearchPane` with `filters = pageImageFilters(page)` (`pageDimensions`:
  equal sides `square`, wider `wide`, else `tall`; `size: 'large'`), `columns={3}`,
  `autoFocus={false}`, `onPreview`, `onPicked`; then a hidden file input (`UPLOAD_ACCEPT_ATTR`)
  behind **Upload an Image** (`Uploading…` while busy; an `ImageUploadError`'s message, else
  "Upload failed.", in the rose error box). With one: `CurrentPicture` (a strip from
  `useImageBlobUrl`, **Remove** = `onPick(undefined)`), `ImageCreditRow` when `credit`, **Overlay**
  tiles (None, Light, Dark, Tint, Fade; a sample sky under each), **Strength** (`MenuSliderRow`
  0..90 step 5, preview on change, one commit on release when changed; absent for None),
  **Position** tiles (Top, Centre, Bottom; Centre deletes `position`), then **Replace Image** (local
  `replacing` state) revealing the search and upload under a Replace Image heading; landing a
  picture closes it.
- The overlay a new picture takes: the page's, else `defaultPageImageOverlay(useCanvasSurface() ===
'dark')`. A Tint takes the overlay's own colour when already a tint, else `accent`; a kind change
  keeps the strength.
- A hovered result previews `{ kind: 'image', imageId: current ?? 'preview', preview: thumbnail,
overlay, position }`; leaving the grid previews null.
- Landing (`land`): `tone = sampleImageTone(thumbnail, or the file's object URL) ??
storedTone(imageId)` (the stored bytes, by `apiFetchImageBlobUrl` or the inline URI), then
  `onPick({ kind: 'image', imageId, tone?, overlay?, position?, credit? })` and
  `track('Tab', 'Changed', 'PageBackgroundImage')`.
- Sheet paint: `CanvasPages` calls `usePageImageSources(pages)` once and passes it to
  `pageSheetStyle(background, ruling, resolve)`: layers top to bottom the pattern, the overlay
  (`pageImageOverlayCss`, `100% 100%`), the picture (`pageImageCssUrl(pageImageSrc(fill,
resolve))`, `cover`, `pageImagePositionCss`, `no-repeat`), over `backgroundColor` = the raw tone.
  `pageImageSrc`: `preview`, else an inline URI, else the resolved blob URL.
- `usePageImageSources`: the sorted gallery ids of the pages' picture fills as a key; each new id
  fetched once with `apiFetchImageBlobUrl` (owner, design, share code), dropped ids revoked; an
  access change revokes all and starts over; unmount revokes all.
- `fillCss` of a picture is `pageImageTone(fill)` (swatches, the check's ink).
- Offline Mode: `tabImageIds(tab)` (`lib/offline/offline-images.ts`) lists the pages' pictures with
  the elements'; `rewriteImageIds` re-homes both (`withPageImageIds`); Take Offline refuses while
  any stays a gallery id.

### Locking a page

- Data: `Page.locked?: true` (`packages/design/src/page.ts`), parsed for every
  kind; `withDuplicatedPage` and `withArticleDuplicated` drop it from a copy.
- `packages/design/src/page-lock.ts`: `elementsOnLockedPages(elements, laidOutPages)` (centre by
  `elementBounds`, arrows resolved) and `guardLockedPages(prev, next, prevPages, nextPages)`:
  while the pages' layout and locks are unchanged, an element held by a locked page whose place
  (bounds and rotation) changed gets its previous `x`/`y`/`width`/`height`/`rotation` back (look
  fields pass), a new element landing on one is left out, and an existing one moved onto one is put
  back; deletions pass; `blocked` reports it.
- `apps/live/lib/page-lock-guard.ts`: `guardLockedPagesIn(prevTabs, nextTabs, guard)` in
  `useEditorState`'s `commitTabs` before layer stamping and in its `tickTabs` (a `useCallback` over
  the history's tick: drag landings, nudges, resizes), for `pageLockGuardRef` (the active tab
  while Pages mode's pages exist); `onBlocked` defers `announcePageLocked` (a toast at most
  every 2.5 s) with `queueMicrotask`, the guard running inside a state update.
- Inert: `usePageLockedIds(elements, pagesMode?.pages)` (`hooks/editor/usePageLockedIds.ts`)
  feeds `useLayersState`'s `extraInertIds`, joining `layerInertIds` (selection, marquee, select-all,
  pruning).
- Edits (`page-edits.ts`): `isLocked`, `setLocked` (`Tab · Changed · PageLocked /
PageUnlocked`, tracked before the change); rename, orientation, size, background, layout, kind
  and delete are refused for a locked page (`[page] refused: page locked`).
- UI: `PageLockButton` (`components/canvas/PageLockButton.tsx`) before the cog, named for its
  press ("Lock page" / "Unlock page", no `aria-pressed`), its room `pageLockRoom(locked, !mobile)`;
  the title bar's fixed room (cog, lock, deck button, logo buttons, Background button) is taken before the invite
  chooses its wide or icon form; a locked page shows no layout invite, card or kind choice. The
  panel (`PagePanel`) shows a `role="status"` notice and renders its name and sections
  `inert` at 50% opacity; Delete page is disabled.

### Panel, previews, reorder

- Background section (`apps/live/components/canvas/page-background-section.tsx`): a `Background
kind` radiogroup (`BackgroundKinds`, `page-background-kinds.tsx`: one `tileClass` tile per offered
  category, `data-background-kind`, a 36 x 24 px sheet painted by `kindPreview(kind, fill, current, accent,
themeGradient)`: the page's `fillCss` on its own category's tile, else Solid the accent at 20% alpha,
  Gradient the theme's `theme-bright` preset, Image `IMAGE_STAND_IN` under `lucideImage`, Animated the
  theme gradient under `lucideSparkles`; the name under it), opening on `backgroundCategoryOf(fill, themePresets)` and holding a chosen category
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
- Panel opened from a cog (tab Page, or the page's first) or the invite (tab Layouts); `opened = { id, cog, tab }` in
  `CanvasPages`. Desktop: fixed, beside the cog when it fits (`a.right + GAP + WIDTH + EDGE
<= innerWidth`), else right-aligned under it; re-placed on resize and `PAGE_EASE_MS + 20` after
  the page's rect changes. Mobile (`useIsMobileViewport`): `BottomSheet`.
- Closes: outside pointerdown (`useClickOutside`, the trigger whitelisted by
  `[data-page-panel-trigger]`), Escape (capture; restores focus to the cog), a wheel outside it.
- Background preview: a shared store (`page-background-preview.ts`), set by the panel through
  `CanvasPages`; each sheet paints `previewedBackground(page, preview)`; `PageClip` inks elements with
  `withPreviewedBackgrounds`; `edit.previewInk` shows
  own-coloured elements re-inked; cleared on leave, on commit and on unmount.
- Panel tabs (`pagePanelTabs(page)`): **Page** while `pageSizeChoices(page).length > 1 ||
pageHasOrientation(page)`, then a logo page's **Background** and
  **Layouts** (a wireframe page's one tab is **Device**); an initial tab the page lacks opens as its first. Leaving Background
  clears the background preview (`onPreview(null)`); leaving Layouts clears the layout preview.
- Layout preview: `view.layoutPreview` set on tile pointerenter / focus; the clip drops that page
  (`hiddenPageId`); `PageLayoutPreview` draws `svgBoxed` / `svgArrow` markup of
  `buildPageLayoutOver` (the page's content carried in) over the sheet. Cleared on apply and on
  unmount (through a latest-callback ref).
- Reorder: `usePageReorderDrag` on the label (`cursor-grab` only while `pageUnits(pages).length > 1`): pointer capture; with two or more units, past
  `DRAG_THRESHOLD` sideways it is a drag (`reorder = { pageId, pageIds, slot }`, `pageIds` the
  unit's pages, all dimmed); release calls `movePageTo(id, slot)`; the following click is
  swallowed (`endsDrag`); Escape cancels. `reorderSlot` = count of other units (`laidOutUnits`)
  whose centre is left of the dragged unit's centre (unit rect centre + screen dx / zoom); the
  marker sits in the gap between units.
- Bare sheets: `CanvasPages` `bare` (zen, presenting) drops `edit`,
  labels, the navigator and the first page's choice.

### Kinds, adding, getting around

- **Add a page**: `AddPageButton` is the + (after the last page, at `lastRight + max(GAP / 2,
(ADD_PAGE_SIZE / 2 + ADD_PAGE_CLEARANCE) / zoom)`, level with the last page's middle,
  `data-add-page-like`, named `addAnotherLabel(like)`), calling `onAddLike(like.id)`
  (`edit.addPageLike`), `like` being `lastPageOfTabKind(pages)`: the last page of the tab's kind, the
  last page itself unless a stored tab mixes kinds. `CanvasPages` renders it only while there is a
  `like` (none on a blank tab). There is no chooser of kinds: `AddPagePopover` is gone.
- **A screen of another device**: on a wireframe tab (`like.kind === 'wireframe'`) a smaller button sits
  under the + (`data-add-page-trigger`, **Add a Screen of Another Device**, `aria-haspopup="dialog"`,
  `aria-expanded`, brand-filled while open) toggling `AddScreenPopover`: desktop a `Portal`led list
  beside the button (right while there is room, else left), level with it, kept in the window;
  phone a `BottomSheet`. Rows per `WIREFRAME_DEVICE_GROUPS`, the remembered device
  (`lastWireframeDevice`) ringed and focused, Up / Down / Home / End cycle; a row
  `rememberWireframeDevice(device)`, `onClose(false)` then `onAddDevice(device)`
  (`edit.addPage('wireframe', device)`); Escape closes and refocuses the button; an outside press
  closes (the trigger whitelisted).
- **One kind a tab**: `tabPageKind(pages)` (`packages/design/src/page.ts`) = `pageKindOf(pages[0])`,
  `null` for a blank first page (or no pages); `pageAdded` refuses `kind_not_offered` when the tab has a
  page and `kind !== tabPageKind(pages)`, before the room check; `pageAddedLike` refuses it when the
  source's kind is not the tab's. `pageDuplicated` copies a page's own kind, so it passes. The first
  page's choice is the only change of kind (`withPageKindChosen`, one unchosen empty page).
- **First page's choice**: `CanvasPages` renders `FirstPageChoice` on a page when `edit`, not
  `bare`, not locked, and `offersPageKindChoice(pages, page.id, edit.contentCount(page.id))`; the
  layout invite is withheld meanwhile. Cards call
  `edit.choosePageKind(page.id, kind, device?)`. The card is scaled `1 / zoom` and centred on the sheet,
  stopping pointer and double-click propagation.
- **In-page layout card**: `EmptyPageLayouts` on every page `showsLayoutCard` passes
  (`layoutCardShows`, `page-layout-card.ts`): `layoutOfferShows` (`edit`, not locked, not
  `startedBlank`, not a wireframe's, empty, not offering its kind, its panel not
  open, not hidden: `layoutsHidden`, local state until the tab remounts; Hide tracks `UI · Closed ·
EmptyPageLayouts`) and `layoutCardSize(page, zoom)` (the page on screen less `LAYOUT_CARD_MARGIN`
  a side, capped at `LAYOUT_CARD_MAX_WIDTH` x `LAYOUT_CARD_MAX_HEIGHT`) at least
  `LAYOUT_CARD_MIN_WIDTH` x `LAYOUT_CARD_MIN_HEIGHT`. It renders `LayoutGallery` with no preview,
  `described` from `DESCRIBED_MIN_WIDTH`, its scroller `height - CARD_CHROME_HEIGHT` (less 48 px for
  a logo page's Start From Scratch); a press is `edit.applyLayout`.
- **Choose a Layout**: `EmptyPageInvite` on every page `layoutInviteShows` passes
  (`layoutOfferShows` and not `layoutCardShows`), scaled `1 / zoom` and centred; its press tracks
  `UI · Opened · EmptyPageInvite` and opens `LayoutGalleryDialog` (the shared `Dialog`, `size="3xl"`,
  `phoneSheet`, `initialFocus="container"`, no Change Theme, as the card) for the page, whose press
  or Surprise Me applies and closes.
- **Page navigator**: `PageNavigatorClusterStrip` in `CanvasChrome`'s bottom-right cluster, after
  `UndoRedoClusterStrip`, while not zen, not `isMobile` and `pagesMode.pages.length > 1`: `CLUSTER_STRIP`, 44 px
  previous / "n of m" / next (the place from `useCurrentPageId`, the first page before one is known),
  disabled at the ends; `onGo(id)` = `pagesMode.focusPage` (gliding); the palette follows the view.
- **The label** reads `pageLabel(page, index, count)`, ending in the kind.
- **Something in view**: `useOffscreenContent` unions the boxed elements' bounds with every page
  rect (`Canvas` passes `pagesMode.pages`), so the Fit nudge never shows while a page is on
  screen.

### Contents

- **Where**: `useContentsChrome` reads `readContentsPlacement(userPreferences)` and
  `readContentsSide(useLocalStorageValue(CONTENTS_SIDE_STORAGE_KEY))`; `contentsDocked` = Pages,
  chrome shown, not Zen, not `isMobile`, `'sidebar'`, and at least `CONTENTS_SIDEBAR_MIN_PAGES`
  pages. Docked, the cluster's `ContentsClusterSegment` is absent (`PagesClusterStrip` renders
  nothing with neither segment), an open `'contents'` popover closes, the corner stacks on its side
  take `[side]: contentsSidebarClearancePx(panelScale)`, and with the right side the bottom-right
  cluster's `right` adds `CONTENTS_SIDEBAR_WIDTH x panelScale`. The sidebar is `absolute`, `[side]:
0`, `top: toolbarTopClearancePx` (`lib/canvas-chrome.ts`), `bottom: 0`, opaque (no
  `data-panel-translucent`).
- **Choosing**: Minimise (`onMinimise`) and Dock as Sidebar (`onDock`, which first closes the
  popover) call `place(next)`: `track('UI', 'Changed', 'ContentsPlacementSidebar' |
'ContentsPlacementButton')`, then `writeUserPreferences(withContentsPlacement(readUserPreferences(),
next), ownerId)`; the editor follows the cache (`useEditorPreferences`). Settings' choice row
  `contentsPlacement` writes the same key. Dragging the header (`data-contents-handle`, pointer
  captured, presses on its buttons ignored) translates the sidebar by the pointer's travel and
  outlines the side under the pointer (the canvas's left or right half); release on the other side
  calls `onMoveToSide`: `track('UI', 'Changed', 'ContentsSideLeft' | 'ContentsSideRight')`, then
  `writeLocalStorageValue(CONTENTS_SIDE_STORAGE_KEY, side)`.
- **Framing**: `usePagesMode`' `frame` measures `sideChromeInsets(canvas)` (the sidebar's
  rect against the canvas: its left half covers the left to its right edge, its right half the right
  from its left edge; none under a fifth of the canvas tall; at most half the width), computes the
  fit (or reading frame) on the canvas less both and moves it with `besideSideInsets`.
  `useEditorViewport.fitToScreen` does the same. `fitPageInView` frames (gliding) the
  `pageInView` page beside the insets; the Fit button and Shift+1 call it in Pages. The
  sidebar frames the page in view on mount and on a side change (next frame, `focusPage`, measured
  at its `restingRect`), and Minimise reads it first and frames it two frames after the placement
  changes.
- **Here**: the popover opens on `pageInView` at the window's size; the sidebar opens on the first
  page, then on mount and `CONTENTS_FOLLOW_SETTLE_MS` after each viewport store change reads
  `pageInView(pages, view, canvas, sideInsetsOf(canvas, sidebar))` against its `offsetParent`.
  `pageInView` reads the centred transform (`w/2 - offset.x + (left - right) / 2zoom`).
- **Rows**: `role="option"` elements (`tabIndex` 0, Enter or Space goes there) so a row can hold
  buttons; the name line ends in the page's actions: `actionsFor(row)` (`usePageContents`) gives
  `duplicate` (`edit.duplicatePage`, `canDuplicate`, not at the limit), `toggleLock`
  (`edit.setLocked`) and `remove` (`edit.removePage`, not on a locked page), or null without
  `edit`. The sidebar's `PageToolbar` (opacity 0 until the row's `group` is hovered or holds focus,
  shown on the marked row and to a finger) and the popover's `PageMenu` stop pointer, key and click
  events from reaching the row (the portalled menu's still bubble through React).
- **Find**: `filterContents(rows, query, texts)` folds case and width (NFKC, lower case) and needs
  every word in the number, name, kind line or the page's words; `usePageContents` computes `texts`
  with `pageTexts` (`apps/live/lib/page-texts.ts`: one walk, each element to the page its anchor
  lies on via `rowPageAt`, its `elementFindTexts` from `@livedesign/design-views`) only while the query is not blank.
- **Add Page**: `ContentsAddPage` is one wide button (`data-contents-add`, **Add Page** with
  `lucidePlus`, its tooltip `addAnotherLabel(lastPage)`) that calls `addLike()`
  (`edit.addPageLike(lastPage.id)`), `lastPage` being `lastPageOfTabKind(pages)`; with no `lastPage` (a
  blank tab) there is no footer. On a wireframe tab a square button beside it
  (`data-add-page-trigger`, `data-contents-add-screen`, **Add a Screen of Another Device**,
  `aria-haspopup="dialog"`) toggles `AddScreenPopover`, whose `onAddDevice` is `add('wireframe',
device)`. The popover carries `data-floating-panel` and `data-menu-surface`, so a press in it stays
  inside an open Contents popover. At the limit both are disabled, the limit in their tooltips.
- **Pictures**: `usePageContents` draws only rows an `IntersectionObserver` (root the list,
  `CONTENTS_DRAW_AHEAD_PX` margin) has seen, every row without one; `usePageThumbnails` holds its
  inputs until they rest `settleMs` (the sidebar's `CONTENTS_SIDEBAR_SETTLE_MS`, the popover's 0),
  buckets the elements once (`pageElementBuckets`) and redraws a page only when its laid-out page
  (fields and rect) or its bucket (by reference) changed, or what all share (tab id, layers, font,
  finish, icons loaded) did.

### Snapping

`useEditorDrag` passes `pageSnapBoxes` (`useLogoEditor`'s `snapBoxes`: `pageSnapBoxes(pages)`
plus a guided logo page's keylines, from `useEditorState`) to `resolveBoxedMove` /
`resolveBoxedResize`, which add them to the alignment targets (`snapToAlignment`,
`snapResizeBounds`, `alignmentGuides`) but not to `distributionSnap`.

### Arrows stay on one page

- `pageIdAt(point, pages)`: the page a point lies on, else null; `pageIdOf(el, all, pages)`: a box
  by its centre, an arrow by its resolved bounds' centre; `crossesPages(a, b)`: both on a page and
  different.
- Dragging an arrow's end (`resolveArrowEndpointDrag`, `reachableFrom`): with two or more pages
  and the other end on a page, boxes on another page are left out of the pin and snap candidates
  and an arrow on another page is not joined, so the end stays free.
- Connect (`useArrowConnect.connectArrowTo`): an element on another page draws nothing and ends
  the connect (log `[arrow-connect] skipped: another page`).
- Nothing rewrites arrows that already cross.

### Copying a background

- `backgroundPatchFor(target, background)`: `{ fill, pattern }` (absent ones clear the target's); a
  logo target takes `{ fill }` only, and null for a picture fill.
- `pageBackgroundSpread(tab, pageId, memory?)`: targets = pages of `pageKindOf(source)` outside
  `pagesSharing(source)`; none → `no_other_pages`. Each target through `pageBackgroundStored`
  with the patch; a refusal (a lock) counts `skipped`, the rest `applied`; then every page to
  re-ink through one `pagesInkFor`, threading the ink memory.
- `pageBackgroundCopied(tab, from, to, memory?)`: unknown → `unknown_page`; a page sharing the
  source → no edit; `pageLockRefuses(to)` → `locked`; no patch → `picture_not_offered`; else
  `pageBackgroundSet`.
- `backgroundCopyEdits` (spread into `pageEdits`): `applyToAllReach` counts the targets;
  `applyBackgroundToAll` tracks `PageBackgroundAppliedToAll`, commits the spread with
  `pageInkMemory(tabId)` (remembering what it returns) and toasts `appliedToAllMessage(kind,
targets - locked, locked)`, the counts taken from the pages before the commit; `copyBackground`
  refuses a locked target or a picture onto a logo page with its notice before committing, else
  tracks `PageBackgroundPainted` and commits `pageBackgroundCopied`.
- `ApplyBackgroundToAll` renders under `BackgroundSection` in the panel's Background tab: a
  secondary `xs` full-width `Button` "Apply to All <KIND_PAGES[kind].many>" and its line; nothing
  at reach 0. Inside the panel's `inert` body, so a locked page's is unavailable.
- The page brush is the Format tool's `formatSourceId` holding `pageBrush(pageId)`
  (`page-brush:<id>`). `Canvas`'s `interceptPress` first tries `formatPagePress`: tool `format`,
  primary button, `onFormatPagePress` given, `pageIdAtPress` a page → claimed. The host passes
  `onFormatPagePress` only while the tool is Format and `pagesMode.edit` exists (an Editor in
  Pages); it applies `pagePaintPress(formatSourceId, pageId, formatConfig.mode === 'keep')`.
  `applyFormatFromSource` returns early under a page brush. `TopCenterChrome` reads
  `formatBannerMessage(formatSourceId, !!pagesMode)`.

### Export

- A picture fill's `backgroundSvg` is `pageImageSvg(fill, rect, href, id)`: the raw tone rect, the
  `<image preserveAspectRatio="xMid{YMin|YMid|YMax} slice">` when `href` (an inline URI, or
  `imageHref(imageId)`: `renderTabToSvg` / `renderTabToCanvas` pass `opts.images?.get(id)?.href`),
  then the overlay (a `fill-opacity` rect, or a `<linearGradient id="<id>-fade">` rect for Fade).
  The Map and the Slide Deck's thumbnails pass no `imageHref`: tone and overlay only. `loadTabImages` loads the
  pages' pictures (`pageImageIds(tab.pages)`) with the elements' images, each once.

`ImageExportOpts.page` makes `renderTabToCanvas` / `renderTabToSvg` use `pageExportFrame(page)`:
bounds = the page rect, no padding, no tab backdrop or pattern; background =
`backgroundSvg` (rect fill or `<linearGradient>` along the CSS gradient line, then a `<pattern>`
anchored at the page's corner); surface = `pageSurface(page) ?? 'light'`; elements filtered to
those whose bounds meet the page (arrows kept). The canvas rasterises `backgroundSvg` first.

A page whose fill is a gradient with a `motion` exports its opening frame:

- `motionParts(motion, { w, h }, motionPaint(fill))` (`apps/live/lib/page-motion-parts.ts`) lists
  every part as data: `MotionBox` (`left`, `top`, `width`, `height`, `round?`, `fill: MotionFill`,
  `halo?`, `anim?`), `MotionWave` (`stroke?`: a thread, its `waveLine` stroked rather than filled;
  `periods` even so the line meets itself at the loop), `MotionGroup` (`anim?`, `mask?:
'from-below'`; an `orbit` group turns about the page's centre) and `MotionGrid`; `MotionAnim` is
  `{ name: MotionAnimName, d, dl?, x?, y?, r?, rest? }` (`r` in degrees, `--pm-r`), one name per
  `pm-<name>` keyframes in `app/motion-page.css`. The fourth page's loops (`warp`, `orbit`, `blip`,
  `bars`, `tumble`) carry their resting transform in their class, so `animation: none` under
  reduced motion leaves each part posed. Warp, Orbits, Radar, Equaliser, Confetti and Threads live
  in `page-motion-parts-page-four.ts`; a Radar blip's `dl` is `-RADAR_TURN x (1 - angle / 360)`, so
  it is lit as the sweep's edge reaches its angle at any speed. `PageMotionLayer` renders the parts as the moving DOM;
  nothing else defines a part.
- `openingPose(anim)` (`page-motion-frame.ts`): `openingPhase` = `(-dl / d)` modulo 1 (the speed
  divides both, so it cancels), `reversed` on an odd loop (`sweep` alternates); `poseAt(anim, p)`
  restates each keyframes as tracks eased per step (`ease-in-out` = `cubicBezier(0.42, 0, 0.58, 1)`,
  `spread` = `cubicBezier(0.2, 0.6, 0.4, 1)`, the rest linear) into `MotionPose { tx, ty, scale, sx,
sy, rotate, opacity }` (`warp` eased `cubicBezier(0.42, 0, 1, 1)`, `blip` `cubicBezier(0, 0, 0.58, 1)`), turned
  and scaled about `animOrigin(anim)`: the centre, or `ANIM_ORIGIN`'s `warp` `[0, 0.5]` and `bars`
  `[0.5, 1]`, which a test holds to the stylesheet's `transform-origin`.
- `paintMotionFrame(ctx, motion, fill, rect, cache?)` (`page-motion-canvas.ts`): clipped to
  `rect`, alpha x `paint.strength`; a box is translated to its centre plus the pose, turned, scaled
  and faded, then its fill drawn (`glow` / `fade`: an elliptical radial gradient reaching its sides;
  `bokeh`: reaching its farthest corner; `lines`: 2px bands every `gap` at 45 degrees; `beam`; `mesh`:
  its spots painted bottom layer first; `rays`: 5 of every 12 degrees from straight up; `ring`: a
  stroke inside the box; `streak`: clear tail to full head; `sweep`: `createConicGradient` from
  straight up, clear to three quarters, full at the edge; `bar`: `from` at 15% at its foot to `to`
  at its top). A `halo` is the disc of radius plus spread under a Gaussian of half the
  blur, `blurredDisc` sampled into 12 stops. A masked group and the grid paint into a layer at the
  context's scale and keep it `destination-in` their mask. The grid projects its lines through
  `rotateX(62deg)` and a perspective of 0.6 x the page's height from the middle of its band.
- `renderTabToCanvas` paints it after `backgroundSvg` (over the pattern, as on screen), at the
  page rect's offset from the frame, passing `opts.motionFrames`. `exportPagesAsPdf` and
  `exportPages` create one `MotionFrameCache` per export when none is given; it keeps the
  last `FRAMES_KEPT` (2) painted frames, keyed by motion, stops, size and scale.
- `renderTabToSvg` passes `pageExportFrame`'s `overFill` an `<image preserveAspectRatio="none">`
  of `motionFrameHref(fill, width, height)`: the gradient along `pageGradientLine` with the frame
  painted over it, a JPEG at `FRAME_JPEG_QUALITY` (0.9), the last `FRAME_CACHE_SIZE` (8) kept;
  `overFill` sits after the fill and before the pattern: the picture is opaque, so over the pattern it would hide
  it (the PNG and PDF, which paint the motion alone, paint it over the pattern). Without a canvas (a test run) it is
  undefined and the gradient stands alone.
  `exportPagesAsPdf` renders each page and writes one PDF page per image with a MediaBox of the page
  size x `PT_PER_PX`. The dialog's `pages` prop (Pages mode, tab scope) selects the page row.

The dialog offers `PAGES_FORMATS` (pdf, png, svg, file, and `logo-kit` while the tab has a
logo page, [Logo pages](logo-pages.md)) with `PAGES_CARD_COPY` for the page formats. Each image format holds its own `PageScope` (state `scopes`, unset =
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

The Import dialog takes `formats`; in Pages mode `EditorTabDialogs` passes `['json']`.

### Slides

`resolveSlide` of a page slide: the tab's elements on that page (`elementIdsOnPage`).
`slideFrame(slide, tab)`: the page rect, else `slideBounds(resolveSlide(...))`. Presenting a page
slide sets `presentingPageId`; `EditorCanvasHost` passes the view with only that page.
`newPageSlide(pageId)` appends `{ id, tabId: activeTabId, elementIds: [], pageId }`. Thumbnails
prepend the page's `backgroundSvg`.

The deck follows the pages (`deckFollowingPages`, `pageMoveForDeckOrder`, `slidePageOwnSlideIds`,
`GoneSlides` in `packages/design/src/slide-deck-pages.ts`, run by `useDeckFollowsPages`):
[Presentation mode](../../012-collaboration/presentation-mode.md) "The deck follows the pages".

- **Deck button**: `PageDeckButton` (`apps/live/components/canvas/PageDeckButton.tsx`) in the
  title bar, beside the cog, on every page (`view.deck` set), for an editor, not on a phone; `labelled` as the
  other title-bar buttons, its room `pageDeckRoom(named)` (28 px, or 112 px named). It reads
  `view.deck: PageDeckControls` (`slideOf(pageId)` giving `{ id, hidden, notes }`, `add`,
  `toggleHidden`, `setNotes`), built by `pageDeckControls(deck, tabId, canEdit, { newPageSlide,
toggleSlideHidden, setSlideNotes })` (`apps/live/lib/page-deck-controls.ts`) and memoised into
  the view in `useEditorState`. States (`data-page-deck-button`): `add` (SlideDeckIcon,
  `ADD_TO_SLIDES` "Add to Slides"), `shown` (EyeIcon, `HIDE_IN_SLIDES` "Hide in Slides"; no
  `aria-pressed`, the name says the press), `hidden` (EyeOffIcon, `SHOW_IN_SLIDES` "Show in
  Slides").
- **Notes button**: `PageNotesButton` (`apps/live/components/canvas/PageNotesButton.tsx`) after the
  deck button while `slideOf(page.id)` is defined (`buttons.notes`); a `TitlePopoverButton` named
  `ADD_NOTES` "Add Notes" (`on` false) or, with non-blank notes, `NOTES` "Notes" (`on` true),
  `lucideFileText`, 320 px popover holding a 6-row textarea (`data-page-notes-popover`, autoFocus,
  placeholder "What you'll say over this slide…") whose change calls `deck.setNotes(slideId,
value)`; keys other than Escape stop at the textarea. Room `pageNotesRoom(named)` (28 px, or 88
  px named). Telemetry `UI · Opened · PageNotesButton`; `UI · Changed · SlideNotes` once per
  opening.
- **Full screen**: `slideFitOptions(slide, config)` (`lib/presentation-config.ts`) gives a page
  slide `{ maxZoom, padding: 0 }`; `fitToBounds` passes `padding` to `computeFitToScreen` (default
  `FIT_TO_SCREEN_PADDING`). `presentedPages` sets `letterbox: true`, and `CanvasPages` then
  draws the sheet's shadow as `0 0 0 LETTERBOX_SPREAD px #000` (`LETTERBOX_SPREAD` 100 000 canvas px).

## Interfaces and contracts

- `PageEdits`: `setOrientation(id, o)`, `setSize(id, size)`, `rename(id, name)`,
  `setBackground(id, Partial<PageBackground>)` (`{ fill: undefined }` = paper), `movePage(id, -1 |
1)`, `movePageTo(id, unitIndex)`, `canMove(id, -1 | 1)`, `addPage?(kind: PageKind)`,
  `choosePageKind(id, kind)`, `duplicatePage?(id)`, `canDuplicate(id)`, `removePage?(id)`,
  `splitPage(id)`, `applyLayout(id, PageLayoutId)`, `contentCount(id)`, `previewInk(preview |
null)`, `isLocked(id)`, `setLocked(id, locked)`, `startBlank(id)`. An unknown page id commits
  nothing.
- The pure edits (`pages-edits.ts`) answer `{ tab }` (the same tab when nothing changes) or
  `{ refused: PageEditRefusal }` (`unknown_page`, `locked`, `no_orientation`, `size_not_offered`,
  `pattern_not_offered`, `page_limit`, `photo_limit`, `last_page`, `not_a_wireframe`,
  `kind_not_offered`).
- `offersPageKindChoice(pages, id, count)`: true only for the only page, unchosen, empty.
  `withPageKindChosen`: null when the page no longer offers it.
- `PageLayout.build(box: LayoutBox): Element[]`: pure; every element inside the box (1 px slack),
  save a full bleed (a square-cornered image or square panel set to the page's edges), which reaches at most `box.bleed` (the page margin, passed by
  `buildPageLayout` for every page but a wireframe; `Kit.bleed`, 0 when absent) past it and meets
  the page edge; arrows only between the layout's own elements; fresh ids each call.
- `withContentOnAPage(tab)`, `withPageSplit(tab, pageId)`: the tab with `pages`, or null (nothing
  to do); `pageAround(box, id)`: always a page.
- `slideFrame(slide, tab)`: a rect or null (nothing to frame).
- `pageExportFrame(page, paper?)`: never throws; the paint is decorative and a rasterise failure
  leaves the paper.

## Errors and edge cases

| Case                                   | Handling                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| Malformed stored page / field          | Skipped / dropped by `parsePage` (Data and persistence)      |
| Edit to a page removed meanwhile       | The commit's `find` misses; the tab is unchanged             |
| Duplicate or add at the limit          | The control is absent / disabled; the commit also refuses    |
| Delete of the last page                | The tab is cleared; Start Making Pages comes back; Undo      |
| Arrow end over another page's element  | Not pinned or joined; the end stays free                     |
| Kind chosen on a page no longer alone  | `withPageKindChosen` null: no edit                           |
| Add of a kind other than the tab's     | `pageAdded` `kind_not_offered`: no edit, logged              |
| Add to a blank tab (first page blank)  | `kind_not_offered`; no + and no Contents footer shown        |
| Stored tab mixing kinds (before)       | Opens as it is; the + adds like the last of the first's kind |
| Edit as Photo on a logo/wireframe tab  | Not offered (`addPhotoPage` absent)                          |
| Stored page with a repeated id         | Skipped after the first                                      |
| Two quick edits                        | Each re-reads the tab at commit time                         |
| Duplicated arrow pinned off the page   | Not copied                                                   |
| Re-fit of content larger than the room | Scaled down, never up                                        |
| Lone page under a layout preview       | `pagesClipPath([])` returns a clip that hides everything     |
| Page slide whose page is gone          | Resolves to no elements, frames to null; shown, fixable      |
| Split past 20 clusters or the limit    | The rest share the last new page, sized around them          |
| Split of a page with one cluster       | No edit; a toast says there is nothing to split              |
| Content wider than `FIT_PAGE_MAX_SIDE` | The page stops at the limit; the content runs off, unscaled  |
| Carrier of the row anchor deleted      | The anchor moves to the new first page; the row stays        |
| Malformed `fit` or `rowAt`             | Read as A4 / dropped (the row on the origin)                 |
| Gradient rasterise failure in export   | Caught; the paper stays                                      |
| Page picture deleted or not servable   | The sheet and export paint its tone under its overlay        |
| Thumbnail unreadable for the tone      | The stored picture is sampled; failing that, mid grey        |
| Picture on a logo page (carried over)  | Dropped on read                                              |
| A page fails to render in a .zip       | The export rejects; the dialog's existing error path shows   |
| A page label with path characters      | `sanitizeFilename` replaces them in zip and download names   |
| One page in the tab                    | No page `Select`; All and One give the same page             |
| Name field closed without blur         | Committed on unmount                                         |
| Stale dev bundle                       | Not a code path; restart the dev server (wipe `.next-dev`)   |

## Security and trust

No server path is added: pages and page slides are tab and presentation data, written by the
existing tab sync and validated on read (`parsePage`, `isSlide`). Colours are validated hex before
they reach CSS or SVG; SVG markup escapes every colour (`xmlEscape`). The layout preview injects
only the renderer's own markup, whose labels are escaped. A page picture names a gallery id or an
inline raster URI, never a URL (`isPageImageId`); the sheet's CSS `url()` takes only a `blob:`,
inline raster or `https:` source with no quote, backslash or line break (`pageImageCssUrl`); the
SVG `href` is escaped. The api counts a page picture as an image reference
(`apps/api/src/image-refs/extract.ts` `imageRefIds(elements, pages)` and its SQL twin in
`db/image-refs.ts`), so retention keeps it and placement grants let a share visitor read it.

## Performance and limits

- Contents' pictures: before, every page scanned every element (`resolveSlide`), O(pages x
  elements) per redraw, on every change while open. Measured in Node (shapes only, no icons): 10
  pages x 20 elements 6.7 ms, 30 x 40 46 ms, 100 x 30 219 ms per redraw. Now one O(elements) bucket
  pass and a redraw of the changed pages only: 100 x 30 draws in full in 68 ms and redraws after a
  one-page edit in 12 ms; the sidebar draws only the rows near view and only after a 250 ms rest.
  Guarded by `page-element-buckets.test.ts` (100 pages x 30 boxes and connectors bucketed inside
  25 ms of CPU) and `usePageThumbnails.test.ts` (one page redrawn per edit, none mid-drag).

- At most 100 pages; per-render layout is O(pages); `withArticlesTogether` is O(pages) and
  returns the same array when nothing moves; `laidOutUnits` O(pages) per drag frame.
- `elementPageSurfaces` and `pageSnapBoxes` run per render: O(elements x pages) and
  O(pages); the provider's value is stable while the entries are, so element views do not
  re-render during a drag that keeps elements on their pages.
- Remembering the page costs nothing per pan frame beyond a `clearTimeout` / `setTimeout` pair (no
  render: it follows the viewport store); once settled, one O(pages) nearest-page pass and one
  local-storage read (at most 200 entries) plus a write only when the page changed.
- Resting on a page costs one array push per viewport change while a gesture is open (no render,
  the store's listener) and a `clearTimeout` / `setTimeout` pair per change otherwise; the snap
  itself runs once per rest: two O(pages) passes (`pageInView`, the neighbour lookup), measured at
  ~6 µs at 100 pages, plus the canvas's layout reads. Guarded by `page-snap.test.ts` "cost" (1000
  snaps at 100 pages inside 100 ms of CPU). The window pointer listeners are passive bookkeeping.
- Entering the mode (`withContentOnAPage`) is O(elements): one bounds pass and one anchor-point
  pass over `elementIndexFor` (measured 1.4 ms at 3000 elements, against 67 ms for the clustering
  it replaced; guarded by a 5000-element budget test). `contentClusters` is O(n²) in the split
  page's elements, run only when Split Into Pages is pressed (57 ms at 3000).
- An animated page's opening frame (measured in headless Chromium at 1920 x 1080, 2x): 1 ms
  (Snowfall) to 122 ms (Mesh) to paint, once per distinct background per export; the SVG's JPEG
  encodes in 13 to 44 ms at 29 to 141 KiB. A frame kept for reuse is 33 MB of pixels, so an export
  keeps two.
- A Fit to Content page's image export is drawn at 2x, lowered by `exportScale` so no canvas side
  passes `MAX_EXPORT_CANVAS_SIDE` (16384 px); its PDF page is at most 14400 pt.
- Carrying content: gathering the placeholders builds every layout twice, once per session
  (measured ~15 ms per box warm, ~100 ms cold, in vitest on an M-series Mac), warmed while idle as
  the layouts open; a carry itself is linear in the page's elements plus the layout's (measured
  2.5 ms for a title page into a poster; guarded by a 300-element budget test).
- Layout thumbnails build once per page shape (`useMemo` on the rect); the overview draws two per category (12 over the six), a category at most eight (Data).
- Re-inking runs on a fill press and on each hovered swatch, never per frame: O(n²) in the page's
  elements for `holdsAny` and covers, a bounded search per colour field (at most 2 x 28 x
  `GRADIENT_SAMPLES` contrasts). Measured 44 ms for 600 elements all re-inked on a steep gradient
  (`page-ink.test.ts` keeps it under 1500 ms). The memory is bounded by the tab's elements and
  20 tabs. Apply to All and a theme change re-ink many pages in one `pagesInkFor` walk:
  O(elements x pages) to sort elements onto pages once, not once a page. Measured 130 ms CPU for
  99 full pages of 50 elements (251 ms page by page; under coverage 175 ms against 706 ms);
  `pages-background-copy.test.ts` keeps it under 1500 ms CPU.
- Chart ink runs at render time. `chartPageGrounds` runs on every `PageClip` render (an
  edit or drag frame) and returns at once with no filled page or no chart; otherwise O(n) to
  find pages plus a backward cover scan per chart. Measured 0.49 ms for 600 elements with 40
  charts on a filled page (`chart-ink.test.ts` keeps it under 50 ms). The provider keys on the
  entries, so a drag that moves no chart's ground re-renders no chart. One adaptation (`inkToward`)
  measures 55 us uncached; `CHART_INK_MEMORY` caches by colour and ground, so a hover redraw is a
  map lookup.
- A page picture is fetched once per id while it is on a page (`usePageImageSources`) and painted
  as a CSS background layer of the sheet, decoded by the browser once; pans and zooms move the
  sheet's transform and never refetch or re-render it. Its tone is sampled once at pick time from
  a 16 x 16 draw, never per render.
- PDF export renders each page at scale 2; memory is one canvas at a time.
- An all-pages .zip holds every page's bytes at once (20 pages max) and is stored uncompressed
  (PNG and SVG gain little from deflate); `crc32` is a 256-entry table, O(bytes).

## Presentation and UX

Copy and layout as the spec: **What Is This Page For?** over the three cards (**Logo**, "A square
artboard for a logo, with guides and drawing tools."; **Wireframe**, "A screen to wireframe,
framed as a phone, tablet, laptop or browser."; **Photo**, "A picture to edit: layers, brushes,
adjustments and filters."), each over its miniature; the
in-page card **Start From a Layout** with **Hide**; the first page's card **What Is This Page For?**, "Choose now: every
page of this tab will be this kind."; the + named **Add Another Logo Page** (`addAnotherLabel`); a wireframe
tab's **Add a Screen of Another Device** opening **Choose a Device**; the navigator **Previous page**, "n of m", **Next page**;
the panel's tabs **Page** / **Background** / **Layouts** (a logo page **Background** / **Layouts**), sections **Size**,
**Orientation**, **Background**, **Pattern**, **Start From a Layout**; the confirm **Replace this
page's content?**, "The n elements on it make way for <layout>. Undo brings them back.",
**Cancel** / **Replace**; actions **Duplicate page**, **Move page left**, **Move page right**,
**Delete page**; the logo page's invite **Start From a Layout**; the title-bar **Layout** and **Tidy Up** buttons; the title-bar **Background** button on a wireframe page (tooltip **Background**, its popover named **Background**, holding the **Background** and **Pattern** sections); the export row **All pages** / **One page** with the outcome line ("n pages, one PDF.", "A .zip of n PNG files, one per page.", "A one-page PDF.", "One PNG."), the subtitle "Pick a format to export the pages."; the slide picker
**Add as slide**; the size tile **Fit** (tooltip "Sized around the board it was made for"), the
action **Split Into Pages**; the toasts "Put onto a page that fits it. Undo switches back to
<Mode>.", "Put onto a page that fits it. Undo takes the page away.",
"Split into n pages. Undo puts it back.", "This page is one group: nothing to split.", "A tab holds
at most 100 pages: delete one to split this page."

## Accessibility

- The cog: `aria-haspopup="dialog"`, `aria-expanded`, named `<page> settings`; the panel
  `role="dialog"` named `<page> settings`; Escape restores focus to the cog.
- Tabs: a `role="group"` named "Page panel section" of toggle buttons (`aria-pressed`) on the
  shared segmented control; size, orientation, swatches and patterns are `role="radiogroup"` / `role="radio"` with `aria-checked` and names; previews follow
  focus as well as hover.
- The page label is a button named by its text (a HoverCard describes the press); the invite and
  Slides buttons are named; Tooltips repeat names only.
- The + is a button named by what it adds (`addAnotherLabel`). A wireframe tab's **Add a Screen of
  Another Device**: `aria-haspopup="dialog"`, `aria-expanded`; its popover `role="dialog"` named
  "Choose a Device" around a `role="group"`; rows are buttons (name and screen size as text), the
  remembered one `aria-current`, arrow keys cycle, Escape returns focus to the button.
- The first page's card `role="group"` labelled by its title "What Is This Page For?"; the in-page
  layout card `role="group"` labelled by "Start From a Layout", its Hide named; the navigator
  `role="group"` named "Page n of m", its arrows named and disabled at the ends.
- Reduced motion: the sheets' ease and the swatch hover scale are off
  (`motion-reduce:transition-none`, `motion-reduce:hover:scale-100`), the preview's fade off.

## Web Experience

No new route or loaded asset; the panel, preview, picker, Add a Screen popover and the first page's
card mount on demand. Layout thumbnails, the preview and the kind miniatures are inline SVG (no
network). No layout shift: the title bar, the navigator and the first page's card are absolutely
positioned over the canvas.

## Observability

- `debugLog` fingerprints: `[page] orientation set`, `size set`, `renamed`,
  `background set`, `moved`, `page added`, `duplicated`,
  `page removed`, `last page removed`, `first page kind chosen`, `add refused: another kind`,
  `layout placed`, `framed`, `last page recorded`, `content put onto a page`, `page split`, `split: one group`,
  `split refused: page limit`, `size refused: fit to content`, `size refused: not offered for the
kind`, `turn refused: landscape only`, `pattern refused: a logo page`, `refused: page locked`,
  `lock set`, `started blank`, `re-inked` (`reinked`, `remembered`), `tidied`, `tidy: already tidy`, `press off the pages ignored`; `[page-lock] edit held back`;
  `[arrow-connect] skipped: another page`; `console.warn` `[page] picture
unavailable` / `picture failed` (a sheet's fetch, or a carried picture's in a layout preview), `picture tone unreadable`,
  `background upload failed`.
- Telemetry as the spec's Telemetry section, charted in `../liveworkspace/apps/site/app/telemetry/livedesign/catalogue/features.ts`
  (`PAGE_ORIENTATION`, `PAGES`, `PAGE_SETUP`,
  `PAGE_BUILDING`) and `../liveworkspace/apps/site/app/telemetry/livedesign/catalogue/collaboration.ts` (`SLIDES_ADDED`, `SLIDE_DECK_OPENED`), with
  explanations in `event-explanations.ts`.

## Testing

Each spec section (or rule group) mapped to the test files that cover it; every file and case was
read against the code. Rules no test covers are listed as gaps after the table.

| Spec rule                                                                                                                                                                                                                                                                   | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page kinds: read, absent is a blank page, a stored article page read as a blank page                                                                                                                                                                                        | `packages/design/src/page.test.ts` "page kinds"                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A new page per kind: logo, wireframe, photo; like the last                                                                                                                                                                                                                  | `packages/design/src/pages-edits.test.ts` "adding"; `apps/live/hooks/editor/page-edits.test.ts` "logo page edits", "Fit to Content page edits"                                                                                                                                                                                                                                                                                                                          |
| One kind a tab: only the tab's kind is added, none to a blank tab, a stored mixed tab takes its first page's; no chooser of kinds on the + or in Contents                                                                                                                   | `pages-edits.test.ts` "adds only pages of the tab’s kind"; `page-edits.test.ts` "one kind a tab"; `AddPageButton.test.tsx`, `ContentsAddPage.test.tsx` "offers no other kind"                                                                                                                                                                                                                                                                                           |
| Back to the page you were on: landing frames it, else the first; nothing recorded before the landing frame; a settling move kept on leaving or closing                                                                                                                      | `apps/live/hooks/editor/usePagesMode.last-page.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| The remembered page: per design and tab, malformed reads absent, capped at the latest 200, the page under (else nearest) the view's centre                                                                                                                                  | `apps/live/lib/last-page.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| The first page's choice: offered while alone, unchosen, empty; each kind taken                                                                                                                                                                                              | `apps/live/components/canvas/FirstPageChoice.test.tsx`; `page-edits.test.ts` "chooses Logo for the only, empty page"                                                                                                                                                                                                                                                                                                                                                    |
| The kind cards: arrow keys between the three                                                                                                                                                                                                                                | `apps/live/components/canvas/FirstPageChoice.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The + after the last page: level with its middle                                                                                                                                                                                                                            | `apps/live/components/canvas/AddPageButton.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| The page panel's tabs per kind; Background apart from Page; its preview cleared                                                                                                                                                                                             | `apps/live/components/canvas/PagePanel.tabs.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A page's fields: valid ones kept, malformed dropped, a repeated id read once                                                                                                                                                                                                | `packages/design/src/page-model.test.ts` "a page", "keeps a copied name within the name limit, and reads a repeated page id once"                                                                                                                                                                                                                                                                                                                                       |
| A new page's id is unique, never reused                                                                                                                                                                                                                                     | `page.test.ts` "name a new page uniquely, never reusing a page number"                                                                                                                                                                                                                                                                                                                                                                                                  |
| Contents: lists, glides, Find a Page past six, keys, reorder, Add Page's kinds for an Editor alone, a page's ⋯ menu, Dock as Sidebar                                                                                                                                        | `apps/live/components/canvas/PageContentsPanel.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                |
| Contents sidebar: named region below the strip, flush to its side, dragged to the other, Minimise framing the page again, framing on docking, a page's toolbar for an Editor alone, glides staying open, follows the page in view once rested, Add Page                     | `apps/live/components/canvas/PageContentsSidebar.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                              |
| Contents placement: the sidebar by default on a desktop with more than one page, never on a phone, the popover once minimised, none in Zen; the choice kept in preferences after its event; the side kept in this browser                                                   | `apps/live/components/canvas/useContentsChrome.test.tsx`; `apps/live/lib/contents-placement.test.ts`; `settings-catalogue.test.ts` "offers where Pages mode's Contents sits"                                                                                                                                                                                                                                                                                            |
| The page in view at any zoom, and beside a sidebar; a frame centred beside a sidebar on either side; the sidebar's insets                                                                                                                                                   | `apps/live/lib/page-contents.test.ts`; `../packages/workbench/src/lib/viewport.test.ts` "besideSideInsets"; `apps/live/lib/side-chrome-insets.test.ts`                                                                                                                                                                                                                                                                                                                  |
| The view rests on a page: the page under the middle, beyond the row, off vertically, zoomed out past fit, a hair past fit, beside the sidebar; swipes by travel and flick, springing back, ends of the row, never by a zoom or zoomed in; zoomed in kept with the edge room | `apps/live/lib/page-snap.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Snapping on a gesture letting go (pan, held pointer, zoom), on rest, not while suspended; `flickVelocity`; the sidebar measured at rest                                                                                                                                     | `apps/live/hooks/editor/usePageSnap.test.ts`; `apps/live/lib/side-chrome-insets.test.ts` "restingRect"                                                                                                                                                                                                                                                                                                                                                                  |
| Find a Page by the words on a page                                                                                                                                                                                                                                          | `apps/live/lib/page-texts.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Contents' pictures: drawn from each page's own elements exactly as from the tab, one page redrawn per edit, none mid-drag                                                                                                                                                   | `apps/live/lib/page-element-buckets.test.ts`; `apps/live/hooks/ui/usePageThumbnails.test.ts`                                                                                                                                                                                                                                                                                                                                                                            |
| The row anchor: read, one carrier, kept when its carrier is deleted                                                                                                                                                                                                         | `page.test.ts` "the row anchor"                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Sizes: measures, labels, mixed row, sizes per kind                                                                                                                                                                                                                          | `page-model.test.ts` "measures every size, the long side upright in portrait", "names itself by its name, or its place once there are several", "lays mixed sizes out in a row"                                                                                                                                                                                                                                                                                         |
| Fit to Content sides read, clamped, A4 without them, no orientation                                                                                                                                                                                                         | `page.test.ts` "Fit to Content pages"; `apps/live/components/canvas/PagePanel.fit.test.tsx`                                                                                                                                                                                                                                                                                                                                                                             |
| A page only takes a size its kind offers; a turn refused without an orientation                                                                                                                                                                                             | `pages-edits.test.ts` "turning and resizing"; `page-edits.test.ts` "gives a page only the sizes its kind offers", "never turns a slide, nor gives it a size that is not a slide size"                                                                                                                                                                                                                                                                                   |
| A change of size or turn re-fits the content; the pages after move along                                                                                                                                                                                                    | `page-model.test.ts` "re-centres its content when its size changes, and moves the pages after it"; `page.test.ts` "withPages"; `page-edits.test.ts` "re-fits a full page into the page when it turns, text scaling with it"                                                                                                                                                                                                                                             |
| Backgrounds: categories, Paper and the colour rows, custom gradient, Angle, Swap                                                                                                                                                                                            | `apps/live/components/canvas/page-background-section.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                          |
| Theme backgrounds, presets, the sheet's paint and pattern                                                                                                                                                                                                                   | `apps/live/lib/page-paint.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A background edit: patched, compared by value                                                                                                                                                                                                                               | `packages/design/src/page-paint.test.ts`; `pages-edits.test.ts` "painting"; `page-edits.test.ts` "paints and clears a background"                                                                                                                                                                                                                                                                                                                                       |
| A dark page has light ink; own colours re-inked                                                                                                                                                                                                                             | `page-model.test.ts` "page backgrounds", "page ink"; `page-ink.test.ts` (every floor on paper, pale, white, dark, navy, grey, red, yellow, Night, Sunrise, a steep gradient and a picture; idempotent; cards, marks, outlines, covers, kept kinds, locks, going back, one edit, cost); `page-ink-contrast.test.ts`; `page-ink-ground.test.ts`; `apps/live/hooks/editor/page-edits.reink.test.ts` (one commit, preview, memory); `apps/live/lib/page-ink-memory.test.ts` |
| Charts adapt as they are drawn (series 3:1, text 4.5:1, hue kept, legible colours unchanged; grounds: paper, solid, card, cover, unknown surface, gradient; export matches)                                                                                                 | `packages/design/src/chart-ink.test.ts`; `apps/live/components/canvas/chart-ground.test.tsx`                                                                                                                                                                                                                                                                                                                                                                            |
| A layout replaces the page's content, inside its margins, one edit                                                                                                                                                                                                          | `pages-edits.test.ts` "laying out"; `page-edits.test.ts` "replaces a page with a layout inside its margins, leaving other pages alone"; `page-model.test.ts` "replaces a page’s content, arrows pinned to it going too"                                                                                                                                                                                                                                                 |
| The layout preview hides the page's own content (the clip)                                                                                                                                                                                                                  | `apps/live/components/canvas/PageClip.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Content carries over: placeholders stay, roles, figures, fallback, pictures, shapes, rich text, fit, ids, budget                                                                                                                                                            | `packages/templates/src/page-layout-carry.test.ts`; `page-edits.test.ts` "carries what was written on the page into the new layout"; `apps/live/components/canvas/PageLayoutPreview.test.tsx`                                                                                                                                                                                                                                                                           |
| The in-page card: Start From Scratch on a logo page only                                                                                                                                                                                                                    | `apps/live/components/canvas/EmptyPageLayouts.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| The layout gallery: sections under All, a chip's run, search across name, description and category, counts, Surprise Me never repeats                                                                                                                                       | `apps/live/components/canvas/layout-gallery/layout-gallery-filter.test.ts`, `apps/live/components/canvas/layout-gallery/LayoutGallery.test.tsx`                                                                                                                                                                                                                                                                                                                         |
| The gallery's columns: as many as the width holds, never fewer than two                                                                                                                                                                                                     | `../packages/workbench/src/components/canvas/layout-gallery/useTileWidth.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                       |
| The card's size, and Choose a Layout where the card has no room                                                                                                                                                                                                             | `apps/live/components/canvas/page-layout-card.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A plain page's dark paper in dark chrome; every tile within budget                                                                                                                                                                                                          | `apps/live/components/canvas/layout-render-thumb.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                              |
| Page actions: duplicate with content, move, delete closing the gap                                                                                                                                                                                                          | `pages-edits.test.ts` "duplicating, moving and deleting"; `page-model.test.ts` "page content"; `page-edits.test.ts` "Page edits"                                                                                                                                                                                                                                                                                                                                        |
| A delete glides to the page before; the last page clears the tab                                                                                                                                                                                                            | `page-edits.test.ts` "goes to the page before a deleted one, or the next when the first goes", "deletes the last page with everything on the tab, and brings Start Making Pages back"                                                                                                                                                                                                                                                                                   |
| A new, turned or resized page comes into view                                                                                                                                                                                                                               | `page-edits.test.ts` "duplicates a page, announcing the copy", "frames a turned or resized page again, as the view frames the page itself"                                                                                                                                                                                                                                                                                                                              |
| Arrows stay on one page                                                                                                                                                                                                                                                     | `packages/design/src/page-of.test.ts`; `apps/live/hooks/canvas/arrow-endpoint-resolve.test.ts` "resolveArrowEndpointDrag across pages"; `apps/live/app/design/[id]/useArrowConnect.test.tsx` "useArrowConnect across pages"                                                                                                                                                                                                                                             |
| Locking a page: what it holds, what it refuses                                                                                                                                                                                                                              | `packages/design/src/page-lock.test.ts`; `pages-edits.test.ts` "locking and naming"; `page-edits.test.ts` "locking a page"; `apps/live/lib/page-lock-guard.test.ts`                                                                                                                                                                                                                                                                                                     |
| The lock button and the locked panel                                                                                                                                                                                                                                        | `apps/live/components/canvas/PageLockButton.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A page frames itself, whatever its shape                                                                                                                                                                                                                                    | `page.test.ts` "frame a page by the page itself, so it fills the screen whatever its shape"                                                                                                                                                                                                                                                                                                                                                                             |
| Drag a label to reorder, by units                                                                                                                                                                                                                                           | `apps/live/hooks/canvas/usePageReorderDrag.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Snapping to page edges, centre lines, margins                                                                                                                                                                                                                               | `apps/live/hooks/canvas/boxed-drag-resolve.test.ts` "Page lines"                                                                                                                                                                                                                                                                                                                                                                                                        |
| A page counts as something in view                                                                                                                                                                                                                                          | `apps/live/hooks/canvas/useOffscreenContent.test.tsx` "counts a page in view as something to see"                                                                                                                                                                                                                                                                                                                                                                       |
| Export: defaults per format, zip entry names, filename sanitising                                                                                                                                                                                                           | `apps/live/lib/export-pages.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Export: the zip writer's CRC and round trip                                                                                                                                                                                                                                 | `../packages/workbench/src/lib/zip-writer.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Export: a page's PDF size, past the limit shrunk                                                                                                                                                                                                                            | `apps/live/lib/export-tab-pdf.test.ts` "singlePageMedia"                                                                                                                                                                                                                                                                                                                                                                                                                |
| Export: an animated page's opening frame (parts, poses, paint, cache; PNG / PDF over the gradient, SVG under the pattern)                                                                                                                                                   | `apps/live/lib/page-motion-parts.test.ts`; `page-motion-frame.test.ts`; `page-motion-canvas.test.ts`; `export-tab-page-motion.test.ts`; `packages/design/src/page-frame.test.ts` "markup over the paper"                                                                                                                                                                                                                                                                |
| Copying a background: Apply to All (same kind, locked skipped, re-inked as each in turn), page format painter (cross kind, logo picture refused), the button, the brush                                                                                                     | `packages/design/src/pages-background-copy.test.ts`; `apps/live/hooks/editor/pages-background-copy-edits.test.ts`; `components/canvas/page-background-apply-all.test.tsx`; `../packages/workbench/src/lib/format-page-brush.test.ts`                                                                                                                                                                                                                                                              |
| Export: no Hidden layers option; a logo page's preview is the download                                                                                                                                                                                                      | `apps/live/components/dialogs/ExportTabDialog.pages.test.tsx`; `apps/live/lib/export-logo.test.ts`                                                                                                                                                                                                                                                                                                                                                                      |
| Import offers JSON only, opening straight at it                                                                                                                                                                                                                             | `apps/live/components/dialogs/ImportTabDialog.test.tsx` "ImportTabDialog, offered formats"                                                                                                                                                                                                                                                                                                                                                                              |
| Into pages: page around content, nothing moved, stored pages kept when made into something                                                                                                                                                                                  | `packages/design/src/paginate.test.ts` "pageAround", "withContentOnAPage", "withContentOnAPage: cost"                                                                                                                                                                                                                                                                                                                                                                   |
| Into pages on opening (own edit, toast, telemetry)                                                                                                                                                                                                                          | `apps/live/hooks/editor/usePagesMode.into-pages.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                |
| No template changes entering Pages (issue #491, Sailboat)                                                                                                                                                                                                                   | `packages/templates/src/template-into-pages.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Split Into Pages: clusters, reading order, at most 20, never past the limit                                                                                                                                                                                                 | `paginate.test.ts` "contentClusters", "withPageSplit"; `page-edits.test.ts` "Fit to Content page edits"; `PagePanel.fit.test.tsx`                                                                                                                                                                                                                                                                                                                                       |
| Page slides resolve and frame; labels; every page in the deck, in page order; a deleted page (its slides removed, brought back with it)                                                                                                                                     | `packages/design/src/slide-deck.test.ts` "page slides"; `packages/design/src/slide-deck-pages.test.ts`; `apps/live/app/design/[id]/useSlideDeck.page-slide.test.ts`; `apps/live/components/panels/SlideDeckPanel.test.tsx` "SlideDeckPanel on a Pages tab"                                                                                                                                                                                                              |
| Every page's deck button and eye; full screen with no margin                                                                                                                                                                                                                | `apps/live/components/canvas/PageDeckButton.test.tsx`; `apps/live/lib/page-deck-controls.test.ts`                                                                                                                                                                                                                                                                                                                                                                       |
| A presented page slide's sheet; its thumbnail inked for its page                                                                                                                                                                                                            | `apps/live/lib/presented-pages.test.ts`; `apps/live/hooks/ui/useSlideThumbnails.test.ts` "inks a page slide's elements for its page's surface"                                                                                                                                                                                                                                                                                                                          |
| Telemetry: the kind events, Fit to Content                                                                                                                                                                                                                                  | `page-edits.test.ts` ("LogoPageAdded", "PageKindLogo"); `usePagesMode.into-pages.test.ts` ("PageFitToContent")                                                                                                                                                                                                                                                                                                                                                          |
| Image backgrounds: parse, safe ids, logo drop, tone under the overlay, ids and re-homing                                                                                                                                                                                    | `packages/design/src/page-image.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Image backgrounds: sheet layers, CSS url guard, overlay and crop, export SVG and the page frame                                                                                                                                                                             | `apps/live/lib/page-image-paint.test.ts`; `../packages/workbench/src/lib/page-image-tone.test.ts`; `apps/live/lib/export-tab-images.test.ts` "loads a page's picture"                                                                                                                                                                                                                                                                                                                   |
| Image backgrounds: the category (not on a logo page), filters, hover preview, one-edit pick, overlay, strength, position, credit, Remove                                                                                                                                    | `apps/live/components/canvas/page-background-image.test.tsx`; `apps/live/components/panels/ImageSearchPane.test.tsx` "for a page background"; `apps/live/lib/image-search/openverse.test.ts`, `search.test.ts` (filters)                                                                                                                                                                                                                                                |
| Image backgrounds: references (retention, grants), Offline Mode, agents                                                                                                                                                                                                     | `apps/api/src/image-refs/extract.test.ts` "page background picture"; `apps/api/src/db/image-refs-writers.test.ts`; `apps/live/lib/offline/offline-images.test.ts` "re-homes a page background"; `packages/edit-operations/src/pages/page-changes.test.ts` "keeps a picture background", `summary.test.ts`                                                                                                                                                               |

Gaps (no unit test; browser-checked or uncovered):

- The Add a Screen popover's placement, outside press and bottom sheet (its rows and keys are tested).
- The page panel's placement, the bottom sheet, Escape restoring focus to the cog, closing on a
  wheel, following its cog after a move; the name field committing on close.
- Hover previews on the sheet (backgrounds, layouts), and the layout invite's
  room in the title bar (`INVITE_WIDE`, `INVITE_ICON`, `LABEL_MIN`).
- The in-page card's visibility rules (`showsLayoutCard`: size on screen, Hide, the panel open) and
  its wide form.
- The page label's press framing the page, its truncation and hiding under `LABEL_MIN`, the page
  navigator, the glide (`glideViewport`, `VIEW_GLIDE_MS`) and the Map's pages.
- Locked-page inertness wiring (`usePageLockedIds` into `extraInertIds`) and the Locked label.
- `usePageImageSources` (the fetch-once, revoke-on-drop lifecycle), `sampleImageTone` in a real
  browser, the Upload an Image file path and the PNG / PDF raster of a picture page: browser-checked
  with headless Playwright (light and dark, portrait and landscape, upload and export).
- The export dialog's page row (`ExportPagePicker`), `pageExportFrame` for a filled page, the
  elements clipped to a page in PDF / PNG / SVG, and the PDF bytes.
- The Slides button and its popover, no Layers in Pages mode, the letterbox
  (`LETTERBOX_SPREAD`) and bare sheets in zen and presenting.
- `pressIsOffPage` (only the pages are drawn on) and the per-element surface provider
  (`PageSurfacesProvider`, `useElementSurface`).
- Telemetry for the remaining page events (`PagePortrait`, `PageLandscape`, `PageSize`,
  `PageBackground`, `PagePattern`, `PageRenamed`, `PageDuplicated`, `PageMoved`, `PageLayout`,
  `PageLocked`, `PageUnlocked`, `PagesLaidOut`, `PageKindLogo`, `PageKindWireframe`, `PageKindPhoto`,
  `UI · Closed · EmptyPageLayouts`) and the `Design · Exported · Pages*` events.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D23 to D32, D55 to D58 and D81 to D87.
