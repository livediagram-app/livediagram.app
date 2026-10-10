# Colour picker blueprint

Derived from [Colour picker](../colour-picker.md). Engineering detail only; design lives in the spec.

## Domain and naming

| Spec term            | Identifier                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| colour picker        | `ColourPicker` (`apps/live/components/colour/ColourPicker.tsx`)                                                                                                                                 |
| swatch               | `ColourSwatch`, `SwatchChip` (`apps/live/components/colour/ColourSwatch.tsx`)                                                                                                                   |
| standard colours     | `STANDARD_COLOUR_NAMES`, `standardColours(tone, appearance)` (`packages/document/src/standard-colours.ts`)                                                                                      |
| tone                 | `StandardTone = 'strong' \| 'soft'`                                                                                                                                                             |
| theme colours        | the host's `ColourOption[]` passed as `theme`, named by `colourWords` (`packages/document/src/quick-swatches.ts`)                                                                               |
| Custom colours       | `Tab.customColours`, `customColoursOf` / `withCustomColour` (`packages/document`), `documentColours(...)` (`apps/live/lib/document-colours.ts`), `useDocumentColours()` (`apps/live/hooks/ui/`) |
| custom colour editor | `CustomColourEditor` (`apps/live/components/colour/CustomColourEditor.tsx`)                                                                                                                     |
| skins                | inline `ColourPicker`; row (`ColourRow`, `LaserColourRow`); `ColourField`; `ColourSwatchButton`, `useColourWell`; all popovers are `ColourPopover`                                              |
| no colour            | a leading `ColourOption` with `none: true` (`noColour(id, label)`)                                                                                                                              |

Grey is a **neutral stock colour**: `GREY_PEN_COLOUR = 'grey'`, `PenColourName = 'ink' | 'grey' | HuedPenColourName`.
It is not in `PEN_COLOURS` (the hued list the snap and the board-scene import measure hues against), so snapping and
import are unchanged.

## Interfaces and contracts

### `packages/document`

- `pen-colours.ts`: `GREY_PEN_COLOUR`; `isPenColourName` accepts it; `penColourLabel('grey') = 'Grey'`;
  `penColourHex('grey', board)` is the OKLCH chroma-0 colour tuned like the hued ones to `PEN_STOCK_CONTRAST`.
  `oklchHex(l, c, h)` is exported for the soft tone.
- `standard-colours.ts`:
  - `STANDARD_COLOUR_NAMES = ['ink','grey','red','orange','yellow','green','teal','blue','violet','pink']`.
  - `type StandardColour = { name: StandardColourName; label: string; hex: string }`.
  - `standardColours(tone, appearance): readonly StandardColour[]`, 10 entries from tables built at module load.
    - strong: `penColourHex(name, appearance)`.
    - soft: `ink` is labelled White, `SOFT_WHITE`; the others `oklchHex(SOFT_LIGHTNESS[appearance],
min(chroma * SOFT_CHROMA_SCALE, SOFT_MAX_CHROMA), hue)`; grey at chroma 0.
  - `standardColourAt(hex)`: `{ name, label, tone, appearance } | null` for any version's hex, case-insensitive.
  - `isHexColour(v)`: `#rrggbb` only, for the apps. `packages/items` keeps its own `HEX_COLOUR` regex (it does not
    depend on `@livediagram/document`).
- `quick-swatches.ts`: `colourWords(hexes)`: hue words, a repeat "Light"/"Deep", a third numbered.

### `packages/items` and `packages/agent-verbs`

- `itemColourValue(v)`: any `#rrggbb`, trimmed and lower-cased, else undefined.
- `type-changes.ts` `colourOf`: any `#rrggbb`, else `type_change_invalid` ("is not a colour").
- MCP `plan-schema.ts`: `color` and `colourArg` describe "a #rrggbb colour" with four examples.

### `apps/live/components/colour`

```ts
type ColourOption = { id: string; colour: string; label: string; none?: boolean };
type ColourGroup = { heading: string; options: readonly ColourOption[] };

ColourPicker({
  label,          // accessible name of the whole picker
  value,          // the id or #rrggbb in force; null/undefined matches nothing
  onPick,         // (id) => void; a custom colour is its lower-case #rrggbb
  leading?,       // ColourOption[]: first in the first group
  theme?,         // ColourOption[]: the Theme Palette; omitted, useThemeColours() (the active tab's theme)
  standard?,      // ColourGroup[]: one row ("Colours"), or a soft and a strong row
  yours?,         // string[]: Custom colours (hex)
  boardWarning?,  // the editor's hard-to-see warning
  onPreview?, onPreviewEnd?,
})
```

- `optionMatches(option, value)`: the same id, or for a hex value the same `option.colour` in any case (a colour
  stored by name arrives as the hex it is drawn in).
- A hex `value` matching no offered swatch is shown first in Custom colours; the list is capped at `YOUR_COLOURS_MAX`.
- `useThemeColours()` (`components/colour/useThemeColours.ts`): `themePresetColors(getTheme(activeTab.theme))` named by
  `colourWords`, ids and colours the hex; memoised on the tab's theme id; `[]` with no `EditorContext`. Custom colours
  leave out any colour the Theme Palette (or any other group) already offers.
- `ColourPopover({ anchor, onClose, ...picker })`: an `AnchoredPopover` of `COLOUR_POPOVER_WIDTH`
  (`COLOUR_PICKER_WIDTH + 2 * COLOUR_POPOVER_PADDING + 2`), focusing the picker's Tab stop a frame after opening.
- `ColourField({ swatch, name, none?, id?, disabled?, ...picker })`: h-8 trigger (chip, name, chevron); Arrow Up or
  Down opens it; a pick closes it and refocuses the trigger.
- `ColourSwatchButton({ swatch, none?, children?, preserveFocus?, onOpenChange?, triggerProps?, className?, ...picker })`:
  `preserveFocus` prevents mousedown focus (rich text keeps its selection) and skips the refocus.
- Builders (`colour-options.ts`): `standardOptions(tone, appearance, by: 'hex' | 'name')`, `standardGroup(...)`
  (heading "Colours"), `noColour(id, label)`, `hexOption(hex)`, `colourName(hex)`.
- Triggers keep their anchor element in state (a callback ref), never read a ref during render.

### Surfaces

| Surface                        | File                                                                                                         | Leading                              | Standard                                                                                                                                         | Value                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Element menu colour rows       | `components/palette/context-menu-input-rows.tsx` (`ColourRow`)                                               | `transparent` "No … colour"          | `tone` prop (soft on Background, Heading, caption and cell background), by name where the row stores names (`ink` prop), else hex for the canvas | id via `onCommit` / `onChange`                                             |
| Draw pen flyout                | `components/canvas/whiteboard/ColourPicker.tsx`                                                              | none                                 | strong by name for the board                                                                                                                     | `null` = Ink                                                               |
| Quick Style More colours       | `components/canvas/QuickMoreColours.tsx`                                                                     | none                                 | strong by name (soft hex on Background, soft light hex on Highlighter)                                                                           | `setColour(role, id)`, `setPenColour`, `setBoard*`, `setHighlighterColour` |
| Quick Style custom swatch      | `components/canvas/SwatchOverridePopover.tsx`                                                                | n/a (editor only)                    | n/a                                                                                                                                              | Use saves and closes                                                       |
| Plan card type                 | `components/plan/ColourSwatches.tsx` (`TypeColourButton`)                                                    | none                                 | strong light hex                                                                                                                                 | hex                                                                        |
| Plan card Colour               | `ColourSelect` (same file, a `ColourField`)                                                                  | None                                 | strong light hex                                                                                                                                 | hex / undefined                                                            |
| Plan column                    | `components/plan/PlanColumnPopover.tsx`                                                                      | No colour                            | strong light hex; column colours as `extra`                                                                                                      | hex / null                                                                 |
| Page background                | `components/canvas/page-background-section.tsx`, `page-background-custom.tsx` (`PAGE_COLOUR_GROUPS`)         | Paper                                | soft "Light" + strong "Dark", light hex                                                                                                          | `PageFill` / undefined                                                     |
| Article toolbar                | `components/canvas/article/page-toolbar-panels.tsx`                                                          | Default colour, Accent; No highlight | strong light; soft light "Highlights"                                                                                                            | hex / null                                                                 |
| Article Accent                 | `components/canvas/article/ArticleStyleSection.tsx`                                                          | Theme                                | strong light hex                                                                                                                                 | hex / undefined                                                            |
| Laser                          | `components/panels/LaserColourRow.tsx`                                                                       | Your colour (`presence`)             | strong by name for the canvas                                                                                                                    | `presence` / name / hex                                                    |
| Canvas, pattern, theme builder | `components/palette/palette-controls.tsx` (`useColourWell`, `ColorSwatch`), `custom-theme-builder-parts.tsx` | none                                 | soft + strong ("Soft colours", "Strong colours") by hex for the canvas; pattern strong only                                                      | hex                                                                        |
| Rich-text colour               | `components/canvas/RichTextToolbar.tsx`                                                                      | none                                 | strong hex for the canvas                                                                                                                        | hex                                                                        |
| Pie and legend rows            | `components/palette/context-menu-data-editors.tsx`                                                           | none                                 | strong light hex                                                                                                                                 | hex                                                                        |

## Behaviour and state

- `ColourPicker` owns one piece of state, `editorOpen`; focus is DOM state.
- Keys (`onColourKeys`, `colourKeyTarget` in `useColourKeys.ts`): on the picker root, for targets carrying
  `data-colour-key`, `ArrowLeft`/`ArrowUp` previous, `ArrowRight`/`ArrowDown` next, wrapping; `Home`/`End`. The editor's
  own controls keep their arrows. `preventDefault` + `stopPropagation` so a host menu's roving keys do not also move.
- Quick Style colour rows (`QuickRadioRow` with swatches) reuse `colourKeyTarget` across the row and More colours;
  rows of glyph buttons stay radio groups whose arrows move and choose.
- Preview: `onPointerEnter` (mouse only, `onMouseHover`) and `onFocus` call `onPreview(id)`; `onPointerLeave` of the root
  and focus leaving the root call `onPreviewEnd`; unmount reverts (`useRevertOnUnmount`).
- **+** toggles the editor; Use calls `onPick(hex)` and closes it.
- Outside-press handling: `ContextMenu`, `IllustratePagePanel` and `RichTextEditor` ignore presses and focus inside
  `[data-anchored-popover]`, so a picker popover never closes its host.

## Data and persistence

- No new stored field. `applyStrokeColorToEl` / `applyTextColorToEl` (`apps/live/lib/style-presets.ts`) store any pen
  name by name where the element has `penColour` / `penTextColour` (shape, arrow, freehand; text, sticky), else its
  light hex; Ink leaves a nameless element unchanged.
- `customSwatches` and `whiteboardYourColours` stay in the `UserPreferences` type, marked dead, so stored blobs load;
  nothing reads or writes them.
- Laser config (`apps/live/lib/laser-config.ts`): colour is `presence`, a standard name, or `#rrggbb`; legacy `cyan`
  reads as `teal`, `white` as `ink`, anything else as `presence`. The room message carries it as a string.
- `Tab.customColours?: string[]` (`packages/document/src/index.ts`), read with `customColoursOf(tab)` (lower-case
  `#rrggbb`, deduped, anything else dropped, at most `CUSTOM_COLOURS_MAX` = 12) and written with
  `withCustomColour(tab, hex)` (moves `hex` to the front, caps; returns the tab itself when nothing changes), both in
  `packages/document/src/custom-colours.ts`. Synced as a `tab-meta` field like any other.
- `addCustomColour(hex)` on the editor state (`hooks/editor/useAddCustomColour.ts`): `tickTabs` on the active tab
  (no history step), a no-op without edit rights or when nothing changes. `ColourPicker` calls it, lower-cased, on the
  custom editor's **Use**, before `onPick`; outside an `EditorContext` there is none.
- `documentColours(tabs, offered = [], firstTabId?)` (`apps/live/lib/document-colours.ts`): `customColoursOf` of
  `firstTabId`'s tab, then the others in tab order; leaves out `offered`; deduped; stops at `YOUR_COLOURS_MAX`
  (= `CUSTOM_COLOURS_MAX`). Never reads elements, pages or articles. `useDocumentColours(offered?)` memoises on the
  editor's `tabs`, the active tab id and the joined `offered`; with no editor context, `[]`. `ColourPicker` also leaves
  out of Custom Colours any colour another group offers.
- `stableColours(shown, next, max)` (`components/colour/colour-options.ts`): colours in `next` not in `shown` go
  first, then `shown` in its order, capped at `max`; returns `shown` itself when nothing is new. `ColourPicker` holds
  `shown` in state from mount (the in-force colour first, then `yours`) and re-derives it each render, frozen while
  the custom editor is open so its live preview adds nothing until **Use**. Unmounting (closing) resets it.

## Errors and edge cases

- An unparsable `value` ("", a named CSS colour) matches nothing and is not added to Custom colours.
- `transparent` / `none` matches the leading no-colour option whose id it is.
- An empty Custom colours shows only **+**, which is then the Tab stop.
- The editor ignores an invalid hex; Enter does nothing until it is valid.

## Security and trust

Colours from collaborators reach swatches only as `backgroundColor` style values after `isHexColour` (Custom colours) or
from typed constants; nothing is injected as markup.

## Performance and limits

- `standardColours` tables: built once at module load (20 tunes of at most 200 OKLCH steps, plus 20 soft washes).
- `documentColours`: reads at most 12 stored colours a tab, never the elements, so its cost is the tab count, not the
  document size; memoised on the tabs.
- `ColourPicker` renders at most about 50 buttons; no context provider, no per-swatch store read.

## Presentation and UX

Constants (`apps/live/components/colour/colour-metrics.ts`):

| Constant                 | Value | Why                           |
| ------------------------ | ----- | ----------------------------- |
| `SWATCH_TARGET_PX`       | 24    | the touch-targets floor       |
| `SWATCH_CHIP_PX`         | 20    | the Draw and Quick Style chip |
| `SWATCH_GAP_PX`          | 4     | the Draw row                  |
| `COLOURS_PER_ROW`        | 10    | one row of standard colours   |
| `COLOUR_PICKER_WIDTH`    | 276   | 10 × 24 + 9 × 4               |
| `COLOUR_POPOVER_PADDING` | 12    | the popover's inset           |
| `YOUR_COLOURS_MAX`       | 12    | the old per-user cap          |

Headings: 10px, semibold, uppercase, slate-500, 6px above their row. Quick Style: `QUICK_ROW_TARGETS` = 10 (Ink, eight
hued, More colours), so the panel is 258px.

## Accessibility

- Root: `role="group"`, `aria-label={label}`. Each heading's row: `role="group"`, `aria-labelledby` its heading.
- Swatches: `<button aria-pressed>` with `aria-label` and a `Tooltip` of the same name.
- Focus ring: 2px brand, `focus-visible` only. Selection ring brand-500 / brand-300, at least 3:1 on the panel.
- Reduced motion: no hover scale.

## Observability

Picks are reported by each surface's own write path (`track('Element', 'Changed', ...)`, `track('Draw', 'Changed',
'PenColour')`); the picker itself adds no event.

## Testing

| Rule                                                      | Test                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ten standard colours, both tones, readable                | `packages/document/src/standard-colours.test.ts`                                                                                            |
| Grey is a stock colour, not hued                          | `packages/document/src/pen-colours.test.ts`                                                                                                 |
| one Tab stop, arrows wrap, Home/End                       | `apps/live/components/colour/ColourPicker.test.tsx`                                                                                         |
| pick, custom Use, value matching, yours cap               | `ColourPicker.test.tsx`                                                                                                                     |
| preview and revert                                        | `ColourPicker.test.tsx`                                                                                                                     |
| skins open, pick closes, Escape refocuses                 | `ColourSkins.test.tsx`                                                                                                                      |
| custom colours kept and listed                            | `packages/document/src/custom-colours.test.ts`, `apps/live/lib/document-colours.test.ts`                                                    |
| no new pickers: no colour well, editor only in the picker | `apps/live/components/colour/one-picker.test.ts`                                                                                            |
| element menu rows                                         | `components/palette/context-menu-input-rows.test.tsx`                                                                                       |
| Quick Style rows, More colours, keys                      | `components/canvas/QuickStylePanel.test.tsx`, `hooks/canvas/useQuickStyle.test.tsx`                                                         |
| Draw marker picker                                        | `components/canvas/whiteboard/ColourPicker.test.tsx`, `WhiteboardDock.test.tsx`                                                             |
| Plan surfaces                                             | `ColourSwatches.test.tsx`, `ItemFieldEditor.colour.test.tsx`, `PlanColumnPopover.colour.test.tsx`, `packages/items/src/item-colour.test.ts` |
| page background and article                               | `page-background-section.test.tsx`, `components/canvas/article/article-colours.test.tsx`                                                    |
| laser and colour wells                                    | `LaserColourRow.test.tsx`, `lib/laser-config.test.ts`, `components/palette/colour-wells.test.tsx`                                           |
| rows fit, e2e                                             | `e2e/quick-style-swatch-rows.spec.ts`, `quick-style-panel.spec.ts`, `quick-style-mixed.spec.ts`                                             |

## Constants and configuration

| Constant            | Value                 | Safe range           | Provenance                             |
| ------------------- | --------------------- | -------------------- | -------------------------------------- |
| `SOFT_LIGHTNESS`    | light 0.93, dark 0.34 | 0.88-0.96 / 0.28-0.4 | Tailwind 100-200 and 800-900 lightness |
| `SOFT_CHROMA_SCALE` | 0.45                  | 0.3-0.6              | keeps washes pastel                    |
| `SOFT_MAX_CHROMA`   | 0.08                  | 0.05-0.1             | Tailwind 200 chroma                    |
| `SOFT_WHITE`        | `#ffffff`             | n/a                  | Ink's soft counterpart (D63)           |
