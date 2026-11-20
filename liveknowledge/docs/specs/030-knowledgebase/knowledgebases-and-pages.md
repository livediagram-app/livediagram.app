# Knowledgebases and pages

Status: **built, not yet verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) steps 4 and 5).
Built: one page kind, every tab a page of writing, with slides and infographics unreachable
([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md) "Unreachable, to delete"), the item's default
name, the continuous page ([blueprint](blueprints/continuous-page.md)), and the page tree
([blueprint](blueprints/page-tree.md)): its model, its storage and sync, the server's check of the limits, the share
roles, the sidebar that replaces the tab bar, the phone sheet, the breadcrumb, and the page's name following its
Title. The editor says "page" and "Knowledgebase" throughout, its settings catalogue included. Not built yet: what
the blueprint's "Not built" lists.

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

- A new knowledgebase opens with one page, **Start Here**, the caret in its title. Its name is "Untitled Knowledgebase"
  until a person names it: a page's Title names that page, never the knowledgebase.
- **Where a new knowledgebase is saved.** A signed-in person's is saved to their account, in Private, so Verify,
  Ask, AI Knowledge and sharing work from the first page. A guest's, and a signed-out person's, is kept Offline in
  this browser, as every app's is ([Save locations](../006-document/save-locations.md)). The start's **Sync
  Knowledgebase to Server** switch moves an empty one either way, so a signed-in person can still choose Offline.
  A browser that looks signed in waits for its session's answer before the create chooses, so a signed-in person is
  never handed an Offline knowledgebase because sign-in had not answered yet; that holds in the test build too,
  whose stored session sets no hint cookie (`looksSignedIn`).
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
  gives them. The parent is saved with the list as well as with the page, so a page that was never opened can be moved. A parent that no longer exists reads as absent (the page surfaces at the top level, never lost).
- A tree is never a cycle: one read from storage is cut at its first page, which keeps the rest of it as its
  subpages. Reading is forgiving and every edit is checked: a move, an indent or an add that would break a limit
  is refused and changes nothing.
- The tree is the left sidebar, replacing the tab bar: 264 px wide, the knowledgebase's name at its head (renamed in
  place), then the pages. Rows indent 20 px a level, a page with subpages has a chevron, and open or closed is kept
  per browser, per knowledgebase. The current page's ancestors are always open, so a page opened by its link shows
  where it is. The current page wears the brand tint. A button at the sidebar's head collapses it to a narrow rail
  and back, kept per browser.
- The bottom bar keeps what else stood in it (Tools, Settings, the appearance), where it stood.
- The tree is a real tree for the keyboard: Up and Down move through the rows, Right opens a page or enters it, Left
  closes it or goes to its parent, Enter opens the page, F2 renames it, and the menu key opens its menu.
- **Add:** "New Page" at the foot adds a top-level page; a row's **+** adds a subpage, as its last. The new page
  opens with the caret in its title, so what is typed next is its name. A page made from the writing (Create Page
  in the page link picker) is not opened; the first time it is, the caret is at the end of its title.
- A key typed outside the writing opens nothing: the editor has no element search (the fork's Search Elements, on
  S and at the end of the palette). Cmd or Ctrl K, the page search, is the knowledgebase's search, and the command
  search (Cmd or Ctrl `.`) reads the pages already open in this browser and loads no other.
- **Name:** a page's name and its Title are one thing. Typing in the Title renames the page, once, when the typing
  stops. Renaming the page in the tree (F2, a double click, Rename) rewrites its Title; a page whose writing has not
  loaded yet is opened first, and renamed as soon as it has.
- **Move:** drag a row to reorder it among siblings or drop it on a page to make it a subpage; the row menu has Move
  Up, Move Down, Indent and Outdent for keyboards and touch. A page moves with its subpages. A page is never dropped
  inside its own subtree.
- **Row menu** (icon-left verb rows under the page's name): Rename, Add Subpage, Duplicate, Copy Link, Verify,
  Always in Context (a checkmark row), Move Up, Move Down, Indent, Outdent, then Delete last, under a separator. A
  verb that cannot run stays, greyed, and says why. Delete is not red: the shared menu row never colours a verb.
  Verify and Always in Context are [Verification](verification.md)'s and [AI Knowledge](ai-knowledge.md)'s, and an
  Editor's.
- A row shows its page's verified state at its right: a tick, or a Review Due pill; nothing for a page never
  verified. The state is part of the row's name for a screen reader.
- **Search** stands at the sidebar's head, under the knowledgebase's name ([Search and Ask](search-and-ask.md)).
- **Duplicate** copies the page beside it, under the same parent, without its subpages.
- **Copy Link** copies the page's address: the knowledgebase's, with the page in its fragment (`#t=<page>`).
- **Delete** removes the page and its subpages after one confirmation that names the count ("Delete Release Process
  and 3 Subpages?"). There is no page trash: Undo brings them back, and the confirmation says so. The last page is
  never deleted, and a locked page is unlocked first. Links to a deleted page show struck through with "Deleted
  Page" ([Links and embeds](links-and-embeds.md)).
- **Breadcrumb:** the page's ancestors sit above its Title, at the head of the writing's column; each is a link. It
  shows as soon as a page with a parent opens, whether or not the page has a title yet. A top-level page has none.
  Nothing else stands in that row. Not shown on a phone, whose column has no room for it.
- On a phone the tree is a sheet opened from a Pages button in the top bar, its rows 44 px tall.
- Whoever is on a page shows in its row, as they showed on its tab.

## The continuous page

A page is one article that never breaks onto paper pages while it is being written.

- Its paper is the **continuous** size: 820 canvas px wide, as tall as the writing (`Page.size: 'fit'` with `fit`
  sides the writer keeps in step with the layout). Where the article engine would add a paper page, a knowledgebase page grows
  taller instead; where it would remove one, the page shrinks. A knowledgebase page therefore always has exactly one page.
- The page's stored height is never under 1,120 px, and it grows downwards from a top
  that never moves, so nothing placed in the writing shifts. Its height is written only when the laid-out height
  changes, by whoever made the change, in the same undo step.
- Page breaks, headers, footers and page numbers are not offered while writing, and a template carries none. A page
  break block imported from elsewhere is kept and draws nothing.
- **Export:** Word export writes the blocks and Word paginates them onto its paper. PDF export draws the page as it
  stands, one tall page: paginating the PDF onto A4 is not built (it needs the writing laid out a second time in A4
  columns), which is a known gap against livedocuments.
- The page stands as a web page does ([The page surface](page-surface.md)): its column centred, scrolled by the
  window, with no zoom and no panning of its own.
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
| Copy a page's link, fold the tree          | yes    | yes         | yes    |

Every gate reads `can`, on the client and again in the room, and ships a test per role.

A Participant comments in threads and replies in a margin note's thread. Starting a margin note puts a mark in the
writing, which is writing: it is an Editor's until the room has a rule that takes a mark and nothing else.
