# Text styles: blueprint

Derived from [Canvas and palette](../canvas-and-palette.md#text-element) "Text styles" and "Text Style". The spec
decides; this file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                       | Role                                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `../packages/element-model/src/text-presets.ts` (monorepo) | Shared: `TextPreset`, `presetTextFields`, `restyleText`, `textPresetOf`, `textBoxFor`, `splitTextPx`      |
| `packages/design/src/text-presets.ts`                      | livedesign's table (`TEXT_PRESETS`, `TEXT_PRESET_LIST`), `createPresetText`, `applyTextPreset`, read-back |
| `apps/live/lib/draw-mode.ts`                               | The `text` intent carries `preset?: TextPresetId`; the banner names the style                             |
| `apps/live/lib/draw-commit.ts`                             | `presetTextAt`, `buildDrawnText`: tap and drag placement of a style                                       |
| `apps/live/app/design/[id]/useElementCreation.ts`          | `addText(preset?)`; a double-click on empty canvas places a Paragraph                                     |
| `apps/live/hooks/canvas/useElementSelectionActions.ts`     | Quick add Text places a Paragraph                                                                         |
| `apps/live/components/palette/tile-defs/tool-tiles.tsx`    | The seven `tools:text-*` tiles                                                                            |
| `apps/live/components/palette/palette-layouts.ts`          | Where each kind's palette offers them                                                                     |
| `apps/live/components/palette/TextStyleSection.tsx`        | The Text flyout's Text Style rows                                                                         |
| `apps/live/lib/text-style.ts`                              | `restyleTextAs(id, measure)`: restyle then re-hug, the mapper a row previews and commits                  |
| `apps/live/components/palette/EditorContextMenuHost.tsx`   | Binds `onSetTextStyle` / `onPreviewTextStyle` to `commitElementStyle` / `previewElementStyle`             |
| `packages/agent-verbs/src/mcp/schema.ts`                   | Names the styles' sizes and weights for agents, from `TEXT_PRESET_LIST`                                   |

## Domain and naming

- **Text style** is the domain term (`TextPreset` in code, after livedocuments' identifier); its ids are
  `TextPresetId`: `title`, `subtitle`, `heading`, `subheading`, `paragraph`, `quote`, `caption`. A palette tile is
  `tools:text-<id>`. "Text type" and "block type" are not synonyms: the block type is a rich-text run's heading
  level ([Block type picker](../../009-elements/block-type-picker.md)), a different control.

## Behaviour and state

- No style is stored. A text wears a style when `textPresetOf` finds a row of `TEXT_PRESET_LIST` with the same drawn
  px (`labelFontPx(textSize) * (textScale ?? 1)`, rounded), `textBold === true` and `textItalic === true`; else none.
- `presetTextFields(preset)`: `width` = `wrapWidth` or `ceil(name.length * px * 0.6) + 8`; `height` =
  `ceil(px * 1.25) + 4`; `label` = the name; `splitTextPx(px)`; `textBold` / `textItalic` only when true;
  `textAlignX: 'left'`, `textAlignY: 'top'`; `sizing` `wrap` with a wrap width, else `fit`.
- Placement: a tap centres the style's box on the tap; a drag keeps the style and takes the dragged box's x, y and
  width with `sizing: 'wrap'`. Colours come from `deriveNewBoxedColours` as for any new boxed element. The tab's
  `defaultTextSize` is not applied.
- `restyleText(el, preset)` on a text: `splitTextPx(px)`; `textScale` deleted when `px <= 48`; `textBold` set or
  deleted; `textItalic` set or deleted; `fontWeight` deleted; a wrapping style sets `sizing: 'wrap'` and
  `width = wrapWidth` only when `sizing !== 'wrap'`; a fitting style sets `sizing: 'fit'`. Any other kind is
  returned as it was (the same object). `restyleTextAs` then applies `hugTextSize` with the tab's measurer.
- The T key, a double-click on empty canvas and quick add Text all make `DEFAULT_TEXT_PRESET` (`paragraph`).

## Interfaces and contracts

- `PendingDraw` gains `{ type: 'text'; preset?: TextPresetId }`; `PaletteTileAction` the same; `PaletteAddHandlers
.onAddText(preset?)`; `PaletteTileActions.addText(preset?)`.
- `EditorContextMenuProps.onSetTextStyle?(id)` and `onPreviewTextStyle?(id)`; the section shows only when both are
  given, the target is a `text` with words (or being edited), the same gate as Alignment.

## Data and persistence

- Only existing `TextElement` fields are written (`textSize`, `textScale`, `textBold`, `textItalic`, `fontWeight`,
  `sizing`, `width`, `height`, `textAlignX`, `textAlignY`, `label`), so the stored-data validators, the room's
  element-op gate, snapshots and every export need no change.

## Errors and edge cases

- A text with rich-text runs keeps its runs: a run's own size or weight still wins over the whole text's, as with
  the Size slider.
- A text made before text hugged (no `sizing`) takes the style's sizing and hugs from then on.
- A multi-selection with no text shows no section; one with texts and other kinds restyles only the texts.

## Performance and limits

- `textPresetOf` is a scan of seven rows per menu render. `restyleTextAs` measures each selected text once per hover
  and once per commit through the canvas measurer the Size slider already uses; nothing runs on the canvas hot path.
- The tiles add seven entries to the palette catalogue (glyph data already in `@liveworkspace/icons/lucide`); the
  shared module is about 150 lines with no new dependency.

## Presentation and UX

- Rows: `min-h-8`, name at `textStylePreviewPx` (`round(10 + (px - 12) * 0.25)`, D127) in its weight and slant,
  the size in px right-aligned in `text-[10px]` tabular figures; pressed rows `bg-brand-100 text-brand-700`, dark
  `bg-brand-500/20 text-brand-100`; hover `bg-slate-100`, dark `bg-slate-800`.
- Hover card: title the style's name; description `"<px> px[, bold | , italic][, wraps at <w> px]. <use>."`.
- Section title **Text Style**, opened closed like every Text flyout section, first in the flyout.

## Accessibility

- In a command menu each row is a `menuitemradio` with `aria-checked`; elsewhere a button with `aria-pressed`. Hover
  previews are mouse-only (`onMouseHover`), so touch never leaves one on screen.

## Observability

- `Element · Changed · TextStyle` on a commit; `Element · Added · Text` for every style placed.

## Testing

- `../packages/element-model/src/text-presets.test.ts`: fields, split, box for words, restyle, read-back.
- `packages/design/src/text-presets.test.ts`: the table's order, sizes on the slider, distinct looks, factory, restyle.
- `apps/live/lib/draw-commit.test.ts`: tap, drag, `presetTextAt`; `apps/live/lib/text-style.test.ts`: restyle and re-hug.
- `palette-layouts.test.ts`, `palette-tile-defs.test.tsx` (Write holds 11), `toolbar-strip-tiles.test.ts`,
  `palette-tile-search.test.ts`, `palette-search.test.ts`, `TextStyleSection.test.tsx`; agent-verbs
  `packages/agent-verbs/src/mcp/schema.test.ts`.

## Constants and configuration

- `TEXT_STYLE_WRAP_WIDTH = 320` (a 390 px phone screen less a 35 px margin each side, D128).
- The sizes in the spec's table; `PREVIEW_MIN_PX = 10`, `PREVIEW_STEP = 0.25` (D127).

## Defaults ledger

- D127, D128.
