# Continuous page blueprint

Derived from [Knowledgebases and pages](../knowledgebases-and-pages.md) "A knowledgebase" and "The continuous page".
One page kind (an article), on one page that grows and shrinks with its writing instead of breaking onto paper pages.
It reuses the article engine ([Article pages](../../007-editor/article-pages.md)) and the Fit to Content size
(`Page.size: 'fit'` with `Page.fit` sides); nothing new is stored but the page's height.

## Domain and naming

| Term                      | Identifier                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| knowledgebase page        | A `Tab` whose `pages` is one article page and whose `articles` holds its one flow (`isKnowledgebasePage`)                                    |
| new page's content        | `newKnowledgebasePageContent()` (`packages/document/src/knowledgebase-page.ts`): `knowledgebasePage()` and `newArticleFlow()`                |
| its flow id               | `KNOWLEDGEBASE_FLOW` (`'art-1'`); a page made by an agent's write or a kind choice keeps the id it was given                                 |
| default page names        | `START_PAGE_NAME` ("Start Here"), `NEW_PAGE_NAME` ("Untitled Page"), read by `isDefaultPageName`                                             |
| default item name         | `UNTITLED_DOCUMENT_NAME` ("Untitled Knowledgebase", `packages/templates/src/untitled.ts`), `isUntitledName`                                  |
| continuous page           | `isContinuousPage(page)`: `page.kind === 'article' && page.size === 'fit'` (`packages/document/src/page-sizes.ts`)                           |
| making one                | `continuousPage(page)`: portrait, `size: 'fit'`, `fit: { width: 1056, height }`                                                              |
| its height                | `Page.fit.height`, set only through `withArticlePageHeight(tab, flow, needed)` and held by `continuousPageHeight(needed)`                    |
| height the writing needs  | `FlowLayout.heightNeeded` from the layout pass, worked out by `continuousHeightNeeded` (`apps/editor/lib/article/continuous-page-height.ts`) |
| height with no browser    | `EstimatedArticle.height` from `estimateArticle`, written by `withArticleHeightEstimated(tab, flow)`                                         |
| closed doors              | `CUT_FROM_FORK` (`apps/editor/lib/not-in-liveknowledge.ts`), `false`                                                                         |
| a page at the first width | a continuous page whose stored `fit.width` is not `CONTINUOUS_PAGE_WIDTH` (856 before Work Tracker 1418), read by `withContinuousPageWidth`  |

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
- A tab stored with no chosen page and nothing on it (made outside these paths) is read as a new knowledgebase page
  wherever a stored tab is read: `migrateStoredTab` ends with `withKnowledgebasePage(tab)`
  ([Describe to set up blueprint](describe-to-set-up.md) "The start screen").

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
`WRITER_WINDOW_MS`, or an import's claim); a locked page or tab holds its height; a session that may not edit (a
Viewer, a link visitor: `canEdit` false) never writes it (`articleEditRefused`). A Participant in liveknowledge may
edit (`writesKnowledgebase`), so settles as an Editor does.

An article nobody here is writing (an agent wrote it, or the tab just loaded) takes its height from this editor once
the web fonts are in, through the existing absent-writer mark (`article-grow-store.ts`): the mark clears when the
height is already right, and after `ARTICLE_GROW_SETTLE_TRIES` writes at most.

**Who settles it, and when** (spec "Who settles the stored height", Work Tracker 1413):

| Session and view                                  | Writes the stored height                                                                                                                                                                  | The absent-writer mark  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Editor or Participant, edit mode, full-width      | Yes: its own changes, and the marked first layout (grow or shrink)                                                                                                                        | Spent as before         |
| Editor or Participant, read mode (`pageReadLens`) | No: the read lens is locked                                                                                                                                                               | **Kept** for Edit       |
| A page or tab locked in Pages mode                | No                                                                                                                                                                                        | **Kept** for the unlock |
| Any session in the narrow view (`isPageViewLens`) | Its own measure, no: `onLayout` hands it to the narrow store. An Editor's or Participant's own writing there (`layout.local`), yes: the full-width estimate once the typing rests (below) | Kept (never reached)    |
| Viewer, link visitor (`canEdit` false)            | No                                                                                                                                                                                        | Cleared                 |

`growForAbsentWriter` on a continuous page under a lock returns **without** `clearArticleGrow` (it cleared the mark
before, so a page opened in read mode was never settled by the Editor's later Edit). Pressing Edit lifts the read
lens's lock, and `useArticles` marks each continuous page's flow again on that rising edge of `reshape` (an Editor,
the tab unlocked): the mark set as the tab loaded may already be spent, since a layout of the tab before its writing
arrived, or before the role was known, clears it. The `ArticleEditor`'s `editable` flips too, which schedules a layout
(`ArticleEditor`'s rights effect), and that layout, now unlocked and marked, settles the page as the absent writer's settle does: through the edit lens, straight onto
the saved page while there is no draft (`lowerPage`: "only the saved page's own height settled"), else onto the
draft's `height`, which Save carries to the page. The narrow view never writes, because its column is narrower than
the stored page's and would store a height that is too tall for every full-width reader; two full-width Editors
whose fonts differ cannot trade heights for ever, since the mark is spent after `ARTICLE_GROW_SETTLE_TRIES` writes.

**Writing done in the narrow view** (Work Tracker 1418: since the page widened, a desktop between the 760 and 960 px
columns is in the narrow view too) stores the estimator's full-width height instead. `onLayout`'s narrow branch, for
a layout of this person's own change (`layout.local`) that `articleEditRefused` lets through, calls
`useNarrowHeightEstimate` (`hooks/editor/useNarrowHeightEstimate.ts`): each call restarts a
`NARROW_ESTIMATE_DELAY_MS` (800 ms) wait, so one estimate is written per pause in the typing, never per keystroke.
The wait ends with a `tickTabs` of `withNarrowHeightEstimated(ts, tabId, flow)`: on the narrow lens (and not on a
locked tab or article) `withFullWidthHeightEstimated(lens)` (`lib/page-surface/page-view-lens.ts`) runs
`withArticleHeightEstimated` on the lens's real tab and hands back a lens page marked with that height, which
`lowerPageView` lowers as the stored page's height, its width and everything else as stored. The same tabs come back
when the height is already that, so a pause that changed nothing writes nothing. A full-width layout settles the
measured height over it as before.

### The drawn height

What the page's box is drawn at is this browser's own, and never stored (spec "The page is drawn as tall as its
writing here"):

1. Every full-width layout of a continuous page (`useArticles.onLayout`, after the narrow view's early return and
   before any gate) notes `continuousPageHeight(heightNeeded)` at the page's stored width in
   `lib/page-surface/page-measured-height-store.ts` (`noteMeasuredPageHeight(tabId, flow, width, height)`), for
   every role, the tab locked or not. A note equal to the kept one tells nobody.
2. `useArticles` reads the active tab's notes (`useMeasuredPageHeights(tabId)`) and hands them on as
   `ArticlesView.measured` (by flow).
3. `drawnPageHeight(page, measured)` is the page's `rect.height`, or the measured height when the page is continuous,
   the measure was taken at its width (so a full-width measure never stretches the narrow view's page, which the lens
   already draws at its own measure) and it is taller. `withDrawnHeight(page, measured)` answers the same page object
   when nothing changes, so the memoised `PageSurfaceSheet` does not re-render.
4. Drawn at it: the page's box (`Canvas` hands `PageSurfaceSheet` `withDrawnHeight(leadPage, …)`) and the writing's
   paper (`ArticleFlows` `data-article-paper`: `max(drawn, var(--page-free-height))`). Not the `ArticleEditor`'s
   pages: the engine lays the writing out on the stored page, so the measure never feeds itself.
5. A press on the paper below the writing's last line puts the caret at the end of the writing
   (`article-editor-handle.ts` `focusAt` via `pressedPos`), not on the last line at the pressed x.

The store keeps the notes of the last `MEASURED_PAGES_KEPT` (32) tabs, the oldest dropped first.

### Where the page sits

`layOutPages` gives a continuous page a top that never moves: `rowAnchor.y`, the row's axis (not above it: the page
surface draws the canvas world inside a scroll container, and a world pushed down to bring the page's top into view
would itself be scrolled to, [page surface blueprint](page-surface.md) "The lock"). The page grows downwards, so the writing and every
element placed in it keep their canvas positions and no element is moved by a height change.

Its left edge never moves either: `rowAnchor.x - CONTINUOUS_PAGE_LEFT` (428, half the first width), whatever its
width, where a paper page is centred on the anchor. A continuous page stored at the first width stood there, so the
wider page grows to the right only and every element and zone placed against it keeps its place against the page.
The canvas position is never seen (the page surface locks the view to the page's column).

### Pages stored at the first width

Spec "Pages stored at the first width" (Work Tracker 1418). `withContinuousPageWidth(tab)`
(`packages/document/src/continuous-page-width.ts`) is a step of `migrateStoredTab`, so it reaches every read of a
stored tab (the api's `rowToTab`, thumbnails, publishing, versions, the file export, the offline store) and every
tab that arrives from outside (`migrateIncomingTab`: a peer's whole-tab op, a file, an api write). It is pure and
writes nothing; the page is stored at the new width with the next save of the tab.

1. It acts on a tab whose stored pages are exactly one continuous article page holding its flow, stored with a
   finite `fit.width` other than `CONTINUOUS_PAGE_WIDTH` (`was`). Any other tab comes back as the same object.
2. The estimator lays the writing out twice on that page (`estimateArticle`): at `was` and at the new width. Each
   pass answers the page's height and each zone's top from the page's top (`EstimatedArticle.zoneTops`).
3. **Height:** `continuousPageHeight(stored + new - old)`: the stored, settled height moved by what the estimator says
   the wider column changes, so its own bias cancels out.
4. **Zones:** each zone with an `at` on the page moves across by its share of the wider column
   (`delta = (new - was)`: inline and centred, or with no alignment, `delta / 2`; inline right or wrapped right,
   `delta`; left, none) and down by the difference of its two estimated tops, through `withZonesSettled`, which moves
   the zone's elements with it.
5. **Margin notes:** each `article-note` element standing in the first width's right margin (its centre between the
   old right edge less the margin and the old right edge) moves right by `new - was`, so it stands centred in the
   new right margin (`articleNoteCorner`). Its height on the page waits for the next settle.
6. The page itself: `fit: { width: CONTINUOUS_PAGE_WIDTH, height }`, every other field kept.

Who settles what after that:

| What                     | Until a full-width Editor's first layout                                | Then                                                          |
| ------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Width                    | `CONTINUOUS_PAGE_WIDTH` (read)                                          | Stored with the next save of the tab                          |
| Height                   | The estimated move from the stored one                                  | Measured (the absent-writer mark, "Who settles it, and when") |
| Zones and their elements | Estimated move                                                          | Measured (`withZonesSettled` in `growForAbsentWriter`)        |
| Margin notes             | Moved across; down unchanged                                            | Measured (`withNotesSettled` in `growForAbsentWriter`, new)   |
| Drawn height, every role | The taller of the above and this browser's measure ("The drawn height") | Same                                                          |

A peer still on the first width (a browser loaded before the deploy) can send a `tab-meta` patch whose pages carry
856: `migrateRoomOp` (`app/document/[id]/room-op-migrate.ts`) reads each such page at the new width (its height
kept), so no editor here holds or saves the first width again, and the narrow view reads the page's width as parsed
(`pagesOf`), never raw.

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
  steps, kept in snapshots and versions, undone with the edit that changed them. A page stored at the first width
  is read at the new one ("Pages stored at the first width"); there is no stored-data migration and no D1 change
  (the api has no D1).
- Nothing else is stored. Which doors are closed is code (`CUT_FROM_FORK`), not data.

## Errors and edge cases

- **Height past the limit:** held at `CONTINUOUS_PAGE_MAX_HEIGHT`; the writing below it would run past the sheet.
  The article's own caps (`MAX_ARTICLE_BLOCKS`, `MAX_ARTICLE_BLOCK_TEXT`) stop a write long before.
- **Two editors, different fonts:** each writes only as the writer of its own change, and an absent writer's mark is
  spent after `ARTICLE_GROW_SETTLE_TRIES` writes, so two browsers that measure a line differently cannot trade
  heights for ever.
- **A reader's view before the writer's height arrives:** the writing is as tall as itself in every browser, so for
  one sync it may run past the sheet's foot or stop short of it. Nothing is clipped, and the box is drawn at this
  browser's measure ("The drawn height").
- **A page stored short** (240 px stored for a 2,600 px page, written in the narrow view or by an agent, then only
  read): drawn at the measure, so its paper takes a press anywhere under the writing; the first full-width Edit
  settles the stored height.
- **A stored height taller than this browser's measure** (another browser's fonts): the box keeps the stored height;
  the drawn height only ever adds.
- **Footnotes:** the footnote layout still ends the page's text above its notes; the notes' room is added to the
  height, so the text ends above them once the page has grown. Until it has, a break it asks for has no column to
  break to and draws nothing.
- **PDF export** draws the page as it is on the canvas, so a continuous page exports as one tall PDF page, not A4
  sheets. Making the PDF paginate means laying the writing out a second time in A4 columns off screen, which is not
  a small change and is not built. Word export writes the blocks on an A4 sheet (`docx-build.ts`: a continuous page is no paper
  size, so its stored width and height are not the file's) and Word paginates them.

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
- **Reading a page stored at the first width:** two estimator passes, once per read until the page is saved at the
  new width; any other tab costs one look at its pages. Measured in `continuous-page-width.test.ts` (CPU budget).
- **Writing in the narrow view:** one estimator pass per pause in the typing (`NARROW_ESTIMATE_DELAY_MS`), on the
  timer, never in the keystroke's own commit: lowering a hundred narrow commits of a 2,000 block page costs what it
  did (`page-view-lens.perf.test.ts`).
- **Estimator:** linear in the writing. A 100,000 character article (100 paragraphs of 1,000 characters) lays out as
  one page 30,720 px tall in the 760 px column, in about 33 ms of CPU cold (measured 2026-11-20, three runs), held
  under
  `cpuBudgetMs(250)` by `continuous-page.test.ts`.
- **Not measured:** the browser's own layout and paint of one very tall writing box. Paper pages bounded each
  column's height; a continuous page is one box. The canvas already culls nothing inside an article, so the cost of
  a long page is the browser's cost of a long contenteditable, and it has not been profiled.

## Presentation and UX

The page's box is 1,056 canvas px wide (a 960 px column) and as tall as its writing here (240 px at least, the taller of the stored and
the measured height, "The drawn height"); nothing is painted for it
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
| Read mode and a lock keep the mark; Edit settles it      | `useArticles.height.test.ts` "who settles the stored height"                                      |
| A Viewer and the narrow view never write the height      | `useArticles.height.test.ts` "who settles the stored height"                                      |
| The box is drawn at the taller of stored and measured    | `page-measured-height-store.test.ts`, `useArticles.height.test.ts` "the drawn height"             |
| A press under the writing puts the caret at its end      | `article-press-pos.test.ts`                                                                       |
| A page at the first width reads at the new one           | `continuous-page-width.test.ts`                                                                   |
| The left edge stays put as the page widens               | `continuous-page.test.ts` "where a continuous page sits"                                          |
| A peer's first-width pages patch reads at the new width  | `room-op-migrate.test.ts`                                                                         |
| The absent writer's settle moves margin notes too        | `useArticles.height.test.ts`                                                                      |
| Narrow-view writing stores the full-width estimate       | `useNarrowHeightEstimate.test.ts`, `useArticles.height.test.ts`                                   |

Not covered by a test: the layout pass itself on a continuous page (`article-measure.ts` reads live DOM rects, which
jsdom does not lay out). None of this is verified in a browser yet.

## Constants and configuration

| Constant                     | Value     | Where                        | Why                                                                                               |
| ---------------------------- | --------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `CONTINUOUS_PAGE_WIDTH`      | 1,056     | `page-sizes.ts`              | The spec's 960 px reading column and its 48 px margins either side (Work Tracker 1418)            |
| `CONTINUOUS_PAGE_LEFT`       | 428       | `page-sizes.ts`              | Half the first width (856): where a continuous page's left edge stands from the row anchor        |
| `NARROW_ESTIMATE_DELAY_MS`   | 800       | `useNarrowHeightEstimate.ts` | How long narrow-view writing rests before its full-width estimate is stored; one estimate a pause |
| `CONTINUOUS_PAGE_MIN_HEIGHT` | 240       | `page-sizes.ts`              | The margins and a Title's line; 192 px at least, or `flowFrame` would shrink the 72 px top margin |
| `CONTINUOUS_PAGE_MAX_HEIGHT` | 4,000,000 | `page-sizes.ts`              | Over 100 times the 100,000 character page; under the px a browser lays a box out to               |
| `CUT_FROM_FORK`              | `false`   | `not-in-liveknowledge.ts`    | One constant every closed door reads, so the deletion finds them all                              |
