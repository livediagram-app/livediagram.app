# Wiki import

Status: the engine is **built** (`@liveknowledge/knowledge-import`, [blueprint](blueprints/knowledgebase-import.md)); the Import
dialog and writing the pages are **spec**, not built ([Build plan](../005-project-roadmap/build-plan.md) step 12).

Bring a whole wiki in from elsewhere. All three sources live in the one Import dialog as choices, beside the
single-file imports the fork already has ([Markdown import](markdown-import.md), [Office import](office-import.md)).

| Source                 | Takes                                              | Page tree from                                              |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| **Markdown Folder**    | a folder, or a `.zip` of `.md` files and pictures  | the folders; `README.md` or `index.md` is the folder's page |
| **Notion**             | Notion's "Markdown & CSV" export `.zip`            | Notion's nested folders, with the 32-character ids removed  |
| **Confluence**         | a space's HTML export `.zip`                       | `index.html`'s nested list, else each page's breadcrumb     |

- **Titles:** the first `#` heading, else the file name (Notion's id suffix and Confluence's numeric suffix removed).
- **Links between pages** (relative `.md` links, Notion's encoded paths, Confluence's `href`s to sibling files, and
  `[[Title]]`) become page links. A link whose target is not in the import stays a plain link.
- **Pictures** in the archive upload to Media and sit in the writing as picture zones; other attachments are listed
  at the foot of their page as plain names (v1 does not store files).
- **Notion:** a database's CSV becomes a table on its page; callouts become quotes; toggles become a heading and its
  content. **Confluence:** info, note and warning macros become quotes with a bold first word; code macros become
  code blocks; user mentions become plain names; everything else falls back to its text.
- HTML is parsed with the trusted-types `parseInert`, never `DOMParser`, and nothing from the archive is ever
  rendered as HTML.
- **Where it lands:** into a new wiki, or under a chosen page of the current one. The dialog first shows what it
  found (pages, pictures, anything it will skip and why) and imports only on **Import <n> Pages**.
- **Bounds:** 200 MB an archive, 500 pages (the wiki's limit, counted with the pages already there), 10 MB a picture.
  The archive is read in the browser as a stream, page by page; pages are written in batches of 20 so a large import
  never holds every page in memory or sends one huge message. A failed page is reported by name at the end; the rest
  are kept.
- Imported pages are Never Verified, owned by nobody.
- Editor only. One undo step is not offered for a whole import: the dialog says so, and the pages land under one
  parent so they can be deleted together.

## What the engine answers

The engine reads an archive and answers an **import plan**; it writes no page and uploads no picture. The dialog
shows the plan and writes it.

- **The plan:** the pages in tree order, each with a key (`p1`, `p2`, ...), its title, its parent's key, its writing
  as Markdown, its page links, its pictures (read only when asked for), its attachments' names and its warnings; and
  a summary: how many pages, pictures and attachments, what is left out and why, and how many files no page uses.
- **Page links** in the Markdown are ordinary links whose address is `knowledgebase-page:<key>`, and pictures are
  `![alt](knowledgebase-picture:<index>)`, the index into the page's pictures. (Not `[[key|Title]]`: a `|` would
  split a table cell.) The dialog turns them into page-link runs and picture zones once the pages exist.
- **`[[Title]]`** finds the first page of that title in tree order, else the first of that file name; with no match
  it stays as written.
- **A link that runs something** (`javascript:`, `vbscript:`, `data:`, `file:`) keeps its words and loses its
  address, with a warning on the page.
- **A folder nobody owns** (no `README.md` or `index.md`; in Notion, no page or database of its name) that holds
  pages gets an empty page of its name, so its pages keep their place. Folders that only wrap the whole archive (the
  zipped folder itself, Notion's `Export-...`) are not pages.
- **The top folder's own page** (`README.md` at the top) is a top-level page listed first, not the parent of the
  rest.
- **Sibling order:** by name as a person lists them (`Page 2` before `Page 10`); Confluence keeps its index's order.
- **Deeper than 8 levels** (counting the levels above the page the import lands under): the deeper pages sit at
  level 8, after the page they were under, each with a warning.
- **Two pages of one title** are both kept; the later one carries a warning.
- **A missing picture** leaves its alt text and a warning; a picture past 10 MB is left out the same way and listed.
- **Attachments** a page links to are named in a list under a bold **Attachments** at the foot of its writing.
- **A Notion toggle** is read where the export writes it as `<details>`; one it writes as a plain list item stays a
  list item, as nothing tells the two apart.
- **A link from the outer link of a picture link** (`[![alt](picture)](address)`) keeps its address as written; the
  picture inside is collected.
- **It cannot fit:** an archive past 200 MB, or more pages than the knowledgebase has room for, answers a plan with
  no pages that says which, with the count found and the room there is. Nothing is read to find that out.
- **A page that cannot be read**, or whose source is past 5 MB, is listed by its path and left out; a link to it
  stays an ordinary link.
