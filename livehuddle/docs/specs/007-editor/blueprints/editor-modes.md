# Editor modes blueprint

Derived from [Editor modes](../editor-modes.md) at the fold-back (build plan step 9, Work Tracker #190). livehuddle has
no editor modes: `EditorMode` survives only as the stored value `'workshop'`, and since Work Tracker #329 the editor
neither holds nor passes one. This records where the stored value lives in the code and what pins it.

## Domain and naming

| Spec term         | Identifier                                                                              | File                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| editor mode       | `EditorMode` (the one id `'workshop'`)                                                  | `packages/document/src/editor-mode.ts`                                                                                   |
| the modes         | `EDITOR_MODE_CATALOGUE` (id, label, description), `EDITOR_MODES`                        | `packages/document/src/editor-mode.ts`                                                                                   |
| the default       | `DEFAULT_EDITOR_MODE` (`'workshop'`)                                                    | `packages/document/src/editor-mode.ts`                                                                                   |
| the mode's name   | `editorModeLabel` ("Workshop")                                                          | `packages/document/src/editor-mode.ts`                                                                                   |
| a tab's mode      | `Tab.opensIn` (stored name kept), read through `opensInOf`                              | `packages/document/src/editor-mode.ts`                                                                                   |
| a stored mode     | `parseEditorMode`, over the private `LEGACY_EDITOR_MODES` set                           | `packages/document/src/editor-mode.ts`                                                                                   |
| the palette       | `MEETING_PALETTE`, `paletteCategories()`, `paletteLandingCategory()` (no mode argument) | `apps/editor/components/palette/palette-layouts.ts`                                                                      |
| the starting tool | `useStartingTool`, `startingTool(mobile)`                                               | `apps/editor/hooks/editor/useStartingTool.ts`                                                                            |
| a new tab's mode  | `opensIn: DEFAULT_EDITOR_MODE` in `addTab`                                              | `apps/editor/hooks/persistence/useTabActions.ts`                                                                         |
| the Session strip | `sessionStripTools(mode)`                                                               | gone with the Session strip ([Not in livehuddle](../../002-project-scope/not-in-livehuddle.md#the-session-strips-timer)) |

"Diagram mode" and "Draw mode" name livediagram's modes only; no livehuddle identifier carries them as a live value.

## Behaviour and state

- **There is no mode state.** The editor context has no `editorMode`, the canvas no `editorMode` prop, the editor
  root no `data-editor-mode` attribute, and the palette, the Search and the tab actions take no mode. `opensInOf(tab)`
  ignores its argument and answers `DEFAULT_EDITOR_MODE`, so the readers that remain (the templates'
  `templateOpensIn`, stored-tab reads) see Workshop whatever a tab stored.
- **A stored mode** reads through `parseEditorMode`: `'workshop'` is itself; `'diagram'`, `'draw'`, `'pages'`,
  `'plan'`, `'illustrate'`, `'infographic'` and `'facilitate'` read as `'workshop'`; any other value (an unknown
  string, a number, `null`, absent) is `undefined`, and the tab still opens in Workshop through `opensInOf`.
- **The palette** has one layout: `MEETING_PALETTE`, landing on `'popular'`. A Participant has no palette
  ([Share roles](../../013-workspace/share-roles.md)).
- **The starting tool** is picked once as the editor opens (`useStartingTool`): Select, Hand on a phone, Hand for an
  embed. A later pick is the person's.
- **The Session strip** offers Timer and Poll when the mode is `'workshop'` (always, in livehuddle); any other
  value answers `null`. An embed gets no strip (`sessionToolsForSurface`).
- **Stored tabs from other products** pass through `migrateStoredTab` (`packages/document/src/stored-tab.ts`) on every
  way in (the api's tab read and thumbnail render, the offline store, a file import): `dropRetiredPages` then
  `dropRetiredPlan` drop what only livedocuments' pages and liveplanner's Plan read, and `migrateWhiteboardKind` turns
  a `kind: 'whiteboard'` tab into a general one with its ink written onto its elements.

## Interfaces and contracts

- `parseEditorMode(v: unknown): EditorMode | undefined` and `opensInOf(tab?: unknown): EditorMode` are the only ways
  code reads a mode. What writes one writes `'workshop'`: a template landing (`templateOpensIn`, falling back to
  `'workshop'`), a board scene landing (`../livediagram/apps/editor/lib/board-scene/land.ts`); a file import keeps the stored value
  it brought (`apps/editor/lib/import-merge.ts`), which reads as Workshop.
- `isEditorMode(v)` is true for `'workshop'` alone; a capitalised `'Workshop'` is not a mode id.
- `EDITOR_MODES` stays an array so its readers (the `/new` wizard's early-click script in
  `packages/api-schema/src/placement-defaults.ts`, the marketing template
  gallery) keep one shape; it has one member.

## Data and persistence

- `Tab.opensIn` is stored as written; nothing migrates it. A tab livediagram wrote with `'diagram'` or `'draw'` keeps
  that value and opens in Workshop.
- No browser key holds a mode: livediagram's per-tab `editor-mode:<tab>` key has no livehuddle reader.

## Errors and edge cases

- An unknown stored mode never throws: `parseEditorMode` answers `undefined` and `opensInOf` still answers Workshop.
- A stored element whose kind livehuddle cut reads as described in [Editor modes](../editor-modes.md#what-a-tab-written-elsewhere-keeps);
  that rule lives in the element migrations, not here.

## Security and trust

- The mode gates nothing by share role: there is nothing to switch. Share-role gates read the session's `can`
  ([Share roles](../../013-workspace/share-roles.md)).

## Performance and limits

- Every read is a constant: `opensInOf` allocates nothing, and `parseEditorMode` is one `Set` lookup.

## Testing

| Rule                                                                    | Test                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Workshop is the only mode, named "Workshop"                             | `packages/document/src/editor-mode.test.ts` ("is Workshop, and only Workshop")                                           |
| Only `'workshop'` is a mode id                                          | `packages/document/src/editor-mode.test.ts` ("recognises Workshop and nothing else")                                     |
| Every stored mode livediagram or an older build wrote reads as Workshop | `packages/document/src/editor-mode.test.ts`                                                                              |
| One palette layout, its categories and tiles                            | `apps/editor/components/palette/palette-layouts.test.ts`                                                                 |
| The editor starts on Select, Hand on a phone or in an embed, once       | `apps/editor/hooks/editor/useStartingTool.test.ts`                                                                       |
| The Session strip offers all three tools in Workshop only               | gone with the Session strip ([Not in livehuddle](../../002-project-scope/not-in-livehuddle.md#the-session-strips-timer)) |
| Pages and Plan content is dropped on the way in                         | `packages/document/src/retired-pages.test.ts`, `retired-plan.test.ts`                                                    |
| A whiteboard tab becomes a general tab                                  | `packages/document/src/legacy-whiteboard-tab.test.ts`                                                                    |

## Constants and configuration

- `DEFAULT_EDITOR_MODE = 'workshop'`: the only value; changing it is a spec change to [Editor modes](../editor-modes.md).
- `LEGACY_EDITOR_MODES`: the seven stored ids above. A new id another product writes joins it in the same PR as its spec.

## Defaults ledger

- D66 (below, in [DEFAULTS.md](DEFAULTS.md)): an unknown stored mode answers `undefined` from `parseEditorMode` rather than
  Workshop, so a caller can tell "stored something we know" from "stored garbage"; the tab opens in Workshop either way.
