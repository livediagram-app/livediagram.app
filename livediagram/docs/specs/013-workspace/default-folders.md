# Default folders

A **default folder** is where a person's new canvases land when they make one without choosing a place. Defaults
belong to the person and to the app: two teammates may send the same new canvases to different places, and
livediagram's defaults never move another app's items.

The index keeps them (`/placement-defaults`, [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md)
"Folders, tags, favourites, defaults"), and the shared Explorer, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md),
sets, shows and clears them.

## Entries

The list a person sets defaults from is titled **New canvases that open as**, and holds, in this order:

| Entry                  | Key                                  |
| ---------------------- | ------------------------------------ |
| Canvases               | `livediagram`                        |
| Retrospective canvases | `livediagram:template:retrospective` |
| Kanban canvases        | `livediagram:template:kanban`        |

The app's own entry holds every new canvas; a mode's entry (Diagrams, Whiteboards, Sessions) the canvases that
open in that mode; a specific tab kind's entry (Event Storming boards) the canvases whose first tab is that kind; a
template family's entry the canvases made from that family (`defaultEntries('livediagram', …,
CANVAS_TEMPLATE_FAMILIES, DEFAULT_FOLDER_OPTIONS)`, `apps/editor/lib/canvas-template-families.ts`,
`DEFAULT_FOLDER_OPTIONS` in `@livediagram/api-schema`). The
families are livediagram's `TEMPLATE_FAMILIES`: every retrospective format (Retrospective, Start / Stop / Continue,
Mad / Sad / Glad, 4Ls, Sailboat) is `retrospective`, the Kanban template `kanban`, every other template none
(`templateFamilyOf` in `@livediagram/templates`). A new template is not complete until it is mapped.

## Filing on create

A create carries its creation intent, `<mode>:<tabKind>[:<family>]` (`indexIntentOf`). The index tries the
kind's key first, then the family's, then the mode's, then the app's (`placementDefaultKeysFor` in
`@liveworkspace/index-client`). An explicit
`folderId: null` is My Work's top chosen on purpose and wins over any default. A default whose folder is gone, or
is in a team the person has left, is skipped; with none left the canvas lands at the top of My Work. Deleting a
folder drops the defaults that point at it.

- `/new` sends no place unless a `?folder=` / `?team=` context names one, so its creates are filed by default. The
  wizard never asks where a canvas goes ([New document route](../007-editor/new-document-route.md#one-step-wizard)).
- A template link (`/new?template=`) is filed by its template's family at creation.
- An API or MCP create that names no place is filed by the template family of its first seeded tab
  (`apps/api/src/routes/document-seed.ts`).
- Duplicate and the server copy land beside their source and are never filed by a default.
- This Browser's canvases have no folder: an offline canvas is kept where it is made
  ([Offline Mode](../006-document/offline-mode.md)).

### A template picked after creation

The wizard makes the chosen mode's blank, and the template is picked afterwards on the new canvas's start screen
([Template starts](../007-editor/start-diagramming.md)), so a template family's default can only answer then
(`apps/editor/components/start/useTemplatePickMove.ts`, over the shared Explorer's `template-pick`).

- **The wizard leaves a note** (this browser tab only): the canvas it made, its first tab, and whether the person
  chose the folder themselves (a `/new?folder=` / `?team=` context). It is written for a cloud canvas made from a
  mode's blank, never for This Browser or a template link.
- **The first template picked from a start screen** on that first tab takes the note. When the person did not
  choose the folder, the index's defaults are read again for the template's family, then the app's, and the canvas
  goes to the default that answers when it is somewhere else. A toast says so: "Moved to **Retros**, your default
  folder for retrospective canvases."
- **Once per canvas:** the note is taken at the first pick, and dropped when the tab gains content any other way
  first. Only an Editor picks from a start screen, so only an Editor's pick files a canvas.
- A failure (a list that cannot be read, a refused move) leaves the canvas where it is.

## Surfaces

- **Use as Default for…** in a folder's menu opens the entries as checkboxes; it stays open so several can be set
  in one visit. A key points at one folder, so checking an entry moves it from the folder that held it.
- **My Work's own menu** (the sidebar's My Work row) carries the same Use as Default for…, for the top of My Work:
  an entry is checked while it has no working default (none, or one whose folder is gone) and is then
  unavailable; checking another clears its default, so those canvases land at the top again. A team's top offers
  none: it cannot be a default.
- **The default marker**: a pin after a default folder's name (rows, cards, Details, the sidebar). Its words
  ("Default folder for new canvases") are its tooltip and a hidden line for screen readers.
- **Default Folders** (Settings › Documents, `apps/editor/components/dialogs/settings/SettingsDefaultFoldersRow.tsx`,
  and from Use as Default for…): each entry, where its new canvases go, Clear and Change. Change opens the default
  folder picker, where My Work's top clears the default and a team's top cannot be chosen.
- **Deleting a default folder**: the confirmation names where the contents go and says which new canvases were
  saved there.

## Non-goals

- A default for a space's root, per device, or per template (templates route only through their family).
- Defaults for This Browser's canvases.
- Moving existing canvases when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md).
