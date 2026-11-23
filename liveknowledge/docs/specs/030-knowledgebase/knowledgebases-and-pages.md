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
Public) already own the word. A knowledgebase made readable by anyone is **published** ([Publish to the
Web](publishing.md)): its "public site", never its "Public".

## A knowledgebase

- A new knowledgebase has one page, **Start Here**. Made from `/new` (the Explorer's New, Home's Make Your First
  Knowledgebase) it opens on the **start screen** ([Describe to set up](describe-to-set-up.md#the-start-screen)),
  whose choices are shapes of a whole knowledgebase: Blank Knowledgebase, Describe to Set Up, and structures (Team
  Handbook, Engineering Handbook and the rest) whose picking makes their whole page tree; Import at its foot. A
  `/new?structure=<id>` link (the landing gallery, Home) makes the knowledgebase and picks that structure on it at
  once. Blank Knowledgebase, `/new?blank=1` and a `/new?template=` link open Start Here with the caret in its Title. Its name is "Untitled Knowledgebase"
  until a person names it: a page's Title names that page, never the knowledgebase. Its creator owns every page it
  starts with ([Verification](verification.md) "The owner"): the api makes a signed-in person's account each created
  page's `knowledge.owner`, from the create's credentials, and the pages a structure adds get theirs from the save
  that makes them. A guest's pages have no owner, and an Offline one's have none until its sync.
- **Where a new knowledgebase is saved.** A signed-in person's is saved to their account, in Private, so Verify,
  Ask, Insights and sharing work from the first page. A guest's, and a signed-out person's, is kept Offline in
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
- The tree is the left sidebar, replacing the tab bar: 264 px wide, the knowledgebase's name at its head (its menu's
  button, "The knowledgebase's menu"), then the pages. Rows indent 20 px a level, a page with subpages has a chevron, and open or closed is kept
  per browser, per knowledgebase. The current page's ancestors are always open, so a page opened by its link shows
  where it is. The current page wears the brand tint. A button at the sidebar's head collapses it to a narrow rail
  and back, kept per browser.
- The bottom bar keeps what else stood in it (Tools, Settings, the appearance), where it stood.
- The tree is a real tree for the keyboard (WAI-ARIA tree view), one Tab stop for the whole tree: Up and Down move
  through the rows, Home and End to the first and the last, Right opens a page or enters it, Left closes it or goes
  to its parent, Enter opens the page, F2 renames it, the menu key or Shift+F10 opens its menu, and typing a page's
  first letters jumps to the next row whose name starts with them. Tab from the focused row reaches that row's + and
  ... and then leaves the tree; no other row's buttons are Tab stops.
- **A row's + and ...** (owner 2026-11-21): with a mouse or a trackpad they show only on the row under the pointer,
  the row holding the keyboard focus, the row whose menu is open and the current page's row, fading and sliding in
  and out (150 ms, ease out; with reduced motion, at once). Their room is kept, so a title never moves or truncates
  differently. A touch screen cannot hover, so there they always show.
- **Right-click** on a page's row opens its menu (the ... menu, the same rows for the same roles) at the pointer, kept
  on screen, in place of the browser's; a long press does on a touch screen. The menu closes on Escape, a press
  outside it or a right-click elsewhere. A Viewer's menu holds Copy Link, so it is never empty.
- **Add:** "New Page" at the foot adds a top-level page; a row's **+** adds a subpage, as its last. The new page
  opens with the caret in its title, so what is typed next is its name. A page made from the writing (Create Page
  in the page link picker) is not opened; the first time it is, the caret is at the end of its title.
- A key typed outside the writing opens nothing: the editor has no element search (the fork's Search Elements, on
  S and at the end of the palette). Cmd or Ctrl K, the page search, is the knowledgebase's search, and the command
  search (Cmd or Ctrl `.`) reads the pages already open in this browser and loads no other. Cmd or Ctrl `.` opens it
  from the writing and from a field too, a new page's title caret included: the chord types nothing there.
- **Name:** a page's name and its Title are one thing: the Title is what the page is called, and its name (what the
  tree, the breadcrumb, page links and backlinks, search, Home and Insights show) follows it. The name is kept
  beside the writing only so a page can be listed without loading its writing; every way in keeps the two the same.
  - Typing in the Title renames the page in the tree as each key lands; the stored name follows when the writing
    commits (the typing pauses), so the breadcrumb, links, search, Home and Insights follow then, one write with
    the Title.
  - Renaming the page in the tree (F2, a double click, Rename) rewrites its Title; a page whose writing has not
    loaded yet is opened first, and renamed as soon as it has.
  - A Title emptied leaves the page unnamed, shown as "Untitled Page" everywhere a name shows. A page whose Title
    was never written keeps the name it was made with (Start Here, "Untitled Page").
  - The rename is no undo step of its own: undoing the typing takes the Title back, and the tree with it while the
    page is open. Not built: the stored name follows only the next time the Title is typed in.
  - With two people writing, each one's own Title edits rename the page; a Title that changes under someone (a
    peer's typing arriving, the writing loading) renames nothing in their editor, so the rename is made once.
  - An agent, the MCP server and the CLI (`create_page`, `write_page`) name a page by its title: a new page's Title
    is the title it is given, with or without writing, and a `write_page` whose Markdown sets the Title (its front
    matter's `title`) renames the page with it, in every open editor. The importers (Markdown, Notion, Confluence)
    and Describe to Set Up give each page they make one title, as its Title and its name.
- **Move:** drag a row to reorder it among siblings or drop it on a page to make it a subpage; the row menu has Move
  Up, Move Down, Indent and Outdent for keyboards and touch. A page moves with its subpages. A page is never dropped
  inside its own subtree.
- **Row menu** (owner 2026-11-21: a toolbar and categories, not one long list): under the page's name, a toolbar
  of icon buttons, Rename, Duplicate, Copy Link and Delete, each named in its hover card; then icon-left rows, Add
  Subpage, Connect File Here, Verify, Request Approval, Always in Context (a checkmark row); then a closed **Move**
  section holding Move Up, Move Down, Indent and Outdent. A verb that cannot run stays, greyed, and says why. Delete is not red: the shared menu row never colours a verb.
  Verify and Always in Context are [Verification](verification.md)'s and [Insights](insights.md)'s, and an
  Editor's.
- A row shows a Review Due pill at its right when its page is due; no Verified tick (owner 2026-11-21). The state is part of the row's name for a screen reader.
- **Search** stands at the sidebar's head, under the knowledgebase's name ([Search and Ask](search-and-ask.md)).
- **Duplicate** copies the page beside it, under the same parent, without its subpages.
- **Copy Link** copies the page's address: the knowledgebase's, with the page in its fragment (`#t=<page>`).
- **Delete** moves the page and its subpages to the knowledgebase's [Trash](#the-page-trash) after one confirmation
  that names the count ("Move Release Process and 3 Subpages to the Trash?", its button Move to Trash). The
  confirmation says they can be restored from the Trash for 30 days, and Undo brings them straight back. The last
  page is never deleted, and a locked page is unlocked first. Links to a page in the Trash show struck through with
  "In the Trash"; to a page deleted for good, "Deleted Page" ([Links and embeds](links-and-embeds.md)). An Offline
  knowledgebase has no Trash (it has no server to keep one): its Delete removes the pages, and Undo brings them back.
- **Breadcrumb:** the page's ancestors sit above its Title, at the head of the writing's column; each is a link. It
  shows as soon as a page with a parent opens, whether or not the page has a title yet. A top-level page has none.
  Nothing else stands in that row. Not shown on a phone, whose column has no room for it.
- On a phone the tree is a sheet opened from a Pages button in the top bar, its rows 44 px tall.
- Whoever is on a page shows in its row, as they showed on its tab.

## The page Trash

Owner 2026-11-21: "I deleted a page and expected to see a trash option above the new page section in the left
sidebar". A deleted page waits in its knowledgebase's **Trash** for 30 days, whole, and comes back from it as it was.
This is the knowledgebase's own Trash of pages, beside the platform's Trash of whole knowledgebases (the Explorer's),
and the two never mix: a page is never listed in the Explorer, and a knowledgebase is never listed here.

- **What it keeps.** A page in the Trash keeps everything the knowledgebase holds of it: its writing, its place
  (its parent and its place among its siblings), its cover and icon, its owner and verification, its approval, its
  comment threads and its versions. A connected file's row under it is not a page and is removed with it, as Remove
  from Sidebar removes one; it is connected again after a restore. A page shared in from another knowledgebase
  leaves as it does today, with no Trash.
- **Where it is.** A **Trash** row with a trash icon is the last item in the page list, after the last page and
  scrolling with the pages, in the sidebar and in the phone's Pages sheet. It shows only while the Trash holds pages
  (owner 2026-11-21), with its count a badge at its right (the pages a person sees in the Trash, a subpage counted
  with its page); an empty Trash shows no row, and a link to a trashed page still opens it. It is absent for a Viewer, a link confined to one page, a
  Community visitor, an embed and an Offline knowledgebase. On the rail, it is an icon button under New Page.
- **The Trash** opens over the page as a centred dialog (a sheet on a phone), "Trash", with a note that pages wait
  here for 30 days and then are removed for good. Each page put in the Trash at once with its subpages is one row:
  its name, "and 3 Subpages" under it when it took some, who moved it there and when ("Deleted by Ana, 3 Nov"), the
  days it has left ("12 days left"), **Restore** and **Delete Forever**. Newest first. An Editor has **Empty Trash** in
  the dialog's foot. Empty, it is an empty state with its illustration: "No Pages in the Trash", "Deleted pages wait
  here for 30 days."
- **Restore** puts the page and its subpages back where they stood: under their old parent, at their old place
  among its subpages. When that parent is no longer in the knowledgebase (deleted for good, or itself in the Trash),
  the page comes back at the top level, and a toast says so ("Restored Release Process at the top level: its parent
  page is gone"). A restore past the 500-page limit is refused and says why. Everyone with the knowledgebase open
  sees the pages come back.
- **Delete Forever** removes the page and its subpages for good, after a confirmation ("Delete Release Process
  forever?", "This cannot be undone.", its button Delete Forever, destructive). **Empty Trash** does the same to
  every page in the Trash, after its own confirmation.
- **How long.** A page is removed for good 30 days after it was put in the Trash (`PAGE_TRASH_DAYS`). The Trash holds
  at most 500 pages (`MAX_TRASHED_PAGES`, the knowledgebase's own page limit): putting the 501st in removes the
  oldest for good. Both are kept by the room as the Trash is read or written, so nothing runs on a schedule for it.
- **Never seen elsewhere.** A page in the Trash is in no part of the knowledgebase but the Trash: not the tree, not
  search, Ask or Insights, not Always in Context, not Home, not Linked From or a link's hover card, not an
  export, a copy or the Community, and not to an agent (`list_pages`, `read_page`, `search_knowledge`,
  `get_context`, the CLI). A link to it shows "In the Trash", struck through; pressing it opens the Trash with the
  page's row marked, for a person who may restore it; for anyone else it reads as "Deleted Page" and goes nowhere.
- **Undo** of the delete in the editor that made it still brings the pages straight back, and takes them out of the
  Trash. A save of a trashed page from another editor still open on it (a peer who was writing in it as it went)
  brings that page back too, with their writing, rather than losing it.
- **Who:**

  | Action                            | Editor | Participant | Viewer |
  | --------------------------------- | ------ | ----------- | ------ |
  | Move a page to the Trash (Delete) | yes    | yes         | no     |
  | See the Trash, Restore a page     | yes    | yes         | no     |
  | Delete Forever, Empty Trash       | yes    | no          | no     |

  A link confined to one page and a Community visitor never see it. An agent's page delete (the MCP server's
  `delete_document` with a page, the CLI's `tab rm`, `DELETE .../tabs/<page>`) also moves the page to the Trash, and
  says so in its result; an agent never lists, restores or empties the Trash, which is a person's in the editor.

## The knowledgebase's menu

The knowledgebase's name in the sidebar's head is a button with a chevron beside it, and it opens the knowledgebase's
menu: the name is the thing the menu is about, so the name is what is pressed, and no second button stands beside
it. The menu is icon-left verb rows under the knowledgebase's name:

| Row                   | Does                                                                                         | Who                                 |
| --------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| Rename                | The name becomes a field where it stands; Enter keeps it, Escape leaves it                   | Editor                              |
| Describe to Add Pages | Opens [Describe to Set Up](describe-to-set-up.md), once it holds writing                     | Writer, signed in                   |
| Import                | Opens Import                                                                                 | Writer                              |
| Export                | Opens Export                                                                                 | everyone                            |
| Publish to the Web    | Opens [Publish to the Web](publishing.md): the knowledgebase, or a section, as a public site | Editor, signed in, not kept Offline |
| AI Settings           | Opens AI Settings ([Search and Ask](search-and-ask.md))                                      | Editor, not kept Offline            |
| Delete                | Moves the knowledgebase to the Trash, after its own confirmation; last, under a separator    | Editor                              |

- Knowledgebase Style is not a row: it opens from the footer's Style ([Knowledgebase Style](page-surface.md#knowledgebase-style)).
- "Editor" is an Editor of the whole knowledgebase; "Writer" is an Editor or a Participant of the whole
  knowledgebase ([Share roles](#share-roles)). A Participant's menu is Describe to Add Pages, Import and Export; a
  Viewer, a link confined to one page and a Community visitor have Export alone. An embed has no menu, and shows the
  name as text. Rename and Delete stay an Editor's: the name and the Trash are the knowledgebase's as an item, which
  the platform's share roles keep for an Editor.
- A row a session is not offered is absent, not greyed: each is decided by the feature it opens, so the menu never
  offers what the feature would refuse.
- **Keyboard and screen readers:** the button says it has a menu and whether it is open, and is named with the
  knowledgebase's name. Enter, Space, Down Arrow or a press opens the menu with the first row focused; the arrow keys, Home and
  End move through the rows, a letter jumps to the row that starts with it, Enter chooses, and Escape closes it with
  the focus back on the button. Each row is a menu item.
- **Typing a new name renames.** The name is what is pressed, so a person who presses it and types a name is renaming
  it. While the letters typed spell the start of a row they jump to it, as above; the first letter that spells no row
  starts Rename with every letter typed so far, the caret after them, and the rest of the name carries on in the field
  ("Team Handbook" is kept whole, never "Handbook"). A space inside the name is the name's, never a press of the
  focused row; a space with nothing typed still chooses it. The letters build one search as the typeahead's do (500
  ms between keys), and a key typed before the menu has taken focus counts. Only where Rename is a row: a Participant's
  or Viewer's typing stays the menu's.
- **On a phone** the same menu opens from the head of the Pages sheet, its button 44 px tall. Rename renames in the
  sheet; every other row closes the sheet, since what it opens stands over the page.

## The continuous page

A page is one article that never breaks onto paper pages while it is being written.

- Its paper is the **continuous** size: 856 canvas px wide (a 760 px column and its margins), as tall as the writing (`Page.size: 'fit'` with `fit`
  sides the writer keeps in step with the layout). Where the article engine would add a paper page, a knowledgebase page grows
  taller instead; where it would remove one, the page shrinks. A knowledgebase page therefore always has exactly one page.
- The page's stored height is the writing's (never under 240 px, the margins and a Title's line), and it grows
  downwards from a top that never moves, so nothing placed in the writing shifts. Its height is written only when the laid-out height
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

A Participant is an Editor minus three things (owner, 2026-11-21): **the Review Period** (changed from Page
Health), **Knowledgebase Style** and **automations**. Sharing and roles stay as the platform has them: a
Participant never manages who has access.

| Action                                                          | Editor | Participant | Viewer |
| --------------------------------------------------------------- | ------ | ----------- | ------ |
| Read pages, follow links, search                                | yes    | yes         | yes    |
| Edit a page: Edit, co-edit the draft, Save, Cancel, Discard     | yes    | yes         | no     |
| Comment (margin notes, threads at the page's foot)              | yes    | yes         | no     |
| Add, rename, move, duplicate, delete pages (to the Trash)       | yes    | yes         | no     |
| See the page Trash, restore a page from it                      | yes    | yes         | no     |
| Delete a page forever, Empty Trash                              | yes    | no          | no     |
| Set, change or remove a page's cover                            | yes    | yes         | no     |
| Verify a page, change its owner, set Always in Context          | yes    | yes         | no     |
| Request Approval; Approve or Reject another's request           | yes    | yes         | no     |
| Describe to Add Pages, Import                                   | yes    | yes         | no     |
| Accept or dismiss an agent's suggestion                         | yes    | yes         | no     |
| Change the Review Period                                        | yes    | no          | no     |
| Knowledgebase Style                                             | yes    | no          | no     |
| Automations (none built yet; the rule stands for when they are) | yes    | no          | no     |
| AI Settings (the key and the model), allow an agent to write    | yes    | no          | no     |
| Rename or delete the knowledgebase, share it, change roles      | yes    | no          | no     |
| Publish to the Web, change what is published, Unpublish         | yes    | no          | no     |
| Export, from the knowledgebase's menu                           | yes    | yes         | yes    |
| Copy a page's link, fold the tree                               | yes    | yes         | yes    |

"Participant" is a person in their own session. An agent's token keeps its scopes as
[Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md) has them: a token below `write` acts as a
Participant did before this rule (it suggests, it never writes), and only an Editor's token writes.

Every gate reads `can`, on the client and again in the api and the room, and ships a test per role. The room relays a
Participant's page changes as it does an Editor's; it strips the knowledgebase's settings (its Review Period) and Style from every
socket's metadata, whoever sent it, and the api refuses a Participant's settings and style writes.

A Participant starts margin notes too: the mark it puts in the writing is writing, which is now a Participant's.
