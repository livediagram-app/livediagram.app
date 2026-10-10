# Facilitate mode blueprint

Derived from [Facilitate mode](../facilitate-mode.md). The mode machinery it joins (store, switch,
Opens in, Shift+D, peer switches) is [Editor modes](../../007-editor/blueprints/editor-modes.md);
this blueprint adds only what the fifth mode changes.

## Domain and naming

| Concept                    | Identifier                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| The mode                   | `'facilitate'`, a member of `EditorMode` (`packages/document/src/editor-mode.ts`)            |
| Its catalogue entry        | `EDITOR_MODE_CATALOGUE` row `{ id: 'facilitate', label: 'Facilitate', description }` (D2)    |
| Its mark                   | `FlipchartIcon` in `packages/ui/src/icons/drawing-kinds.tsx`, `EDITOR_MODE_ICONS.facilitate` |
| Its palette layout         | `FACILITATE: PaletteLayout` in `apps/live/components/palette/palette-layouts.ts`             |
| The strip's tools per mode | `sessionStripTools(mode, esBoard)` in `apps/live/components/canvas/SessionClusterStrip.tsx`  |
| Its blank                  | template kind `'blank-session'`, label "Blank Session", document name "Untitled Session"     |
| Its default folder key     | `'mode:facilitate'`, words `{ label: 'Sessions', noun: 'sessions' }` (`MODE_WORDS`)          |

Banned as names for the mode, in code and copy: "Session mode", "Collaborate mode". The palette
category keeps id `behaviour` and label "Collaborate".

## Constants and configuration

| Constant                             | Value                                                                                                                                                                                                                                             | Provenance                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `FACILITATE.landing`                 | `'popular'`                                                                                                                                                                                                                                       | spec "The palette"                |
| `FACILITATE` Popular tiles           | `tools:sticky`, `tools:text`, `tools:frame`, `tools:arrow`, `tools:session-timer`, `tools:session-vote`, `tools:session-poll`, `tools:reveal`, `collab:agenda`, `collab:idea-box`, `collab:qa-board`, `collab:temperature` (12, as every Popular) | spec "The palette"                |
| `FACILITATE` categories              | `popular`, `shapes`, `my-shapes`, `write`, `draw`, `build`, `icons`, `stickers`, `media` (Diagram's: no embeds, D8), `behaviour`                                                                                                                  | spec "The palette"; D3            |
| `DIAGRAM` categories                 | as today less `stickers` and `behaviour`; `write` = its own tiles then `collab:comment-pin`, `collab:action-card` (D4)                                                                                                                            | spec "What Diagram gives up"      |
| `sessionStripTools`                  | `facilitate` or an event-storming board (`esBoard`) → all three; `plan` → `['timer','vote']`; else `null`                                                                                                                                         | spec "The Session strip per mode" |
| `TEMPLATE_MODES` additions           | `retrospective`, `start-stop-continue`, `mad-sad-glad`, `four-ls`, `sailboat`, `town-hall`, `lean-coffee`, `crazy-eights`, `meeting-agenda`, `blank-session` → `'facilitate'`                                                                     | spec "Templates"                  |
| `BLANK_TEMPLATE_FOR_MODE.facilitate` | `'blank-session'`                                                                                                                                                                                                                                 | spec "Templates"                  |
| `MODE_BEST.facilitate`               | `retrospective`, `town-hall`, `lean-coffee`, `crazy-eights` (D5)                                                                                                                                                                                  | templates-by-mode spec            |

## Behaviour and state

- **No new state.** The mode is `Tab.opensIn = 'facilitate'`, written by the existing switch,
  Shift+D, tab menu Mode and template overrides. Everything else derives from the mode.
- **Gates:** `hasBoardLook`, `hasPageLook`, `hasPlanInput` are all `false` for `facilitate`; it
  takes Diagram's look and input. `useModeDefaultTool` starts it on Select (Hand on a phone), as
  Diagram.
- **Palette:** `paletteLayoutFor('facilitate')` returns `FACILITATE`; Draw keeps borrowing
  `DIAGRAM`. A switch re-lands the palette on the new layout's `landing` (existing behaviour).
- **Search:** unchanged code. `allElementTiles()` iterates `PALETTE_LAYOUTS`, which gains
  `facilitate`, so every Collaborate tile stays searchable; in Diagram they fall outside
  `modeElementTiles('diagram')` and list with other modes' tiles; stickers go to the catalogue
  search's `elsewhere` (`paletteCategoryOffered('diagram','stickers')` is false). Picking either
  places it in the current mode with no switch.
- **Strip:** `CanvasChrome` mounts the strip only when `sessionStripTools(mode, esBoard)` is
  non-null, and `useCanvasChromePanels` closes a session popover whose mode no longer offers it;
  both pass `props.esBoard`, so Diagram's strip vanishes, running tool or not, while an
  event-storming board keeps it.
- **Elements:** no change to faces, menus or quick menus; they never read the mode.
- **Templates:** `templateCanvasOverrides` sets `opensIn` from `templateEditorMode(kind)`, so the
  table above is the only template change besides the new blank.

## Interfaces and contracts

```ts
export type EditorMode = 'diagram' | 'draw' | 'illustrate' | 'plan' | 'facilitate';
export function sessionStripTools(mode: EditorMode): readonly SessionStripTool[] | null;
export const PALETTE_LAYOUTS: { diagram; illustrate; plan; facilitate };
export const EDITOR_MODE_ICONS: Record<EditorMode, IconComponent>; // key type derived from EditorMode
```

- Every `Record<EditorMode, …>` gains a `facilitate` entry (the compiler enforces it):
  `MODE_EVENT` (`useEditorMode.ts`), `MODE_WORDS`, `BLANK_TEMPLATE_FOR_MODE`, `MODE_BEST`,
  `useTemplateModeFilter` events and counts, marketing `modeCounts`.
- Non-exhaustive lists updated by hand: `VALUE_LABELS['opens-in']` (explorer-lens), settings
  icons, help `featureColours`, marketing `HeroMode` and `TemplateGallery` `CHOICES`.
- OpenAPI `EditorMode` enum regenerated (`pnpm --filter @livediagram/api gen:openapi`).
- `TemplateKind` gains `'blank-session'`; `isBlankTemplate` covers it.

## Data and persistence

- `opensIn: 'facilitate'` is stored and synced like any mode. `parseEditorMode` accepts it via
  `isEditorMode` (catalogue-driven). An older client reading `'facilitate'` falls back to Diagram
  through `opensInOf`'s unknown-value rule: no crash, no write-back.
- Creation intent (`readCreationIntent`) and tab stats record `facilitate`; default folder key
  `mode:facilitate` is generated by `PLACEMENT_DEFAULT_KEYS`.
- No migration: existing tabs keep their stored mode (spec "Existing tabs").

## Errors and edge cases

| Case                                                  | Handling                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| A session button pressed in Diagram                   | Starts its tool as today; no strip appears (spec)                          |
| A strip popover open when the tab switches to Diagram | Closes (existing `useCanvasChromePanels` re-check)                         |
| Older client opens a Facilitate tab                   | Reads Diagram (unknown mode), shows Diagram's palette; content intact      |
| `/new?mode=facilitate`                                | `new-document-params` accepts any `EditorMode`; selects Blank Session      |
| Event-storming board                                  | Always Diagram; no switch (unchanged)                                      |
| Participant in Facilitate                             | `participantTiles('facilitate')`: sticky and text from Popular, plus image |

## Security and trust

- No new trust boundary. The mode is a tab field already validated server-side by
  `parseEditorMode`; role gating is the existing switch's (`canEdit && canSwitch`), the session
  tools' (room drops view-role mutations) and the participant palette's.

## Performance and limits

- One more static layout object (12 entries) and one more catalogue row; `allElementTiles()` is
  memoised once per session. No hot-path work added; the strip renders less in Diagram.
- Budget: `paletteCategoriesFor('facilitate')` under 1 ms (measured with the existing modes).

## Presentation and UX

- The switch menu, tab menu Mode, tab pill and template filter gain one row/glyph each through
  the catalogue; no layout shift (fixed-size chip).
- Copy: label "Facilitate"; description per D2; toast "<Name> switched this tab to Facilitate.";
  announcement "Facilitate mode".

## Accessibility

- `FlipchartIcon` is `aria-hidden` like the other marks; the rows' names come from the label.
- Contrast and focus as the existing mode rows; nothing new animates.

## Assets and external resources

- `FlipchartIcon`: hand-authored SVG path in `drawing-kinds.tsx` (MIT, this repo), D7.
- `blank-session` preview: hand-authored SVG in `packages/template-previews/src/template-preview-16.tsx`
  (Group 16, chained last in `template-preview.tsx`), with its hover story (the timer runs down, dots land).
- The help card glyph `facilitate-mode` in `apps/help/lib/featureIcons.tsx` (three people round a
  speech bubble), hue `#c2410c` in `featureColours.ts`.
- The Start Blank menu row (`packages/ui/src/StartBlankMenu.tsx`) and its funnel slot `HeaderSession`
  on every surface (`packages/api-schema/src/cta-sources.ts`).

## Observability

- Telemetry: `Editor·Changed·ModeFacilitate`, `UI·Toggled·TemplateModeFacilitate`,
  `Folder·Changed|Cleared·DefaultModeFacilitate` (derived), each with an explanation sentence in
  `apps/telemetry/app/event-explanations.ts`.

## Testing

| Spec rule                                                                                 | Test                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Five modes, order, labels, Shift+D wraps                                                  | `packages/document/src/editor-mode.test.ts`, `hooks/editor/editor-mode-shortcut.test.ts`                               |
| Facilitate's palette layout and Popular                                                   | `components/palette/palette-layouts.test.ts`                                                                           |
| Diagram drops Stickers + Collaborate, keeps Icons, Comment panel and Action card in Write | `palette-layouts.test.ts`                                                                                              |
| Search still finds them in Diagram                                                        | `palette-tile-search.test.ts`, `palette-catalogue-search.test.ts`                                                      |
| Strip per mode; Diagram none while running                                                | `components/canvas/SessionClusterStrip.test.tsx`                                                                       |
| Strip kept on an event-storming board                                                     | `SessionClusterStrip.test.tsx`                                                                                         |
| Share roles in Facilitate                                                                 | `SessionClusterStrip.test.tsx` (view role), `palette-layouts.test.ts` (participant tiles), `EditorModeSwitch.test.tsx` |
| Templates open in Facilitate; blank                                                       | `apps/live/lib/templates.test.ts`, `packages/templates/src/popular.test.ts`                                            |
| Default folder key + label                                                                | `default-key-entries.test.ts`, api-schema `placement-defaults.test.ts`                                                 |
| Explorer Opens in chip                                                                    | `packages/explorer-lens` tests                                                                                         |
| OpenAPI enum current                                                                      | `apps/api` `manifest.test.ts`                                                                                          |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D1 to D8.
