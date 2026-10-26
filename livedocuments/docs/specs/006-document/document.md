# Document

A **document** is the top-level container a person creates, names, shares,
files in a folder and deletes. It holds an ordered set of tabs, optionally
grouped into [tab folders](tab-folders.md). Every tab is worked on in the one
editor mode, Pages ([Pages mode](../007-editor/pages-mode.md)): a run of pages on a surround.

## Domain language

| Term            | Means                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **document**    | The top-level container: its name, owner, location, share links and tabs.                                 |
| **tab**         | One tab of a document, with its own pages, layers and elements.                                           |
| **page**        | One page of a tab: a design page, a slide or an article page ([Pages mode](../007-editor/pages-mode.md)). |
| **editor mode** | How a tab is worked on: always Pages.                                                                     |

- As a term, "diagram" names nothing the person sees: it survives in code as the general tab kind's
  stored value (`'diagram'`) and in legacy names.
- "Board" is not a term.
- Specs, UI copy and code name the container a document, and a tab's parts pages.

## Choosing the word in prose

Code is strict: the container is always a document. Compound names use
"document" (`documentId`, `DocumentDTO`); the bare name is `liveDoc` / `LiveDoc`
(plural `liveDocs` / `LiveDocs`), so it never shadows the browser's `document` and
`Document`.

Prose follows the context:

- **Document** when the text is about the container: naming, filing, sharing,
  trashing or opening.
- **Page**, or the page's own kind (an article, a slide, a deck, an infographic), when the text
  is about what is made in it.

## What keeps its name

- **livedocuments** stays the product and brand name.
- A whole document as a file is a `.livedocuments` file of MIME type
  `application/vnd.livedocuments+json`: both name the app that opens the file, not what is inside it.

<!-- legacy-names -->

## Names

The container is a **document** everywhere:

- **Code:** identifiers, files and packages (`@livedocuments/document`, `apps/editor/app/document/[id]`).
- **Storage:** the document's own schema (`document-room/document-schema.ts`) and the index name the tables and
  columns `documents`, `document`, `document_tabs` and `document_id`. The tab kind `'diagram'` and anything naming a
  drawing (`ErDiagram`) name what they draw, not the container.
- **Realtime and storage:** the Durable Object class is `DocumentRoom` (binding `DOCUMENT_ROOM`), a SQLite-backed
  class; it holds each document's content ([API app, Storage](../015-api/api.md#storage)); the room ops are
  `document-meta` and `document-trashed`.
- **Preferences** stored under older keys pass through `upgradeLegacyPreferences` where they are read, in the
  browser's cache and the person's stored copy. A document is untitled while its name is "Untitled document"
  (`isUntitledDocumentName`).

Files that read older shapes on purpose are named `legacy-*` (`legacy-preferences.ts`, `legacy-stroke-points.ts`).
<!-- /legacy-names -->
