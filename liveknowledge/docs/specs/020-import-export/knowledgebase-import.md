# Wiki import

Status: **spec**, not built ([Build plan](../005-project-roadmap/build-plan.md) step 12).

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
