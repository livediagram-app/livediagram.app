# Default folders

A **default folder** is where a person's new plans land when they make one without choosing a place. Defaults
belong to the person and to the app: two teammates may send the same new plans to different places, and
liveplanner's defaults never move another app's items.

The index keeps them (`/placement-defaults`, [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md)
"Folders, tags, favourites, defaults"), and the shared Explorer, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md),
sets, shows and clears them.

## Entries

The list a person sets defaults from is titled **New plans that open as**, and holds, in this order:

| Entry               | Key                                  |
| ------------------- | ------------------------------------ |
| Plans               | `liveplanner`                        |
| Retrospective plans | `liveplanner:template:retrospective` |
| Kanban plans        | `liveplanner:template:kanban`        |

The template families are liveplanner's (`TEMPLATE_FAMILIES`, `lib/plan-template-families.ts`), the same values
the Explorer's Template filter offers.

## Filing on create

A create that names no folder and no team, and carries a creation intent, lands in the first working default of
the template's key (the last word of the intent, `plan:board:kanban`), then the app's key. An explicit
`folderId: null` is My Work's top chosen on purpose and wins over any default. A default whose folder is gone, or
is in a team the person has left, is skipped; with none left the plan lands at the top of My Work. Deleting a
folder drops the defaults that point at it.

- `/new` sends no place unless a `?folder=` / `?team=` context names one, so its creates are filed by default.
- A blank made by `/new` whose template is picked afterwards on Start Planning moves to that template's default
  folder at the pick (`useTemplatePickMove`), once, unless the person chose its place. The toast says where:
  "Moved to Boards, your default folder for Kanban plans."
- Duplicate and the server copy land beside their source and are never filed by a default.

## Surfaces

- **Use as Default for…** in a folder's menu opens the entries as checkboxes; it stays open so several can be set
  in one visit. A key points at one folder, so checking an entry moves it from the folder that held it.
- **The default marker**: a pin after a default folder's name (rows, cards, Details, the sidebar), with a count
  when it holds more than one entry. Its words ("Default folder for new Kanban plans") are its tooltip and a
  hidden line for screen readers.
- **Default Folders** (Settings › Plans, and from Use as Default for…): each entry, where its new plans go, Clear
  and Change. Change opens the default folder picker, where My Work's top clears the default and a team's top
  cannot be chosen.
- **Deleting a default folder**: the confirmation names where the contents go and says which new plans were
  saved there.
