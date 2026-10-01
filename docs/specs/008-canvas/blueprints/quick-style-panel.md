# Quick style panel: blueprint

Derived from [Quick style panel](../quick-style-panel.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                        | Role                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/quick-swatches.ts`                                   | The seven swatches per role and theme, slot ids, hue names, slot lookup                                          |
| `packages/document/src/colors.ts`                                           | `unpaintedShapeInk(surface)`: the theme default on the Default scheme; `supportsColours` admits `text`           |
| `packages/document/src/element-types.ts`, `arrow-types.ts`                  | `strokeSwatch` / `fillSwatch` on `ShapeElement`, `strokeSwatch` on `ArrowElement`, `textSwatch` on `TextElement` |
| `packages/document/src/validate.ts`                                         | Rejects a swatch field that is not a slot                                                                        |
| `packages/document/src/quick-swatch-rederive.ts`                            | `rederiveQuickSwatches(el, theme)`: a bound colour re-read from its slot                                         |
| `packages/document/src/theme-graph.ts`                                      | The four theme walks call the re-derive last                                                                     |
| `apps/live/lib/style-presets.ts`                                            | Hand-set colour and presets clear the matching binding                                                           |
| `apps/live/hooks/canvas/useColorStyleSetters.ts`, `useShapeStyleSetters.ts` | Resets clear both bindings                                                                                       |
| `apps/live/lib/format-painter.ts`, `format-config.ts`                       | The painter carries a binding only together with its colour                                                      |
| `apps/live/lib/quick-style.ts`                                              | Pure: eligibility, sections, shared values, the apply transforms, clear                                          |
| `apps/live/lib/style-memory.ts`                                             | Pure: memory shape, record from an edit, apply to a new element, forget, parse                                   |
| `apps/live/lib/quick-style-placement.ts`                                    | Pure: the candidate walk that keeps the panel clear of chrome                                                    |
| `apps/live/hooks/canvas/useStyleMemory.ts`                                  | Per-document memory state + `localStorage`; `recordEdit`, `styleNewElement`, `forget`                            |
| `apps/live/hooks/canvas/useQuickStyle.ts`                                   | Panel actions: one commit per choice, memory, telemetry                                                          |
| `apps/live/hooks/ui/useQuickStylePlacement.ts`                              | Measures chrome and the panel, runs the walk, re-runs on chrome change                                           |
| `apps/live/components/canvas/QuickStylePanel.tsx`                           | The panel: docked (Palette dress) or compact by layout                                                           |
| `apps/live/components/canvas/quick-style-rows.tsx`                          | `QuickRadioRow`, swatch and glyph options, roving focus                                                          |
| `apps/live/lib/swatch-overrides.ts`                                         | Pure: apply to a row, the theme-keyed store (set, clear, prune, caps), parse                                     |
| `apps/live/lib/swatch-override-prefs.ts`                                    | Prunes a deleted custom theme's overrides from the preferences blob                                              |
| `apps/live/hooks/canvas/useSwatchOverrides.ts`                              | The active theme's overrides, read from and written to the synced preferences                                    |
| `apps/live/components/primitives/CustomThemeProvider.tsx`                   | Calls the prune on delete and when the custom-theme list loads                                                   |
| `apps/live/components/canvas/SwatchOverridePopover.tsx`                     | The right-click popover: picker, hex field, Clear override                                                       |
| `apps/live/app/document/[id]/useEditorState.ts`                             | Wires memory into the style hooks and the creation hooks; exposes the panel's view-model                         |
| `apps/live/app/document/[id]/EditorView.tsx`                                | Mounts the panel                                                                                                 |

## Domain and naming

| Term             | Identifier                                                                                  | Meaning                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Quick swatch     | `QuickSwatch = { slot, color, name }`                                                       | One colour option                                                                             |
| Swatch role      | `QuickSwatchRole = 'stroke' \| 'fill' \| 'text'`                                            | Which row (Stroke / Background / Text colour) it belongs to                                   |
| Slot             | `QuickSwatchSlot = 1..6`; `0` = theme default                                               | The stable id of a colour across themes                                                       |
| Swatch binding   | `strokeSwatch`, `fillSwatch`, `textSwatch` on the element                                   | The slot a colour was picked from; absent = unbound                                           |
| Section          | `QuickSectionId`                                                                            | `stroke`, `background`, `textColour`, `width`, `style`, `textAlign`, `iconAlign`              |
| Style target     | `isQuickStyleTarget(el)`                                                                    | An unlocked `shape`, `arrow` or `text`                                                        |
| Kind key         | `StyleKindKey`, `styleKindOf(el)`                                                           | `shape:<ShapeKind>` for shapes, `arrow` for arrows, `text` for text elements (D53)            |
| Style memory     | `StyleMemory = Partial<Record<StyleKindKey, RememberedStyle>>`                              | Per kind, the last value chosen for each memorable field                                      |
| Memorable fields | `SHAPE_MEMORY_FIELDS`, `ARROW_MEMORY_FIELDS`                                                | The fields memory records and applies (below)                                                 |
| Placement        | `placeQuickStylePanel(input) => { left, top }`                                              | Where the panel sits, in viewport px                                                          |
| Swatch override  | `SwatchOverrides = { stroke?, fill?, text? }`, each `Partial<Record<QuickSwatchSlot, Hex>>` | A custom colour replacing a slot's theme colour in the row                                    |
| Row density      | `density: 'compact' \| 'roomy'`                                                             | Compact (Toolbar): 20 px swatches in 24 px targets, touching; roomy (Floating): 24 px, spread |

Banned synonyms: "format panel" (that is the painter's panel), "editor panel" (the removed one),
"preset" for a swatch, "default style" for memory.

Memorable fields:

- Shape: `strokeColor`, `strokeSwatch`, `fillColor`, `fillSwatch`, `textColor`, `colorPreset`,
  `strokeWidth`, `strokeStyle`, `textAlignX`, `iconPosition`.
- Arrow: `strokeColor`, `strokeSwatch`, `strokeWidth`, `strokeStyle`, `flow`.
- Text: `textColor`, `textSwatch`.

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

- Picking slot `k > 0` writes the colour and `strokeSwatch` / `fillSwatch` / `textSwatch = k`. Picking slot 0 writes
  `theme.elementX ?? undefined` (the context menu's reset-to-theme value) and clears the binding.
- `rederiveQuickSwatches(el, theme)`: for a shape or arrow (stroke / fill) or a text element (text)
  carrying a valid slot, rewrites the bound
  colour from `quickSwatchColor(view, role, slot)`; an invalid slot is ignored (D33). Returns `el`
  unchanged when nothing is bound.
- Called last in `recolourElementsForTheme`, `switchThemeElements`, `resetThemeElementsToTheme` and
  `resetArrowsToTheme`, with the theme itself (not the per-branch view), so a slot means the same
  colour on every branch (D34).
- Cleared by: `applyFillColorToEl` (`fillSwatch`), `applyStrokeColorToEl` (`strokeSwatch`, shapes and
  arrows), `applyTextColorToEl` (`textSwatch`, text elements), `applyColorPresetToEl` (both),
  `resetColorsSelected` (shape both, arrow stroke, text `textSwatch`), `resetShapeStyleSelected` (both).
- Format painter: `paintableFields` carries `fillSwatch` (group Fill) and `strokeSwatch` (group Border)
  for shapes and `textSwatch` (group Text) for text elements, `paintableArrowFields` carries
  `strokeSwatch`. `applyPaint` keeps a binding only when its
  colour was painted with a defined binding; a painted colour without one deletes it.
- Validation: `isValidElement` rejects a shape, arrow or text element whose `strokeSwatch` /
  `fillSwatch` / `textSwatch` is present and not `isQuickSwatchSlot`.

## Swatch overrides

- `Hex` is `#rrggbb`, lower case (`normaliseHex` accepts `#RGB` / `#RRGGBB` with or without `#`,
  anything else is rejected). Slots 1 to 6 only; slot 0 is never overridden.
- `applySwatchOverrides(swatches, row)` returns the row with each overridden slot replaced by
  `{ slot, color: hex, name: \`Custom ${hueName(hex).toLowerCase()}, in place of ${theme.name}\`,
  override: { themeColor, themeName } }`. Unoverridden swatches are returned as they are.
- `quickStyleView(elements, theme, overrides)` builds all three colour rows through it. A shape or arrow's value:
  its bound slot when that slot is NOT overridden; else the displayed swatch whose colour matches its
  colour (case-insensitive), slot 0 matching as before; else `null`.
- `applyQuickStroke` / `applyQuickFill` / `applyQuickTextColour` with an overridden slot write the
  custom colour, clear the binding (`strokeSwatch` / `fillSwatch` / `textSwatch` undefined) and `colorPreset`: a custom colour does not
  follow the theme.
- Store: `UserPreferences.quickSwatchOverrides: SwatchOverrideStore`, an array of
  `{ t: themeId, s?: SwatchOverrideRow, f?: SwatchOverrideRow, x?: SwatchOverrideRow }`,
  newest-edited first, one entry per theme (`s` = Stroke, `f` = Background, `x` = Text colour, D51). Synced through `writeUserPreferences(prefs, ownerId)`
  exactly as `customSwatches` is; the api stores the blob opaquely (4 KB cap, no per-field
  validation), so there is no api-schema change and all validation is client-side on read.
- `overridesForTheme(store, themeId)` → `SwatchOverrides` for the active tab's theme
  (`activeTab.theme ?? DEFAULT_SCHEME_ID`).
- `storeWithOverride(store, t, role, slot, hex)`: the entry for `t` gains the slot and moves to the
  front; then the caps apply: at most `SWATCH_OVERRIDE_MAX_THEMES = 8` entries, and entries dropped
  from the back while `JSON.stringify(store).length > SWATCH_OVERRIDE_MAX_BYTES = 800` (always
  keeping the first).
- `storeWithoutOverride(store, t, role, slot)`: removes the slot; an empty row is deleted, an
  entry with no rows is removed; the input is returned by reference when nothing changes.
- `pruneSwatchOverrideStore(store, keep)` and `pruneCustomThemeSwatchOverrides(ownerId, exists)`:
  entries whose `t` starts with `custom:` and no longer exists are removed, from
  `CustomThemeProvider` on delete and after its list loads; built-in ids are never pruned. A write
  only happens when something was pruned (`[swatch-overrides] pruned`, debug).
- `parseSwatchOverrideStore(value)`: an array only; per entry, `t` a non-empty string of at most
  `SWATCH_OVERRIDE_MAX_THEME_ID = 64` chars, first entry per theme wins, rows keep slots 1-6 whose
  values pass `normaliseHex`, an entry with no rows is dropped, then the caps apply (D44).
- `useSwatchOverrides({ themeId, userPreferences, setUserPreferences, writeUserPreferences,
ownerId })` → `{ overrides, setOverride(role, slot, hex), clearOverride(role, slot) }`. Writes
  read the freshest cached preferences (`readUserPreferences`), change only this key (removed when
  the store is empty), then `setUserPreferences` + `writeUserPreferences`.
- Popover (`SwatchOverridePopover`): `role="dialog"`, `aria-label` "Custom colour for <theme
  name>, <Stroke | Background | Text colour>". Contents: a native `<input type="color">` (label "Colour"), a hex
  text field (label "Hex", commits on Enter or blur when valid, shows "Enter a colour like #1a2b3c"
  when not), **Clear override** (disabled while the slot is not overridden) and **Done**. The colour
  input commits on `change` (the picker's close), never per `input` tick. Portalled to `body`,
  `fixed`, `z-[var(--z-toolbar)]`; placed right of the panel (8 px from it), else left of it when the viewport has no room there, top at the
  swatch's top, clamped into the viewport. Opens with focus on the colour input; Escape, Done or a
  pointer-down outside closes it and returns focus to the swatch.
- Opening: `contextmenu` on a slot 1-6 swatch (mouse, the context-menu key and Shift+F10 all
  dispatch it), plus an explicit `keydown` for Shift+F10 / `ContextMenu`, which prevents the
  default so the browser menu never shows. Slot 0 prevents the browser menu and opens nothing.
- Marker: a 6 px dot at the swatch's top-right, `#0f172a` on light colours and `#ffffff` on dark
  (`isLightColor`), with a 1 px ring of the opposite; `aria-hidden`, since the name says it.
- Telemetry: `UI·Changed·QuickSwatchCustom` on a committed override, `UI·Changed·QuickSwatchReset`
  on Clear override.

## Sections and shared values

`quickStyleView(elements, theme) => QuickStyleView | null`, over the selected elements:

1. `targets = elements.filter(isQuickStyleTarget)`. Empty → `null` (no panel).
2. Per section, its supporting targets:

| Section      | Supports                                                |
| ------------ | ------------------------------------------------------- |
| `stroke`     | arrows; shapes with `supportsColours`                   |
| `background` | shapes with `supportsFillColor`                         |
| `textColour` | text elements                                           |
| `width`      | arrows; shapes with `supportsBorderControls`            |
| `style`      | arrows; shapes with `supportsBorderControls`            |
| `textAlign`  | shapes with `supportsTextAlign` and a non-blank `label` |
| `iconAlign`  | shapes with `acceptsInlineIcon` and an `iconId`         |

A section with no supporting target is omitted. Every target supports nothing → `null`. 3. Style options: `['solid', 'dashed', 'flowing']` when every `style` target is an arrow, else
`['solid', 'dashed', 'dotted']`. 4. Value per target:

- stroke / background / textColour: the bound slot; else `quickSwatchSlotOf` of the colour; else `0` when the
  colour is unset or equals the slot-0 colour or the theme's own element value; else `null`.
- width: shape `strokeWidth ?? 'medium'`; arrow `arrowThicknessOf`. `none` / `extra-thick` → `null`.
- style: shape `strokeStyle ?? 'solid'`; arrow: flow `dashes` with style `dashed` → `flowing`, no
  flow → its style, any other flow → `null`. Values outside the offered three → `null`.
- textAlign: `textAlignX ?? 'center'`. iconAlign: `iconPosition ?? 'left'`; `below` → `null`.

5. Section `value` = the common value when every target's value is equal and non-null, else `null`.

## Apply

One pure transform per section, a no-op on a non-supporting element:

- `applyQuickStroke(el, theme, slot)`, `applyQuickFill(el, theme, slot)`: see bindings; on a shape
  also clears `colorPreset`. `applyQuickTextColour(el, theme, slot)`: `textColor` and `textSwatch` on
  a text element; slot 0 writes `theme.elementText ?? undefined`.
- `applyQuickWidth(el, w)`: shape `strokeWidth = w`; arrow `strokeWidth = ARROW_THICKNESS_PX[w]`.
- `applyQuickStrokeStyle(el, v)`: shape `strokeStyle = v`; arrow `solid`/`dashed` → that style and
  `flow`, `flowSpeed` removed; `dotted` → `dotted`, flow removed; `flowing` → `dashed`,
  `flow = 'dashes'`, `flowSpeed ?? DEFAULT_ANIMATION_SPEED`.
- `applyQuickTextAlign(el, x)`: `textAlignX = x`.
- `applyQuickIconAlign(el, pos)`: `iconPosition = pos`.
- `clearQuickStyle(el, theme)`: shape: `fillColor`, `strokeColor`, `textColor` to
  `theme.elementX ?? undefined`; `fillSwatch`, `strokeSwatch`, `colorPreset`, `strokeWidth`,
  `strokeStyle`, `textAlignX`, `iconPosition` removed. Arrow: `strokeColor` to
  `theme.elementStroke ?? undefined`; `strokeSwatch`, `strokeWidth`, `strokeStyle`, `flow`,
  `flowSpeed` removed. Text: `textColor` to `theme.elementText ?? undefined`; `textSwatch` removed.

`useQuickStyle` runs each as one `commit` over the targets (one undo step, one activity entry),
records the memory from the same before / after, and tracks the section's token. Clear styles also
calls `forget` with the kind keys of every target it changed.

## Style memory

`StyleMemory` is `Partial<Record<StyleKindKey, RememberedStyle>>`, a remembered style being `Record<field, string | number>`.

- `recordStyleEdit(memory, before, after, theme)`: for every element present in both lists with the
  same id that `isQuickStyleTarget(after)`, for every memorable field of its kind whose value changed
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
- Storage: `localStorage` key `livediagram:v2:style-memory:<documentId>`, written through
  `writeLocalStorageSafe`, at most once per `STYLE_MEMORY_WRITE_DEBOUNCE_MS = 250` (D37), and flushed
  on unmount. Read once per document id.

`useStyleMemory({ documentId, theme })` returns `recordEdit(before, after)`, `styleNewElement(el)`,
`forget(kindKeys)`. With `documentId === null` (still loading) nothing is read or written and
`styleNewElement` is the identity.

Capture points (the panel **or** the context menu):

- `useElementStyle` receives `commit` and `tickTabs` wrapped to call `recordEdit` with the active
  tab's elements before and after the mapper (from `tabsRef`).
- `useStylePreview` gets `onCommitted(before, after)`, called in `commitStyle` with the exact lists it
  commits (the preview's restore is not an edit and is not recorded).
- `useQuickStyle` records its own commits.

Apply points (user-drawn only), each passing the built element through `styleNewElement`:
`useShapeDrawing.commitDraw` (arrow and boxed intents), `makeCommitFreehand` (a recognised shape or
arrow), `useElementCreation.dropPaletteItem`, `useArrowConnect.connectArrowTo`,
`useBoxedDragHandlers` (quick-connect arrow, both the drag and `placeOutPx`), `useEditorDrag`'s
`chainNextArrow`. Nothing else calls it.

## Placement

`placeQuickStylePanel({ area, panel, obstacles, gap })`, all rects in viewport px,
`gap = QUICK_STYLE_GAP_PX = 12`. `inner` = `area` inset by `gap`.

1. `leftX = area.left + gap`; `centreY = area.top + (area.height - panel.height) / 2`.
2. `edge` = obstacles intersecting the band `[area.left, area.left + panel.width + 2 * gap]`.
3. Candidates in order: (a) `(leftX, centreY)`; (b) `(leftX, o.bottom + gap)` for each distinct
   edge bottom, ascending; (c) `(leftX, o.top - gap - panel.height)` for each distinct edge top,
   descending; (d) `(max(edge.right) + gap, centreY)`; (e) `(area.right - gap - panel.width, centreY)`.
   (b) to (d) only when `edge` is non-empty.
4. A candidate is valid when it lies inside `inner` and intersects no obstacle inflated by `gap`.
   The first valid wins; none → (a) with `fallback: true` (logged).

`useQuickStylePlacement(panelRef, active, layout) => { left, top, width } | null`
measures `main[data-canvas-a11y-root]` (area), the panel, the Palette
`[data-tour-id="palette"][data-floating-panel]` (Floating only, for its width) and obstacles
`[data-tour-id="palette"], [data-toolbar-more], [data-floating-panel], [data-zoom-cluster]` with a
non-empty rect, in a layout effect before paint, then again on: `ResizeObserver` (area, panel,
obstacles, so a collapsing Palette is followed), a `MutationObserver` on the anchor's
`style` / `class` (so a dragged Palette is followed live), `resize`, `pointerup` / `keyup`
(capture), `transitionend`, and `livediagram:panel-layout-changed`; coalesced to one run per
animation frame. The panel's height is its natural height (`[data-quick-style-body]` scroll
height). Until the first measure the panel
renders `visibility: hidden` so it never paints in the wrong spot.

## Behaviour and state

| State  | Condition                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Hidden | Phone viewport, zen, embed, presenting, edits blocked, an element or multi context menu open, or `quickStyleView` is `null` |
| Shown  | Otherwise; sections from `quickStyleView`                                                                                   |

Transitions are driven by selection and those flags only; the panel owns no state but roving focus.

## Presentation and UX

- Floating: the Palette's dress: `rounded-lg border bg-white shadow-lg`
  (`dark:border-slate-800 dark:bg-slate-900`), `data-panel-translucent`, a header copied from
  `MovablePanelHeader` (title "Quick style" + `HelpArticleLink article="quickStylePanel"`, no drag or
  collapse), and a body `[data-quick-style-body]` with `p-2.5`; width from the Palette when one is
  on screen.
- Under Minimal chrome (`useMinimalChrome()`): the docked header is not rendered (its title and help
  link would both be hidden); the section titles stay. The docked body carries `scrollbar-slim`.
- Toolbar (compact): the same surface with no header; rows at `density="compact"`.
- The width never follows the content, and a swatch row never wraps or clips: `panelFrame(docked,
paletteWidth, penRows)` derives it in px from the named measures in `quick-style-metrics.ts`
  (`QUICK_TARGET_PX` 24, `QUICK_BORDER_PX` 1, `QUICK_COMPACT_PADDING_PX` 8,
  `QUICK_FLOATING_PADDING_PX` 10, `QUICK_FLOATING_GAP_PX` 4, `QUICK_ROW_TARGETS` 7 or 8 with pen
  rows): compact is `targets · 24 + 2 · 8 + 2 · 1` (186 px, or 210 px with pen rows) with the
  padding set from the same constant; Floating with no Palette on screen is
  `8 · 24 + 7 · 4 + 2 · 10 + 2 · 1` (242 px), its body padded by `QUICK_FLOATING_PADDING_PX`;
  Floating with a Palette takes the Palette's width.
- Both: `fixed`, `z-[var(--z-panel)]`, `data-quick-style-panel`, `data-layout`; stop `pointerdown` /
  `contextmenu` from reaching the canvas.
- Row order (D52): Stroke, Background, Text colour, Stroke width, Stroke style, Text alignment, Icon
  alignment, then Actions.
- Section: title `text-[10px] font-semibold uppercase tracking-wider text-slate-500
dark:text-slate-400` (always shown, Minimal chrome included; a caller may pass `showTitles={false}`), then the row; `gap-2.5` between sections;
  a divider above Actions.
- Colour row: seven 24 × 24 px target buttons, each drawing an inner colour chip: compact 20 px chips
  in touching targets (the row is exactly 168 px), roomy 24 px chips spread across the row
  (`justify-between`); the swatch paints its colour, a selected
  swatch shows a 2 px ring in `brand-500`.
- Three-option rows: three equal buttons, 28 px tall, glyph-only (line weights, dash patterns, align
  glyphs, icon-before / above / after glyphs); selected = `bg-brand-50 text-brand-700 ring-brand-300`,
  dark `bg-brand-500/15 text-brand-200`.
- Clear styles: a full-width text button "Clear styles" with an eraser glyph.
- Entrance: `motion-safe:animate-fade-in` (`micro`); none under `.reduce-motion`.

Copy: titles "Stroke", "Background", "Text colour", "Stroke width", "Stroke style", "Text alignment", "Icon
alignment", "Actions". Option names: swatch names; "Thin", "Medium", "Thick"; "Solid", "Dashed",
"Dotted", "Flowing"; "Align left", "Align centre", "Align right"; "Icon before label", "Icon above
label", "Icon after label"; "Clear styles". The panel's region label: "Quick style".

## Accessibility

- Container `role="region"` `aria-label="Quick style"`.
- Row `role="radiogroup"` with `aria-label` = its title (independent of the visible title).
- Option `role="radio"`, `aria-checked`, `aria-label` = its name, wrapped in `Tooltip` with the same
  name. Roving `tabIndex`: the checked option, else the first, is `0`; the rest `-1`.
- Keys: ArrowRight / ArrowDown next, ArrowLeft / ArrowUp previous (wrapping), Home / End first /
- Shift+F10 / the context-menu key on a slot 1-6 swatch opens its override popover (a labelled
  dialog); Escape returns focus to the swatch.
- An overridden swatch's name and tooltip say "Custom <hue>, in place of <theme colour>"; the corner
  marker is decoration.
  last: each moves focus and chooses. Space / Enter chooses the focused option.
- `focus-visible:ring-2 ring-brand-500 ring-offset-1` on every option.
- Swatch contrast against the panel: each swatch carries a `border-black/15 dark:border-white/20`
  hairline so a white or near-panel colour still has an edge (1.4.11).

## Web Experience

- CLS: the panel is `fixed`, outside flow; hidden-until-measured prevents a first-frame jump.
- INP: one commit per choice; `quickStyleView` is `O(selection)`, memoised on selection and elements.
- LCP: nothing on the initial render path; the panel mounts on selection.

## Errors and edge cases

| Case                                      | Handling                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Storage read throws / malformed           | Empty memory; `console.warn('[style-memory] unreadable', key)`             |
| Storage write fails                       | Session-only memory (safe writer); the read-back mismatch is logged once   |
| Override hex invalid                      | Not committed; the field says "Enter a colour like #1a2b3c"                |
| Override store malformed                  | Invalid entries dropped on read (D44); a write stores the cleaned store    |
| Custom theme deleted                      | Its overrides are pruned on delete and on the next custom-theme list load  |
| Preferences PUT over 4 KB                 | Prevented by the 800-byte cap (D45); the cache keeps the change regardless |
| Invalid slot on an element                | Ignored by re-derive; rejected by validation on load                       |
| Theme with a short palette                | Padded from the toned set                                                  |
| No clear placement                        | Candidate (a); `console.debug('[quick-style] placement fallback')`         |
| Selection changes while a tooltip is open | Tooltip unmounts with its option                                           |
| Element deleted by a peer mid-choice      | The commit maps the live elements; a missing id is simply not there        |
| Locked element in the selection           | Not a target; never written                                                |
| `documentId` null                         | Memory inert                                                               |

## Security and trust

Memory is device-local, never sent, and only ever applied to elements the user draws, as style
fields of known primitive type (`parseStyleMemory`). Swatch bindings arriving from the api, MCP or
an import pass `isValidElement`; an out-of-range slot rejects the element. Swatch overrides ride the
existing preferences PUT (the owner's own blob, same auth, same 4 KB cap); they are only ever read
back through `parseSwatchOverrideStore` and only ever used as a swatch colour, never as markup. No
new network surface.

## Performance and limits

- `quickSwatches` is a handful of HSL conversions and at most ~40 contrast steps; called per render
  of the panel and per bound element in a theme walk. Worst case a 2 000-element theme switch with
  every element bound: 4 000 calls, well under a frame each.
- Memory size: kind keys are bounded by `ShapeKind` count + 1, each with at most 10 fields: well
  under 10 KB per document.
- `recordEdit` diffs the active tab's elements by id with a `Map`: `O(n)` per style commit.

## Observability

- `[style-memory] recorded` (debug): kind keys and field names, on a changed record.
- `[style-memory] applied` (debug): kind key, on a new element that took memory.
- `[style-memory] forgot` (debug): kind keys, on Clear styles.
- `[style-memory] unreadable` / `write failed` (warn).
- `[quick-style] placement fallback` (debug) with the candidate list.
- Telemetry: `Element·Changed·QuickStroke | QuickBackground | QuickTextColour | QuickStrokeWidth | QuickStrokeStyle |
QuickTextAlign | QuickIconAlign | QuickClearStyles`.

## Testing

| Spec rule                                                                         | Test                                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Seven swatches, default first, six from the palette                               | `quick-swatches.test.ts`                                         |
| Toned hues, readable backgrounds, visible strokes                                 | `quick-swatches.test.ts`                                         |
| Text swatches read at 4.5:1 on the canvas                                         | `quick-swatches.test.ts`                                         |
| Text elements get the Colours category (single + multi menus)                     | `colors.test.ts`                                                 |
| Text colour row: text elements only, bound slot follows the theme                 | `quick-style.test.ts`, `quick-swatch-rederive.test.ts`           |
| Bound colours follow a theme change (shapes + arrows)                             | `quick-swatch-rederive.test.ts`                                  |
| Hand-set colour / preset / reset clears the binding                               | `style-presets.test.ts`, `quick-style.test.ts`                   |
| Painter carries a binding only with its colour                                    | `format-painter.test.ts`, `format-config.test.ts`                |
| Validation rejects a bad slot                                                     | `validate.test.ts`                                               |
| Sections, mixed selection, shared value, style set                                | `quick-style.test.ts`                                            |
| Flowing in one choice                                                             | `quick-style.test.ts`, `e2e/quick-style-panel.spec.ts`           |
| Clear styles resets fields and forgets kinds                                      | `quick-style.test.ts`, `style-memory.test.ts`, e2e               |
| Memory per kind, arrows separate, field by field                                  | `style-memory.test.ts`                                           |
| Theme defaults are not memories                                                   | `style-memory.test.ts`                                           |
| Carries to the next drawn element of the kind only                                | `style-memory.test.ts`, e2e                                      |
| Parse drops junk                                                                  | `style-memory.test.ts`                                           |
| Placement order and fallback                                                      | `quick-style-placement.test.ts`                                  |
| Left edge centred, walks below / above / beside left chrome, then the right edge  | `quick-style-placement.test.ts`, `e2e/quick-style-panel.spec.ts` |
| Toolbar and Floating sit on the left edge                                         | `quick-style-placement.test.ts`, `e2e/quick-style-panel.spec.ts` |
| One click on Flowing sets dashed + flow                                           | `e2e/quick-style-panel.spec.ts`                                  |
| Overrides replace a slot, keyed by theme, capped, pruned; parse drops junk        | `swatch-overrides.test.ts`, `swatch-override-prefs.test.ts`      |
| Synced per user; theme switch shows that theme's slots; Clear override restores   | `useSwatchOverrides.test.tsx`                                    |
| Overridden slot applies the custom colour unbound; highlight by colour            | `quick-style.test.ts`                                            |
| Right-click / Shift+F10 opens the popover; picking saves; Clear override restores | `QuickStylePanel.test.tsx`, `e2e/quick-style-panel.spec.ts`      |
| Toolbar panel is 186 px, targets 24 × 24; swatch rows one line, never clipped     | `e2e/quick-style-panel.spec.ts`                                  |
| Radio groups, names, keyboard                                                     | `QuickStylePanel.test.tsx`                                       |

## Constants and configuration

| Constant                         | Value                      | Provenance                                      | Safe range  |
| -------------------------------- | -------------------------- | ----------------------------------------------- | ----------- |
| `QUICK_STROKE_MIN_CONTRAST`      | 3                          | WCAG 2.2 1.4.11                                 | 3 to 4.5    |
| `QUICK_FILL_MIN_TEXT_CONTRAST`   | 4.5                        | WCAG 2.2 1.4.3                                  | 4.5 to 7    |
| Saturation clamp                 | 0.45 to 0.85               | D38                                             | 0.3 to 1    |
| Lightness clamp, light / dark    | 0.36 to 0.52 / 0.6 to 0.74 | D38                                             | 0.25 to 0.8 |
| `FILL_WASH` light / dark         | 0.2 / 0.3                  | D38                                             | 0.1 to 0.4  |
| `QUICK_STYLE_GAP_PX`             | 12                         | Existing corner insets (`right-3`)              | 8 to 24     |
| `SWATCH_OVERRIDE_MAX_THEMES`     | 8                          | D45                                             | 1 to 20     |
| `SWATCH_OVERRIDE_MAX_BYTES`      | 800                        | D45: 4 KB blob, recent exclusions up to ~2.4 KB | 300 to 1200 |
| `SWATCH_OVERRIDE_MAX_THEME_ID`   | 64                         | `custom:<uuid>` is 43                           | 43 to 128   |
| `STYLE_MEMORY_WRITE_DEBOUNCE_MS` | 250                        | D37                                             | 100 to 1000 |
| Swatch size / gap                | 24 / 4 px                  | WCAG 2.2 2.5.8 target size                      | 24+ / 2+    |
