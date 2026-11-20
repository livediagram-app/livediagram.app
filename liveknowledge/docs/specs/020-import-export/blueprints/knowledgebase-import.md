# Knowledgebase import blueprint

Derived from [Knowledgebase import](../knowledgebase-import.md). Two halves: the **engine**,
`@liveknowledge/knowledge-import` (`packages/knowledge-import`), an archive in and an import plan out; and, from
"Archive sources" on, the **editor's half** (`apps/editor/lib/knowledge-import/` and
`apps/editor/components/dialogs/knowledge-import/`): what a person picks as an archive, the dialog's steps, and
writing the plan through the save pipeline. Nothing of the editor's half is verified in a browser.

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

## Archive sources

`apps/editor/lib/knowledge-import/archive-sources.ts` answers a `PickedArchive`: `{ name, kind, bytes, open() }`.
`open()` lists the archive afresh each time it is planned (a plan is made again when the destination changes), and
`bytes` is the size known before anything is opened (`planImport`'s `archiveBytes`).

| Picked                                  | Function                       | Listing                                                                                                   |
| --------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A `.zip` (the picker, or one dropped)   | `zipArchive(file)`             | `openZipFile` (below), names as written, through the package's `zipEntries`; `bytes` is the file's size   |
| A folder from `<input webkitdirectory>` | `inputFolderArchive(files)`    | Each `File` under its `webkitRelativePath`                                                                |
| A folder, or loose files, dropped       | `droppedArchive(dataTransfer)` | `webkitGetAsEntry` walked breadth first with a queue, `readEntries` called until it answers an empty page |

- **A folder is the archive's root.** `folderArchive` drops the folder's own name from every path when they all
  start with it, so its `README.md` is the top page listed first, as the spec says; the name is kept as the
  archive's name. A zip keeps its paths, and the engine's own wrapper rule reads them.
- **Nothing is read to list.** A folder's entry holds its `File` (a handle) and reads `file.arrayBuffer()` only on
  `read()`. The walk of a dropped folder stops one past `MAX_ARCHIVE_ENTRIES`, so the engine refuses a huge folder
  without it being walked whole.
- **What is no archive** (a file that is no zip, a drop that holds nothing) answers the pick step's error, "That
  could not be read as an archive. Choose a .zip, or a folder of pages."

### The zip reader

`apps/editor/lib/office-import/zip.ts`, shared with Word import, takes `ZipOptions`:

| Option             | Absent (an Office package)           | A Knowledgebase import                                          |
| ------------------ | ------------------------------------ | --------------------------------------------------------------- |
| `names`            | `folded`: lower-cased, compared so   | `as-written`: each name as spelled, slashes forward             |
| `maxEntries`       | `OFFICE_MAX_ZIP_ENTRIES` (4,000)     | `MAX_ARCHIVE_ENTRIES + 1`, so the engine's listing refuses      |
| `maxUnpackedBytes` | `OFFICE_MAX_UNPACKED_BYTES` (256 MB) | `2 * MAX_ARCHIVE_BYTES` (a file is a page once, a picture once) |

- `openZip(bytes, options)` is Word import's door, unchanged with no options. `openZipFile(blob, options)` opens
  the file itself and never reads it whole: the last 64 KB (the end record), the directory when it starts before
  that (a second slice), and for each entry asked for its 30-byte local header and then its packed bytes. So a
  200 MB archive costs its directory in memory, plus one entry at a time.
- `ZipArchive.size(name)` answers the unpacked size the directory declares; the package's `zipEntries` hands it on
  as the entry's `size` (`ZipReader.size`, optional), so an archive past 200 MB by its own account is blocked
  before an entry is read. A declared size is never trusted where it matters: a read still counts what arrives.
- Each read is capped at `max(MAX_PAGE_SOURCE_BYTES, MAX_PICTURE_BYTES)`; the engine then holds a page and a
  picture each to its own bound.

## The dialog

`apps/editor/components/dialogs/knowledge-import/`, inside `ImportTabDialog` (the one Import dialog).

| Piece                                      | File                                  |
| ------------------------------------------ | ------------------------------------- |
| the three sources: copy, file types, glyph | `sources.tsx`                         |
| the steps and the plan, as state           | `useKnowledgeImport.ts`               |
| the steps joined                           | `KnowledgeImportPanel.tsx`            |
| pick: drop area, Choose a .zip, a Folder   | `ArchivePickStep.tsx`                 |
| review                                     | `ImportReviewStep.tsx`                |
| the indented tree of what was found        | `PlanTreePreview.tsx`                 |
| what is left out or changed, grouped       | `ImportIssues.tsx`                    |
| where it lands, the page picker            | `DestinationPicker.tsx`               |
| the bar and Cancel                         | `ImportProgressStep.tsx`              |
| the summary and Open <first page>          | `ImportDoneStep.tsx`                  |
| the editor's side: who is offered it       | `useKnowledgeImportProps.ts`          |
| the review's copy, pure                    | `lib/knowledge-import/import-copy.ts` |

- **In the one dialog.** `ImportTabDialog` takes an optional `knowledgebase` prop. With it, the format grid has
  two headed groups (**Into This Page**, holding the formats and the replace warning; **A Whole Knowledgebase**,
  holding the three `FormatCard`s with their file-type chips), and choosing a source swaps the dialog's body for
  `KnowledgeImportPanel`, loaded then (`next/dynamic`), so a single-file import never loads the engine. A page
  that takes one single-file format still shows the grid when the sources are there.
- **Share roles.** `useKnowledgeImportProps` (called by `EditorTabDialogs`) answers the prop only when
  `can.editPages && !isStructureReadOnly`, the gate the page tree uses, and only once the reader is known. Anyone
  else is handed nothing and the dialog renders none of the three. The room checks every page write again.
- **States** (`KnowledgeImportState`): `pick` (with an error or none), `reading`, `review` (`replanning` while the
  plan is made again for another destination; the last plan stays on screen and Import is busy), `importing`
  (`progress`, `stopping`), `done`. A plan answered after a newer one was asked for is dropped.
- **Steady height.** Every step is a column at least 28 rem tall with its buttons at its foot, so the dialog does
  not jump between steps; long lists scroll inside (the page picker 10 rem, the done lists 10 rem).
- **The plan's options** come from the destination: `existingPages` 0 and `parentDepth` 0 for a new knowledgebase;
  the open knowledgebase's page count and `pageDepth` of the chosen page otherwise; `limits.pages` and
  `limits.depth` are `MAX_KNOWLEDGEBASE_PAGES` and `MAX_PAGE_DEPTH`.
- **The review's groups** (`issueGroups`, one pass over the plan): each warning kind and skip reason is a group
  with its count, what happens, and the first `ISSUE_EXAMPLES` (5) by name; attachments named and files not used
  are a line each. A picture past 10 MB is listed once, as its page's warning.
- **The tree preview** (`planPreviewRows`): the first `PLAN_PREVIEW_ROWS` (12) pages, each a level further in than
  its parent (16 px, at most six levels drawn), then "and <n> more". One pass, stopping at the cap.
- **The page picker** is native radios over `pageTreeRows`, in a `radiogroup` named "Page to Import Under": the
  arrow keys move through it, a page at `MAX_PAGE_DEPTH` is disabled and says "Deepest Level". Rows are 32 px, 44
  px on a touch screen; the two destination options are 44 px on a touch screen.
- **Accessibility.** The drop area is a named region, `aria-busy` while reading; the bar is `role="progressbar"`
  with `aria-valuenow`, `aria-valuemax` and the line as `aria-valuetext`; the summary is `role="status"` and its
  way forward takes focus; a blocked plan is `role="alert"`. Motion is the shared tokens only (`duration-short`),
  and the spinner stops under reduced motion.
- **Observability.** `debugLog('[knowledge-import] planned' | 'unreadable' | 'written', ...)` with counts, never
  content. Telemetry: `Tab` `Imported` with `MarkdownFolder`, `Notion` or `Confluence`, once an import stored a
  page; a new knowledgebase also sends `Document` `Created` (`Offline` or `Cloud`).

## Writing the plan

`writeImportPlan(plan, deps)` (`apps/editor/lib/knowledge-import/write-plan.ts`), pure over what it is handed: the
save layer, `storePicture`, `newId`, the landing parent, `cancelled()` and `onProgress`.

1. **Ids first.** Every page's tab id is made before any page is written, so a link to a page further down the
   tree is written with the page that holds it. No page is written twice.
2. **Batches** of `IMPORT_BATCH_PAGES` (20), in the plan's tree order, so a page's parent is in its batch before
   it, in an earlier batch, or the landing parent. `cancelled()` is read before each batch.
3. **Pictures of the batch** through `storePicture`, `IMPORT_PICTURE_CONCURRENCY` (3, the image pipeline's own) at
   a time; a file many pages show is stored once (by its path). A picture that fails is a named line in the
   summary (`failedPictures`) and its page keeps the alt text.
4. **The batch's tabs** are made then (`importedPageTab`), and handed to the save layer, which answers the pages it
   could not store, each with why, and `stalled` when saving stopped answering. The tabs are let go after.
5. **A page that fails** (made or stored) joins `lost`: its key resolves to no id from then on, so later links to
   it are written as their words, and a page under it takes the nearest page above that was written, or the
   landing parent.

### A page's tab

`importedPageTab` (`page-content.ts`):

- The Markdown is read by `articleFromMarkdown`, the reader Markdown import and `write_article` use.
- **Page links.** The article reader keeps only http, https and mailto addresses, so `knowledgebase-page:<key>` is
  swapped before reading for `https://page-<nonce>.invalid/<key>` (never resolvable, and a fresh nonce a page) and
  each run carrying it becomes `{ text, page: <tab id> }` (`PAGE_LINK_KEY`, `@liveknowledge/knowledge`) with no
  `href`, in paragraphs, list items and table cells. A key with no id leaves the run its words.
- **Pictures.** Each stored picture becomes a `[zone <id>]` line, the form `articleFromMarkdown` keeps a zone by,
  handed in as the article being written over: an `object` zone sized by `pictureZoneSize`, parked by
  `parkedZoneAt` with its `ImageElement` exactly there (`pictureElement`), as Word import parks its pictures. The
  editor's first layout of the page settles the zone and its picture (`markArticleSettle` on a page added to the
  open knowledgebase; the absent-writer path when a page of a new knowledgebase is first opened by an Editor). A
  picture alone on its line is the zone line; one inside other writing leaves the line and its zone follows the
  block. A picture shown twice is two zones of one stored picture. A picture that was not stored is its alt text.
- Fenced code is left as written; a line the source wrote that reads as a zone line is escaped.
- The tab is a knowledgebase page (`knowledgebasePage()`, `KNOWLEDGEBASE_FLOW`): a Title block saying the page's
  name (capped by `truncateName`, "Untitled Page" when blank), then the writing, with the open page's look
  (`newTabSeed`) and no `knowledge` field.
- **Refused, with a reason:** Markdown past `ARTICLE_MARKDOWN_MAX`, a paragraph past the block limit, more than
  `MAX_ARTICLE_BLOCKS` blocks, or (not Offline) a tab past `MAX_TAB_BYTES`.

### Save layers

`save-layers.ts`. Both answer `{ failed, stalled? }`.

- **Under a page of the open knowledgebase** (`openKnowledgebaseLayer`): the batch is judged against the page list
  as it is (`withPageAdded`, the tree's own limits: `page_limit`, `depth_limit`, `unknown_page`, each refused page
  failing with `pageTreeRefusalText`), then added in **one `commitTabs`**, the page list's own edit. Each page is
  marked loaded and claimed for layout. The autosave stores it as it stores any new page; the layer waits for
  every page's `whenTabSaved` (`IMPORT_SAVE_WAIT_MS`, 60 s) before answering, so the next batch never joins a save
  still in flight. A page not stored in time answers `stalled`: the import stops, and the pages keep saving.
- **Parents before subpages.** The autosave writes changed pages side by side. `page-save-order.ts`
  (`app/document/[id]/`) holds a page's write until the first save of its parent, when that is part of the same
  save, has settled: `expectFirstSave` as each new page's save is prepared, `savePageAfterParent` around the PUT
  (the autosave's `prepareTabSave` and `apiSaveTab` deps). A parent whose save never runs releases its subpages
  after `PARENT_SAVE_WAIT_MS` (15 s). This holds for every new page, not only an import's.
- **A new knowledgebase** (`newKnowledgebaseLayer`): the first batch is `apiCreateDocument`'s tabs (or
  `offlineCreateDocument`'s when the open knowledgebase is Offline); later batches are `apiSaveTab` in waves, a
  page once the page above it in the batch is stored, `IMPORT_SAVE_CONCURRENCY` (4) at a time; then the whole list
  so far goes to `apiSaveDocumentMeta` with each page's parent, which fixes the order. A page that cannot be saved
  fails with its subpages in that batch. A batch that stores nothing, or whose order cannot be written, stalls.
  The room judges each of these writes as it judges any (`tabParentRefusal`, `tabListRefusal`).
- **The pictures** go through the import image pipeline (`createBrowserImportImageSession`: the Media upload, or
  embedded for an Offline knowledgebase), made on the first picture. `picture.read()` refuses one past 10 MB.

### Known limits

- Pages added to the open knowledgebase stay in the editor's state as loaded pages, as pages a person opens do: an
  import of 500 pages holds their writing until the knowledgebase is reloaded. Only one batch is parsed at a time.
- Each batch is an undo step of the page list (`commitTabs`), so Undo takes back the last 20 pages.
- A link written in an earlier batch to a page that then fails stays a page link to an id no page has (it reads
  "Deleted Page" once [Links and embeds](../../030-knowledgebase/links-and-embeds.md) draws that).
- An import into a new knowledgebase is written by this browser alone: closing the tab stops it at the pages
  stored so far.
- A zip of a folder whose own `README.md` sits in that folder keeps the engine's reading (the README is the page
  the rest sit under); only a picked or dropped folder is read as the root.

### Performance

Measured 2026-11-20 (CPU, `write-plan.test.ts`): 500 pages of 50 links each, converted and handed to a save layer
in 25 batches, 152 ms cold and 75 to 78 ms warm; 2,000 pages 320 ms, so linear. Held under `cpuBudgetMs(800)`.
The review's own work on that plan (`planPreviewRows`, `issueGroups`) is 0.2 to 0.6 ms. The review renders 12 tree
rows whatever the plan holds; the page picker renders a row a page of the open knowledgebase (at most 500), only
while "Under a Page" is chosen. Choosing another destination plans the archive again (the engine's 84 ms for 500
pages, plus reading the pages).

### Testing

`write-plan.test.ts` (batches of 20, parents before subpages, a forward link in one pass, three pictures at a
time and one stored once, a cancel between batches, a failed page and its subpages, a refusing and a stalled save
layer, the CPU budget), `page-content.test.ts`, `save-layers.test.ts`, `archive-sources.test.ts`,
`import-copy.test.ts`, `zip.test.ts` (names as written, the caps, `openZipFile`, Word's reading unchanged),
`page-save-order.test.ts`; the dialog: `KnowledgeImportPanel.test.tsx` (pick, review, the tree's cap, the page
picker, a blocked plan, no pages, the bar and Cancel, the summary with what failed) and
`ImportTabDialog.knowledgebase.test.tsx` (the sources in the one dialog, and a role at a time).

## Not built

- Nothing of the dialog or the write path has been seen in a browser: the drop of a real folder, a 200 MB zip read
  from disk, real uploads, the autosave storing a batch against a live room, and the dialog's look.
- The help article for Knowledgebase import, and its end-to-end spec.
- The Dashboard's catalogue of telemetry (liveworkspace.app) does not describe the three new `Imported` types.
