# Illustrate for agents

How an agent (the MCP tools and the CLI's verbs, [Agents](README.md)) reads and makes the pages of a tab in
Illustrate mode: infographic, slide and logo pages ([Illustrate pages](../007-editor/illustrate-pages.md),
[Logo pages](../007-editor/logo-pages.md)) and articles ([Article pages](../007-editor/article-pages.md)). People
with the document open see an agent's pages and writing arrive at once, as anyone's.

The bar: an agent asked to "write a document", "make a deck" or "design a logo" makes it on the right kind of page
on the first try, writes an article in Markdown, and is never told a change worked when it shows on no page.

## Domain language

| Term             | Means                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **page**         | One `IllustratePage` of a tab, as [Illustrate pages](../007-editor/illustrate-pages.md) defines it          |
| **page place**   | A page's 1-based position in the tab's row (`2` is the second page): what agents and people count by        |
| **page change**  | One entry of a `change_pages` call: `add`, `set`, `layout`, `move`, `duplicate` or `delete`                 |
| **article**      | One flow of article pages and its writing (`Tab.articles[flow]`), named by its flow id or its title         |
| **title**        | The text of an article's first `title` block; what `write_article` and the views name an article by         |
| **front matter** | An optional `---` fenced block of `title:` and `subtitle:` lines at the top of the Markdown an agent writes |

The interface's words are kept: an agent writes an **article**, never a "document" (the document is the file).

## The front doors

- **MCP**: two tools, `change_pages` and `write_article` ([MCP server](../015-api/mcp-server.md#49d-the-illustrate-tools)),
  and the `pages` view of `read_document`.
- **CLI**: `page ls` (the `pages` view), `page set` (`change_pages`), `article get` (one article as Markdown) and
  `article set` (`write_article`) ([CLI](../015-api/cli.md)).
- Both go through one api route, `POST /api/documents/:id/tabs/:tabId/illustrate`, over one pure engine shared with
  the editor, so an agent's page edit is exactly the edit the page panel makes.
- `create_document` and `add_tab` with an Illustrate template (`article`, `slide-deck`, `logo-design`, the poster
  family, `blank-illustration`, ...) still make a tab on its pages; the new tools then change it.

## Which tab

- Both tools take an optional `tabId`. Absent, they act on the document's first tab in Illustrate mode
  (`opensIn: 'illustrate'`), else its first tab when that tab is empty (switching it loses nothing: a document
  just made for pages). A document with neither is refused (`tab_needed`), saying to name a tab (which switches
  it) or to `add_tab` with template `blank-illustration`: a diagram is never switched into Illustrate unasked.
- A tab named that is not in Illustrate mode is switched into it by the same edit, as the editor's mode switch does
  (`withEditorModeSwitched`: content past the first page is put onto a page of its own). The answer says
  "Switched the tab to Illustrate".
- An Event Storming tab is refused (`tab_kind`): it never changes mode.
- A locked tab is refused (`tab_locked`).

## Naming a page

- A page is named by its **id** (`page-3f2a91c0`), its **place** (`2`, or `"2"`), or its **name** (case and spacing
  aside). An id wins over a place, a place over a name.
- An unknown page is refused (`page_unknown`) with the pages there are ("Pages: 1 Cover (slide), 2 (slide),
  3 Logo (logo)").
- Places are read against the pages as the changes before it left them, so `[delete 2, set 2]` sets the page that
  was third.

## `change_pages`

Up to **50** page changes, applied in order, each to the tab as the ones before it left it, written as **one**
edit. A refused change stops the batch and nothing is written; the answer names the change and why, and what the
changes before it would have done.

| Change      | Fields                                                                                               | Does                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `add`       | `kind` (infographic, slide, logo), `size?`, `orientation?`, `name?`, `background?`, `layout?`, `at?` | A new page of the kind, sized as the editor's **+** sizes it unless told, at place `at` (default the end)        |
| `set`       | `page`, `name?`, `size?`, `orientation?`, `background?`, `locked?`                                   | The page panel's edits; on an article page size, orientation and background change every page of the article     |
| `layout`    | `page`, `layout`                                                                                     | Puts a layout onto the page in place of everything on it, as the panel's Layouts do                              |
| `move`      | `page`, `to`                                                                                         | Moves the page (an article page: its whole article) to place `to`, its content with it                           |
| `duplicate` | `page`                                                                                               | A copy after it, content and all (an article: the whole article and its writing)                                 |
| `delete`    | `page`                                                                                               | Removes the page and everything on it (an article page: the whole article, writing and all); never the last page |

- **Article pages are made by `write_article`**, never by `add`: an `add` of kind `article` is refused
  (`article_by_write`) with that hint.
- **The first page's choice**: while the tab's only page is unchosen and empty, an `add` of a kind makes that page
  the kind (`withPageKindChosen`) instead of adding a second page, so a fresh Illustrate tab does not keep an empty
  first page.
- **Sizes**: a page takes only the sizes its kind offers (`pageSizesFor`); any other is refused (`size_not_offered`)
  naming the ones it takes. Fit to Content is never chosen (`size_not_offered`). A slide or logo page has no
  orientation; turning one is refused (`no_orientation`).
- **Backgrounds**: `{ color }` (a hex) is a solid fill, `{ gradient: [from, to], angle? }` a two-stop gradient
  (angle in degrees, default 160, the panel's), `pattern` one of `dots`, `grid`, `lines` or `none`, `{ paper: true }` back to the
  plain paper. A logo page takes no pattern (`pattern_not_offered`). A new fill re-inks the page's own-coloured
  content as the panel does (`withPageInkFor`).
- **Layouts**: a layout id the page's kind offers (`layoutCatalogueFor`); any other is refused (`layout_unknown`)
  naming the kind's layouts. Laid out in the page's content box, in the tab's theme.
- **Locks**: a locked page refuses every change but `set { locked: false }` (`page_locked`); on an article any
  locked page refuses the changes that reach all its pages, as in the editor.
- **Limit**: a tab holds at most 100 pages (`MAX_ILLUSTRATE_PAGES`); an `add` or `duplicate` past it is refused
  (`page_limit`).
- **The answer**: one line per change ("Added page 3 (slide, 16:9) from layout Title", "Deleted page 2 and 4
  elements on it"), then the tab's pages as they now are: place, id, name, kind, size and orientation, the page's
  rectangle on the canvas (`x, y, width, height`) and how many elements are on it. Elements are put onto a page with
  `update_document`, at coordinates inside its rectangle.

## `write_article`

Writes an article's text from **Markdown**.

- **Which article**: `article` names one by flow id or title (case aside). Absent: the tab's only article; with none,
  a new article; with two or more, refused (`article_ambiguous`) naming them. A named article that is not there is
  refused (`article_unknown`). `new: true` always starts a new article.
- **A new article** is made as the editor's **+** makes one (A4 portrait, or the last page's paper size and
  orientation when it is A4, US Letter or A3), after the last page, or, while the tab's only page is unchosen and
  empty, on that page. `size` and `orientation` may set its paper (an article's sizes, `pageSizesFor('article')`).
- **`mode`**: `replace` (default) writes the article's text anew; `append` adds the blocks after its last block.
- **The Markdown** (the editor's paste reading, `parseMarkdownBlocks`, shared): `#`, `##`, `###` headings (h1 to
  h3), paragraphs, `-` / `*` / `1.` lists by indent (five levels), `- [ ]` / `- [x]` to-dos, `>` quotes, fenced
  code, `---` dividers; bold, italic, strikethrough, inline code and links (http, https, mailto). A line holding only
  `\pagebreak` is a page break.
- **Front matter** sets the title and subtitle: a first line `---`, then `title: ...` and `subtitle: ...` lines, then
  `---`. They become the article's `title` and `subtitle` blocks, first. Without front matter the text is written as
  given (a replace keeps no old title).
- **Zones** (objects and drawings in the text) are written as a line `[zone <id>]`, as the `pages` view prints them.
  A replace keeps a zone exactly where its line is; a zone of the article whose line is missing is removed with the
  elements in it, and the answer says so ("Removed zone z-12 and 3 elements"). An unknown zone id is refused
  (`zone_unknown`). New zones are made in the editor, not by agents.
- **Margin notes** live on runs; a replace keeps none and removes their markers, saying how many; append keeps them.
- **Style**: `look` (`clean`, `classic`, `report`, `notebook`, `bold`), `accent` (a hex) and `pageNumbers` set the
  article's style, the rest left as it is.
- **Limits**: the Markdown at most **400,000** characters (`ARTICLE_MARKDOWN_MAX`), the article at most
  `MAX_ARTICLE_BLOCKS` (5,000) blocks, a block at most `MAX_ARTICLE_BLOCK_TEXT` (20,000) characters; past any of
  them the call is refused (`article_too_large`) saying which. The tab's own byte cap has the last word
  (`tab_too_large`).
- **Locked** article pages refuse it (`page_locked`).
- **The answer**: the article's flow id, title, pages, block count and words, and the page count it reaches is
  settled in the editor (below), said plainly: "Written: 42 blocks, 1,830 words. The article flows onto more pages
  as it is laid out in the editor."

## Pages for the writing

Where a line breaks is measured by the editor, so the server never counts an article's pages
([Article pages](../007-editor/article-pages.md) "Flowing onto pages").

- An article whose writing reaches past its last page is grown by an editor that is not its writer at two moments
  only: the first lay-out after **an agent's write** reaches it (the relayed `article` op says `agent: true`), and
  the first lay-out after **the tab loads** (a writer who left before settling). Pages are added, never removed, as
  the writer's would be; shrinking stays the writer's. Any other time the writer settles, as today, so two devices
  measuring type a line apart never take turns adding and removing a page.
- Two editors growing it at once each send their pages; the `tab-meta` patch is the last one's, whole, so the row
  never holds both sets, and the next lay-out settles what is left.
- A locked page holds the article as it is: nothing is grown.

## Reading: the `pages` view

`read_document` with `view: "pages"` (the CLI's `page ls`, and `read --view pages`) answers, for an Illustrate tab:

- each page in row order: place, id, name, kind, size and orientation, the rectangle, background, locked, and the
  refs of the elements on it (the outline's refs, [Document views](document-views.md));
- each article: flow id, title, its pages' places, block count, words, style look, and its writing as Markdown in
  the form `write_article` takes (front matter, `[zone <id>]` lines), so read, edit, write back round-trips;
- the layouts each kind on the tab offers, by id and label.

A tab not in Illustrate mode answers one line saying so and how to switch it (`change_pages`). The view keeps to the
read budget: past it an article's Markdown stops at a block boundary with "(truncated: N more blocks; read with
`article get`)". The outline's header names an Illustrate tab's page count and points at the view.

## The route

`POST /api/documents/:id/tabs/:tabId/illustrate` with `{ pages?: PageChange[], article?: ArticleWrite, base?: rev }`
(exactly one of the two).

- Open to anyone who may edit the tab (a person's session or an API token); a read-only token is refused as every
  write is.
- Reads the tab at its revision, applies the engine, and writes the tab at that revision: elements through the
  changeset write (so their ops are recorded, merged into later saves, relayed and revertible), the pages,
  `opensIn` and articles with them in the same batch. A revision that moved meanwhile is read again and applied
  once more; a second move answers `409 tab_busy`.
- Relays to the document's room what an editor's own edit sends: the changeset's element ops, a `tab-meta`
  `{ pages, opensIn }` patch, and the `article` ops (block diffs) of each article written. The room relays without
  reading them, as it does an editor's.
- **Known gap** (the tab rename's, [Agent changesets](agent-changesets.md#whole-tab-saves-and-tab-renames)): a
  whole-tab save an editor already had in flight when the write landed carries the pages and writing it had. The
  relay reaches that editor first in every other case, and its next save carries the agent's.
- Refusals answer `400` (or `409`, `413`) with `{ error: <code>, message }`, the codes above, the same text on the
  CLI and the MCP.

## Observability

Every decision logs with the `[illustrate-agent]` fingerprint: `applied` (document, tab, changes, rev), `refused`
(code, change index), `stale-retry`, `relay-missed`, and in the editor `[article] grown for an absent writer`
(flow, pages).

## Telemetry

- An agent's page change or article write sends the server-side `Agent · Applied` with its front door (`Mcp`,
  `Cli`, `Api`), as a changeset does; a refusal sends nothing.
- Reading the `pages` view sends `Agent · Viewed · Pages`, as every view does.
- The editor's grow for an absent writer is not a person's action and sends nothing.

## Non-goals

- Agents making zones (objects and drawings in the text) or margin notes.
- Exact page counts for an article without an editor.
- A picture of the pages in the tool answer (the PNG the diagram tools return draws elements, not pages).
- Recording page and article writes in the changeset history for revert (only their elements are).
