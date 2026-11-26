# Knowledgebase export blueprint

Derived from [Knowledgebase export](../knowledgebase-export.md). Three layers: the **page file writer** in
`@liveknowledge/document` (pure, shared with the CLI), the **streamed zip** in `@liveworkspace/workbench`, and the
**editor's half** (`apps/editor/lib/knowledgebase-export/`, `apps/editor/components/dialogs/markdown-folder/`).

## Domain and naming

| Term (spec)            | Identifier                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Markdown Folder format | `'markdown-folder'` in `Format` (`components/dialogs/export-formats.ts`), card in `CARDS`                  |
| a page's file          | `pageFileMarkdown(tab, file, files, pictureAt, options)` (`packages/document/src/knowledgebase-export.ts`) |
| a page's file path     | `pageFilePaths(pages)` (`article-page-links.ts`, unchanged)                                                |
| front matter           | `pageFrontMatter(title, facts)`; facts `ExportPageFacts = { owner?, updated?, verified?, labels? }`        |
| a page's pictures      | `pageFilePictures(tab)`: the cover's, then the writing's (`pagePictures`)                                  |
| a page address         | `pageOfAddress(documentId)(href)`; `withPageAddressesAsLinks(flow, pageOfHref)`                            |
| the streamed zip       | `ZipBlobWriter` (`packages/workbench/src/lib/zip-writer.ts`), `ZipTooLargeError`                           |
| the export's source    | `MarkdownFolderSource` (`lib/knowledgebase-export/markdown-folder.ts`), built by `markdownFolderSource`    |
| the making             | `buildMarkdownFolder(source, { onProgress, signal })` → `MarkdownFolderResult`                             |
| who is offered it      | `offersMarkdownFolder({ documentId, ownerId, tabScope })` (`markdown-folder-source.ts`)                    |
| the panel              | `MarkdownFolderPanel`, `useMarkdownFolderExport`, `useMarkdownFolderProp`                                  |

## Constants

| Constant               | Value           | Provenance                                                                                               |
| ---------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| `PAGE_READS_AT_ONCE`   | 4               | Spec ("read four at a time"); the browser's six connections a host, less two for the room and the editor |
| `PICTURES_FOLDER`      | `pictures`      | The CLI's folder, so both write the same tree                                                            |
| `UNTITLED_EXPORT_PAGE` | `Untitled Page` | The tree's name for an unnamed page                                                                      |
| `ZIP_MAX_BYTES`        | `0xffffffff`    | The plain zip format's 32-bit offsets (no ZIP64)                                                         |
| `ZIP_MAX_ENTRIES`      | `0xffff`        | The plain zip format's 16-bit entry count                                                                |

## The page file (`knowledgebase-export.ts`)

1. The flow: the page's saved writing (`savedArticlesOf`, never an edit's draft), the one `pageFlowOf` names, else
   the first.
2. The title: `options.title` (the tree's name), else the Title block's text, else `tab.name`, else
   `UNTITLED_EXPORT_PAGE`; whitespace collapsed to single spaces. The subtitle: the Subtitle block's text.
3. The Title and Subtitle blocks leave the flow, so `articleToMarkdown` writes no front matter of its own.
4. Links, in order: `withPageLinksResolved(blocks, pageByTitle)` (`[[Title]]` text, never in code, a footnote or a
   link), `withPageAddressesAsLinks(flow, pageOfHref)` (an ordinary link naming a page of this knowledgebase), then
   `withPageLinksAsFiles(flow, hrefOf, titleOf)`: each page link a relative path (`relativePagePath`) with the
   page's current title for its words; a page with no file loses its link and keeps its words.
5. Pictures: a zone's `[zone id]` line gives way to the pictures standing in it (`zoneMemberIds`), the blank line
   after an empty zone goes with it, a fenced code block's lines are never zones; pictures in no zone follow the
   writing. `pictureAt` answers a root path (made relative), an absolute address (kept), or null: the picture's
   description in italics (`_alt_`), nothing when it has none.
6. The file: `pageFrontMatter` (title, subtitle, owner, updated, verified as ISO strings, labels, cover; every value
   `JSON.stringify`d, a YAML double-quoted scalar), a blank line, `# <title>`, the writing, the loose pictures, one
   trailing newline.

`pageOfAddress(documentId)`: the fragment after `#` parsed as search parameters; `t` names the page. A bare
fragment answers it; an absolute URL answers it only when a path segment is `documentId`; anything else (a
relative path, no `t`, another knowledgebase) answers undefined. Stored writing keeps only `http(s)` and `mailto`
addresses, so in practice it is a Copy Link.

## The streamed zip (`ZipBlobWriter`)

`add(name, data)`: the entry's local header, name and bytes become one `Blob` part at once; its central directory
record is kept (46 bytes and the name). `finish()` is one `Blob` of the parts, the records and the end record.
Before an entry that would pass `ZIP_MAX_ENTRIES` or put the offsets past `ZIP_MAX_BYTES` (counting its record and
the end record), it throws `ZipTooLargeError` and adds nothing. Its output is byte for byte `writeZip`'s for the same
entries and date. `writeZip` and it share `entryRecords` and `endRecord`.

## The making (`buildMarkdownFolder`)

- `pageFilePaths` over the source's pages, titles by id, `pageByTitleIn`, `pageOfAddress(source.documentId)`.
- For each page in tree order: the cancel is checked; the reads for this page and the next
  `PAGE_READS_AT_ONCE - 1` are started (a read ahead's failure is caught on the side and thrown in its turn); the
  page's read is awaited and the cancel checked again. Null: `missingPages += 1`. Else each of
  `pageFilePictures(tab)` not yet seen is read (`readPicture`, a throw counts as none), named
  (`pictureFileName`) and added, or counted in `missingPictures`; then the page's file is added. `onProgress(i + 1,
total)`.
- `pictureFileName(imageId, type, n)`: the extension from the type (png, jpg, gif, webp, svg, avif; any other is no
  picture), the stem the id with every character outside `[\w.-]` a hyphen, or `picture-<n>` for a `data:` id or a
  stem past 64 characters.
- Cancelled: `ExportCancelled`. A page read that throws ends the making with that error.

## The editor's source (`markdown-folder-source.ts`)

- Synced: `apiKnowledgePages` (`GET pages?names=1`) → `folderPagesOf`: connected rows out; facts from `owner` (by
  `names`), `updatedAt`, `trust.verifiedAt`, `labels`. Offline: `offlinePagesOf(tabs)`: connected out, the
  verified time alone.
- `readPage`: a page in `loadedTabIds` is the editor's own tab; any other `apiReadSavedTab` (a plain `GET
tabs/<id>` with the caller's headers, or `offlineLoadTab`): never `apiLoadTab`, which would move the delta-save
  base copy of a tab the editor might open meanwhile.
- `readPicture`: a `data:` id is decoded (`dataPicture`, base64 png, jpeg, gif or webp only); any other
  `apiFetchImageBlob` (the original, `?d=<knowledgebase>`, the share code).

## The api (`GET pages`)

Each page row gains `updatedAt` (its summary's). `?names=1` adds `names`: one `getParticipants` over the distinct
owners, a name per account that has one (`{}` when none). A row outside a scoped caller's scope is never listed.
Optional fields: an older client reads the answer as before.

## The panel

- The card shows where `markdownFolder` is handed in: `useMarkdownFolderProp` hands it when
  `offersMarkdownFolder` and the export is the tab's (never a selection's). Counts: the editor's pages and connected
  rows.
- `useMarkdownFolderExport`: phases `idle`, `making { done, total }`, `done { missingPictures }`, `error { message }`.
  One making at a time. Unmounting aborts. A finished zip is handed to `onDownload` (the dialog downloads
  `<knowledgebase>.zip` through `sanitizeFilename`, and tracks); with nothing missing, `onDone` closes the dialog.
  `ZipTooLargeError` reads `MARKDOWN_FOLDER_ERRORS.tooLarge`, any other failure `.read`; a cancel goes back to idle.
- Copy: the head line `<n> Pages, in Folders Following the Page Tree` (grouped digits), the four checked lines of
  `MARKDOWN_FOLDER_HOLDS`, the connected line, `Reading the Page Tree…` before the first page, then `Preparing <done>
of <total> Pages`, the warning `Downloaded. <n> Pictures Could Not Be Read: their words are kept.`

## Accessibility

The progress is a `progressbar` named by its line, with `aria-valuenow` in percent, and the line itself is
`aria-live="polite"`. The back bar is disabled while making. Errors are `alert`s, the partial download a `status`.

## Performance and limits

- Memory: at most `PAGE_READS_AT_ONCE` pages and one picture's bytes in the page's heap; the zip's parts are Blobs.
- CPU: 500 pages of 20 paragraphs with 200 pictures of 200 KB (a 40 MB zip) measured 163 ms on a developer machine;
  the test holds it under `cpuBudgetMs(4000)`.
- Requests: one tree read, one a page the editor does not hold, one a distinct picture.

## Observability

`Document · Exported · MarkdownFolder` on download. A failed read surfaces in the panel's alert; the api's own
request logs carry it.

## Testing

| Rule                                                           | Test                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Front matter, title, subtitle, cover, pictures, zones, links   | `packages/document/src/knowledgebase-export.test.ts`             |
| The streamed zip equals `writeZip`, and its limits             | `packages/workbench/src/lib/zip-writer.test.ts`                  |
| The making, cancel, read-ahead bound, picture names, 500 pages | `apps/editor/lib/knowledgebase-export/markdown-folder.test.ts`   |
| Round trip through Markdown Folder import                      | the same file, "imports back through Markdown Folder"            |
| Who is offered it; the source's reads                          | `markdown-folder-source.test.ts`, `lib/api/export-reads.test.ts` |
| The card, the panel's phases, Cancel, close cancels            | `components/dialogs/ExportTabDialog.markdown-folder.test.tsx`    |
| `GET pages` `updatedAt` and `names`                            | `apps/api/src/routes/knowledge-agent-routes.test.ts`             |
| The CLI writes the same files                                  | `apps/cli/src/commands/knowledge-files.test.ts`                  |
| A front matter title is read on import                         | `packages/knowledge-import/src/markdown-folder.test.ts`          |
