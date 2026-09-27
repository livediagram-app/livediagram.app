# Quick style panel: blueprint

Derived from [Quick style panel](../quick-style-panel.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                        | Role                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/diagram/src/quick-swatches.ts`                                    | The seven swatches per role and theme, slot ids, hue names, slot lookup                  |
| `packages/diagram/src/colors.ts`                                            | `unpaintedShapeInk(surface)`: the theme default on the Default scheme                    |
| `packages/diagram/src/element-types.ts`, `arrow-types.ts`                   | `strokeSwatch` / `fillSwatch` on `ShapeElement`, `strokeSwatch` on `ArrowElement`        |
| `packages/diagram/src/validate.ts`                                          | Rejects a swatch field that is not a slot                                                |
| `packages/diagram/src/quick-swatch-rederive.ts`                             | `rederiveQuickSwatches(el, theme)`: a bound colour re-read from its slot                 |
| `packages/diagram/src/theme-graph.ts`                                       | The four theme walks call the re-derive last                                             |
| `apps/live/lib/style-presets.ts`                                            | Hand-set colour and presets clear the matching binding                                   |
| `apps/live/hooks/canvas/useColorStyleSetters.ts`, `useShapeStyleSetters.ts` | Resets clear both bindings                                                               |
| `apps/live/lib/format-painter.ts`, `format-config.ts`                       | The painter carries a binding only together with its colour                              |
| `apps/live/lib/quick-style.ts`                                              | Pure: eligibility, sections, shared values, the apply transforms, clear                  |
| `apps/live/lib/style-memory.ts`                                             | Pure: memory shape, record from an edit, apply to a new element, forget, parse           |
| `apps/live/lib/quick-style-placement.ts`                                    | Pure: the candidate walk that keeps the panel clear of chrome                            |
| `apps/live/hooks/canvas/useStyleMemory.ts`                                  | Per-diagram memory state + `localStorage`; `recordEdit`, `styleNewElement`, `forget`     |
| `apps/live/hooks/canvas/useQuickStyle.ts`                                   | Panel actions: one commit per choice, memory, telemetry                                  |
| `apps/live/hooks/ui/useQuickStylePlacement.ts`                              | Measures chrome and the panel, runs the walk, re-runs on chrome change                   |
| `apps/live/components/canvas/QuickStylePanel.tsx`                           | The panel: docked (Palette dress) or compact by layout                                   |
| `apps/live/components/canvas/quick-style-rows.tsx`                          | `QuickRadioRow`, swatch and glyph options, roving focus                                  |
| `apps/live/app/diagram/[id]/useEditorState.ts`                              | Wires memory into the style hooks and the creation hooks; exposes the panel's view-model |
| `apps/live/app/diagram/[id]/EditorView.tsx`                                 | Mounts the panel                                                                         |

## Domain and naming

| Term             | Identifier                                                     | Meaning                                                            |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Quick swatch     | `QuickSwatch = { slot, color, name }`                          | One colour option                                                  |
| Swatch role      | `QuickSwatchRole = 'stroke' \| 'fill'`                         | Which row (Stroke / Background) it belongs to                      |
| Slot             | `QuickSwatchSlot = 1..6`; `0` = theme default                  | The stable id of a colour across themes                            |
| Swatch binding   | `strokeSwatch`, `fillSwatch` on the element                    | The slot a colour was picked from; absent = unbound                |
| Section          | `QuickSectionId`                                               | `stroke`, `background`, `width`, `style`, `textAlign`, `iconAlign` |
| Style target     | `isQuickStyleTarget(el)`                                       | An unlocked `shape` or `arrow`                                     |
| Kind key         | `StyleKindKey`, `styleKindOf(el)`                              | `shape:<ShapeKind>` for shapes, `arrow` for arrows                 |
| Style memory     | `StyleMemory = Partial<Record<StyleKindKey, RememberedStyle>>` | Per kind, the last value chosen for each memorable field           |
| Memorable fields | `SHAPE_MEMORY_FIELDS`, `ARROW_MEMORY_FIELDS`                   | The fields memory records and applies (below)                      |
| Placement        | `placeQuickStylePanel(input) => { left, top }`                 | Where the panel sits, in viewport px                               |

Banned synonyms: "format panel" (that is the painter's panel), "editor panel" (the removed one),
"preset" for a swatch, "default style" for memory.

Memorable fields:

- Shape: `strokeColor`, `strokeSwatch`, `fillColor`, `fillSwatch`, `textColor`, `colorPreset`,
  `strokeWidth`, `strokeStyle`, `textAlignX`, `iconPosition`.
- Arrow: `strokeColor`, `strokeSwatch`, `strokeWidth`, `strokeStyle`, `flow`.

## Swatches

`quickSwatches(theme, role)` returns seven, slots `[0, 1, 2, 3, 4, 5, 6]`:

1. Ink: `themeInk(theme)` = `theme.elementX ?? unpaintedShapeInk(canvasSurface(theme.backgroundColor)).X`.
2. Slot 0: `{ color: ink.stroke | ink.fill, name: 'Theme default' }`.
3. A theme with a `palette`: its first six entries, `stroke` or `fill` by role, named by
   `hueName(entry.stroke)`; padded from the toned set when shorter (D32); names disambiguated.
4. Otherwise the toned set: accent HSL from `ink.stroke`; `s = clamp(s, 0.45, 0.85)`;
   `l = clamp(l, 0.36, 0.52)` on light paper, `clamp(l, 0.6, 0.74)` on dark. Hues and names: 0 Red,
   28 Orange, 46 Yellow, 140 Green, 215 Blue, 270 Violet.
   - Stroke: `hsl(h, s, l)`, stepped by `0.02` lightness away from the canvas until contrast against
     `theme.backgroundColor` is at least `QUICK_STROKE_MIN_CONTRAST = 3`.
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

- Picking slot `k > 0` writes the colour and `strokeSwatch` / `fillSwatch = k`. Picking slot 0 writes
  `theme.elementX ?? undefined` (the context menu's reset-to-theme value) and clears the binding.
- `rederiveQuickSwatches(el, theme)`: for a shape or arrow carrying a valid slot, rewrites the bound
  colour from `quickSwatchColor(view, role, slot)`; an invalid slot is ignored (D33). Returns `el`
  unchanged when nothing is bound.
- Called last in `recolourElementsForTheme`, `switchThemeElements`, `resetThemeElementsToTheme` and
  `resetArrowsToTheme`, with the theme itself (not the per-branch view), so a slot means the same
  colour on every branch (D34).
- Cleared by: `applyFillColorToEl` (`fillSwatch`), `applyStrokeColorToEl` (`strokeSwatch`, shapes and
  arrows), `applyColorPresetToEl` (both), `resetColorsSelected` (shape both, arrow stroke),
  `resetShapeStyleSelected` (both).
- Format painter: `paintableFields` carries `fillSwatch` (group Fill) and `strokeSwatch` (group Border)
  for shapes, `paintableArrowFields` carries `strokeSwatch`. `applyPaint` keeps a binding only when its
  colour was painted with a defined binding; a painted colour without one deletes it.
- Validation: `isValidElement` rejects a shape or arrow whose `strokeSwatch` / `fillSwatch` is present
  and not `isQuickSwatchSlot`.

## Sections and shared values

`quickStyleView(elements, theme) => QuickStyleView | null`, over the selected elements:

1. `targets = elements.filter(isQuickStyleTarget)`. Empty → `null` (no panel).
2. Per section, its supporting targets:

| Section      | Supports                                        |
| ------------ | ----------------------------------------------- |
| `stroke`     | arrows; shapes with `supportsColours`           |
| `background` | shapes with `supportsFillColor`                 |
| `width`      | arrows; shapes with `supportsBorderControls`    |
| `style`      | arrows; shapes with `supportsBorderControls`    |
| `textAlign`  | shapes that are not `isSelfDrawingShape`        |
| `iconAlign`  | shapes with `acceptsInlineIcon` and an `iconId` |

A section with no supporting target is omitted. Every target supports nothing → `null`. 3. Style options: `['solid', 'dashed', 'flowing']` when every `style` target is an arrow, else
`['solid', 'dashed', 'dotted']`. 4. Value per target:

- stroke / background: the bound slot; else `quickSwatchSlotOf` of the colour; else `0` when the
  colour is unset or equals the slot-0 colour or the theme's own element value; else `null`.
- width: shape `strokeWidth ?? 'medium'`; arrow `arrowThicknessOf`. `none` / `extra-thick` → `null`.
- style: shape `strokeStyle ?? 'solid'`; arrow: flow `dashes` with style `dashed` → `flowing`, no
  flow → its style, any other flow → `null`. Values outside the offered three → `null`.
- textAlign: `textAlignX ?? 'center'`. iconAlign: `iconPosition ?? 'left'`; `below` → `null`.

5. Section `value` = the common value when every target's value is equal and non-null, else `null`.

## Apply

One pure transform per section, a no-op on a non-supporting element:

- `applyQuickStroke(el, theme, slot)`, `applyQuickFill(el, theme, slot)`: see bindings; on a shape
  also clears `colorPreset`.
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
  `flowSpeed` removed.

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
- Storage: `localStorage` key `livediagram:v2:style-memory:<diagramId>`, written through
  `writeLocalStorageSafe`, at most once per `STYLE_MEMORY_WRITE_DEBOUNCE_MS = 250` (D37), and flushed
  on unmount. Read once per diagram id.

`useStyleMemory({ diagramId, theme })` returns `recordEdit(before, after)`, `styleNewElement(el)`,
`forget(kindKeys)`. With `diagramId === null` (still loading) nothing is read or written and
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

`placeQuickStylePanel({ layout, area, panel, obstacles, anchor, gap })`, all rects in viewport px,
`gap = QUICK_STYLE_GAP_PX = 12`; `layout` is `resolvePanelLayout(userPreferences)`; `anchor` is
the floating Palette's rect or `null`. `inner` = `area` inset by `gap`.

**Floating with an anchor** (`dockToPalette`), `D = QUICK_STYLE_DOCK_GAP_PX = 16`:

1. `left = clamp(anchor.left, inner.left, inner.right - panel.width)`; `panel.width` is the
   anchor's width (the panel is sized to the Palette before it is measured).
2. `others` = obstacles other than the anchor's own rect; `column` = those overlapping
   `[left, left + panel.width]` horizontally.
3. Beneath: `top = anchor.bottom + D`. Repeat: a `column` obstacle covering `top` moves
   `top` to its bottom + `D`; else `next` = the nearest `column` obstacle below,
   `room = min(inner.bottom, next.top - D) - top`. `room >= panel.height` → **under-palette**.
   The first `room >= QUICK_STYLE_DOCK_MIN_HEIGHT_PX = 96` is kept as the scrolling choice
   (`maxHeight = room`). Continue from `next.bottom + D`; stop when there is no `next`.
4. Above: `top = anchor.top - D - panel.height`, stepping above any `others` hit, while
   `top >= inner.top`: a clear box → **over-palette**.
5. Else the scrolling choice, if any; else the right-edge walk.

**Right edge** (Toolbar, Minimal, and the Floating fallback):

1. `rightX = area.right - gap - panel.width`; `centreY = area.top + (area.height - panel.height) / 2`.
2. `edge` = obstacles whose rect intersects the band `[rightX - gap, area.right]` horizontally.
3. Candidates in order: (a) `(rightX, centreY)`; (b) `(rightX, o.bottom + gap)` for each distinct
   edge bottom, ascending; (c) `(rightX, o.top - gap - panel.height)` for each distinct edge top,
   descending; (d) `(min(edge.left) - gap - panel.width, centreY)`; (e) `(area.left + gap, centreY)`.
   (b) to (d) only when `edge` is non-empty.
4. A candidate is valid when it lies inside `inner` and intersects no obstacle inflated by `gap`.
   The first valid wins; none → (a) with `fallback: true` (logged).

`useQuickStylePlacement(panelRef, active, layout) => { left, top, width, maxHeight } | null`
measures `main[data-canvas-a11y-root]` (area), the panel, the anchor
`[data-tour-id="palette"][data-floating-panel]` (Floating only) and obstacles
`[data-tour-id="palette"], [data-toolbar-more], [data-floating-panel], [data-zoom-cluster]` with a
non-empty rect, in a layout effect before paint, then again on: `ResizeObserver` (area, panel,
obstacles, so a collapsing Palette is followed), a `MutationObserver` on the anchor's
`style` / `class` (so a dragged Palette is followed live), `resize`, `pointerup` / `keyup`
(capture), `transitionend`, and `livediagram:panel-layout-changed`; coalesced to one run per
animation frame. The panel's height is its NATURAL height (`[data-quick-style-body]` scroll
height), never the capped one, so the cap cannot oscillate. Until the first measure the panel
renders `visibility: hidden` so it never paints in the wrong spot.

## Behaviour and state

| State  | Condition                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Hidden | Phone viewport, zen, embed, presenting, edits blocked, an element or multi context menu open, or `quickStyleView` is `null` |
| Shown  | Otherwise; sections from `quickStyleView`                                                                                   |

Transitions are driven by selection and those flags only; the panel owns no state but roving focus.

## Presentation and UX

- Floating (docked): the Palette's dress: `rounded-lg border bg-white shadow-lg`
  (`dark:border-slate-800 dark:bg-slate-900`), `data-panel-translucent`, a header copied from
  `MovablePanelHeader` (title "Quick style" + `HelpArticleLink article="quickStylePanel"`, no drag or
  collapse), and a body `[data-quick-style-body]` with `p-2.5`, `overflow-y-auto` under a cap; width
  and `maxHeight` from the placement.
- Toolbar / Minimal (compact): the same surface with no header, width `w-52` (208 px), `p-2`.
- Both: `fixed`, `z-[var(--z-panel)]`, `data-quick-style-panel`, `data-layout`; stop `pointerdown` /
  `contextmenu` from reaching the canvas.
- Section: title `text-[10px] font-semibold uppercase tracking-wider text-slate-500
dark:text-slate-400` (hidden when `showTitles` is false), then the row; `gap-2.5` between sections;
  a divider above Actions.
- Colour row: seven 24 px swatches, at least 4 px apart, spread across the row (`justify-between`); the swatch paints its colour, a selected
  swatch shows a 2 px ring in `brand-500`.
- Three-option rows: three equal buttons, 28 px tall, glyph-only (line weights, dash patterns, align
  glyphs, icon-before / above / after glyphs); selected = `bg-brand-50 text-brand-700 ring-brand-300`,
  dark `bg-brand-500/15 text-brand-200`.
- Clear styles: a full-width text button "Clear styles" with an eraser glyph.
- Entrance: `motion-safe:animate-fade-in` (`micro`); none under `.reduce-motion`.

Copy: titles "Stroke", "Background", "Stroke width", "Stroke style", "Text alignment", "Icon
alignment", "Actions". Option names: swatch names; "Thin", "Medium", "Thick"; "Solid", "Dashed",
"Dotted", "Flowing"; "Align left", "Align centre", "Align right"; "Icon before label", "Icon above
label", "Icon after label"; "Clear styles". The panel's region label: "Quick style".

## Accessibility

- Container `role="region"` `aria-label="Quick style"`.
- Row `role="radiogroup"` with `aria-label` = its title (independent of the visible title).
- Option `role="radio"`, `aria-checked`, `aria-label` = its name, wrapped in `Tooltip` with the same
  name. Roving `tabIndex`: the checked option, else the first, is `0`; the rest `-1`.
- Keys: ArrowRight / ArrowDown next, ArrowLeft / ArrowUp previous (wrapping), Home / End first /
  last: each moves focus and chooses. Space / Enter chooses the focused option.
- `focus-visible:ring-2 ring-brand-500 ring-offset-1` on every option.
- Swatch contrast against the panel: each swatch carries a `border-black/15 dark:border-white/20`
  hairline so a white or near-panel colour still has an edge (1.4.11).

## Web Experience

- CLS: the panel is `fixed`, outside flow; hidden-until-measured prevents a first-frame jump.
- INP: one commit per choice; `quickStyleView` is `O(selection)`, memoised on selection and elements.
- LCP: nothing on the initial render path; the panel mounts on selection.

## Errors and edge cases

| Case                                      | Handling                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Storage read throws / malformed           | Empty memory; `console.warn('[style-memory] unreadable', key)`           |
| Storage write fails                       | Session-only memory (safe writer); the read-back mismatch is logged once |
| Invalid slot on an element                | Ignored by re-derive; rejected by validation on load                     |
| Theme with a short palette                | Padded from the toned set                                                |
| No clear placement                        | Candidate (a); `console.debug('[quick-style] placement fallback')`       |
| Selection changes while a tooltip is open | Tooltip unmounts with its option                                         |
| Element deleted by a peer mid-choice      | The commit maps the live elements; a missing id is simply not there      |
| Locked element in the selection           | Not a target; never written                                              |
| `diagramId` null                          | Memory inert                                                             |

## Security and trust

Memory is device-local, never sent, and only ever applied to elements the user draws, as style
fields of known primitive type (`parseStyleMemory`). Swatch bindings arriving from the api, MCP or
an import pass `isValidElement`; an out-of-range slot rejects the element. No new network surface.

## Performance and limits

- `quickSwatches` is a handful of HSL conversions and at most ~40 contrast steps; called per render
  of the panel and per bound element in a theme walk. Worst case a 2 000-element theme switch with
  every element bound: 4 000 calls, well under a frame each.
- Memory size: kind keys are bounded by `ShapeKind` count + 1, each with at most 10 fields: well
  under 10 KB per diagram.
- `recordEdit` diffs the active tab's elements by id with a `Map`: `O(n)` per style commit.

## Observability

- `[style-memory] recorded` (debug): kind keys and field names, on a changed record.
- `[style-memory] applied` (debug): kind key, on a new element that took memory.
- `[style-memory] forgot` (debug): kind keys, on Clear styles.
- `[style-memory] unreadable` / `write failed` (warn).
- `[quick-style] placement fallback` (debug) with the candidate list.
- Telemetry: `Element·Changed·QuickStroke | QuickBackground | QuickStrokeWidth | QuickStrokeStyle |
QuickTextAlign | QuickIconAlign | QuickClearStyles`.

## Testing

| Spec rule                                                                     | Test                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Seven swatches, default first, six from the palette                           | `quick-swatches.test.ts`                                         |
| Toned hues, readable backgrounds, visible strokes                             | `quick-swatches.test.ts`                                         |
| Bound colours follow a theme change (shapes + arrows)                         | `quick-swatch-rederive.test.ts`                                  |
| Hand-set colour / preset / reset clears the binding                           | `style-presets.test.ts`, `quick-style.test.ts`                   |
| Painter carries a binding only with its colour                                | `format-painter.test.ts`, `format-config.test.ts`                |
| Validation rejects a bad slot                                                 | `validate.test.ts`                                               |
| Sections, mixed selection, shared value, style set                            | `quick-style.test.ts`                                            |
| Flowing in one choice                                                         | `quick-style.test.ts`, `e2e/quick-style-panel.spec.ts`           |
| Clear styles resets fields and forgets kinds                                  | `quick-style.test.ts`, `style-memory.test.ts`, e2e               |
| Memory per kind, arrows separate, field by field                              | `style-memory.test.ts`                                           |
| Theme defaults are not memories                                               | `style-memory.test.ts`                                           |
| Carries to the next drawn element of the kind only                            | `style-memory.test.ts`, e2e                                      |
| Parse drops junk                                                              | `style-memory.test.ts`                                           |
| Placement order and fallback                                                  | `quick-style-placement.test.ts`                                  |
| Floating docks under the Palette, follows collapse / move, scrolls when short | `quick-style-placement.test.ts`, `e2e/quick-style-panel.spec.ts` |
| Toolbar sits on the right edge, centred                                       | `quick-style-placement.test.ts`, `e2e/quick-style-panel.spec.ts` |
| One click on Flowing sets dashed + flow                                       | `e2e/quick-style-panel.spec.ts`                                  |
| Radio groups, names, keyboard                                                 | `QuickStylePanel.test.tsx`                                       |

## Constants and configuration

| Constant                         | Value                      | Provenance                         | Safe range  |
| -------------------------------- | -------------------------- | ---------------------------------- | ----------- |
| `QUICK_STROKE_MIN_CONTRAST`      | 3                          | WCAG 2.2 1.4.11                    | 3 to 4.5    |
| `QUICK_FILL_MIN_TEXT_CONTRAST`   | 4.5                        | WCAG 2.2 1.4.3                     | 4.5 to 7    |
| Saturation clamp                 | 0.45 to 0.85               | D38                                | 0.3 to 1    |
| Lightness clamp, light / dark    | 0.36 to 0.52 / 0.6 to 0.74 | D38                                | 0.25 to 0.8 |
| `FILL_WASH` light / dark         | 0.2 / 0.3                  | D38                                | 0.1 to 0.4  |
| `QUICK_STYLE_GAP_PX`             | 12                         | Existing corner insets (`right-3`) | 8 to 24     |
| `QUICK_STYLE_DOCK_GAP_PX`        | 16                         | panel-docking.md corner-stack gap  | 8 to 24     |
| `QUICK_STYLE_DOCK_MIN_HEIGHT_PX` | 96                         | D42: header + one row              | 80 to 240   |
| `STYLE_MEMORY_WRITE_DEBOUNCE_MS` | 250                        | D37                                | 100 to 1000 |
| Swatch size / gap                | 24 / 4 px                  | WCAG 2.2 2.5.8 target size         | 24+ / 2+    |
