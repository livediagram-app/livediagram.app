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

## Renaming from diagram

The container was called a diagram until the domain language settled on document. Everything
that named it moved in one change:

- **Code:** identifiers, files and packages (`@livedocuments/document`, `apps/editor/app/document/[id]`).
- **Storage:** the document's own schema (`document-room/document-schema.ts`) and the index name the tables and columns `documents`,
  `document`, `document_tabs` and `document_id`, and the timeline's source, scope and event types say document. The tab kind
  `'diagram'` and anything naming a drawing (`ErDiagram`) are left alone.
- **Realtime and storage:** the Durable Object class is `DocumentRoom` (binding `DOCUMENT_ROOM`), a SQLite-backed
  class declared new in its first migration (livedocuments was never deployed with data, so it carries no rename
  history); it holds each document's content ([API app, Storage](../015-api/api.md#storage)); the room ops are
  `document-meta` and `document-trashed`.
- **Copies from elsewhere** are upgraded where they arrive: element links in exported files and
  offline documents (`upgradeLegacyLinks`, run by `migrateStoredTab`), the browser's cached
  preferences (`upgradeLegacyPreferences`), the offline store (moved to the `documents` object
  store on the next visit), and stored names: a document still called "Untitled diagram" counts as
  untitled, exactly as "Untitled document" does.
- **Addresses people already have** keep working: the public API's
  `/api/diagrams…` routes and the MCP `*_diagram` tools stay as deprecated aliases until 30 April
  2027 ([Public API and API tokens §3.8](../015-api/public-api-and-tokens.md#38-deprecated-diagram-routes),
  [MCP server §4.18](../015-api/mcp-server.md#418-deprecated-tool-names)).
- **An editor left open across the deploy** runs the old code, which has no hook to reload it: it
  keeps saving and connecting through the aliases, but stops seeing live name and tab-list
  changes from others until it reloads.

Files that hold the old names on purpose are named `legacy-*`.
<!-- /legacy-names -->
