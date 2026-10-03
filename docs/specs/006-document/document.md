# Document

A **document** is the top-level container a person creates, names, shares,
files in a folder and deletes. It holds an ordered set of tabs, optionally
grouped into [tab folders](tab-folders.md). Every tab has a **tab kind**,
which fixes what that tab is. A general tab is worked on in one of two
[editor modes](../007-editor/editor-modes.md), Diagram or Draw.

## Domain language

| Term                     | Means                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| **document**             | The top-level container: its name, owner, location, share links and tabs.                        |
| **tab**                  | One page of a document, with its own canvas, layers and elements.                                |
| **tab kind**             | What a tab is for (`TabKind`, `packages/document/src/tab-kind.ts`).                              |
| **diagram**              | The general tab kind: every element type, worked on in Diagram or Draw mode.                     |
| **event-storming board** | The tab kind for event storming ([Event storming](../021-event-storming/event-storming.md)).     |
| **editor mode**          | How a general tab is worked on: Diagram or Draw ([Editor modes](../007-editor/editor-modes.md)). |
| **whiteboard**           | The activity of Draw mode ([Draw mode](../023-draw-mode/draw-mode.md)); not a tab kind.          |

- As a term, "diagram" names the tab kind, never the container. Prose may still say diagram
  where the text is about drawing ([Choosing the word in prose](#choosing-the-word-in-prose)).
- "Board" on its own is not a term; say event-storming board or whiteboard.
- A tab kind is reserved for a very specific use; anything a mode can serve stays a general tab.
- Specs, UI copy and code name the container a document.

## Choosing the word in prose

Code is strict: the container is always a document. Compound names use
"document" (`documentId`, `DocumentDTO`); the bare name is `liveDoc` / `LiveDoc`
(plural `liveDocs` / `LiveDocs`), so it never shadows the browser's `document` and
`Document`.

Prose follows the context:

- **Document** when the text is about the container: naming, filing, sharing,
  trashing, opening, or a mix of tab kinds.
- **Diagram** is fine when the text is about a document that is, in all
  likelihood, a diagram tab at heart, such as drawing a flowchart in it.
  A whiteboard or an event-storming board is never called a diagram.
- **Diagram types** keep their names: a sequence diagram, an ER diagram,
  an architecture diagram.
- **Diagramming** and **diagram tool** describe the product and the activity;
  livediagram is built for every kind of diagram, and also does
  whiteboarding, event storming and slideshows well.
- A new tab kind joins the table above; the container keeps its name.

## What keeps its name

- **livediagram** stays the product and brand name.
- A document mirrored to Google Drive is a `.livediagram` file of MIME type
  `application/vnd.livediagram+json` ([Google Drive mirror](../022-drive-mirror/drive-mirror.md)):
  both name the app that opens the file, not what is inside it.

<!-- legacy-names -->

## Renaming from diagram

The container was called a diagram until the domain language settled on document. Everything
that named it moved in one change:

- **Code:** identifiers, files and packages (`@livediagram/document`, `apps/live/app/document/[id]`).
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
  offline documents (`upgradeLegacyLinks`, run by `migrateStoredTab`), the browser's cached
  preferences (`upgradeLegacyPreferences`), the offline store (moved to the `documents` object
  store on the next visit), and stored names: a document still called "Untitled diagram" counts as
  untitled, exactly as "Untitled document" does.
- **Addresses people already have** keep working: `/diagram/<id>` and six help articles redirect
  for good ([Router app](../016-platform/router-app.md#legacy-editor-route)); the public API's
  `/api/diagrams…` routes and the MCP `*_diagram` tools stay as deprecated aliases until 30 April
  2027 ([Public API and API tokens §3.8](../015-api/public-api-and-tokens.md#38-deprecated-diagram-routes),
  [MCP server §4.18](../015-api/mcp-server.md#418-deprecated-tool-names)).
- **An editor left open across the deploy** runs the old code, which has no hook to reload it: it
  keeps saving and connecting through the aliases, but stops seeing live name and tab-list
  changes from others until it reloads.

Files that hold the old names on purpose are named `legacy-*`.
<!-- /legacy-names -->
