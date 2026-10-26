# Design

A **design** is the top-level container a person creates, names, shares,
files in a folder and deletes. It holds an ordered set of tabs, optionally
grouped into [tab folders](tab-folders.md). Every tab is worked on in the one
editor mode, Pages ([Pages mode](../007-editor/pages-mode.md)): a run of pages on a surround.

## Domain language

| Term            | Means                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **design**      | The top-level container: its name, owner, location, share links and tabs.                          |
| **tab**         | One tab of a design, with its own pages, layers and elements.                                      |
| **page**        | One page of a tab: a logo, a wireframe or a photo ([Pages mode](../007-editor/pages-mode.md)).     |
| **tab kind**    | What a tab is (`TabKind`, `packages/design/src/tab-kind.ts`); livedesign has one, the general tab. |
| **editor mode** | How a tab is worked on: always Pages; a stored livediagram mode reads as Pages.                    |

- As a term, "diagram" names nothing the person sees: it survives in code as the general tab kind's
  stored value (`'diagram'`) and in legacy names.
- "Board" is not a term.
- Specs, UI copy and code name the container a design, and a tab's parts pages.

## Choosing the word in prose

Code is strict: the container is always a design. Compound names use
"design" (`designId`, `DesignDTO`); the bare name is `liveDoc` / `LiveDoc`
(plural `liveDocs` / `LiveDocs`), so it never shadows the browser's `design` and
`Design`.

Prose follows the context:

- **Design** when the text is about the container: naming, filing, sharing,
  trashing or opening.
- **Page**, or the page's own kind (a logo, a wireframe, a photo), when the text
  is about what is made in it.

## What keeps its name

- **livedesign** stays the product and brand name.
- A whole design as a file is a `.livedesign` file of MIME type
  `application/vnd.livedesign+json`: both name the app that opens the file, not what is inside it.

<!-- legacy-names -->

## Older names it reads

A design's older name is **diagram**. livedesign's code, storage and routes all say design
(`@livedesign/design`, `apps/live/app/design/[id]`, the `DesignRoom` Durable Object, the `design-meta` and
`design-trashed` room ops), and the api serves no `/api/diagrams…` aliases and the MCP registers no `*_diagram` tools.
What can still arrive under the old name is read as a design:

- **Element links** in exported files, offline designs and old clients, `{ kind: 'diagram', diagramId, name }` (and
  the half-renamed `{ kind: 'diagram', designId }`), are upgraded by `upgradeLegacyLinks`
  (`packages/design/src/legacy-links.ts`), run by `migrateStoredTab`. A link is told apart from a tab, whose kind
  `'diagram'` is the tab kind, by its id field.
- **The offline store** keeps its records in the `designs` object store, moving any it finds in `diagrams`
  ([Offline Mode](offline-mode.md)).
- **Names**: a design still called "Untitled diagram" counts as untitled, exactly as "Untitled design" does
  (`isUntitledDesignName`, `packages/templates/src/legacy-untitled.ts`).
- **The editor path** `/diagram/<id>` opens the design and corrects the address bar to `/design/<id>`
  ([New design route](../007-editor/new-design-route.md)).

Files that hold the old names on purpose are named `legacy-*`.
<!-- /legacy-names -->
