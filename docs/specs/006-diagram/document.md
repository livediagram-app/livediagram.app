# Document

A **document** is the top-level container a person creates, names, shares,
files in a folder and deletes. It holds an ordered set of tabs, optionally
grouped into [tab folders](tab-folders.md). Every tab has a **tab kind**,
which fixes how that tab is drawn on and presented.

## Domain language

| Term                     | Means                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **document**             | The top-level container: its name, owner, location, share links and tabs.                    |
| **tab**                  | One page of a document, with its own canvas, layers and elements.                            |
| **tab kind**             | What a tab is for (`TabKind`, `packages/diagram/src/tab-kind.ts`).                           |
| **diagram**              | The tab kind for structured diagrams: shapes, arrows, icons, templates.                      |
| **event-storming board** | The tab kind for event storming ([Event storming](../021-event-storming/event-storming.md)). |
| **whiteboard**           | The tab kind for freehand whiteboarding ([Whiteboard](../023-whiteboard/whiteboard.md)).     |

- "Diagram" names only the tab kind, never the container.
- "Board" on its own is not a term; say event-storming board or whiteboard.
- Specs, UI copy and code name the container a document everywhere.
- A new tab kind joins the table above; the container keeps its name.

## What keeps its name

- **livediagram** stays the product and brand name.
- A document mirrored to Google Drive is a `.livediagram` file of MIME type
  `application/vnd.livediagram+json` ([Google Drive mirror](../022-drive-mirror/drive-mirror.md)):
  both name the app that opens the file, not what is inside it.
