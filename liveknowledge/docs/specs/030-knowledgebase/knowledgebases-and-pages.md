# Knowledgebases and pages

Status: **partly built** ([Build plan](../005-project-roadmap/build-plan.md) steps 4 and 5). Built: one page kind,
every tab a page of writing, with slides and infographics unreachable
([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md) "Unreachable, to delete"), the item's default
name, the continuous page ([blueprint](blueprints/continuous-page.md)), and the page tree's model: `Tab.parent`, the
limits and the tree functions ([blueprint](blueprints/page-tree.md)). Not built yet: everything of the page tree a
person sees (the sidebar still to replace the tab bar, the breadcrumb, the phone sheet), the tree in the tab
summaries, the server's check of the limits, the share-role change below (a Participant can still write on a page),
and the word Knowledgebase in the rest of the editor's copy. The blueprint lists each with its files.

## Domain language

| Term              | Means                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **knowledgebase** | What a person makes, shares and finds in the Explorer: liveknowledge's item. The code and the API keep the platform's word, `document`.                      |
| **page**          | One piece of writing in a knowledgebase, with a title. Stored as a tab (`Tab`) holding one article. The interface never says "tab".                          |
| **page tree**     | The knowledgebase's pages in order, each under a parent page or at the top level.                                                                            |
| **subpage**       | A page with a parent. **Top-level page**: one without.                                                                                                       |
| **writing**       | A page's blocks, as in [Article pages](../007-editor/article-pages.md). The page's title is the writing's Title block.                                       |
| **page link**     | A link in the writing to another page of the same knowledgebase ([Links and embeds](links-and-embeds.md)).                                                   |
| **owner**         | The person answerable for a page being right ([Verification](verification.md)). Not the knowledgebase's owner, who is the person who made the knowledgebase. |
| **agent**         | A program reading or writing through the MCP server, the CLI or an API token ([Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md)).        |

**Knowledgebase** is one word (owner, 2026-11-20), never "wiki" and never "knowledge base", in the interface, the
help and the marketing. "Space" is never used for one either: the Explorer's Spaces (Offline, Private, Shared, Team,
Public) already own the word.

## A knowledgebase

- A new knowledgebase opens with one page, **Start Here**, the caret in its title. Its name is "Untitled Knowledgebase" until named.
- Every page is made the same way, whoever makes it (New Page, a template, an agent's `add_tab`, a tab built from
  elements): one article on one page, an empty Title and a first paragraph (`newKnowledgebasePageContent`). A page
  added later is "Untitled Page" until it is named.
- Templates are templates of writing only (meeting notes, a design doc, a status report and the like), with Blank Page.
- A knowledgebase is shared, found, archived, deleted, restored, snapshotted, mirrored to Drive and kept Offline exactly as
  every app's item is; liveknowledge adds nothing to those.
- **Limits:** 500 pages a knowledgebase (`MAX_KNOWLEDGEBASE_PAGES`), 8 levels deep (`MAX_PAGE_DEPTH`). At a limit the control is disabled
  with a tooltip that says why. Both are checked on the server as well.

## The page tree

- `Tab.parent` is the id of the page it sits under; absent is top level. Siblings keep the order the knowledgebase's tab list
  gives them. A parent that no longer exists reads as absent (the page surfaces at the top level, never lost).
- A tree is never a cycle: one read from storage is cut at its first page, which keeps the rest of it as its
  subpages. Reading is forgiving and every edit is checked: a move, an indent or an add that would break a limit
  is refused and changes nothing.
- The tree is the left sidebar, replacing the tab bar: rows indent by depth, a page with subpages has a chevron, and
  open or closed is kept per browser. The current page's ancestors are always open.
- **Add:** "New Page" at the foot adds a top-level page; a row's **+** adds a subpage. The new page opens with the
  caret in its title.
- **Move:** drag a row to reorder it among siblings or drop it on a page to make it a subpage; the row menu has Move
  Up, Move Down, Indent and Outdent for keyboards and touch. A page moves with its subpages. A page is never dropped
  inside its own subtree.
- **Row menu** (icon-left verb rows): Rename, Add Subpage, Duplicate, Copy Link, Move Up, Move Down, Indent,
  Outdent, Delete (last, red). Verify joins it with [Verification](verification.md).
- **Delete** removes the page and its subpages to the knowledgebase's trash after one confirmation that names the count
  ("Delete Release Process and 3 Subpages?"). Links to a deleted page show struck through with "Deleted Page".
- **Breadcrumb:** the page's ancestors sit above its title; each is a link.
- On a phone the tree is a sheet opened from the top bar.

## The continuous page

A page is one article that never breaks onto paper pages while it is being written.

- Its paper is the **continuous** size: 820 canvas px wide, as tall as the writing (`Page.size: 'fit'` with `fit`
  sides the writer keeps in step with the layout). Where the article engine would add a paper page, a knowledgebase page grows
  taller instead; where it would remove one, the page shrinks. A knowledgebase page therefore always has exactly one page.
- The page is never under 1,120 px tall, so an empty page still reads as a page, and it grows downwards from a top
  that never moves, so nothing placed in the writing shifts. Its height is written only when the laid-out height
  changes, by whoever made the change, in the same undo step.
- Page breaks, headers, footers and page numbers are not offered while writing, and a template carries none. A page
  break block imported from elsewhere is kept and draws nothing.
- **Export:** Word export writes the blocks and Word paginates them onto its paper. PDF export draws the page as it
  stands, one tall page: paginating the PDF onto A4 is not built (it needs the writing laid out a second time in A4
  columns), which is a known gap against livedocuments.
- The view frames the page at reading width and scrolls down the writing; zooming still works, and a wheel or
  trackpad's sideways pan does not move a page that already fits the window. (Dragging with the Hand tool or a finger
  still moves it sideways: not built.)
- Everything else of the article engine stays: blocks, tables, contents, footnotes, margin notes, zones for pictures,
  charts and drawings, the slash menu, Markdown paste, find and replace, live carets.
- **Page kinds:** liveknowledge has one, the knowledgebase page. Slides, infographics and flashcards are not in liveknowledge
  ([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md)).

## Share roles

| Action                                     | Editor | Participant | Viewer |
| ------------------------------------------ | ------ | ----------- | ------ |
| Read pages, follow links, search           | yes    | yes         | yes    |
| Write on a page                            | yes    | no          | no     |
| Comment (margin notes, threads)            | yes    | yes         | no     |
| Add, rename, move, duplicate, delete pages | yes    | no          | no     |

Every gate reads `can`, on the client and again in the room, and ships a test per role.
