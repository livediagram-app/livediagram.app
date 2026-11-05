# Workshop mode blueprint

> **Re-derived for part 3** (Work Tracker #423): [The meeting board](../workshop-mode.md) is the spec. The palette
> layout, the Session strip, the templates, the Search and the keys below are part 3's; part 4 re-derives what it
> deletes (the Collaborate code, the openers).

Derived from [Workshop mode](../workshop-mode.md) and [Editor modes](../../007-editor/editor-modes.md): Workshop is
livehuddle's one editor mode, every tab is in it, and there is no switch.

## Domain and naming

| Concept                | Identifier                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The mode               | `'workshop'`, the only member of `EditorMode` (`packages/document/src/editor-mode.ts`)                                   |
| Its catalogue entry    | `EDITOR_MODE_CATALOGUE`'s one row `{ id: 'workshop', label: 'Workshop', description }` (D2)                              |
| Its mark               | `FlipchartIcon` in `../packages/ui/src/icons/drawing-kinds.tsx`, `EDITOR_MODE_ICONS.workshop`                            |
| Its palette layout     | `MEETING: PaletteLayout` in `apps/editor/components/palette/palette-layouts.ts`                                          |
| The strip's tools      | gone with the Session strip ([Not in livehuddle](../../002-project-scope/not-in-livehuddle.md#the-session-strips-timer)) |
| Its blank              | template kind `'blank-session'`, label "Blank Space", document name "Untitled Space"                                     |
| Its default folder key | `'mode:workshop'`, words `{ label: 'Spaces', noun: 'spaces' }` (`MODE_WORDS`)                                            |

Banned as names for the mode, in code and copy: "Session mode", "Collaborate mode", and its old
name "Facilitate", which survives only where something stored is read: `LEGACY_EDITOR_MODES`
(every legacy id → `workshop`), the
`facilitateTourSeen` preference (`upgradeLegacyPreferences`) and the router's
`/help/canvas/facilitate-mode/` redirects. The facilitator (the baton) is a different thing and
keeps its name. The Collaborate elements keep `toolGroup: 'behaviour'` and their `tileGroup`s; livehuddle's palette
offers its Space categories: `collab-travel` "Travel", `collab-seating` "Seating", `collab-rooms` "Rooms",
`collab-amenities` "Amenities" and the rest of `SPACE_CATEGORIES` (there is no `collab-mode`). `COLLABORATE_CATEGORY_GROUPS` in
`palette-tile-defs.tsx` maps each to its `tileGroup` (`travel`, `seating`, `rooms`, `amenities`, ...), and the
category's tiles are that group's, in catalogue order: a new tile joins its category by its group alone.
The bar's Session category (`session-category.tsx`) is deleted; the `BehaviourGroup` / `BehaviourSearch` telemetry
types stay in the shared enums for history.

## Constants and configuration

| Constant                  | Value                                                                                                                                                                                                                                                                                                       | Provenance                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `MEETING.landing`         | `'popular'`                                                                                                                                                                                                                                                                                                 | spec "The palette"                  |
| `MEETING` Popular tiles   | `tools:sticky`, `tools:text`, `DIVIDE`, `tools:room`, `tools:meeting-table`, `tools:chair`, `tools:focus-button`, `tools:avatar-pad`                                                                                                                                                                        | spec "The palette"                  |
| `MEETING` categories      | `popular`, `write` (text, sticky), `collab-rooms` (`ROOMS_BUILD` then a divider, then the rest of `rooms`), `collab-seating`, `collab-amenities`, `collab-bar`, `collab-recreation`, `collab-garden`, `collab-meeting`, `collab-travel` (each its own `tileGroup`, in `SPACE_CATEGORIES` order), `stickers` | spec "The palette"                  |
| Bands                     | Common (Write), Meet (band 6: Rooms to Meeting), Travel (band 7: Travel, `SpaceCategory.band`), Decorate (Stickers)                                                                                                                                                                                         | spec "The palette"                  |
| Bar labels                | `BAR_LABELS.write = 'Write'` (one word); `barCategoriesFor(categories)` drops Popular                                                                                                                                                                                                                       | toolbar-layout "Names are one word" |
| `SEARCH_ONLY_TILE_IDS`    | `[]`                                                                                                                                                                                                                                                                                                        | spec "The palette" (Search)         |
| `sessionStripTools`       | `{ timer: true, poll: false }` on every tab; Poll shows only while a stored poll runs (`showPoll = pollRunning \|\| (offersPoll && canStart)`)                                                                                                                                                              | spec "The Session strip"            |
| `EDIT_KEYS`               | E / 0 eraser, T / 8 text, N sticky (no `9`: the Image left); no diagram-tool keys, no Frame key                                                                                                                                                                                                             | spec "The palette"                  |
| Template kinds            | `blank-session`, `virtual-office`, `coworking-space`, `team-pod`, `all-hands-hall`; every one opens in `'workshop'`                                                                                                                                                                                         | spec "Templates"                    |
| `RETIRED_TEMPLATE_TITLES` | The 34 retired templates' titles, so "Untitled <title>" still reads as a default name                                                                                                                                                                                                                       | spec "Templates"                    |
| The blank                 | `'blank-session'`                                                                                                                                                                                                                                                                                           | spec "Templates"                    |
| Default folder words      | `MODE_WORDS.workshop = { label: 'Spaces', noun: 'spaces' }`                                                                                                                                                                                                                                                 | spec "Workspace"                    |

## Behaviour and state

- **No state of its own.** Every tab reads as Workshop (`opensInOf`); the editor writes `opensIn: 'workshop'` on the
  tabs it makes. Nothing switches, so there is no switch, Shift+D, peer-switch toast or palette re-landing.
- **Palette:** `paletteCategoriesFor` returns `MEETING`'s categories.
- **Search:** the Toolbar strip's Search lists only the palette's tiles (`elementTileSections(...).here`) and the
  Stickers entries; `ToolbarSearch` draws no other section.
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
- Creation intent (`readCreationIntent`) and tab stats record `workshop`; Default Folders' Spaces entry
  (`mode:workshop`) is the one mode entry.
- No migration: livehuddle had no stored spaces when Diagram and Draw were cut.

## Errors and edge cases

| Case                            | Handling                                                               |
| ------------------------------- | ---------------------------------------------------------------------- |
| A tab stored as Diagram or Draw | Reads as Workshop; content intact apart from elements livehuddle lacks |
| `/new?mode=<anything>`          | The mode is ignored; the blank is Blank Space                          |
| Participant                     | No palette (`participantTiles` gone); `can.alwaysWalks` holds Avatar   |

## Security and trust

- No new trust boundary. A stored mode is validated by `parseEditorMode`; role gating is the session tools' (room
  drops view-role mutations) and the participant content rule's (a Participant has no palette).

## Performance and limits

- One static layout object; Search filters the palette's ~40 tiles per keystroke while open. No hot-path work.

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

| Spec rule                                      | Test                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| One mode; every stored value reads as Workshop | `packages/document/src/editor-mode.test.ts`                                                                              |
| The meeting palette and its Popular            | `components/palette/palette-layouts.test.ts`, `bar-categories.test.tsx`                                                  |
| Search finds only the palette                  | `palette-tile-search.test.ts`, `ToolbarPalette.test.tsx`                                                                 |
| Timer only; a running stored poll ends         | gone with the Session strip ([Not in livehuddle](../../002-project-scope/not-in-livehuddle.md#the-session-strips-timer)) |
| No diagram-tool keys                           | `hooks/canvas/useEditorKeyboardShortcuts.test.ts`, `shortcut-sections.test.ts`                                           |
| The five templates; a retired one is unknown   | `packages/templates` `template-catalogue.test.ts`, `retired-templates.test.ts`                                           |
| Strip on every tab                             | gone with the Session strip ([Not in livehuddle](../../002-project-scope/not-in-livehuddle.md#the-session-strips-timer)) |
| Share roles                                    | `lib/share-roles.test.ts` (the role matrix; a Participant has no palette)                                                |
| Templates open in Workshop; blank              | `apps/editor/lib/templates.test.ts`, `packages/templates/src/popular.test.ts`                                            |
| Default folder key + label                     | `default-key-entries.test.ts`, api-schema `placement-defaults.test.ts`                                                   |
| OpenAPI enum current                           | `apps/api` `manifest.test.ts`                                                                                            |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D1 to D8.
