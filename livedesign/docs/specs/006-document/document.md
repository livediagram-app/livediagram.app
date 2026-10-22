# Document

A **document** is the top-level container a person creates, names, shares,
files in a folder and deletes. It holds an ordered set of tabs, optionally
grouped into [tab folders](tab-folders.md). Every tab is worked on in the one
editor mode, Pages ([Pages mode](../007-editor/pages-mode.md)): a run of pages on a surround.

## Domain language

| Term            | Means                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **document**    | The top-level container: its name, owner, location, share links and tabs.                                                      |
| **tab**         | One tab of a document, with its own pages, layers and elements.                                                                |
| **page**        | One page of a tab: a design page, a slide, an article page, a logo or a wireframe ([Pages mode](../007-editor/pages-mode.md)). |
| **tab kind**    | What a tab is (`TabKind`, `packages/document/src/tab-kind.ts`); livedesign has one, the general tab.                           |
| **editor mode** | How a tab is worked on: always Pages; a stored livediagram mode reads as Pages.                                                |

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
- **Page**, or the page's own kind (an article, a slide, a deck, an infographic, a logo, a wireframe), when the text
  is about what is made in it.

## What keeps its name

- **livedesign** stays the product and brand name.
- A whole document as a file is a `.livedesign` file of MIME type
  `application/vnd.livedesign+json`: both name the app that opens the file, not what is inside it.

<!-- legacy-names -->

## Renaming from diagram

The container was called a diagram until the domain language settled on document. Everything
that named it moved in one change:

- **Code:** identifiers, files and packages (`@livedesign/document`, `apps/live/app/document/[id]`).
- **Database:** migration `0055_documents.sql` renames `diagrams` → `documents`, `diagram_tabs` →
  `document_tabs` and every `diagram_id` → `document_id`, keeps every foreign key and index, and
  rewrites the stored values that named the container: timeline source, scope and event types,
  titles and snapshot keys; element links to another document; the `notifyDiagramJoin`
  preference; and the telemetry history, so the dashboard's lines continue. The tab kind
  `'diagram'` and anything naming a drawing (`ErDiagram`) are left alone.
- **Realtime:** the Durable Object class `DiagramRoom` is renamed to `DocumentRoom` by a
  `renamed_classes` migration (tag `v2`), which keeps every room's storage; the room ops are
  `document-meta` and `document-trashed`.
- **Copies from elsewhere** are upgraded where they arrive: element links in exported files and
  offline documents (`upgradeLegacyLinks`, run by `migrateStoredTab`), the offline store (moved to
  the `documents` object store on the next visit), and stored names: a document still called
  "Untitled diagram" counts as untitled, exactly as "Untitled document" does.
- livedesign was never deployed under the old names, so the api serves no `/api/diagrams…` aliases
  and the MCP registers no `*_diagram` tools.

Files that hold the old names on purpose are named `legacy-*`.
<!-- /legacy-names -->
