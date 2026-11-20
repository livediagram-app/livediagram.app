# Wikis and pages

Status: **spec**, not built ([Build plan](../005-project-roadmap/build-plan.md) steps 4 and 5).

## Domain language

| Term               | Means                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **wiki**           | What a person makes, shares and finds in the Explorer: liveknowledge's item. The code and the API keep the platform's word, `document`.            |
| **page**           | One piece of writing in a wiki, with a title. Stored as a tab (`Tab`) holding one article. The interface never says "tab".                        |
| **page tree**      | The wiki's pages in order, each under a parent page or at the top level.                                                                          |
| **subpage**        | A page with a parent. **Top-level page**: one without.                                                                                             |
| **writing**        | A page's blocks, as in [Article pages](../007-editor/article-pages.md). The page's title is the writing's Title block.                            |
| **page link**      | A link in the writing to another page of the same wiki ([Links and embeds](links-and-embeds.md)).                                                 |
| **owner**          | The person answerable for a page being right ([Verification](verification.md)). Not the wiki's owner, who is the person who made the wiki.        |
| **agent**          | A program reading or writing through the MCP server, the CLI or an API token ([Wiki for agents](../024-agents/wiki-for-agents.md)).                |

"Space" is never used for a wiki: the Explorer's Spaces (Offline, Private, Shared, Team, Public) already own the word.

## A wiki

- A new wiki opens with one page, **Start Here**, the caret in its title. Its name is "Untitled Wiki" until named.
- A wiki is shared, found, archived, deleted, restored, snapshotted, mirrored to Drive and kept Offline exactly as
  every app's item is; liveknowledge adds nothing to those.
- **Limits:** 500 pages a wiki (`MAX_WIKI_PAGES`), 8 levels deep (`MAX_PAGE_DEPTH`). At a limit the control is disabled
  with a tooltip that says why. Both are checked on the server as well.

## The page tree

- `Tab.parent` is the id of the page it sits under; absent is top level. Siblings keep the order the wiki's tab list
  gives them. A parent that no longer exists reads as absent (the page surfaces at the top level, never lost).
- The tree is the left sidebar, replacing the tab bar: rows indent by depth, a page with subpages has a chevron, and
  open or closed is kept per browser. The current page's ancestors are always open.
- **Add:** "New Page" at the foot adds a top-level page; a row's **+** adds a subpage. The new page opens with the
  caret in its title.
- **Move:** drag a row to reorder it among siblings or drop it on a page to make it a subpage; the row menu has Move
  Up, Move Down, Indent and Outdent for keyboards and touch. A page moves with its subpages. A page is never dropped
  inside its own subtree.
- **Row menu** (icon-left verb rows): Rename, Add Subpage, Duplicate, Copy Link, Move To, Verify, Delete (last, red).
- **Delete** removes the page and its subpages to the wiki's trash after one confirmation that names the count
  ("Delete Release Process and 3 Subpages?"). Links to a deleted page show struck through with "Deleted Page".
- **Breadcrumb:** the page's ancestors sit above its title; each is a link.
- On a phone the tree is a sheet opened from the top bar.

## The continuous page

A page is one article that never breaks onto paper pages while it is being written.

- Its paper is the **continuous** size: 820 canvas px wide, as tall as the writing (`Page.size: 'fit'` with `fit`
  sides the writer keeps in step with the layout). Where the article engine would add a paper page, a wiki page grows
  taller instead; where it would remove one, the page shrinks. A wiki page therefore always has exactly one page.
- Page breaks, headers, footers and page numbers are not offered while writing. PDF and Word export paginate onto A4
  as livedocuments does, and a page break block imported from elsewhere is kept and honoured only there.
- The view frames the page at reading width and scrolls down the writing; zooming still works, panning sideways does
  not move a page that already fits the window.
- Everything else of the article engine stays: blocks, tables, contents, footnotes, margin notes, zones for pictures,
  charts and drawings, the slash menu, Markdown paste, find and replace, live carets.
- **Page kinds:** liveknowledge has one, the wiki page. Slides, infographics and flashcards are not in liveknowledge
  ([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md)).

## Share roles

| Action                                             | Editor | Participant            | Viewer |
| -------------------------------------------------- | ------ | ---------------------- | ------ |
| Read pages, follow links, search                   | yes    | yes                    | yes    |
| Write on a page                                    | yes    | no                     | no     |
| Comment (margin notes, threads)                    | yes    | yes                    | no     |
| Add, rename, move, duplicate, delete pages         | yes    | no                     | no     |

Every gate reads `can`, on the client and again in the room, and ships a test per role.
