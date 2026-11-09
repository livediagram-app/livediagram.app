# Text effects: blueprint

Derived from [Text effects](../text-effects.md) and the text half of
[Element shadows](../element-shadows.md). The spec decides; this file only adds engineering
precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

Scope, by file:

| File                                                          | Role                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/model-core/src/rich-text.ts` (shared)               | `TextRun.highlight`, `TextRun.gradient`, `RunPatch`, `ATTR_KEYS`              |
| `livedocuments/packages/document/src/text-effects.ts`         | `TEXT_GRADIENTS`, `TextGradientId`, `textGradientOf`, `isHighlightColour`, `highlightBandCss`, band geometry constants |
| `livedocuments/packages/document/src/shadow.ts`               | `supportsShadow` takes `text`; `shadowTextCss`                                |
| `livedocuments/packages/document/src/element-types.ts`        | `TextElement.shadow`                                                          |
| `livedocuments/packages/document/src/svg-render-describe.ts`  | `ExportRun.highlight` / `.gradient` resolved from runs                        |
| `livedocuments/packages/document/src/svg-render-labels.ts`    | Band rects and gradient defs in `svgRichWrappedLabel`; `wrapExportRuns` keeps fragments apart by effect |
| `apps/editor/components/canvas/label-style.ts`                | `effectiveRunStyle` paints both effects                                       |
| `apps/editor/components/canvas/element-variant.ts`            | Text `textShadow`                                                             |
| `apps/editor/components/rich-text/rich-text-dom.ts`           | `data-rt-highlight`, `data-rt-gradient` round trip                            |
| `apps/editor/components/rich-text/rich-text-format.ts`        | `ActiveFormat.highlight` / `.gradient` (uniform or null)                      |
| `apps/editor/components/rich-text/TextEffectsPanel.tsx`       | The panel (Highlight picker, Gradient tiles)                                  |
| `apps/editor/components/canvas/RichTextToolbar.tsx`           | The Text Effects dropdown                                                     |
| `apps/editor/lib/export-tab-canvas-draw.ts`                   | PNG bands and gradients                                                       |
| `apps/editor/lib/office-export/pptx-native.ts`, `pptx-types.ts`, `pptx-slide-xml.ts` | `highlight`, `gradFill`, `outerShdw` on runs           |

## Domain and naming

| Term      | Identifier                         | Meaning                                       |
| --------- | ---------------------------------- | --------------------------------------------- |
| Highlight | `TextRun.highlight`                | A marker band colour behind a run             |
| Gradient  | `TextRun.gradient: TextGradientId` | A preset filling a run's glyphs                |
| Preset    | `TEXT_GRADIENTS[]` `{ id, label, from, to }` | The six named gradients              |
| Text shadow | `TextElement.shadow`             | The element shadow, drawn behind the glyphs    |

Banned: "glow", "marker" as a field name (the spec's "marker band" is the look, `highlight` the field).

## Constants

| Constant                 | Value          | Provenance |
| ------------------------ | -------------- | ---------- |
| `HIGHLIGHT_BAND_TOP`     | 0.38 of the line box | Spec |
| `HIGHLIGHT_BAND_BOTTOM`  | 0.94 of the line box | Spec |
| `HIGHLIGHT_PAD_EM`       | 0.125 em each side | Spec ("an eighth of an em") |
| Band corner radius       | 0.2 em         | D127       |
| Gradient angle           | 90° (left to right) | Spec  |

## Behaviour and state

### Canvas style (`effectiveRunStyle`)

1. `hl = isHighlightColour(run.highlight) ? run.highlight : null`; `g = textGradientOf(run.gradient)`.
2. Layers, top first: `g ? linear-gradient(90deg, g.from, g.to)` then
   `hl ? linear-gradient(to bottom, transparent 38%, hl 38%, hl 94%, transparent 94%)`.
3. `backgroundClip` / `WebkitBackgroundClip`: `text` for the gradient layer, `border-box` for the
   band. With a gradient: `color: transparent`, `WebkitTextFillColor: transparent`.
4. Any effect: `boxDecorationBreak: clone` (and the `Webkit` prefix); a band adds
   `padding: 0 0.125em`, `margin: 0 -0.125em` (so the text does not move), `borderRadius: 0.2em`.
5. A gradient run in a shadowed text element: `textShadow: none` and
   `filter: drop-shadow(...)` from the element shadow (`shadowFilterCss`).

### Toolbar

`onApplyRun(patch)` on the session applies `{ highlight }` or `{ gradient }` (a value or
`undefined` to clear) over the selection, or the whole label when collapsed, through the existing
`applyFormatToRange` commit, one undo step. The panel closes on a pick (D128).

### Export runs

`ExportRun` gains `highlight?: string` and `gradient?: { from: string; to: string }`, resolved once in
`describeBoxedExport` (unknown values dropped). `wrapExportRuns` merges two fragments only when both
effects match too. `svgRichWrappedLabel` measures each fragment with the wrap's measure, places the
line by its anchor, and writes per line: band `rect`s first (`y = lineY - size * 0.5 + size * 1.25 *
0.38`, height `size * 1.25 * 0.56`, `rx = size * 0.2`), then the `text`; gradient fragments
reference `<linearGradient id="tg-{elementId}-{n}" gradientUnits="userSpaceOnUse" x1 x2>`, emitted
in a `defs` before the text.

### PNG

The same rects via `fillRect` (rounded with `roundRect` when present) before the fragment's text; a
gradient fragment's `fillStyle` is `createLinearGradient(x, 0, x + width, 0)`.

### PowerPoint

`PptxRun.highlight?: OoxmlColour`, `PptxRun.gradient?: [OoxmlColour, OoxmlColour]`,
`PptxRun.shadow?: { blurEmu, distEmu, dirDeg, alpha }`. `rPr` children in schema order: fill
(`gradFill` with `gsLst` 0 and 100000 and `lin ang="0" scaled="0"`, else `solidFill`), `effectLst`
with `outerShdw blurRad dist dir algn="ctr" rotWithShape="0"` over `srgbClr 0F172A` with `alpha`,
`highlight`, then `latin`, `cs`. A text element with a shadow stays native; other shadowed kinds
still return null.

## Interfaces and contracts

No validation (cosmetic run attributes are lenient); renderers drop unrecognised values.

## Data and persistence

Two optional run fields; stored only when set; normalisation merges equal neighbours (string
equality). No migration.

## Errors and edge cases

- Highlight on whitespace only: a band is drawn (it is what was asked for).
- An unknown gradient id or a non-hex highlight: no effect, text in its colour.
- Gradient on an empty run: nothing to draw.

## Performance and limits

CSS backgrounds on spans cost no filter; text shadows use `text-shadow`, not `filter`, except a
gradient run in a shadowed element (one small span filter). Export adds at most one rect and one def
per fragment.

## Presentation and UX

Panel `w-64 p-1.5`, the article colour panel's titles; gradient tiles `h-9`, "Aa" at 15px/700 on the
current paper, ring on the active tile, tooltips named by preset.

## Accessibility

Tiles are buttons with `aria-label` "{Name} gradient" and `aria-pressed`; None is "No gradient".

## Observability

`track('Element', 'Changed', 'TextHighlight' | 'TextGradient')`.

## Testing

- `rich-text.test.ts` (model-core): patch, merge and `hasRichFormatting` with the new keys.
- `text-effects.test.ts`: presets, guards, CSS layers.
- `label-style.test.ts`: the canvas style for band, gradient, both, and shadowed gradient.
- `rich-text-dom.test.ts`: data attribute round trip.
- `svg-render-labels.test.ts`: rect and gradient def positions; deterministic ids.
- `pptx.test.ts`: `highlight`, `gradFill`, `outerShdw` on runs; shadowed text stays native.
- `TextEffectsPanel.test.tsx`: picks call through; None clears.
