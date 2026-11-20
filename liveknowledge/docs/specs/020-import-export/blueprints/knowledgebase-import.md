# Knowledgebase import blueprint

Derived from [Knowledgebase import](../knowledgebase-import.md). This blueprint covers the **engine**,
`@liveknowledge/knowledge-import` (`packages/knowledge-import`): an archive in, an import plan out. The Import dialog,
the zip reader's wiring, the picture upload and the page writes are not built and not covered here.

## Domain and naming

| Term             | Identifier                                  | Means                                                                      |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| archive          | `ImportArchive`                             | A sync or async iterable of `ArchiveEntry`: a picked folder, a zip, a test |
| archive entry    | `ArchiveEntry`                              | `{ path, size?, read() }`: one file, its bytes read only on `read()`       |
| source           | `ImportSource`                              | `'markdown-folder' \| 'notion' \| 'confluence'`                            |
| listing          | `ArchiveListing`                            | Every file's normalised path and reader, by `keyOf(path)`; no bytes        |
| draft            | `DraftPage`                                 | A page as a reader hands it over: tree place, Markdown, links as written   |
| reader           | `SourceReader`                              | `{ isPage(path), read(context) }`, one per source                          |
| plan             | `ImportPlan`                                | `{ pages: PlannedPage[], summary: ImportSummary }`                         |
| page key         | `PlannedPage.key`                           | `p1`, `p2`, ... in tree order; unique in one plan                          |
| page link scheme | `PAGE_LINK_SCHEME` (`knowledgebase-page:`)  | A page link's address in planned Markdown, followed by the target's key    |
| picture scheme   | `PICTURE_SCHEME` (`knowledgebase-picture:`) | A picture's address in planned Markdown, followed by its index in the page |
| block            | `ImportBlock`                               | Why nothing can be imported: `archive-too-large` or `too-many-pages`       |

## Modules

All in `packages/knowledge-import/src/`, each with its test beside it.

| Module                | Holds                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `index.ts`            | The package's surface: `planImport`, `zipEntries`, the limits, the plan's types and the two schemes               |
| `plan.ts`             | `planImport(source, archive, options)`: the one door, and the order of the steps below                            |
| `types.ts`            | The archive, options, plan, summary, warning and skip types                                                       |
| `limits.ts`           | Every bound as a named constant, and `ImportLimits` / `DEFAULT_LIMITS`                                            |
| `paths.ts`            | `normalisePath`, `keyOf`, `resolveFrom`, `decodeTarget`, name ordering, picture extensions                        |
| `archive.ts`          | `listArchive`, `readText`, `ImportSizeError`, `zipEntries` (a zip reader's entries as an archive)                 |
| `draft.ts`            | `DraftPage`, `ReadContext`, `SourceReader`                                                                        |
| `page-source.ts`      | `readPageSource` (one page's text, or a skip), `titleOfMarkdown` (first `#` heading, front matter dropped)        |
| `markdown-scan.ts`    | `rewriteMarkdown`: one pass that hands links, pictures and `[[Title]]` outside code to a visitor; `proseLines`    |
| `folder-tree.ts`      | `folderDrafts`: the tree a folder of files makes, shared by Markdown Folder and Notion                            |
| `tree.ts`             | `arrangeTree`: tree order, missing parents, loops, the depth limit                                                |
| `resolve.ts`          | `buildLookups` (once an import) and `resolvePage`: page links, pictures, attachments, unsafe links                |
| `markdown-folder.ts`  | The Markdown Folder reader                                                                                        |
| `notion.ts`           | The Notion reader; `stripNotionId`                                                                                |
| `notion-markdown.ts`  | Callouts (`<aside>`) to quotes, toggles (`<details>`, `<summary>`) to a heading and content                       |
| `csv.ts`              | `parseCsv` (RFC 4180, one pass) and `csvToMarkdownTable`                                                          |
| `confluence.ts`       | The Confluence reader: the index's tree, breadcrumbs, titles, the attachment list                                 |
| `html-document.ts`    | `parseHtmlDocument`: the only place archive HTML is parsed, through `parseInert` (`@liveworkspace/trusted-types`) |
| `html-to-markdown.ts` | `htmlToMarkdown(element)`: the walk over the inert document                                                       |
| `__fixtures__/`       | `archiveOf`: a test archive built from strings that records every read                                            |

## planImport

`planImport(source, archive, options): Promise<ImportPlan>`. Options: `existingPages` (default 0), `parentDepth`
(the depth of the page the import lands under, 0 for a new knowledgebase), `archiveBytes` (the archive file's size,
when known), `limits` (overrides, for tests). Steps, in order:

1. `options.archiveBytes` over the archive limit: a blocked plan (`archive-too-large`). Nothing is opened.
2. **Listing** (`listArchive`): the archive is iterated once. Each entry's path is normalised; a path that is empty
   or climbs out of the root is skipped (`outside-archive`); folder entries, `__MACOSX/` and `.DS_Store` are passed
   over; a second file of the same key is passed over. Declared sizes are summed. Past the archive limit or the
   entry limit the listing stops and the plan is blocked (`archive-too-large`). No entry is read.
3. **The page limit, before reading:** the files the reader calls pages are counted. More than the room
   (`limits.pages - existingPages`, at least 0): blocked (`too-many-pages`, with `found` and `room`).
4. **Reading:** the source's reader reads its pages one at a time (`readPageSource`) and answers drafts in sibling
   order. A page whose read throws is skipped (`page-failed`); one past the page source limit is skipped
   (`page-too-large`); the rest continue.
5. **The page limit, after reading:** folders nobody owns and databases with no page of their own are pages too, so
   the drafts are counted again against the room; over it, blocked.
6. **The tree** (`arrangeTree`, depth `max(1, limits.depth - parentDepth)`): pages are placed depth first and keyed
   `p<n>` in that order. A flattened page gets a `flattened` warning, a page whose title an earlier page has a
   `duplicate-title` warning.
7. **Resolving** (`buildLookups` once, then `resolvePage` for each page): see below.
8. **The summary:** pages, pictures (distinct files), attachments, the skipped list, `ignoredFiles` (files listed
   and never used as a page, a picture or an attachment), `blocked: null`.

A blocked plan has `pages: []`, the skips found so far and `blocked` set.

## Paths

- `normalisePath`: backslashes become slashes; empty and `.` segments go; `..` pops a segment and answers null when
  there is none to pop. A leading slash therefore reads from the archive's root, never the machine's.
- `keyOf`: NFC, lower case. Every lookup (files, pages, folders) is by key, so links written in another case or
  another Unicode form still find their file; the first file of a key wins.
- A link's address is cut at `?` or `#`, %-decoded (`decodeTarget`; a malformed escape is kept as written), then
  resolved against the page's folder (`resolveFrom`). An address that climbs out resolves to null and is never
  looked up.

## Titles

- Markdown and Notion pages: `titleOfMarkdown`. YAML front matter is dropped. The title is the first line outside
  fenced code matching `# Title` (closing `#`s dropped). When only blank lines come before it, the heading leaves
  the writing (it becomes the page's Title block); otherwise the writing keeps it.
- No heading: the file's name without its extension; for `README.md` or `index.md`, its folder's name (the top one
  keeps its file's name); for Notion, the name with its id removed (`stripNotionId`: an optional space or hyphen and
  32 hex digits at the end).
- Confluence: the index's link text, else `#title-text` without the space's name before `:`, else the file's
  name with a trailing `_<digits>` or `-<digits>` removed and `-`, `_`, `+` read as spaces.

## Folder trees

`folderDrafts(pages, titleOfFolder)`, for Markdown Folder and Notion. Each page says which folder it **owns**
(Markdown: a `README.md` or `index.md` owns its folder; Notion: `Name <id>.md` and a database's `.csv` own the folder
`Name <id>`), or none.

- A page's home folder is its own folder's parent when it owns one, else the folder it is in. Its parent is the page
  that owns its home folder.
- A home folder nobody owns gets an empty page (`id` `folder:<key>`, titled by the folder's name through
  `titleOfFolder`), made once and placed the same way, so chains of unowned folders each get one.
- The wrapper: starting at the root, while every page lies under one same next folder and no page sits in or owns
  the current one, that folder is skipped. Pages in the wrapper are top-level.
- Order: every page sorts by its name (`compareNames`: case-blind, numeric); the top folder's own page sorts first.
  `arrangeTree` keeps that order among siblings.

Notion's reader also: keeps the `.csv` with every row when a database has both (`_all.csv` wins), writes the table
after the database page's own writing, or makes a page for a database with none; and marks both spellings of the
`.csv` path as the page's, so links to either resolve.

## The tree

`arrangeTree(items, maxDepth)` walks once with an explicit stack.

- A parent id that is not among the items reads as none: the page is top-level.
- A page is placed once. Parents that only lead to each other are never reached from the top, so each such loop
  surfaces at the top level from its first page, and the walk does not follow it round again.
- A page at `maxDepth` passes its own parent to its children and marks them flattened, so everything deeper sits at
  the last level, after the page it was under.

## The Markdown scan

`rewriteMarkdown(source, visit)` reads the Markdown a line at a time and skips fenced code (a fence closes on its
own character, at least as long as it opened) and code spans (a run of backticks to the next run of the same
length on the line). An escaped character (`\x`) is copied. It recognises:

- `[text](address)` and `![alt](address)`: the text may not hold `[`; the address may hold parentheses one deep,
  spaces, angle brackets (`<a b.md>`) and a quoted title, which is dropped.
- `[[Target]]`, `[[Target|Label]]` and `![[picture]]`.

The visitor answers the replacement, or null to keep the text as written. Each search for a closing mark (`]`,
`]]`, `)`, a backtick run of one length) is remembered for the line, so a line of unclosed brackets is searched once
for each mark, not once for each bracket.

## Resolving

`buildLookups(pages)` makes, once: `byPath` (every path that is a page, to its key) and `byName` (a title, else a
file name without its extension, to the first page of it in tree order). `resolvePage` then runs the scan over a
draft's Markdown:

| Token                                                                    | Answer                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| A link to `javascript:`, `vbscript:`, `data:` or `file:`                 | Its text alone; warning `unsafe-link`                                                            |
| A link with a scheme, or to `#anchor`                                    | Kept as written                                                                                  |
| A link to a page of the plan                                             | `[text](knowledgebase-page:<key>)`; recorded in `links`                                          |
| A link to a page file that is no page of the plan (it could not be read) | Kept as written                                                                                  |
| A link to another file of the archive                                    | Its text alone; the file's name joins `attachments`                                              |
| A link to nothing in the archive                                         | Kept as written (a page outside the import)                                                      |
| A picture at `http:` or `https:`                                         | Kept as written                                                                                  |
| A picture the archive holds                                              | `![alt](knowledgebase-picture:<index>)`; one entry in `pictures` however often the page shows it |
| A picture past the picture limit (by declared size)                      | Its alt text; warning `picture-too-large`; skipped `picture-too-large`                           |
| A picture that is no picture file                                        | Its alt text; the file's name joins `attachments`                                                |
| A picture the archive does not hold                                      | Its alt text; warning `missing-picture`                                                          |
| `[[Target]]` with a match in `byName`                                    | `[label or target](knowledgebase-page:<key>)` (`#heading` dropped from the target)               |
| `[[Target]]` with none                                                   | Kept as written                                                                                  |

Then the draft's `attached` addresses (Confluence's attachment list) add the names of the files that exist and are
no pictures, and a page with attachments ends with `**Attachments**` and a list of the names.

A planned picture's `read()` reads the entry then, and throws `ImportSizeError` when the bytes are past the picture
limit (an archive need not declare sizes).

## HTML to Markdown

`parseHtmlDocument(source)` is `parseInert(source, 'text/html')`: the trusted-types inert parse the apps use. The
document is never attached to a page, and nothing is serialised back to HTML. `parseInert` runs as it is in the
package's tests under jsdom, so no stand-in adapter was needed; `html-document.ts` is the one seam should one be.

`htmlToMarkdown(element)` walks the element's children into blocks joined by a blank line:

| HTML                                                                          | Markdown                                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `h1`..`h6`                                                                    | `#`..`######` and its inline text                                                                       |
| `p`                                                                           | Its inline text                                                                                         |
| `ul`, `ol`                                                                    | `-` and `1.` items, nested lists indented four spaces a level                                           |
| `table`                                                                       | A pipe table, its first row the header, cells' text with `\|` for `                                     | `   |
| `pre` (Confluence's code macro)                                               | A fence, its language from `brush: x` or a `language-x` class; four backticks when the code holds three |
| `.confluence-information-macro` (`-information`, `-note`, `-warning`, `-tip`) | A quote opening with **Info**, **Note**, **Warning** or **Tip**; an unknown kind reads as **Note**      |
| `blockquote`                                                                  | A quote                                                                                                 |
| `hr`                                                                          | `---`                                                                                                   |
| `div`, `section` and the other containers                                     | Their own blocks                                                                                        |
| `a[href]`                                                                     | `[text](address)`, the address %-escaped where it would end the link early                              |
| `a.user-mention`, `a.confluence-userlink`, `a` with no address                | Its text                                                                                                |
| `img[src]`                                                                    | `![alt](address)`; `img.emoticon` and an `img` with no address: its alt                                 |
| `strong`, `b`; `em`, `i`; `del`, `s`; `code`, `tt`                            | `**`, `*`, `~~`, a code span                                                                            |
| `br`                                                                          | A space                                                                                                 |
| `script`, `style`, `noscript`, `template`, `iframe`, `object`, `embed`        | Nothing                                                                                                 |
| Anything else                                                                 | Its text                                                                                                |

The Markdown's links and pictures are then resolved like any other source's, which is where an address that runs
something loses its address.

The Confluence reader reads `index.html` (the one nearest the top) into a map of page to parent, title and order:
a list item's own link is the first outside its nested lists, and a nested list's items sit under it (under the
item above when it has no link of its own). A page the index leaves out takes the last link of `#breadcrumbs` that
is a file of the archive, not itself and not an index. The writing is `#main-content`, else the body.

## Bounds

| Constant                | Value  | Enforced                                                                                             |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `MAX_ARCHIVE_BYTES`     | 200 MB | `planImport` step 1 (the file's size) and `listArchive` (declared sizes summed); the plan is blocked |
| `MAX_ARCHIVE_ENTRIES`   | 20,000 | `listArchive`; the plan is blocked (`archive-too-large`)                                             |
| `MAX_IMPORT_PAGES`      | 500    | `planImport` steps 3 and 5, less `existingPages`; the plan is blocked                                |
| `MAX_IMPORT_DEPTH`      | 8      | `arrangeTree`, less `parentDepth`; deeper pages are flattened and warned                             |
| `MAX_PICTURE_BYTES`     | 10 MB  | `resolvePage` (declared size: left out and listed) and the picture's `read()` (actual size: throws)  |
| `MAX_PAGE_SOURCE_BYTES` | 5 MB   | `readText` (declared size before reading, actual size after); the page is skipped                    |

`MAX_IMPORT_PAGES` and `MAX_IMPORT_DEPTH` hold the values of the knowledgebase's `MAX_KNOWLEDGEBASE_PAGES` and
`MAX_PAGE_DEPTH` ([Knowledgebases and pages](../../030-knowledgebase/knowledgebases-and-pages.md)); the dialog
passes the document's own through `options.limits` so there is one source for them.

**Memory.** The listing holds paths and readers, never bytes. Pages are read one at a time; a page's source is let
go once its draft is made. The plan holds every page's Markdown (bounded by the archive limit, as the dialog
previews the whole plan) and no picture's bytes. Writing pages in batches of 20 is the dialog's.

**Time.** Every step is one pass over its input: the listing over the entries, a reader over its pages, the tree
walk over the drafts, the scan over each line, and a link is one map read. The one sort is the siblings'. Measured
(CPU, 50 links a page): 500 pages 84 ms, 2,000 pages 138 ms, 8,000 pages 709 ms. `plan.test.ts` holds 500 pages each
linking to 50 others under a CPU budget (`cpuBudgetMs(400)`), and `markdown-scan.test.ts` reads a line of 40,000
unclosed brackets.

## Security and trust

- The archive is untrusted. Paths: see "Paths"; nothing is looked up outside the archive root, and the engine
  touches no filesystem.
- HTML is parsed only by `parseHtmlDocument`, inert; scripts, styles and frames contribute nothing; of an element's
  attributes only `href`, `src`, `alt`, `class`, `id` and the code macro's language are read, so no handler survives.
- The plan is data: Markdown text, keys and lazy readers. No HTML leaves the engine.
- Addresses that run something are dropped (see "Resolving").
- Sizes: see "Bounds". Declared sizes are not trusted where it matters: text and pictures are measured again once
  read.

## Errors and edge cases

| Case                                      | Handling                                                   |
| ----------------------------------------- | ---------------------------------------------------------- |
| Archive with no pages                     | A plan with no pages, not blocked                          |
| An entry's `read()` rejects, for a page   | Skipped `page-failed`; the rest continue                   |
| Confluence's `index.html` cannot be read  | Skipped `page-failed`; the tree comes from breadcrumbs     |
| A Notion database's `.csv` cannot be read | Skipped; its folder's pages keep an empty page of its name |
| An empty `.csv`                           | No table                                                   |
| Two files whose paths differ only in case | The first is kept                                          |
| A link's %-escape is malformed            | Looked up as written                                       |
| A picture shown twice on a page           | One picture, both places point at it                       |

## Testing

Every rule above has a test in the module's `*.test.ts`; coverage is held at 100% lines, branches, functions and
statements (`vitest.config.ts`). The sources are tested through `planImport` with archives built from strings:
`markdown-folder.test.ts`, `notion.test.ts` (ids, encoded links, a database's CSV and `_all.csv`, callouts,
toggles), `confluence.test.ts` (under jsdom: the index tree, breadcrumbs, macros, mentions, a hostile page whose
script and handlers must not run) and `plan.test.ts` (each bound, the depth limit, a failing page, a hostile path,
the CPU budget).

## Not built here

- The zip reader's wiring. `zipEntries` takes the shape of the editor's reader
  (`apps/editor/lib/office-import/zip.ts` `openZip`), so no dependency is added; that reader lower-cases entry names
  and carries Office's own caps, so the dialog's step gives it a mode that keeps names as written and takes these
  limits before using it for file-name titles.
- The Import dialog, picture upload to Media, page writes in batches of 20, and turning the two schemes into
  page-link runs and picture zones.
