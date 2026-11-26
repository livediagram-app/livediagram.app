# Knowledgebase export

Status: **built, not yet verified in a browser** (Work Tracker 1468, [blueprint](blueprints/knowledgebase-export.md)).

Take a whole knowledgebase out as a `.zip` of Markdown files, from the Export dialog: one file a page, folders that
follow the page tree, pictures beside them and links between pages kept as relative links. It is the way back out
for what [Knowledgebase import](knowledgebase-import.md) brings in: Confluence, Notion, Obsidian, a Git repository or
any tool that reads a folder of Markdown. Before it, the app exported only the open page (PDF, Word, Markdown and the
rest); a whole knowledgebase came out as Markdown only through the CLI (`liveknowledge export`).

## Where it is offered

The Export dialog (the knowledgebase's menu, **Export**) offers a **Markdown Folder** card beside the page formats,
after Markdown: "Every page as a Markdown file in one .zip, folders following the page tree, pictures beside them.
For Confluence, Notion or a Git repository." Its name is the Import dialog's source of the same name: what this
writes, that reads back.

It is offered to every session that reads the **whole knowledgebase**: an Editor, a Participant and a Viewer, a
team member, an All Pages link, and an Offline knowledgebase. A link confined to one page reads one page, so its
Export keeps the single-page Markdown card and shows no Markdown Folder. An embed has no Export.

## What the zip holds

- **One file a page**, named by the page's title as a file name: lower case, words joined by hyphens, at most 80
  characters, `page` when nothing is left (`Release Process` is `release-process.md`). A page's subpages sit in a
  folder named as its file (`runbooks.md`, `runbooks/deploys.md`). Two pages of one title under one parent take
  `-2`, `-3` in tree order. The names are the CLI's (`pageFilePaths`), so the same knowledgebase exports to the same
  paths from either, and an export made again keeps every page's path while its title stands.
- **Each file** opens with front matter, then the page's title as a `#` heading, then its writing as Markdown (the
  form [Markdown import](markdown-import.md) reads):

  ```markdown
  ---
  title: 'Release Process'
  owner: 'Ana Lopes'
  updated: '2026-11-20T09:14:00.000Z'
  verified: '2026-11-02T16:00:00.000Z'
  labels: ['Engineering', 'Runbook']
  ---

  # Release Process

  We release on Tuesdays...
  ```

  `title` always; `subtitle` when the page has one; `owner` the page's owner by name; `updated` when the page was
  last saved; `verified` when it was last verified; `labels` its labels by name; `cover` its cover picture's path.
  A field with nothing to say is left out (an Offline knowledgebase has no owners' names and no saved times). Every
  value is a quoted string (a list of them for labels), so a title with a colon or a quote reads back whole. The
  heading is the title too, because most importers (Confluence's, Notion's, this one's) take a page's title from its
  first `#` heading and drop front matter.

- **Links between pages** are relative links to the other page's file (`[Deploys](../runbooks/deploys.md)`), with
  the linked page's current title as their words. That covers a page link, a `[[Title]]` written as text that names a
  page of this knowledgebase (first match in tree order, as the importer resolves one), and a link to a page's
  address in this knowledgebase (its Copy Link, `#t=<page>`). A link to a page the zip does not hold (in the Trash,
  gone) is its words alone. Every other link stays as it was written.
- **Pictures** are files under `pictures/` at the zip's root, each picture once however many pages show it, linked
  from the page by a relative path (`![Diagram](../pictures/9f2c41.png)`), where it stands in the writing. A page's
  cover picture is there too, named in its front matter's `cover`. A picture that cannot be read (gone, refused) is
  written as its description in italics (`_Diagram_`) and counted in the result.
- **Attachments.** A knowledgebase page stores no files of its own (an import lists an archive's other files as
  names, [Knowledgebase import](knowledgebase-import.md) "Pictures"): its pictures are its attachments, and they are
  in the zip. A connected file in the sidebar is another app's item, not a page: it is left out and counted.
- **What is not Markdown** is left out as the single-page Markdown export leaves it out (charts, drawings, shapes
  beside the writing), and the result line counts the pages that lost something.

## Who sees what

Only pages the person may read are exported: the tree is the api's `GET pages`, which answers a caller's own
pages and refuses a link confined to one page, and each page's writing is read with the caller's own credentials.
A page in the Trash is in no export ([Knowledgebases and pages](../030-knowledgebase/knowledgebases-and-pages.md)
"The page Trash"). Nothing is written, so a Viewer exports as an Editor does.

| Action                                 | Editor | Participant | Viewer |
| -------------------------------------- | ------ | ----------- | ------ |
| Export the whole knowledgebase as .zip | yes    | yes         | yes    |

A link confined to one page: no (it exports its page alone, as Markdown).

## The panel

The card opens a panel behind the dialog's back bar ("All Formats", the chip **Markdown Folder**):

- What it will hold: "42 Pages, in Folders Following the Page Tree" and a line on what is in each file (title,
  owner, last updated, pictures, links between pages). Connected files are counted when there are any ("2 connected
  files stay out: they belong to other apps.").
- **Download .zip**. While it builds, the button gives way to a progress bar and "Preparing 140 of 320 Pages",
  with **Cancel**. Closing the dialog cancels too. Nothing is downloaded until every page is in.
- Done: the `.zip` downloads as `<knowledgebase>.zip` and the dialog closes, as an image format's does. When some
  pictures could not be read, the dialog stays with "Downloaded. 3 Pictures Could Not Be Read: their words are kept."
- An error ("A page could not be read. Check your connection and try again.") shows inline with the button back.

## How it is built

In the browser, a page at a time, streamed into the zip: the tree is one request, then each page's writing is read
(the writing this editor already holds, else the saved page), turned into its file and added, and let go before the
next. Pages are read four at a time and written in tree order. Each picture is fetched once, the first time a page
shows it, and added straight away. The zip's entries are kept as the browser's own `Blob`s, so a large export's bytes
are not all held in the page's memory: at most four pages and one picture are, at once. Entries are stored, not
compressed: pictures already are, and Markdown is small beside them.

**Bounds.** 500 pages at most, the knowledgebase's own limit. A zip is at most 4 GB (the plain zip format's
limit); past that the export stops and says so.

## Round trip

A zip exported here imports back through **Import → Markdown Folder** as the same tree: the same titles, the same
parents and order (siblings are written in tree order and the importer orders them by name, so the order is the
names' when titles were reordered by hand), page links as page links, pictures as pictures.

## Telemetry

`Document · Exported · MarkdownFolder` once the zip downloads: the format, nothing about the pages.

## The CLI

`liveknowledge export <knowledgebase> <dir>` writes the same files to a folder, from the same writer
(`@liveknowledge/document`'s `pageFileMarkdown`), so the two agree.

## Non-goals

- Exporting a part of the tree (a page and its subpages): the Publish to the Web section picker covers sharing a
  section; this is the whole knowledgebase.
- Confluence's own space-export format (HTML or XML): Confluence imports Markdown, and a folder of Markdown is what
  every tool reads.
- Building the zip on the server and mailing a link: the zip's own work for 500 pages and 200 pictures (a 40 MB zip)
  measures about 0.2 s of CPU (`markdown-folder.test.ts`); the rest is reading the pages, four at a time, which a
  server would wait on as well. Settings' **Download All My Data** already does the server-side copy of everything.
