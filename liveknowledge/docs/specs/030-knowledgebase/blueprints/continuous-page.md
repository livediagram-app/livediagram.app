# Continuous page blueprint

Derived from [Knowledgebases and pages](../knowledgebases-and-pages.md) "A knowledgebase" and "The continuous page".
One page kind (an article), on one page that grows and shrinks with its writing instead of breaking onto paper pages.
It reuses the article engine ([Article pages](../../007-editor/article-pages.md)) and the Fit to Content size
(`Page.size: 'fit'` with `Page.fit` sides); nothing new is stored but the page's height.

## Domain and naming

| Term                     | Identifier                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| knowledgebase page       | A `Tab` whose `pages` is one article page and whose `articles` holds its one flow (`isKnowledgebasePage`)                                    |
| new page's content       | `newKnowledgebasePageContent()` (`packages/document/src/knowledgebase-page.ts`): `knowledgebasePage()` and `newArticleFlow()`                |
| its flow id              | `KNOWLEDGEBASE_FLOW` (`'art-1'`); a page made by an agent's write or a kind choice keeps the id it was given                                 |
| default page names       | `START_PAGE_NAME` ("Start Here"), `NEW_PAGE_NAME` ("Untitled Page"), read by `isDefaultPageName`                                             |
| default item name        | `UNTITLED_DOCUMENT_NAME` ("Untitled Knowledgebase", `packages/templates/src/untitled.ts`), `isUntitledName`                                  |
| continuous page          | `isContinuousPage(page)`: `page.kind === 'article' && page.size === 'fit'` (`packages/document/src/page-sizes.ts`)                           |
| making one               | `continuousPage(page)`: portrait, `size: 'fit'`, `fit: { width: 820, height }`                                                               |
| its height               | `Page.fit.height`, set only through `withArticlePageHeight(tab, flow, needed)` and held by `continuousPageHeight(needed)`                    |
| height the writing needs | `FlowLayout.heightNeeded` from the layout pass, worked out by `continuousHeightNeeded` (`apps/editor/lib/article/continuous-page-height.ts`) |
| height with no browser   | `EstimatedArticle.height` from `estimateArticle`, written by `withArticleHeightEstimated(tab, flow)`                                         |
| closed doors             | `CUT_FROM_FORK` (`apps/editor/lib/not-in-liveknowledge.ts`), `false`                                                                         |

"Page" in this blueprint means the knowledgebase page (the tab) unless it says "the page's sheet" or `Page`, the one
sheet the writing is laid on. Code and the API keep `tab`, `document`, `article` and `flow`.

## Behaviour and state

### One page kind

- `createTab(name)` (`apps/editor/app/document/[id]/editor-page-helpers.ts`) returns a tab with
  `newKnowledgebasePageContent()` and `templateChosen: true`, so the start screen never opens on it and the caret
  lands in its Title (the article's own first-focus rule). A knowledgebase's first tab is named `START_PAGE_NAME`
  (`useEditorDocument`, `newDocumentContent`, `placeholdersFromSummaries`).
- The `blank` template, a tab built from raw elements (`edit-operations/src/replace.ts`, the MCP's `create_document`)
  and an agent's `add_tab` all carry `newKnowledgebasePageContent()`. A template tab is named by its template; an
  unnamed one is `NEW_PAGE_NAME`.
- `withPageKindChosen(tab, pageId, 'article', flow)` makes the continuous page whatever size the page was, so the
  `blank-article` template, an import into an empty tab and `write_article` on an empty tab all land on it.
- `TEMPLATES` lists `blank`, `blank-article` and the thirteen written templates. `isTemplateKind`, the start screen,
  `/new?template=`, the MCP's `template` argument and `list_templates` all read that list, so an unlisted kind is
  "not a template" everywhere.
- A tab stored with no chosen page and nothing on it (made outside these paths) still shows the start screen, whose
  cards are written templates and Blank Page. `withKnowledgebasePage(tab)` reads such a tab as a new page for a caller
  that wants it converted; no path calls it on load today.

### The page's height

States of a continuous page: **settled** (its height is what its writing needs) and **stale** (the writing has moved
and the height has not followed). The only transition is a layout pass.

1. A change lays the writing out (`measureArticleLayout`, one pass a frame, as before). The writing's box has no fixed
   height and no columns on a continuous page (`article-view-mount.ts`: `min-height` in place of `height`, no
   `column-count`), so it is always as tall as itself and nothing breaks to a next page.
2. The pass reads the foot of the writing's last box (the same walk over the top-level blocks' rects that found the
   rightmost column) and reports `heightNeeded = top margin + writing + notes' room + bottom margin`, whole px
   (`continuousHeightNeeded`). `pagesNeeded` is 1.
3. `useArticles.onLayout` runs `withWritingRoom`: `withArticlePageHeight` on a continuous page,
   `withArticlePageCount` on paper pages. It is the same `tickTabs` write a page add was: made by the writer of the
   change, in the undo step of the edit that caused it, synced as a `tab-meta` patch of `pages`.
4. `withArticlePageHeight` returns the same tab when the held height equals the stored one, and `tickTabs` then
   returns the same list: **no write, no render, no sync when the height is unchanged.**

Guards, unchanged from page adds: only the writer of a change settles it (a change made here within
`WRITER_WINDOW_MS`, or an import's claim); a locked page or tab holds its height; a Participant or Viewer never
writes it (`articleEditRefused`).

An article nobody here is writing (an agent wrote it, or the tab just loaded) takes its height from this editor once
the web fonts are in, through the existing absent-writer mark (`article-grow-store.ts`): the mark clears when the
height is already right, and after `ARTICLE_GROW_SETTLE_TRIES` writes at most.

### Where the page sits

`layOutPages` gives a continuous page a top that never moves: `rowAnchor.y - CONTINUOUS_PAGE_MIN_HEIGHT / 2`, where
a page of the least height centred on the anchor has its top. The page grows downwards, so the writing and every
element placed in it keep their canvas positions and no element is moved by a height change.

### The view

The view is the page surface's ([page surface blueprint](page-surface.md)): locked to the page's column and scrolled
by a native scroll container. `usePagesMode.frameFor` still asks for `computeReadingFrame` as a page opens; the
locked store takes only its vertical part, which lands on the page's top. The sideways hold
(`lib/continuous-page-view.ts`, `pageFitsSideways`) is deleted: nothing pans sideways any more.

### Not offered while writing

Page Break is in neither the slash menu nor the Insert panel; Page Numbers and the Header and Footer fields are not
in the Style panel (`CUT_FROM_FORK`); a written template's header, footer, page numbers, first-page rule and page
breaks are left out as it is built (`articleTabOverrides`). `write_article` takes no `new`, `size`, `orientation` or
`pageNumbers`. A `pageBreak` block that arrives from elsewhere (a Word or Markdown import) is kept in the writing,
draws nothing on the continuous page, and is skipped by the estimator.

## Interfaces and contracts

| Function                                        | Input                                                         | Output                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `continuousPageHeight(needed)`                  | any number                                                    | whole px in `[MIN, MAX]`; `MIN` for a non-finite value                                                                        |
| `withArticlePageHeight(tab, flow, needed)`      | a tab, a flow id, px                                          | the tab with that page's `fit.height`; the same tab when nothing changes, the page is not continuous or the flow is not there |
| `withArticleHeightEstimated(tab, flow)`         | a tab, a flow id                                              | the tab sized by the estimator; the same tab off a continuous page                                                            |
| `continuousHeightNeeded(frame, bottom, limit?)` | the flow frame, the writing's foot, the page's footnote limit | px, never under the two margins                                                                                               |
| `parsePagesRequest({ pages })`                  | any page changes                                              | refusal `kind_not_offered`                                                                                                    |
| `parsePagesRequest({ article })`                | `article`, `markdown`, `mode`, `look`, `accent`, `as`         | the write; any other key refused by name (`invalid_value`)                                                                    |

A stored page is read by `parsePageFields`: on an article page `size: 'fit'` reads as the continuous page, its width
always `CONTINUOUS_PAGE_WIDTH` and its height `continuousPageHeight(stored)`. An article page stored in a paper size
(a tab exported from livedocuments and imported as JSON) keeps that size and paginates as livedocuments does.

## Data and persistence

- `Page.size`, `Page.fit` (existing fields): stored in the tab's body, synced in `tab-meta` patches with the page
  steps, kept in snapshots and versions, undone with the edit that changed them. No migration: liveknowledge has no
  stored tabs from before.
- Nothing else is stored. Which doors are closed is code (`CUT_FROM_FORK`), not data.

## Errors and edge cases

- **Height past the limit:** held at `CONTINUOUS_PAGE_MAX_HEIGHT`; the writing below it would run past the sheet.
  The article's own caps (`MAX_ARTICLE_BLOCKS`, `MAX_ARTICLE_BLOCK_TEXT`) stop a write long before.
- **Two editors, different fonts:** each writes only as the writer of its own change, and an absent writer's mark is
  spent after `ARTICLE_GROW_SETTLE_TRIES` writes, so two browsers that measure a line differently cannot trade
  heights for ever.
- **A reader's view before the writer's height arrives:** the writing is as tall as itself in every browser, so for
  one sync it may run past the sheet's foot or stop short of it. Nothing is clipped.
- **Footnotes:** the footnote layout still ends the page's text above its notes; the notes' room is added to the
  height, so the text ends above them once the page has grown. Until it has, a break it asks for has no column to
  break to and draws nothing.
- **PDF export** draws the page as it is on the canvas, so a continuous page exports as one tall PDF page, not A4
  sheets. Making the PDF paginate means laying the writing out a second time in A4 columns off screen, which is not
  a small change and is not built. Word export writes the blocks and Word paginates them.

## Security and trust

The height is content, written under the same gate as the writing: an Editor's session in the editor
(`articleEditRefused`, `canEdit`), and the room's existing `tab-meta` rules. The api refuses page changes whole
(`kind_not_offered`) before it reads the tab, so no token can add a slide or an infographic page.

## Performance and limits

- **Typing:** one layout pass a frame, as before. The pass adds one `Math.max` per block rect it already read. A
  keystroke that moves no line reports the same `heightNeeded`, and `withArticlePageHeight` answers the same tab:
  no state change, no render, no room op.
- **A new line:** one `tickTabs` write of `pages` (a single page object replaced), where paper pages wrote only on a
  page boundary. That is at most one write per laid-out line, never per keystroke, and it rides the typing commit's
  own sync.
- **Estimator:** linear in the writing. A 100,000 character article (100 paragraphs of 1,000 characters) lays out as
  one page 35,592 px tall in about 30 ms of CPU cold and 10 ms warm (measured 2026-11-20 at the Normal margins of
  the time; the default is now Narrow, a wider column and a shorter page, not measured again), held under
  `cpuBudgetMs(250)` by `continuous-page.test.ts`.
- **Not measured:** the browser's own layout and paint of one very tall writing box. Paper pages bounded each
  column's height; a continuous page is one box. The canvas already culls nothing inside an article, so the cost of
  a long page is the browser's cost of a long contenteditable, and it has not been profiled.

## Presentation and UX

The page's box is 820 canvas px wide and never under 1,120 px tall; nothing is painted for it
([page surface blueprint](page-surface.md) "What is painted"). The start screen is titled "Start a Page".

## Testing

| Rule                                                     | Test                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A new page is one article on one page                    | `knowledgebase-page.test.ts`, `editor-page-helpers.test.ts`                                       |
| The continuous size, its limits, its parse               | `continuous-page.test.ts` "the continuous size", "a stored continuous page"                       |
| The top never moves                                      | `continuous-page.test.ts` "where a continuous page sits"                                          |
| Grows, shrinks, writes nothing when unchanged            | `continuous-page.test.ts` "withArticlePageHeight"                                                 |
| One page however long, within budget                     | `continuous-page.test.ts` "a continuous page laid out without a browser"                          |
| The height the layout pass asks for                      | `continuous-page-height.test.ts`                                                                  |
| Templates carry no header, footer, page numbers or break | `article-templates.test.ts`                                                                       |
| Nothing makes a slide or an infographic                  | `not-in-liveknowledge.test.ts`, `parse.test.ts`, `tab-pages-route.test.ts`, `pages-tools.test.ts` |
| `write_article` starts on the continuous page            | `article-write.test.ts`                                                                           |

Not covered by a test: the layout pass itself on a continuous page (`article-measure.ts` reads live DOM rects, which
jsdom does not lay out). None of this is verified in a browser yet.

## Constants and configuration

| Constant                     | Value     | Where                     | Why                                                                                               |
| ---------------------------- | --------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `CONTINUOUS_PAGE_WIDTH`      | 820       | `page-sizes.ts`           | The spec's reading width: about 75 characters a line at the default size and margins              |
| `CONTINUOUS_PAGE_MIN_HEIGHT` | 1120      | `page-sizes.ts`           | About an A4 sheet at that width, so an empty page reads as a page; even, so the top is a whole px |
| `CONTINUOUS_PAGE_MAX_HEIGHT` | 4,000,000 | `page-sizes.ts`           | Over 100 times the 100,000 character page; under the px a browser lays a box out to               |
| `CUT_FROM_FORK`              | `false`   | `not-in-liveknowledge.ts` | One constant every closed door reads, so the deletion finds them all                              |
