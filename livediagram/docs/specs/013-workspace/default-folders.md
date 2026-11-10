# Default folders

A **default folder** is where a person's new canvases land when they make one without choosing a place. Defaults
belong to the person and to the app: two teammates may send the same new canvases to different places, and
livediagram's defaults never move another app's items.

The index keeps them (`/placement-defaults`, [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
"Folders, favourites, defaults"), and the shared Explorer, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md),
sets, shows and clears them.

## Entries

The list a person sets defaults from is titled **New canvases that open as**, and holds exactly three entries, one
per editor mode, in this order:

| Entry     | Key                         | Holds                              |
| --------- | --------------------------- | ---------------------------------- |
| Diagrams  | `livediagram:mode:diagram`  | new canvases that open in Diagram  |
| Drawings  | `livediagram:mode:draw`     | new canvases that open in Draw     |
| Workshops | `livediagram:mode:workshop` | new canvases that open in Workshop |

Their words are `DEFAULT_FOLDER_OPTIONS` in `@livediagram/api-schema` (Diagrams / diagrams, Drawings / drawings,
Workshops / workshops), typed per mode, so a new editor mode does not compile until it is named there. livediagram
offers no app-level entry ("Canvases"), no entry for a tab kind (an Event Storming board) and none for a template
family (a retrospective): a canvas is filed by the mode it opens in alone. The shared Explorer reads that from the
index's `MODE_ONLY_PLACEMENT_APPS` ([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
"Mode-only apps"), so every surface (Settings, the Explorer's Default Folders, Use as Default for…, liveworkspace's
own Explorer) lists the same three.

## Filing on create

A create carries its creation intent, `<mode>:<tabKind>[:<family>]` (`indexIntentOf`). The index records it whole
(the Explorer's filters read its family), but files the canvas by its mode's key only (`placementDefaultKeysFor` in
`@liveworkspace/index-client`): an Event Storming board or a retrospective lands in the default of whichever of the
three modes it opens in, and a key from before (the app's own, a kind's, a template family's) is never read. An
explicit `folderId: null` is My Work's top chosen on purpose and wins over any default. A default whose folder is
gone, or is in a team the person has left, is skipped, and the canvas lands at the top of My Work. Deleting a
folder drops the defaults that point at it.

- `/new` sends no place unless a `?folder=` / `?team=` context names one, so its creates are filed by default. The
  wizard never asks where a canvas goes ([New document route](../007-editor/new-document-route.md#one-step-wizard)).
- A template link (`/new?template=`) is filed by the mode its template opens in.
- An API or MCP create that names no place and no intent is filed by its first seeded tab: the mode its template
  opens in (`templateEditorMode`), else the mode the tab says it opens in (`seedIntentOf`,
  `apps/api/src/routes/document-seed.ts`).
- Duplicate and the server copy land beside their source and are never filed by a default.
- This Browser's canvases are never filed by a default: an offline canvas is kept where it is made
  ([Offline Mode](../006-document/offline-mode.md)), at This Browser's root, and only the person moves it into one of
  its local folders ([one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#this-browser-a-space) "This Browser, a Space").

### Defaults from before

Index migration `0013_livediagram_mode_defaults.sql` carried each person's defaults over once: their old app-level
default ("Canvases") filled whichever of the three mode keys held none, then every livediagram app-level, kind and
template key was deleted. Defaults are per person, never per team, so nothing else moved.

### A template picked after creation

The wizard makes the chosen mode's blank, and the template is picked afterwards on the new canvas's start screen
([Template starts](../007-editor/start-diagramming.md)). A template opens in its own mode, which can differ from
the blank's (a Workshop template picked on a Diagram blank), so the mode's default answers then
(`apps/editor/components/start/useTemplatePickMove.ts`, over the shared Explorer's `template-pick`).

- **The wizard leaves a note** (this browser tab only): the canvas it made, its first tab, and whether the person
  chose the folder themselves (a `/new?folder=` / `?team=` context). It is written for a cloud canvas made from a
  mode's blank, never for This Browser or a template link.
- **The first template picked from a start screen** on that first tab takes the note. When the person did not
  choose the folder, the index's defaults are read again for the template's mode, and the canvas goes to that
  default when it is somewhere else. A toast says so: "Moved to **Retros**, your default folder for workshops."
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
  ("Default folder for new diagrams and drawings") are its tooltip and a hidden line for screen readers.
- **Default Folders** (Settings › Explorer, `apps/editor/components/dialogs/settings/SettingsDefaultFoldersRow.tsx`,
  and from Use as Default for…): each entry, where its new canvases go, Clear and Change. Change opens the default
  folder picker, where My Work's top clears the default and a team's top cannot be chosen.
- **Deleting a default folder**: the confirmation names where the contents go and says which new canvases were
  saved there ("New diagrams and workshops are saved here by default.").

## Non-goals

- A default for a space's root, per device, per tab kind or per template (a canvas routes only through its mode).
- Defaults for This Browser's canvases.
- Moving existing canvases when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md).
