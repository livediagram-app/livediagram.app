# Project

A **project** is the top-level container a person creates, names, shares,
files in a folder and deletes. It holds an ordered set of tabs, optionally
grouped into [tab folders](tab-folders.md). Every tab has a **tab kind**,
which fixes what that tab is, and every tab is worked on in Plan, the one
[editor mode](../007-editor/editor-modes.md).

## Domain language

| Term            | Means                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **project**     | The top-level container: its name, owner, location, share links and tabs.                                  |
| **tab**         | One page of a project, with its own canvas, layers and elements.                                           |
| **tab kind**    | What a tab is (`TabKind`, `packages/project/src/tab-kind.ts`): Board, Sheet, Dashboard, Form, or general.  |
| **general tab** | A tab Start Planning has not yet made one of the four; stored as the kind `'diagram'`, livediagram's name. |
| **editor mode** | How a tab is worked on: always Plan ([Editor mode](../007-editor/editor-modes.md)).                        |

- The kind id `'diagram'` is a stored value, never a term: prose says general tab. A tab with no `kind`, or a kind
  this build no longer has (a stored `'event-storming'` or `'whiteboard'`), reads as a general tab.
- "Board" on its own names a Board tab or a Plan board on it, never the container.
- A tab kind is reserved for a specific use with its own content and rules ([Plan tabs](../026-plan/plan-tabs.md),
  [Forms](../030-forms/forms.md)).
- Specs, UI copy and code name the container a project ([Domain language](../003-system-architecture/domain-language.md#project)).

## Choosing the word in prose

Code is strict: the container is always a project. Its type is `Project`, and compound names use
"project" (`projectId`, `ProjectDTO`); older modules still name a loaded project's variable `liveDoc`, so it
never shadows the browser's `document` or a nearby `project`.

Prose says **project** for the container, **tab** for one page of it, and the tab's kind (a board, a sheet, a
dashboard, a form) for what is on it. liveplanner is a planner, not a diagram tool
([Purpose](../001-project-vision/purpose.md)).

## What keeps its name

- **liveplanner** stays the product and brand name.
- A tab exported as a file is plain JSON (`.json`), imported back the same way
  ([Export fidelity](../020-import-export/export-fidelity.md)).

<!-- legacy-names -->

## Renaming from diagram

The container was called a diagram until the domain language settled on project. Everything
that named it moved in one change:

- **Code:** identifiers, files and packages (`@liveplanner/project`, `apps/editor/app/project/[id]`).
- **Stored data:** there is no D1. Each plan's own SQLite names the container `plan` (the `plan`
  row, `plan_tabs`, `plan_id`), and the stored values that name it (titles and snapshot keys, the
  `notifyProjectJoin` preference, telemetry types) use project. The tab kind `'diagram'` and anything naming a drawing (`ErDiagram`) are left alone.
- **Realtime and storage:** the Durable Object class is `PlanRoom` (binding `PLAN_ROOM`), a SQLite-backed class declared
  new in its first migration (liveplanner was never deployed, so it carries no rename history); it holds each plan's
  content ([API](../015-api/api.md#storage)); the room ops are `project-meta` and `project-trashed`.
- **Copies from elsewhere** are upgraded where they arrive: element links in exported files and
  offline projects (`upgradeLegacyLinks`, run by `migrateStoredTab`), the browser's cached
  preferences (`upgradeLegacyPreferences`), the offline store (moved to the `projects` object
  store on the next visit), and stored names: a project still called "Untitled diagram" counts as
  untitled, exactly as "Untitled project" does.
- **No old addresses.** liveplanner was never deployed, so nobody holds a `/diagram/<id>` link or an old help
  address: the router redirects neither, and there are no `/api/diagrams…` routes and no MCP `*_diagram` tools.

Files that hold the old names on purpose are named `legacy-*`.
<!-- /legacy-names -->
