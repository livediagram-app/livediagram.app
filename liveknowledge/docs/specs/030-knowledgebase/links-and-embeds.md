# Links and embeds

Status: **built in the editor, not yet verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md)
step 6; [blueprint](blueprints/knowledge-ui.md)). Page links and Linked From are built as written here, except that a link's hover card
shows first lines only for a page this editor has already opened. Embeds from other apps are the platform's live
embed, placed from the slash menu, which is not the card described below: the blueprint lists each difference.

## Page links

- Typing `[[` in the writing opens a picker of the knowledgebase's pages, filtered as you type; Enter inserts a **page link**.
  The slash menu's "Link to Page" and pasting a page's URL do the same. Choosing "Create Page" at the foot of the
  picker makes a subpage of the current page with the typed title and links to it.
- A page link is a run with `page: <tab id>`, so it follows the page through renames and moves. It always shows the
  page's current title. Pressing it opens the page; hovering shows a card with the title, its verified state and its
  first lines.
- A link to a deleted page stays in the writing, struck through, labelled "Deleted Page", and goes nowhere.
- Markdown in and out: `[[Title]]` on import resolves to a page of that title in the knowledgebase (first match in tree order;
  no match stays plain text), and export writes `[Title](relative/path.md)`.

## Backlinks

- The foot of every page lists **Linked From**: the pages whose writing links here, as chips, in tree order. No
  backlinks shows nothing (not an empty state: the section is absent).
- The room keeps the link table (`page_links(from_tab, to_tab)`) in the knowledgebase's Durable Object, rewritten for a page
  whenever its writing is saved. Backlinks are read from it, never by scanning every page.

## Embeds from other apps

- The slash menu's **Embed** takes a link to a livediagram, liveplanner, livedocuments, livedesign or livehuddle item
  (or a tab of one) the person can open, and adds an embed zone: a framed card with the app's logo mark and wordmark,
  the item's name, its current preview picture and **Open**.
- The picture is the platform's preview of that item (`/api/previews`), so it follows the item as it changes; the card
  re-reads it when the page opens and every five minutes while it is visible. A reader who cannot open the item sees
  the frame with "You Don't Have Access to This".
- External links (YouTube, Figma, Loom and the rest) embed as they do in livedocuments.

## Connected files in the sidebar

Owner, 2026-11-21: "Connect File shouldn't be a tab, we should be able to add it to the sidebar and then clicking it
opens that in a new tab". (This replaces the earlier ask that connected files show as footer tabs.)

- **Connect File** (the page tree's + menu, and the tree's context menu) adds another app's file (a canvas, plan,
  document, design or Space) to the page tree as a **connected row**: led by its app's logo, its name following the
  file's own name, with a small arrow-out mark after it. It is placed like a page (at the top level or under a page)
  and moved by drag as pages are, but it holds no subpages.
- **Pressing it opens the file in its own app in a new browser tab** (`target="_blank"`, `noopener`). It never opens
  inside the knowledgebase: there is no connected tab, no host view and no footer tab for it.
- Its row menu: Open (new tab), Copy Link, Move To, Remove from Sidebar (the file itself is untouched). A file that
  can no longer be opened (deleted, or access lost) shows an amber dot and "Can't Open" with Connect Again and Remove.
- Search, Ask and agents do not read connected files; page links and embeds are unchanged.
- Editors and Participants add, move and remove connected rows; Viewers and link visitors see and open them only
  (opening still needs access to the file in its own app).
- The footer keeps Pages, Ask and AI Knowledge only.

**Details** (decided 2026-11-21, building the owner's ask):

- **Where Connect File is.** The sidebar's foot keeps New Page and, beside it, an Add to Sidebar button whose menu
  holds Connect File, with liveworkspace's mark (New Page is beside it, so the menu does not repeat it; owner 2026-11-21); a page's row menu has Connect File Here, which places the file as that page's last
  subpage. Either opens the Connect File dialog (the shared Connect list: Recent, Find a file, the role, both ways);
  picking a file adds its row and closes the dialog. A file already in the sidebar says Connected, and picking it
  goes to its row. Connect File needs an account and a knowledgebase on the server (never one kept Offline, an embed
  or a link confined to one page).
- **A row is never the open page.** Pressing it, Enter on it and its menu's Open open the file in a new browser tab
  and leave the page you are on open. When a knowledgebase loads, or a page is deleted, the open page is always a
  page, never a connected row.
- **Where it leads** is asked of the index once a row is drawn (one ask a row for the session, at most four at once),
  so the row is a real link (`<a target="_blank" rel="noopener">`: a middle click and Cmd-click work as on any link)
  and a row that opens nothing shows Can't Open at once. Copy Link copies that address. The name the index answers
  is the row's name: a writer's editor renames the row to match.
- **Can't Open**, in amber, says why in its hover card: the file was moved to the Trash or deleted; its link was
  removed; or the row came with a copy or an import. Its menu offers Connect Again (when the link was removed or it
  came with a copy, for a writer) and Remove from Sidebar. A row that could not be asked (offline, the network) stays
  a plain row, and pressing it asks again.
- **It is not a page.** It never counts toward the 500 pages, holds no subpages (nothing drops into it, and a stored
  subpage under one reads at the top level), takes no Rename, Duplicate, Verify or Always in Context, and is never in
  search, Ask, backlinks, the page link picker or Export. Agents see it in `list_pages` as a row with
  `kind: "connected"` and its app; `read_page` on it says it is a connected file. The index allows 50 connections a
  knowledgebase (`CONNECTIONS_PER_ITEM`).
- **Remove from Sidebar** removes the row at once, with no confirm (the file is untouched).

## Share roles

Inserting or removing a link or an embed is writing: an Editor or a Participant. Following links, reading backlinks and opening an
embedded item: every role (the embedded item's own sharing decides whether it opens).
