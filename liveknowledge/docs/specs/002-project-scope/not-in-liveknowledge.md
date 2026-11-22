# Not in liveknowledge

What the fork from livedocuments brought that liveknowledge does not keep, and what v1 leaves for later.

## Cut from the fork

- **Slides, infographics and flashcards**, with their templates, layouts, palette entries, presenter view, speaker
  notes, animated GIF export, PowerPoint import and export, and the MCP's page-layout and element tools. A knowledgebase page
  is writing. Pictures, charts and drawings stay as zones in the writing.
- **Paper sizes and orientation** as choices while writing ([Knowledgebases and pages](../030-knowledgebase/knowledgebases-and-pages.md)
  "The continuous page"). Export still paginates.
- **The tab bar and tab kinds.** Pages live in the page tree.
- **Diagram lint** for free canvases. Zones keep the checks that apply inside a drawing.

## Not in v1

- A model paid for by liveworkspace, and semantic (embedding) search. Search is keyword search in the Durable Object.
- Ask across several knowledgebases at once, and Ask through anonymous share links.
- Google Docs import (it needs Google consent changes only the owner can make).
- File attachments other than pictures.
- Page-level permissions inside a knowledgebase. Sharing is per knowledgebase, as every app's is.
- Public knowledgebases as websites with their own domain.

## Unreachable, to delete

Slides, infographics, paper pages in a row and presenting can no longer be reached: no control, link, template, tool or
verb makes or shows one. The code behind them was too entangled with the article engine to delete in the same step, so
it stays for now, the way livehuddle left its diagram element engine for a follow-up. Every closed door in the editor
reads `CUT_FROM_FORK` (`apps/editor/lib/not-in-liveknowledge.ts`), so the deletion can find them. To delete:

- **Editor, the row of pages:** `components/canvas/FirstPageChoice.tsx`, `page-kind-cards.tsx`, `AddPageButton.tsx`,
  `ContentsAddPage.tsx`, `PagePanel.tsx` and its sections, the page cog, `PageLayoutsButton.tsx`, `layout-gallery/`,
  the Use a Layout invite, `PageContentsSidebar.tsx`, `PageContentsPanel.tsx`, `useContentsChrome.tsx`,
  `page-row-slides.tsx`, `hooks/ui/usePageContents.ts`, `lib/contents-placement.ts`, the page navigator and stack
  controls, and the add, copy, remove, split, size, turn and kind verbs in `hooks/editor/page-edits.ts`.
- **Editor, slides and presenting:** `app/document/[id]/useSlideDeck.ts`, `useDeckFollowsPages.ts`, `deck-save.ts`,
  `lib/page-deck-controls.ts`, `lib/presentation-config.ts`, `components/slide-notes/`, `PresentationHud.tsx`,
  `PresentationSettings.tsx`, `PageNotesButton.tsx` and the header's Present button. (The Slide and Infographic tours
  are deleted, with the Pages tour: [Pages tour](../007-editor/pages-tour.md).)
- **Editor, PowerPoint:** `lib/office-export/pptx-*.ts`, `lib/office-import/pptx*.ts` and `build-deck.ts`, and the
  `powerpoint` and `pptx` keys of the Import and Export dialogs.
- **Editor, the palette:** the `design` and `slide` palette kinds (`lib/palette-kind.ts`) and the tiles only they show.
- **Editor, Search Elements:** removed (the strip's last button, its popover and the S key that opened it:
  `ToolbarSearch.tsx` is deleted). A knowledgebase is searched by its pages. Left unreferenced, to delete:
  `components/palette/palette-tile-search.ts` and `palette-catalogue-search.ts` with their tests, and
  `packages/workbench`'s `toolbar-search-request` stays the platform's.
- **Editor, zoom and panning** ([The page surface](../030-knowledgebase/page-surface.md) "No zoom and no panning";
  the view is locked and scrolled natively): `hooks/canvas/useCanvasPinchZoom.ts`, `useDoubleTapZoom.ts`,
  `useOffscreenContent.ts`, `components/chrome/ZoomControls.tsx`, `ZoomMenu.tsx`, `ViewZoomControls` and
  `ViewMinimap` in `components/canvas/view-readers.tsx`, `components/canvas/Minimap.tsx` and its tests, the Map's
  settings (`showMinimap`, `mapDimOutside`, `mapSize`) and panel wiring (`useCanvasChromePanels`, `panel-layout`),
  `lib/tab-fit-view.ts`, `fitToScreen`, `fitToBounds` and the glides in `hooks/canvas/useEditorViewport.ts`, the
  zoom handlers of `useEditorInput.ts` (`onZoomIn`, `onZoomOut`, `onZoomReset`, `onFitToScreen`), the `pan` canvas
  tool (`CanvasTool`, `canvasCursorClass`, the hand's part of `useCanvasPanAndMarquee`), `usePageSnap.ts`, the phone
  framing in `usePagesMode` (`readPage`, `panFrom`, `computeReadingFrame` beyond the page's top) and
  `useTouchPagePan`'s pan half. Deleted with this change: `lib/continuous-page-view.ts`.
- **Editor, the corner card and the fork's top bar** ([The page surface](../030-knowledgebase/page-surface.md) "The
  footer"; Share and the account button are in the top row, the views are the footer's tabs): liveknowledge no
  longer draws `packages/workbench`'s `EditorCornerActions` (the platform's, for the other editors; only its
  `CORNER_BTN`, `CORNER_TONE` and `HeaderShareIcon` are read). Deleted with this change:
  `components/ask/KnowledgeViewSwitch.tsx`, the phone's switch row and the floating Page Info and Pages buttons.
- **Editor, the Selection mode and the presenter's tools** ([The page surface](../030-knowledgebase/page-surface.md)
  "No Selection mode"; `useCanvasTool` reads every tool but Format as Select): `lib/laser-config.ts`,
  `hooks/canvas/useLaserConfig.ts`, the laser and spotlight panels in `components/canvas/useCanvasToolPanels.tsx`,
  `useSpotlight` and the laser broadcast in `hooks/collab/useEditorBroadcast.ts` with its `laser` room op, the
  `laser`, `spotlight` and `pan` members of `CanvasTool` and their branches in `canvasCursorClass` and
  `useCanvasSurfaceGestures`, the Laser and Spotlight glyphs in `components/palette/palette-icons.tsx`, and the
  strip's old furniture, unreferenced now: `components/palette/ArticleDockSlot.tsx`, `usePaletteKindMotion.ts`,
  `lib/palette-kind.ts`'s `usePaletteKind`, the Library tab of `usePaletteCatalogue`, `useStripCrowdsCorners` and
  the `stripSpansTop` clearance in `CanvasChrome`, and the Components, Media and Data categories of
  `palette-layouts.ts` with the tiles only they show. Deleted with this change:
  `components/palette/canvas-tool-options.tsx` and its two tests.
- **Editor, the bare-ground gestures** (the same section; they exist only while a drawing zone is being edited):
  the `middleMousePan` preference and its Settings row, and `useCanvasPanAndMarquee`'s pan half outside a drawing.
- **Editor, the paper:** `components/canvas/CanvasPages.tsx` and `CanvasPageSheet.tsx` draw only an article kept in
  a paper size (an imported livedocuments tab); a knowledgebase page draws `PageSurfaceSheet`. With them, the sheet's
  shadow and letterbox, `PageMotionLayer.tsx`, `page-title-bar-room.ts` and the canvas pattern code behind
  `resolveTabBackdrop` in the editor's view (`lib/canvas-backgrounds.ts`, `AnimatedCanvasBackground.tsx`).
- **Editor, a page's own look and lock** ([The page surface](../030-knowledgebase/page-surface.md) "What a page no
  longer has"; a stored background, style or lock is dropped as a tab is read, `page-looks.ts`):
  `components/canvas/PageSheetTitleBar.tsx`, `PageArticleButtons.tsx`, `PageBackgroundButton.tsx`,
  `PageAppearanceButton.tsx`, `PageTabStyleButton.tsx`, `TitlePopoverButton.tsx`, `PagePanel.tsx` and
  `page-panel-sections.tsx`, `page-background-*.tsx`, `article/ArticleStyleSection.tsx`,
  `article/ArticleBandsSection.tsx`, `article/PageBands.tsx`, `lib/page-background-preview.ts`,
  `lib/page-panel-request.ts`, `requestStylePanel` and `useStylePanelRequest` in
  `lib/article/article-editor-store.ts`, `setArticleStyle`, `previewArticleStyle` and `stylePreview` in
  `hooks/editor/useArticles.ts`, the page lock (`setLocked` in `page-edits.ts`, `lib/article/article-lock.ts`,
  `usePageLockedIds.ts`, `Tab.locked` and every `tabLocked` read), the Tab Style dialog and its door
  (`components/dialogs/CanvasThemeDialog.tsx`, `tab-style-profile.tsx`, `tab-style-pages.ts`,
  `NewPageBackgroundPanel.tsx`, `TabStylePreview.tsx`, `ArticleStyleRow.tsx`, `lib/tab-style-opener.ts`,
  `lib/tab-looks.ts`, `lib/new-page-background.ts`, `components/canvas/ThemeStrip.tsx`,
  `components/tour/TabStyleTour.tsx`), and in Settings the Map rows (`showMinimap`, `mapDimOutside`, `mapSize`), Middle-Mouse Pan,
  the Editor category's canvas rows (Alignment Guides, Auto-Attach Arrows, Element Indicators,
  Quick-Add on Hover) and the Quick Style and Collaborate panel switches
  ([User preferences](../007-editor/user-preferences.md) "What liveknowledge offers"), with their copy on liveworkspace.app's settings page and their help articles.
- **Editor, the knowledgebase's own search dialog:** deleted (`components/knowledge/SearchDialog.tsx`); the
  universal search panel's first group is This Knowledgebase ([Search and Ask](../030-knowledgebase/search-and-ask.md)
  "Search"). Still offered by the panel and not a knowledgebase's: its Pages and Elements groups over the open
  pages and its Add to Canvas group (`lib/search.ts`, `lib/palette-search.ts`), to settle with the palette.
- **`packages/document`:** `slide-deck*.ts`, `slide-builds.ts`, the paper and slide sizes and orientations
  (`page-sizes.ts`), the page kinds other than `article`, and the page row's edits (`pages-edits.ts`, the page-count
  half of `article-pages.ts`).
- **`packages/templates`:** every builder and layout of an unlisted kind (`template-builders-*.ts`,
  `template-pages.ts`, `template-design-pages.ts`, `page-layout*.ts`, `slide-layout*.ts`, `layout-catalogue.ts`), the
  unlisted kinds of `TemplateKind` and their rows in the category and page-kind tables, the Events, Home and Pitches
  categories, and the tests that now only pin them (`template-backgrounds.test.ts`, `template-into-pages.test.ts`).
- **`packages/template-previews`:** the previews of unlisted kinds.
- **Agents:** `packages/edit-operations/src/pages/page-changes.ts`, `changePages` and `changePagesShape` in
  `packages/agent-verbs`, the `pages` branch of `apps/api/src/changesets/pages.ts`, and the `PageChange` types in
  `packages/api-schema`.
- **Marketing:** the Slides and Infographics category pages and their feature art (build plan step 14).

Still reachable, and to settle when the MCP server and CLI are reworked in pages (build plan step 13): a JSON import
of a tab exported from livedocuments keeps the pages it was stored with, and `update_document` still places free
elements on a page.
