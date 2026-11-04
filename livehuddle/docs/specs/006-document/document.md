# Document

A **document** is the top-level container a person creates, names, shares,
files in a folder and deletes. It holds an ordered set of tabs, optionally
grouped into [tab folders](tab-folders.md). Every tab has a **tab kind**,
which fixes what that tab is. Every tab is worked on in Workshop, livehuddle's one
[editor mode](../007-editor/editor-modes.md).

## Domain language

| Term            | Means                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **document**    | The top-level container: its name, owner, location, share links and tabs.                |
| **tab**         | One page of a document, with its own canvas, layers and elements.                        |
| **tab kind**    | What a tab is for (`TabKind`, `packages/document/src/tab-kind.ts`).                      |
| **diagram**     | The general tab kind (a stored name): every element type, worked on in Workshop.         |
| **editor mode** | How a tab is worked on: always Workshop ([Editor modes](../007-editor/editor-modes.md)). |

- As a term, "diagram" names the tab kind, never the container. Prose may still say diagram
  where the text is about drawing ([Choosing the word in prose](#choosing-the-word-in-prose)).
- A tab kind is reserved for a very specific use; anything else stays a general tab.
- Specs, UI copy and code name the container a document.

## Choosing the word in prose

Code is strict: the container is always a document. Compound names use
"document" (`documentId`, `DocumentDTO`); the bare name is `liveDoc` / `LiveDoc`
(plural `liveDocs` / `LiveDocs`), so it never shadows the browser's `document` and
`Document`.

Prose follows the context:

- **Document** when the text is about the container: naming, filing, sharing,
  trashing, opening, or a mix of tab kinds.
- **Space** is the word a person reads for the thing they make (D6 (a) in
  [Open decisions](../005-project-roadmap/open-decisions.md), [Domain language](../003-system-architecture/domain-language.md#space)):
  every label, title, toast and help article says space where code says document.
- livehuddle is not a diagramming tool ([Purpose](../001-project-vision/purpose.md)); "diagram" in prose names
  livediagram's work.
- A new tab kind joins the table above; the container keeps its name.

## What keeps its name

- **livehuddle** stays the product and brand name.
- A document synced to Google Drive is a `.livehuddle` file of MIME type
  `application/vnd.livediagram+json` ([Google Drive sync](../../../../liveworkspace/docs/specs/005-drive/drive.md)):
  both name the app that opens the file, not what is inside it.

<!-- legacy-names -->

## Renaming from diagram

The container was called a diagram until the domain language settled on document. Everything
that named it moved in one change:

- **Code:** identifiers, files and packages (`@livehuddle/document`, `apps/editor/app/document/[id]`).
- **Schema:** the document's own schema names the tables and columns `document`, `document_tabs` and
  `document_id`, and the timeline's source, scope and event types say document. The tab kind
  `'diagram'` and anything naming a drawing are left alone.
- **Realtime and storage:** the Durable Object class is `DocumentRoom` (binding `DOCUMENT_ROOM`), a SQLite-backed
  class declared new in its first migration (livehuddle ships fresh on new infrastructure, so it carries no rename
  history); it holds each document's content ([API app, Storage](../015-api/api.md#storage)); the room ops are
  `document-meta` and `document-trashed`.
- **Copies from elsewhere** are upgraded where they arrive: element links in exported files and
  offline documents (`upgradeLegacyLinks`, run by `migrateStoredTab`), the browser's cached
  preferences (`upgradeLegacyPreferences`), the offline store (moved to the `documents` object
  store on the next visit), and stored names: a document still called "Untitled diagram" counts as
  untitled, exactly as "Untitled document" does.
- **Addresses people already have** keep working: `/diagram/<id>` and six help articles redirect
  for good ([Router app](../016-platform/router-app.md#legacy-editor-route)); the public API's
  `/api/diagrams…` routes stay as a deprecated alias until 30 April 2027
  ([Public API and API tokens §3.8](../015-api/public-api-and-tokens.md#38-deprecated-diagram-routes)); the MCP server
  has no `*_diagram` tools.
- **An editor left open across the deploy** runs the old code, which has no hook to reload it: it
  keeps saving and connecting through the aliases, but stops seeing live name and tab-list
  changes from others until it reloads.

Files that hold the old names on purpose are named `legacy-*`.
<!-- /legacy-names -->
