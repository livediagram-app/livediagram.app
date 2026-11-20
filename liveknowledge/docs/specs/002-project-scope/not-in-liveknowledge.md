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
  `PresentationSettings.tsx`, `PageNotesButton.tsx`, the header's Present button, and the Slide and Infographic tours
  (`components/tour/slide-tour-steps.ts`, `infographic-tour-steps.ts`).
- **Editor, PowerPoint:** `lib/office-export/pptx-*.ts`, `lib/office-import/pptx*.ts` and `build-deck.ts`, and the
  `powerpoint` and `pptx` keys of the Import and Export dialogs.
- **Editor, the palette:** the `design` and `slide` palette kinds (`lib/palette-kind.ts`) and the tiles only they show.
- **Editor, Search Elements:** removed (the strip's last button, its popover and the S key that opened it:
  `ToolbarSearch.tsx` is deleted). A knowledgebase is searched by its pages. Left unreferenced, to delete:
  `components/palette/palette-tile-search.ts` and `palette-catalogue-search.ts` with their tests, and
  `packages/workbench`'s `toolbar-search-request` stays the platform's.
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
