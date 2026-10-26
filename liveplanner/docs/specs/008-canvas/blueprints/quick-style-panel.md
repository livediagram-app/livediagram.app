# Quick style panel: blueprint

Derived from [Quick style panel](../quick-style-panel.md): style memory, the quick swatches and their bindings. No
panel is mounted. The spec decides; this file only adds engineering precision. Defaults applied where the spec is
silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                          | Role                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/project/src/quick-swatches.ts`                                      | The seven swatches per role and theme, slot ids, hue names, slot lookup                                          |
| `packages/project/src/colors.ts`                                              | `unpaintedShapeInk(surface)`: the theme default on the Default scheme                                            |
| `packages/project/src/element-types.ts`, `arrow-types.ts`                     | `strokeSwatch` / `fillSwatch` on `ShapeElement`, `strokeSwatch` on `ArrowElement`, `textSwatch` on `TextElement` |
| `packages/project/src/validate.ts`                                            | Rejects a swatch field that is not a slot                                                                        |
| `packages/project/src/quick-swatch-rederive.ts`                               | `rederiveQuickSwatches(el, theme)`: a bound colour re-read from its slot                                         |
| `packages/project/src/theme-graph.ts`                                         | The theme walks call the re-derive last                                                                          |
| `apps/editor/lib/style-presets.ts`, `apps/editor/lib/reset-colours.ts`        | Hand-set colour, presets and resets clear the matching binding                                                   |
| `apps/editor/hooks/canvas/useColorStyleSetters.ts`, `useShapeStyleSetters.ts` | Resets clear both bindings                                                                                       |
| `apps/editor/lib/style-memory.ts`                                             | Pure: memory shape, record from an edit, apply to a new element, forget, parse                                   |
| `apps/editor/hooks/canvas/useStyleMemory.ts`                                  | Per-project memory state + `localStorage`; `recordEdit`, `styleNewElement`, `forget`                             |
| `apps/editor/app/project/[id]/useEditorState.ts`                              | Wires memory into the style hooks and the creation hooks                                                         |
| `../packages/workbench/src/lib/panel-presence.ts`                             | `announcePanelPresence()`, the floating-panel presence event                                                     |

## Domain and naming

| Term             | Identifier                                                         | Meaning                                                                            |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Quick swatch     | `QuickSwatch = { slot, color, name }`                              | One colour option                                                                  |
| Swatch role      | `QuickSwatchRole = 'stroke' \| 'fill' \| 'text'`                   | Which colour (stroke / background / text) it is                                    |
| Slot             | `QuickSwatchSlot = 1..6`; `0` = theme default                      | The stable id of a colour across themes                                            |
| Swatch binding   | `strokeSwatch`, `fillSwatch`, `textSwatch` on the element          | The slot a colour was picked from; absent = unbound                                |
| Kind key         | `StyleKindKey`, `styleKindOf(el)`                                  | `shape:<ShapeKind>` for shapes, `arrow` for arrows, `text` for text elements (D53) |
| Style memory     | `StyleMemory = Partial<Record<StyleKindKey, RememberedStyle>>`     | Per kind, the last value chosen for each memorable field                           |
| Memorable fields | `SHAPE_MEMORY_FIELDS`, `ARROW_MEMORY_FIELDS`, `TEXT_MEMORY_FIELDS` | The fields memory records and applies (the spec lists them)                        |

Banned synonyms: "preset" for a swatch, "default style" for memory.

## Swatches

`quickSwatches(theme, role)` returns seven, slots `[0, 1, 2, 3, 4, 5, 6]`:

1. Ink: `themeInk(theme)` = `theme.elementX ?? unpaintedShapeInk(canvasSurface(theme.backgroundColor)).X`.
2. Slot 0: `{ color: ink.stroke | ink.fill | ink.text, name: 'Theme default' }`.
3. A theme with a `palette`: its first six entries, `stroke` or `fill` by role (text: `stroke`
   stepped to `MIN_TEXT_CONTRAST` as below, D50), named by `hueName(entry.stroke)`; padded from the toned set when shorter (D32); names disambiguated.
4. Otherwise the toned set: accent HSL from `ink.stroke`; `s = clamp(s, 0.45, 0.85)`;
   `l = clamp(l, 0.36, 0.52)` on light paper, `clamp(l, 0.6, 0.74)` on dark. Hues and names: 0 Red,
   28 Orange, 46 Yellow, 140 Green, 215 Blue, 270 Violet.
   - Stroke: `hsl(h, s, l)`, stepped by `0.02` lightness away from the canvas until contrast against
     `theme.backgroundColor` is at least `QUICK_STROKE_MIN_CONTRAST = 3`.
   - Text: `hsl(h, s, l)` stepped the same way until contrast is at least
     `MIN_TEXT_CONTRAST = 4.5` (the shared text-contrast constant in `colors.ts`).
   - Fill: `mix(stroke, base, wash)` with `base = '#ffffff'`, `wash = 0.2` on light paper and
     `base = ink.fill`, `wash = 0.3` on dark; `wash` reduced by `0.02` until the contrast of
     `ink.text` on it is at least `QUICK_FILL_MIN_TEXT_CONTRAST = 4.5`.
5. `hueName(hex)`: saturation below 0.12 is Grey; hue 15 to 45 with lightness below 0.33 is Brown;
   otherwise by upper bound 15 Red, 30 Orange, 38 Amber, 65 Yellow, 85 Lime, 165 Green, 185 Teal,
   200 Cyan, 250 Blue, 290 Violet, 345 Pink, 360 Red.
6. Disambiguation: a repeated name becomes `Deep <name>` or `Light <name>` by lightness against its
   first holder; a still-taken name is numbered (`Orange 2`).

`quickSwatchColor(theme, role, slot)` is `quickSwatches(...)[slot].color`.
`quickSwatchSlotOf(theme, role, color)` is the slot 1-6 whose colour equals `color`
case-insensitively, else `null`.

## Swatch bindings

- liveplanner's editor writes no binding; a binding arrives with an element.
- `rederiveQuickSwatches(el, theme)`: for a shape or arrow (stroke / fill) or a text element (text)
  carrying a valid slot, rewrites the bound colour from `quickSwatchColor(view, role, slot)`; an invalid slot is
  ignored (D33). Returns `el` unchanged when nothing is bound.
- Called last by the theme walks (`recolourElementsForTheme`, `switchThemeElements`, `resetThemeElementsToTheme`,
  `resetArrowsToTheme`), with the theme itself (not the per-branch view), so a slot means the same colour on every
  branch (D34).
- Cleared by: `applyFillColorToEl` (`fillSwatch`), `applyStrokeColorToEl` (`strokeSwatch`, shapes and arrows),
  `applyTextColorToEl` (`textSwatch`, text elements), `applyColorPresetToEl` (both), `resetColorsSelected` through
  `resetElementColours` (shape both, arrow stroke, text `textSwatch`; and every stock name), `resetShapeStyleSelected`
  (both).
- Validation: `isValidElement` rejects a shape, arrow or text element whose `strokeSwatch` / `fillSwatch` /
  `textSwatch` is present and not `isQuickSwatchSlot`.

## Style memory

`StyleMemory` is `Partial<Record<StyleKindKey, RememberedStyle>>`, a remembered style being `Record<field, string | number>`.

- `recordStyleEdit(memory, before, after, theme)`: for every element present in both lists with the
  same id that is a remembered target (`isRememberedTarget`: an unlocked shape, arrow or text element), for every memorable field of its kind whose value changed
  (`!==`): the value is written under the element's kind key; `undefined`, or a colour equal
  (case-insensitive) to the theme's own value for that field (`elementFill` / `elementStroke` /
  `elementText`), deletes the field instead. An empty kind entry is removed. Returns the input
  `memory` itself when nothing changed (D35).
- `applyStyleMemory(el, memory, theme)`: for a style target with an entry, lays each remembered field
  on the element; then a remembered `strokeSwatch` / `fillSwatch` re-derives its colour for `theme`, and
  a remembered `colorPreset` re-derives the preset for `theme` (`rederiveColorPresetForTheme`).
  Anything else is returned unchanged.
- `forgetStyleKinds(memory, kinds)`: removes those entries.
- `parseStyleMemory(raw)`: `safeJson`, keeps only known kind keys and memorable fields with the right
  primitive type (string / number); anything else is dropped (D36).
- Storage: `localStorage` key `liveplanner:v2:style-memory:<projectId>`, written through
  `writeLocalStorageSafe`, at most once per `STYLE_MEMORY_WRITE_DEBOUNCE_MS = 250` (D37), and flushed
  on unmount. Read once per project id.

`useStyleMemory({ projectId, theme })` returns `recordEdit(before, after)`, `styleNewElement(el)`,
`forget(kindKeys)`. With `projectId === null` (still loading) nothing is read or written and
`styleNewElement` is the identity.

Capture points (the element menu):

- `useElementStyle` receives `commit` and `tickTabs` wrapped to call `recordEdit` with the active
  tab's elements before and after the mapper (from `tabsRef`).
- `useStylePreview` gets `onCommitted(before, after)`, called in `commitStyle` with the exact lists it
  commits (the preview's restore is not an edit and is not recorded).

Apply points (user-drawn only), each passing the built element through `styleNewElement`:
`useElementCreation.dropPaletteItem` (the editor's own creation path),
`useBoxedDragHandlers` (quick-connect arrow, both the drag and `placeOutPx`), `useEditorDrag`'s
`chainNextArrow`. Nothing else calls it.

## Observability

- `[style-memory] <log>` (debug, `debugLog`): kind keys and field names, on a changed record or a forget.
- `[style-memory] applied` (debug): kind key, on a new element that took memory.
- `[style-memory] unreadable` / `write failed` (warn).

## Testing

| Spec rule                                                    | Test                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Seven swatches, default first, six from the palette          | `quick-swatches.test.ts`                                           |
| Toned hues, readable backgrounds, visible strokes            | `quick-swatches.test.ts`                                           |
| Text swatches read at 4.5:1 on the canvas                    | `quick-swatches.test.ts`                                           |
| Bound colours follow a theme change (shapes + arrows + text) | `quick-swatch-rederive.test.ts`                                    |
| Hand-set colour / preset / reset clears the binding          | `style-presets.test.ts`, `reset-colours.test.ts`                   |
| Validation rejects a bad slot                                | `validate.test.ts`                                                 |
| Memory per kind, arrows separate, field by field             | `style-memory.test.ts`                                             |
| Theme defaults are not memories                              | `style-memory.test.ts`                                             |
| Parse drops junk                                             | `style-memory.test.ts`                                             |
| Storage key, debounce, flush on unmount                      | `useStyleMemory.test.tsx`                                          |
| A floating panel announces its arrival and departure         | `apps/editor/components/primitives/MovablePanel.presence.test.tsx` |

## Constants and configuration

| Constant                         | Value                      | Provenance      | Safe range  |
| -------------------------------- | -------------------------- | --------------- | ----------- |
| `QUICK_STROKE_MIN_CONTRAST`      | 3                          | WCAG 2.2 1.4.11 | 3 to 4.5    |
| `QUICK_FILL_MIN_TEXT_CONTRAST`   | 4.5                        | WCAG 2.2 1.4.3  | 4.5 to 7    |
| Saturation clamp                 | 0.45 to 0.85               | D38             | 0.3 to 1    |
| Lightness clamp, light / dark    | 0.36 to 0.52 / 0.6 to 0.74 | D38             | 0.25 to 0.8 |
| `FILL_WASH` light / dark         | 0.2 / 0.3                  | D38             | 0.1 to 0.4  |
| `STYLE_MEMORY_WRITE_DEBOUNCE_MS` | 250                        | D37             | 100 to 1000 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
