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

## Share roles

Inserting or removing a link or an embed is writing: Editor only. Following links, reading backlinks and opening an
embedded item: every role (the embedded item's own sharing decides whether it opens).
