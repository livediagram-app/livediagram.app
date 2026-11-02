# Workshop mode blueprint

Derived from [Workshop mode](../workshop-mode.md) and [Editor modes](../../007-editor/editor-modes.md): Workshop is
livehuddle's one editor mode, every tab is in it, and there is no switch.

## Domain and naming

| Concept                | Identifier                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| The mode               | `'workshop'`, the only member of `EditorMode` (`packages/document/src/editor-mode.ts`)        |
| Its catalogue entry    | `EDITOR_MODE_CATALOGUE`'s one row `{ id: 'workshop', label: 'Workshop', description }` (D2)   |
| Its mark               | `FlipchartIcon` in `../packages/ui/src/icons/drawing-kinds.tsx`, `EDITOR_MODE_ICONS.workshop` |
| Its palette layout     | `WORKSHOP: PaletteLayout` in `apps/editor/components/palette/palette-layouts.ts`              |
| The strip's tools      | `sessionStripTools(mode, esBoard)` in `apps/editor/components/canvas/SessionClusterStrip.tsx` |
| Its blank              | template kind `'blank-session'`, label "Blank Workshop", document name "Untitled Workshop"    |
| Its default folder key | `'mode:workshop'`, words `{ label: 'Sessions', noun: 'sessions' }` (`MODE_WORDS`)             |

Banned as names for the mode, in code and copy: "Session mode", "Collaborate mode", and its old
name "Facilitate", which survives only where something stored is read: `LEGACY_EDITOR_MODES`
(every legacy id → `workshop`), the
`facilitateTourSeen` preference (`upgradeLegacyPreferences`) and the router's
`/help/canvas/facilitate-mode/` redirects. The facilitator (the baton) is a different thing and
keeps its name. The Collaborate elements keep `toolGroup: 'behaviour'` and their `tileGroup`s
(the Tools category's is `'tools'`); their six categories are
`collab-ask` "Ask", `collab-tools` "Tools", `collab-record` "Record", `collab-react` "React",
`collab-mode` "Selection Mode" and `collab-navigate` "Navigate" (`COLLABORATE_CATEGORY_GROUPS` in
`palette-tile-defs.tsx` maps each to its `tileGroup`). Five of them (all but Ask) sit behind the bar's Session
category (`session-category.tsx`), a `PaletteCategoryBrowser` whose opens and searches send the `BehaviourGroup` /
`BehaviourSearch` telemetry types.

## Constants and configuration

| Constant                 | Value                                                                                                                                                                                                                                                                                                                                                                                            | Provenance               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| `WORKSHOP.landing`       | `'popular'`                                                                                                                                                                                                                                                                                                                                                                                      | spec "The palette"       |
| `WORKSHOP` Popular tiles | `tools:sticky`, `tools:text`, `tools:frame`, `tools:arrow`, `tools:session-timer`, `tools:session-vote`, `tools:session-poll`, `tools:reveal`, `collab:agenda`, `collab:idea-box`, `collab:qa-board`, `collab:temperature` (12, as every Popular)                                                                                                                                                | spec "The palette"       |
| `WORKSHOP` categories    | `popular`, `shapes`, `my-shapes`, `write` (less `tools:page`, `tools:annotation`, then `tools:table`, `tools:checklist`), `draw` (less `tools:shape-pen`, `tools:polygon`), `layout` (with `tools:timeline`), `collab-ask`, `collab-tools`, `collab-record`, `collab-react`, `collab-mode`, `collab-navigate`, `icons`, `stickers`, `media` (no embeds, D8), `data`; `event-storming` board only | spec "The palette"; D3   |
| `sessionStripTools`      | `{ timer, vote, poll }` all true on every tab                                                                                                                                                                                                                                                                                                                                                    | spec "The Session strip" |
| Template mode            | Every template kind opens in `'workshop'`                                                                                                                                                                                                                                                                                                                                                        | spec "Templates"         |
| The blank                | `'blank-session'`                                                                                                                                                                                                                                                                                                                                                                                | spec "Templates"         |

## Behaviour and state

- **No state of its own.** Every tab reads as Workshop (`opensInOf`); the editor writes `opensIn: 'workshop'` on the
  tabs it makes. Nothing switches, so there is no switch, Shift+D, peer-switch toast or palette re-landing.
- **Palette:** `paletteCategoriesFor` returns `WORKSHOP`'s categories, the event-storming notation added on such a
  board.
- **Search:** the Toolbar strip's Search lists every tile livehuddle has (`allElementTiles()`), the search-only tiles
  (Components, Code block, embeds) included; a pick places it.
- **Strip:** `CanvasChrome` mounts the Session strip on every tab.
- **Elements:** faces, menus and quick menus never read the mode.

## Interfaces and contracts

```ts
export type EditorMode = 'workshop'; // EDITOR_MODE_CATALOGUE, packages/document/src/editor-mode.ts
export function opensInOf(tab: { opensIn?: string } | undefined): EditorMode; // always 'workshop'
export function parseEditorMode(v: unknown): EditorMode | undefined; // 'workshop' and every legacy id
```

- The OpenAPI `EditorMode` enum is `['workshop']`, regenerated (`pnpm --filter @livehuddle/api gen:openapi`).

## Data and persistence

- `opensIn` is stored as `'workshop'`. Any other stored value (`'diagram'`, `'draw'`, `'facilitate'`, `'pages'`,
  `'plan'`, `'illustrate'`, `'infographic'`, an unknown string) reads as Workshop and is never rewritten on read.
- Creation intent (`readCreationIntent`) and tab stats record `workshop`; Default Folders' Sessions entry
  (`mode:workshop`) is the one mode entry.
- No migration: livehuddle had no stored spaces when Diagram and Draw were cut.

## Errors and edge cases

| Case                            | Handling                                                               |
| ------------------------------- | ---------------------------------------------------------------------- |
| A tab stored as Diagram or Draw | Reads as Workshop; content intact apart from elements livehuddle lacks |
| `/new?mode=<anything>`          | The mode is ignored; the blank is Blank Workshop                       |
| Event-storming board            | A Workshop tab with its notation palette (until step 5.2)              |
| Participant                     | `participantTiles`: sticky and text from Popular, plus image           |

## Security and trust

- No new trust boundary. A stored mode is validated by `parseEditorMode`; role gating is the session tools' (room
  drops view-role mutations) and the participant palette's.

## Performance and limits

- One static layout object; `allElementTiles()` is memoised once per session. No hot-path work.

## Presentation and UX

- No switch, mode menu or mode filter is drawn.

## Accessibility

- `FlipchartIcon` is `aria-hidden`; nothing new animates.

## Assets and external resources

- `FlipchartIcon`: hand-authored SVG path in `drawing-kinds.tsx` (MIT, this repo), D7.
- `blank-session` preview: hand-authored SVG in `packages/template-previews/src/template-preview-17.tsx`
  (Group 17, chained last in `template-preview.tsx`), with its hover story (the timer runs down, dots land).
- The help card glyph `workshop-mode` in `apps/help/lib/featureIcons.tsx` (three people round a
  speech bubble), hue `#c2410c` in `featureColours.ts`.
- The funnel slot `HeaderSession` on every surface (`packages/api-schema/src/cta-sources.ts`), retired
  with the public sites' Start Blank menu.

## Observability

- No mode events fire. `UI·Toggled·TemplateModeWorkshop` and `Editor·Changed·ModeWorkshop` stay in the shared enums
  for history only.

## Testing

| Spec rule                                      | Test                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| One mode; every stored value reads as Workshop | `packages/document/src/editor-mode.test.ts`                                               |
| Workshop's palette layout and Popular          | `components/palette/palette-layouts.test.ts`                                              |
| Search finds every element                     | `palette-tile-search.test.ts`, `palette-catalogue-search.test.ts`                         |
| Strip on every tab, event-storming board too   | `components/canvas/SessionClusterStrip.test.tsx`                                          |
| Share roles                                    | `SessionClusterStrip.test.tsx` (view role), `palette-layouts.test.ts` (participant tiles) |
| Templates open in Workshop; blank              | `apps/editor/lib/templates.test.ts`, `packages/templates/src/popular.test.ts`             |
| Default folder key + label                     | `default-key-entries.test.ts`, api-schema `placement-defaults.test.ts`                    |
| OpenAPI enum current                           | `apps/api` `manifest.test.ts`                                                             |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D1 to D8.
