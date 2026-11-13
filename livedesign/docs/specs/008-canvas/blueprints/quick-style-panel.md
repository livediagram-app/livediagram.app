# Quick Style bar: blueprint

Derived from [Quick Style bar](../quick-style-panel.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                             | Role                                                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/design/src/quick-swatches.ts`                                          | The seven swatches per role and theme, slot ids, hue names, slot lookup                                          |
| `packages/design/src/colors.ts`                                                  | `unpaintedShapeInk(surface)`: the theme default on the Default scheme; `supportsColours` admits `text`           |
| `packages/design/src/element-types.ts`, `arrow-types.ts`                         | `strokeSwatch` / `fillSwatch` on `ShapeElement`, `strokeSwatch` on `ArrowElement`, `textSwatch` on `TextElement` |
| `packages/design/src/validate.ts`                                                | Rejects a swatch field that is not a slot                                                                        |
| `packages/design/src/quick-swatch-rederive.ts`                                   | `rederiveQuickSwatches(el, theme)`: a bound colour re-read from its slot                                         |
| `packages/design/src/theme-graph.ts`                                             | The four theme walks call the re-derive last                                                                     |
| `apps/live/lib/style-presets.ts`                                                 | Hand-set colour and presets clear the matching binding                                                           |
| `apps/live/hooks/canvas/useColorStyleSetters.ts`, `useShapeStyleSetters.ts`      | Resets clear both bindings                                                                                       |
| `apps/live/lib/format-painter.ts`, `format-config.ts`                            | The painter carries a binding only together with its colour                                                      |
| `apps/live/lib/quick-style.ts`                                                   | Pure: eligibility, sections, shared values, the apply transforms, clear                                          |
| `apps/live/lib/style-memory.ts`                                                  | Pure: memory shape, record from an edit, apply to a new element, forget, parse                                   |
| `apps/live/hooks/canvas/useStyleMemory.ts`                                       | Per-design memory state + `localStorage`; `recordEdit`, `styleNewElement`, `forget`                              |
| `apps/live/hooks/canvas/useQuickStyle.ts`                                        | Bar actions: one commit per choice, memory, telemetry                                                            |
| `apps/live/lib/quick-style-bar.ts`                                               | Pure: `quickStyleStyledIds`, `quickStyleBarPage`, the page the bar sits on                                       |
| `apps/live/lib/quick-style-bar-slots.ts`                                         | Store: each page's slot (element, named), the bar's room beside it, and a phone's Appearance rows                |
| `apps/live/components/canvas/QuickStyleBarSlot.tsx`                              | A page's slot in its title-bar row (`CanvasPages`), just left of the title bar                                   |
| `apps/live/components/canvas/PageAppearanceButton.tsx`, `page-title-bar-room.ts` | A phone's Appearance: the selection's rows under Selected Element, on any page, and the room it takes            |
| `apps/live/components/canvas/QuickStyleBar.tsx`                                  | The bar: a toolbar card portalled into the slot, a `TitlePopoverButton` per section                              |
| `apps/live/components/canvas/quick-style-sections.tsx`                           | `QUICK_BAR_SECTIONS` (names, titles), `QuickSectionRow`, `QuickSectionIcon`, popover widths                      |
| `apps/live/components/canvas/QuickPenRows.tsx`, `QuickHighlighterRows.tsx`       | The marker and highlighter rows, one per popover, and their button icons                                         |
| `apps/live/components/canvas/QuickStyleHost.tsx`                                 | Reads the selection, builds the view, picks the page (`useCurrentPageId` for a tool in hand)                     |
| `apps/live/components/canvas/quick-style-rows.tsx`                               | `QuickRadioRow`, swatch and glyph options, roving focus                                                          |
| `apps/live/lib/swatch-overrides.ts`                                              | Pure: apply to a row, the theme-keyed store (set, clear, caps), parse                                            |
| `apps/live/hooks/canvas/useSwatchOverrides.ts`                                   | The active theme's overrides, read from and written to the synced preferences                                    |
| `packages/workbench/src/components/canvas/SwatchOverridePopover.tsx`             | The right-click popover: picker, hex field, Clear override                                                       |
| `apps/live/app/design/[id]/useEditorState.ts`                                    | Wires memory into the style hooks and the creation hooks; exposes the bar's view-model and `pages`               |
| `apps/live/app/design/[id]/EditorView.tsx`                                       | Mounts `QuickStyleHost` (picks the page, renders the bar)                                                        |

## Domain and naming

| Term             | Identifier                                                                                  | Meaning                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick swatch     | `QuickSwatch = { slot, color, name }`                                                       | One colour option                                                                                                                                  |
| Swatch role      | `QuickSwatchRole = 'stroke' \| 'fill' \| 'text'`                                            | Which row (Stroke / Background / Text colour) it belongs to                                                                                        |
| Slot             | `QuickSwatchSlot = 1..6`; `0` = theme default                                               | The stable id of a colour across themes                                                                                                            |
| Swatch binding   | `strokeSwatch`, `fillSwatch`, `textSwatch` on the element                                   | The slot a colour was picked from; absent = unbound                                                                                                |
| Section          | `QuickSectionId`                                                                            | `penColour`, `penWidth`, `highlighterColour`, `highlighterWidth`, `stroke`, `background`, `textColour`, `width`, `style`, `textAlign`, `iconAlign` |
| Style target     | `isQuickStyleTarget(el)`                                                                    | An unlocked `shape`, `arrow` or `text`                                                                                                             |
| Kind key         | `StyleKindKey`, `styleKindOf(el)`                                                           | `shape:<ShapeKind>` for shapes, `arrow` for arrows, `text` for text elements (D53)                                                                 |
| Style memory     | `StyleMemory = Partial<Record<StyleKindKey, RememberedStyle>>`                              | Per kind, the last value chosen for each memorable field                                                                                           |
| Memorable fields | `SHAPE_MEMORY_FIELDS`, `ARROW_MEMORY_FIELDS`                                                | The fields memory records and applies (below)                                                                                                      |
| Bar page         | `quickStyleBarPage(styledIds, elements, pages, currentPageId) => pageId \| null`            | The page the bar sits on                                                                                                                           |
| Swatch override  | `SwatchOverrides = { stroke?, fill?, text? }`, each `Partial<Record<QuickSwatchSlot, Hex>>` | A custom colour replacing a slot's theme colour in the row                                                                                         |

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
  `resetColorsSelected` through `resetElementColours` (shape both, arrow stroke, text `textSwatch`; and
  every stock name), `resetShapeStyleSelected` (both).
- Format painter: `paintableBoxedFields` carries `fillSwatch` (group Fill) and `strokeSwatch` (group Border)
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
  exactly as every synced preference is; the api stores the blob opaquely (4 KB cap, no per-field
  validation), so there is no api-schema change and all validation is client-side on read.
- `overridesForTheme(store, themeId)` → `SwatchOverrides` for the active tab's theme
  (`activeTab.theme ?? DEFAULT_SCHEME_ID`).
- `storeWithOverride(store, t, role, slot, hex)`: the entry for `t` gains the slot and moves to the
  front; then the caps apply: at most `SWATCH_OVERRIDE_MAX_THEMES = 8` entries, and entries dropped
  from the back while `JSON.stringify(store).length > SWATCH_OVERRIDE_MAX_BYTES = 800` (always
  keeping the first).
- `storeWithoutOverride(store, t, role, slot)`: removes the slot; an empty row is deleted, an
  entry with no rows is removed; the input is returned by reference when nothing changes.
- `parseSwatchOverrideStore(value)`: an array only; per entry, `t` a non-empty string of at most
  `SWATCH_OVERRIDE_MAX_THEME_ID = 64` chars, first entry per theme wins, rows keep slots 1-6 whose
  values pass `normaliseHex`, an entry with no rows is dropped, then the caps apply (D44).
- `useSwatchOverrides({ themeId, userPreferences, setUserPreferences, writeUserPreferences,
ownerId })` → `{ overrides, setOverride(role, slot, hex), clearOverride(role, slot) }`. Writes
  read the freshest cached preferences (`readUserPreferences`), change only this key (removed when
  the store is empty), then `setUserPreferences` + `writeUserPreferences`.
- Popover (`SwatchOverridePopover`, `w-64`): `role="dialog"`, `aria-label` "Custom colour for <theme
  name>, <Stroke | Background | Text colour>". Contents: the heading "Custom colour", the
  `CustomColourEditor` (`components/colour/`, no board warning) started on the swatch's colour, then
  **Clear override** while the slot is overridden, else the theme note. **Use** (or Enter in the
  editor's hex field with a valid colour) calls `onSave(hex)` lower-cased and closes; an invalid hex
  does nothing. Portalled to `body`,
  `fixed`, `z-[calc(var(--z-popover)+2)]`; placed right of the row's popover (`[data-anchored-popover]`, 8 px from it), else left of it when the viewport has no room there, top at the
  swatch's top, clamped into the viewport. Opens with focus on the editor's square; Escape, Use or a
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

1. `targets = elements.filter(isQuickStyleTarget)`. Empty → `null` (no theme rows).
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

`useQuickStyle` runs each as one `commit` over the targets (one undo step),
records the memory from the same before / after, and tracks the section's token. Clear Styles also
calls `forget` with the kind keys of every target it changed.

## Mixed selections and named colours

Derived from the spec's Multi-selection rules for any mix of kinds (a whole pasted page):

- **Applicability** stays per element: `isQuickStyleTarget` (unlocked shape, arrow, text, path) and
  `supportsQuickSection` decide each row; `isPenStroke` (`quick-style-pen.ts`) decides the marker
  rows. Every other element is passed over: it is neither a target nor counted, and never empties the
  view of the rest. `quickStyleView` applies the same predicates.
- **Named colours**: in `swatchValue`, a target whose role colour is unset but carries a stock name
  (`penColour` for stroke, `penTextColour` for text) has value `null` (it marks no swatch), never
  slot 0. `applyQuickStroke` removes `penColour`; `applyQuickTextColour` removes `penTextColour`;
  `clearQuickStyle` removes `penColour` and `penTextColour` (shapes, arrows, paths, text).
- **Telemetry** is unchanged: the row's own token, once per choice.

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
- Storage: `localStorage` key `livedesign:v2:style-memory:<designId>`, written through
  `writeLocalStorageSafe`, at most once per `STYLE_MEMORY_WRITE_DEBOUNCE_MS = 250` (D37), and flushed
  on unmount. Read once per design id.

`useStyleMemory({ designId, theme })` returns `recordEdit(before, after)`, `styleNewElement(el)`,
`forget(kindKeys)`. With `designId === null` (still loading) nothing is read or written and
`styleNewElement` is the identity.

Capture points (the bar **or** the context menu):

- `useElementStyle` receives `commit` and `tickTabs` wrapped to call `recordEdit` with the active
  tab's elements before and after the mapper (from `tabsRef`).
- `useStylePreview` gets `onCommitted(before, after)`, called in `commitStyle` with the exact lists it
  commits (the preview's restore is not an edit and is not recorded).
- `useQuickStyle` records its own commits.

Apply points (user-drawn only), each passing the built element through `styleNewElement`:
`useShapeDrawing.commitDraw` (arrow and boxed intents), `makeCommitFreehand` (a recognised shape or
arrow), `useElementCreation.dropPaletteItem`, `useArrowConnect.connectArrowTo`,
`useBoxedDragHandlers` (quick-connect arrow, both the drag and `placeOutPx`), `useEditorDrag`'s
`chainNextArrow` (in `editor-drag-release.ts`). Nothing else calls it.

## Where the bar sits

`quickStyleBarPage` counts at most `QUICK_STYLE_BAR_SAMPLE` (256) of the styled elements, evenly spread: each finds
its page with a scan of the row, so a select-all over many pages stays well inside a frame (the budget test holds 2000
elements over 200 pages under 8 ms of CPU).

`quickStyleStyledIds(view)`: the view's `targetIds`, then the marker strokes' and the highlights'
ids (`pen.subject` / `highlighter.subject` of kind `strokes`); empty for a tool in hand.

`quickStyleBarPage(styledIds, elements, pages, currentPageId)`:

- No pages → `null`.
- `styledIds` empty (a marker in hand, the armed Highlighter): `currentPageId` when it is one of
  `pages` (`useCurrentPageId`, `lib/current-page-kind.ts`), else the first page.
- Otherwise count `pageIdOf(el, elements, pages)` over the live styled elements; the page with the
  most wins, a tie to the page first in `pages`. None on a page: the page whose rect is nearest the
  first styled element's `elementBounds` centre (squared distance to the rect, 0 inside). No live
  element → `null`.

`QuickStyleHost` memoises it on the view's styled ids, the tab's elements, `QuickStyleDeps.pages`
(`pagesMode.pages`) and the current page id.

Slots: `CanvasPages` puts `QuickStyleBarSlot` (while the page can be edited, on a phone too) in the
page's title-bar row (`absolute right-0 flex items-center gap-2`, counter-scaled with
`steady(zoom, 'bottom right')`), after an empty logo page's layout invite and just before
`PageTitleBar`: a `display: contents` div registered in `quick-style-bar-slots.ts` as `{ el, named }`
(`named` = the title bar's `titleBarNamed`), set in a layout effect and cleared only by its own
element. The bar reads its page's slot with `useQuickStyleBarSlot(pageId)` (`useSyncExternalStore`)
and portals into `slot.el`; no slot (the page's row not drawn) means no bar. The row takes presses
only on its cards (`pointer-events-none`, each card `pointer-events-auto`).

Room: the bar publishes `offsetWidth + QUICK_STYLE_BAR_GAP` (8, the row's `gap-2`) for its page
through `setQuickStyleBarRoom` in a layout effect, re-published by a `ResizeObserver` on the bar and
set to 0 on leaving. `CanvasPages` subtracts `useQuickStyleBarRoom()` (one `{ pageId, px }`, one bar) for the page from its
label room (with the title bar's and the invite's), so the label truncates, then hides under
`LABEL_MIN`. Only `CanvasPages` re-renders on a change.

Phone: the bar draws no toolbar. It publishes `setQuickStylePhoneRows(pageId, { pageId, rows, open })` (one row per
section that shows, `{ id, name, line, icon }` with `QuickSectionIcon` as the icon) in a layout effect, taken back
as it goes. `CanvasPages` reads `useQuickStylePhoneRows()`: the page it names gets `selected` in its
`TitleBarButtons` (so `titleBarFixedRoom` counts Appearance on any page) and the rows on `PageAppearanceButton`,
which lists them after its own under `AppearanceRowList`'s `heading="Selected Element"`. A press calls `open(id)`:
the bar tracks `UI·Opened·QuickStyle<Button>` and raises that section's count, the `openRequest` of a headless
`TitlePopoverButton` portalled into the slot, whose bottom sheet (named by the section's title) holds
`QuickSectionRow` with `showTitle={false}`.

## Behaviour and state

| State  | Condition                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Hidden | Split view, zen, embed, edits blocked, turned off, an element or multi context menu open, the view `null`, no page, or no slot |
| Phone  | Otherwise on the mobile viewport: no toolbar, the rows in the page's Appearance, each sheet headless in the slot               |
| Shown  | Otherwise; sections from the view                                                                                              |

Transitions are driven by selection, the tool in hand and those flags only; the bar owns no state
but its open popover (each `TitlePopoverButton`'s) and the swatch being edited.

## Presentation and UX

- The card: `TITLE_BAR_CARD_CLASS` (`PageTitleBar.tsx`), `flex items-center gap-0.5`,
  `motion-safe:animate-fade-in`, `data-quick-style-bar`, `data-tour-id="quick-style"`; stops
  `pointerdown`, `dblclick` and `contextmenu` from reaching the canvas.
- Buttons, in `QUICK_BAR_SECTIONS` order, only sections in the view (D52): Marker (Marker colour),
  Size (Marker width), Highlighter (Highlighter colour), Thickness (Highlighter width), Stroke, Fill
  (the Background section), Text (Text colour), Width (Stroke width), Line (Stroke style), Align
  (Text alignment), Icon (Icon alignment). Each a `TitlePopoverButton` (`titleButtonClass`, named
  beside its icon while `slot.named`), its popover `sectionPopoverWidth(id)` wide: a colour row's and
  Marker width's `QUICK_ROW_TARGETS · 24 + 2 · 12 + 2`, a three-glyph row's `3 · 44 + 2 · 4 + 2 · 12 + 2`.
  Opening one tracks `UI·Opened·QuickStyle<name>`.
- `QuickSectionIcon`: colour sections a 14 px chip of `paint` (Stroke an outline ring, Fill a filled
  square, Text an "A" over a 3 px bar, Marker a dot, Highlighter a rounded band; transparent the
  no-colour diagonal; `null` two greys split on the diagonal), `data-chip`, `data-paint`; glyph
  sections the option glyph in force at 16 px (`PenWidthIcon` for Size, the border previews for
  Thickness and Width), the first option's at 45% opacity when mixed (`data-mixed`).
- `paint` per theme colour section (`quickStyleView`): `shared(paintOf(el))`, `paintOf` = the
  element's own colour lower-cased, `ink` for Ink by name, `null` for another stock name, else the
  row's slot 0. The marker's paint is its option's swatch (a custom hex as itself); the
  highlighter's its colour.
- The popover: `QuickSectionRow` with its title shown (`text-[10px] font-semibold uppercase`), rows
  as before (below); the marker and highlighter rows add `In hand: <name>` (`text-xs`) under the
  title while their subject is a tool (`pen` / `tool`). A pick applies and the popover stays.
- Colour row: 24 × 24 px target buttons, each drawing the colour picker's `SwatchChip` (20 px, a
  selected swatch a 2 px ring in `brand-500`, an overridden one its `marked` corner dot), touching,
  then `QuickMoreColours`: a `ColourSwatchButton` named "More colours, <row title>" drawing four
  standard dots, opening the full picker (row's colours as Theme, `standardGroup` strong by name on
  Stroke and Text colour, soft hex on Background,
  `useDesignColours`). Its pick calls `setColour(role, id)`.
- Three-option rows: three equal buttons, 28 px tall, glyph-only (line weights, dash patterns, align
  glyphs, icon-before / above / after glyphs); selected = `bg-brand-50 text-brand-700 ring-brand-300`,
  dark `bg-brand-500/15 text-brand-200`. Marker width: its six in one row.
- `SwatchOverridePopover` sits beside `[data-anchored-popover]` (the row's popover), above popovers
  (`z-[calc(var(--z-popover)+2)]`), and joins the popover stack (`usePopoverLayer`), so Escape closes
  it alone and a press in it is not outside the row's popover.
- Entrance: `motion-safe:animate-fade-in` (`micro`); none under `.reduce-motion`.

Copy: buttons "Marker", "Size", "Highlighter", "Thickness", "Stroke", "Fill", "Text", "Width",
"Line", "Align", "Icon"; popover titles "Marker colour", "Marker width", "Highlighter colour",
"Highlighter width", "Stroke", "Fill", "Text colour", "Stroke width", "Stroke style", "Text
alignment", "Icon alignment". Option names: swatch names; "Thin", "Medium", "Thick"; "Solid",
"Dashed", "Dotted", "Flowing"; "Align left", "Align centre", "Align right"; "Icon before label",
"Icon above label", "Icon after label"; the marker widths' labels. The toolbar's label: "Quick Style".

## Accessibility

- Container `role="toolbar"` `aria-label="Quick Style"`; each button `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-label` = its name, in a `Tooltip`; its popover `role="dialog"` named the same,
  focus moving to the row's tab stop on open and back to the button on Escape.
- A glyph row `role="radiogroup"` with `aria-label` = its title (independent of the visible title);
  a colour row `role="group"` with the same label.
- Glyph option `role="radio"`, `aria-checked`; swatch a button with `aria-pressed` and
  `data-colour-key`; each `aria-label` = its name, wrapped in `Tooltip` with the same name. Roving
  `tabIndex`: the checked option, else the first, is `0`; the rest (More colours included) `-1`.
- Colour row keys: `colourKeyTarget` over the row's `[data-colour-key]` targets (More colours
  included): the arrows move focus, wrapping, Home / End jump; nothing is chosen until Enter / Space.
- Glyph row keys: ArrowRight / ArrowDown next, ArrowLeft / ArrowUp previous (wrapping), Home / End first /
- Shift+F10 / the context-menu key on a slot 1-6 swatch opens its override popover (a labelled
  dialog); Escape returns focus to the swatch.
- An overridden swatch's name and tooltip say "Custom <hue>, in place of <theme colour>"; the corner
  marker is decoration.
  last: each moves focus and chooses. Space / Enter chooses the focused option.
- `focus-visible:ring-2 ring-brand-500 ring-offset-1` on every option.
- Swatch contrast against the popover: each swatch carries a `border-black/15 dark:border-white/20`
  hairline so a white or near-panel colour still has an edge (1.4.11).

## Web Experience

- CLS: the bar sits in the title-bar row, outside the canvas flow; only the page's label truncates.
- INP: one commit per choice; `quickStyleView` is `O(selection)`, memoised on selection and elements.
- LCP: nothing on the initial render path; the bar's code loads when idle and it mounts on selection.

## Errors and edge cases

| Case                                      | Handling                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Storage read throws / malformed           | Empty memory; `console.warn('[style-memory] unreadable', key)`             |
| Storage write fails                       | Session-only memory (safe writer); the read-back mismatch is logged once   |
| Override hex invalid                      | Not committed; the field says "Enter a colour like #1a2b3c"                |
| Override store malformed                  | Invalid entries dropped on read (D44); a write stores the cleaned store    |
| Preferences PUT over 4 KB                 | Prevented by the 800-byte cap (D45); the cache keeps the change regardless |
| Invalid slot on an element                | Ignored by re-derive; rejected by validation on load                       |
| Theme with a short palette                | Padded from the toned set                                                  |
| Selection off every page                  | The nearest page                                                           |
| A tool in hand, no current page           | The first page                                                             |
| The page's row not drawn (no slot)        | No bar until it is                                                         |
| Selection changes while a tooltip is open | Tooltip unmounts with its option                                           |
| Element deleted by a peer mid-choice      | The commit maps the live elements; a missing id is simply not there        |
| Locked element in the selection           | Not a target; never written                                                |
| `designId` null                           | Memory inert                                                               |

## Security and trust

Memory is device-local, never sent, and only ever applied to elements the user draws, as style
fields of known primitive type (`parseStyleMemory`). Swatch bindings arriving from the api, MCP or
an import pass `isValidElement`; an out-of-range slot rejects the element. Swatch overrides ride the
existing preferences PUT (the owner's own blob, same auth, same 4 KB cap); they are only ever read
back through `parseSwatchOverrideStore` and only ever used as a swatch colour, never as markup. No
new network surface.

## Performance and limits

- `quickSwatches` is a handful of HSL conversions and at most ~40 contrast steps; called per render
  of the bar and per bound element in a theme walk. Worst case a 2 000-element theme switch with
  every element bound: 4 000 calls, well under a frame each.
- Memory size: kind keys are bounded by `ShapeKind` count + 1, each with at most 10 fields: well
  under 10 KB per design.
- `recordEdit` diffs the active tab's elements by id with a `Map`: `O(n)` per style commit.

## Observability

- `[style-memory] recorded` (debug): kind keys and field names, on a changed record.
- `[style-memory] applied` (debug): kind key, on a new element that took memory.
- `[style-memory] forgot` (debug): kind keys, on Clear Styles (the element menu).
- `[style-memory] unreadable` / `write failed` (warn).
- Telemetry: `Element·Changed·QuickStroke | QuickBackground | QuickTextColour | QuickStrokeWidth | QuickStrokeStyle |
QuickTextAlign | QuickIconAlign | QuickClearStyles`; `UI·Opened·QuickStyle<button>` as a popover opens.

## Testing

| Spec rule                                                                         | Test                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Seven swatches, default first, six from the palette                               | `quick-swatches.test.ts`                                                              |
| Toned hues, readable backgrounds, visible strokes                                 | `quick-swatches.test.ts`                                                              |
| Text swatches read at 4.5:1 on the canvas                                         | `quick-swatches.test.ts`                                                              |
| Text elements get the Colours category (single + multi menus)                     | `colors.test.ts`                                                                      |
| Text colour row: text elements only, bound slot follows the theme                 | `quick-style.test.ts`, `quick-swatch-rederive.test.ts`                                |
| Bound colours follow a theme change (shapes + arrows)                             | `quick-swatch-rederive.test.ts`                                                       |
| Hand-set colour / preset / reset clears the binding                               | `style-presets.test.ts`, `quick-style.test.ts`                                        |
| Painter carries a binding only with its colour                                    | `format-painter.test.ts`, `format-config.test.ts`                                     |
| Validation rejects a bad slot                                                     | `validate.test.ts`                                                                    |
| Sections, mixed selection, shared value, style set                                | `quick-style.test.ts`                                                                 |
| Flowing in one choice                                                             | `quick-style.test.ts`, `e2e/quick-style-panel.spec.ts`                                |
| Clear Styles resets fields and forgets kinds                                      | `quick-style.test.ts`, `style-memory.test.ts`, e2e                                    |
| Memory per kind, arrows separate, field by field                                  | `style-memory.test.ts`                                                                |
| Theme defaults are not memories                                                   | `style-memory.test.ts`                                                                |
| Carries to the next drawn element of the kind only                                | `style-memory.test.ts`, e2e                                                           |
| Parse drops junk                                                                  | `style-memory.test.ts`                                                                |
| The bar's page: most styled, a tie to the first, else the nearest; a tool in hand | `quick-style-bar.test.ts`                                                             |
| Slots per page, never dropped by an old row; the room the bar takes               | `quick-style-bar-slots.test.tsx`                                                      |
| A phone's rows in Appearance, on any page, each opening its sheet                 | `QuickStyleBar.test.tsx`, `CanvasPages.phone.test.tsx`, `page-title-bar-room.test.ts` |
| A button per applicable row, named, values on them, popovers, no Clear Styles     | `QuickStyleBar.test.tsx`, `e2e/quick-style-panel.spec.ts`                             |
| Sits left of the page's title bar, in its row                                     | `e2e/quick-style-panel.spec.ts`                                                       |
| `paint`: the colour every element paints                                          | `quick-style.test.ts`                                                                 |
| One click on Flowing sets dashed + flow                                           | `e2e/quick-style-panel.spec.ts`                                                       |
| Overrides replace a slot, keyed by theme, capped; parse drops junk                | `swatch-overrides.test.ts`                                                            |
| Synced per user; theme switch shows that theme's slots; Clear override restores   | `useSwatchOverrides.test.tsx`                                                         |
| Overridden slot applies the custom colour unbound; highlight by colour            | `quick-style.test.ts`                                                                 |
| Right-click / Shift+F10 opens the popover; picking saves; Clear override restores | `quick-style-rows.test.tsx`, `QuickStyleBar.test.tsx`, e2e                            |
| Targets 24 × 24; swatch rows one line, never clipped                              | `e2e/quick-style-panel.spec.ts`, `e2e/quick-style-swatch-rows.spec.ts`                |
| Radio groups, names, keyboard                                                     | `quick-style-rows.test.tsx`                                                           |
| Marker and highlighter buttons, their rows, In hand                               | `QuickStyleBar.test.tsx`                                                              |
| Any mix: rows apply where they fit, others passed over                            | `quick-style-mixed.test.ts`, `quick-style.test.ts`                                    |
| Named stock colours mark no swatch; a choice or Clear Styles removes the name     | `quick-style.test.ts`                                                                 |

## Constants and configuration

| Constant                         | Value                      | Provenance                                      | Safe range  |
| -------------------------------- | -------------------------- | ----------------------------------------------- | ----------- |
| `QUICK_STROKE_MIN_CONTRAST`      | 3                          | WCAG 2.2 1.4.11                                 | 3 to 4.5    |
| `QUICK_FILL_MIN_TEXT_CONTRAST`   | 4.5                        | WCAG 2.2 1.4.3                                  | 4.5 to 7    |
| Saturation clamp                 | 0.45 to 0.85               | D38                                             | 0.3 to 1    |
| Lightness clamp, light / dark    | 0.36 to 0.52 / 0.6 to 0.74 | D38                                             | 0.25 to 0.8 |
| `FILL_WASH` light / dark         | 0.2 / 0.3                  | D38                                             | 0.1 to 0.4  |
| `QUICK_STYLE_BAR_GAP`            | 8                          | The title-bar row's `gap-2`                     | 4 to 12     |
| `SWATCH_OVERRIDE_MAX_THEMES`     | 8                          | D45                                             | 1 to 20     |
| `SWATCH_OVERRIDE_MAX_BYTES`      | 800                        | D45: 4 KB blob, recent exclusions up to ~2.4 KB | 300 to 1200 |
| `SWATCH_OVERRIDE_MAX_THEME_ID`   | 64                         | A built-in id with room to spare                | 43 to 128   |
| `STYLE_MEMORY_WRITE_DEBOUNCE_MS` | 250                        | D37                                             | 100 to 1000 |
| Swatch size / gap                | 24 / 4 px                  | WCAG 2.2 2.5.8 target size                      | 24+ / 2+    |
