# Iconography blueprint

Derived from [Iconography](../iconography.md).

## Domain and naming

| Term (spec)        | Identifier                                                                                                           | Home                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| On-screen stroke   | `ICON_STROKE_PX`, `ICON_STROKE_PX_SMALL`                                                                             | `packages/icons/src/weight.ts`                       |
| Stroke in units    | `strokeUnits(px, sizePx, units)` (exporters, tech tiles)                                                             | `packages/icons/src/weight.ts`                       |
| Ink geometry       | `primsBounds`, `inkInsets`                                                                                           | `packages/icons/src/ink.ts`                          |
| Glyph child reader | `childPrims(children)`                                                                                               | `packages/ui/src/icons/glyph-ink.ts`                 |
| Non-scaling rule   | `.lvd-glyph *`                                                                                                       | `packages/tailwind-config/theme.css`                 |
| Icon size step     | `GlyphSize` = `12 \| 14 \| 16 \| 20 \| 24`, `GLYPH_SIZES`                                                            | `packages/icons/src/weight.ts`                       |
| Icon primitive     | `Glyph`                                                                                                              | `packages/ui/src/icons/Glyph.tsx`                    |
| Icon weight        | `IconWeight` = `'thin' \| 'regular' \| 'bold'`                                                                       | `packages/diagram/src/icon-weight.ts`                |
| Icon weight px     | `ICON_WEIGHT_PX`, `DEFAULT_ICON_WEIGHT`                                                                              | `packages/diagram/src/icon-weight.ts`                |
| Element field      | `iconWeight?: IconWeight`                                                                                            | `BoxedElement` in `element-types.ts`                 |
| Vendored Lucide    | one `lucide<Name>` export per glyph in `packages/icons/src/lucide.generated.ts`, subpath `@livediagram/icons/lucide` | written by `packages/icons/scripts/vendor-lucide.ts` |
| Vendor manifest    | `packages/icons/lucide-manifest.json`                                                                                | pinned version + glyph names                         |
| Centring exception | `CENTRING_EXCEPTIONS`, `ASYMMETRIC`                                                                                  | each centring test (named glyph → reason)            |
| Art allow-list     | `ICON_ART_ALLOWLIST`, `RAW_ICON_SVG`                                                                                 | `packages/eslint-config/raw-svg.js`                  |

"Glyph" is the rendered icon; "icon" in `shape: 'icon'` is the canvas element. Do not use either as a synonym for the other in code.

## Behaviour and state

- `Glyph` sets `strokeWidth = weight ?? glyphStrokePx(size)` in on-screen px and the class `lvd-glyph`, whose rule makes every child `vector-effect: non-scaling-stroke`; CSS sizing and canvas zoom leave the weight alone.
- `Glyph` reads its children's geometry (`childPrims`: intrinsic shapes, `g`, fragments, `Prims`) and sets `--glyph-ink-l/r/t/b` from `inkInsets` (2 decimals, clamped at 0; stroke 0 for filled glyphs). An unreadable child (transform, other component) omits the variables.
- The canvas icon's stroke is `ICON_WEIGHT_PX[element.iconWeight ?? DEFAULT_ICON_WEIGHT]` in screen pixels (`vector-effect: non-scaling-stroke`, as today).
- A remote participant's selection keeps its highlight stroke, `ICON_REMOTE_HIGHLIGHT_PX`.
- An icon drawn inside another shape (`shape-inline-icon-layout`) uses `ICON_WEIGHT_PX.regular`.
- Palette thumbnails (Icons tab, favourites, search results) render through `Glyph`-equivalent sizing at `ICON_STROKE_PX`.
- Setting the weight on a multi-selection applies to every `shape: 'icon'` line-art element. Technology tiles ignore it.

## Interfaces and contracts

```ts
// packages/icons/src/weight.ts
export const ICON_STROKE_PX = 1.25;
export const ICON_STROKE_PX_SMALL = 1;
export const ICON_SMALL_MAX_PX = 12;
export type GlyphSize = 12 | 14 | 16 | 20 | 24;
export const GLYPH_SIZES: readonly GlyphSize[];
export function strokeUnits(px: number, sizePx: number, units: number): number; // px * units / sizePx
export function glyphStrokePx(sizePx: number): number;

// packages/ui/src/icons/Glyph.tsx
type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'strokeWidth'> & {
  size?: number; // px, default 16; controls use GLYPH_SIZES
  weight?: number; // on-screen px override; default glyphStrokePx(size)
};
type GlyphProps = IconProps & { units?: number; filled?: boolean };

// packages/diagram/src/icon-weight.ts
export type IconWeight = 'thin' | 'regular' | 'bold';
export const ICON_WEIGHTS: readonly IconWeight[];
export const ICON_WEIGHT_PX: Record<IconWeight, number>; // thin 0.75, regular 1.25, bold 2
export const DEFAULT_ICON_WEIGHT: IconWeight; // 'regular'
export const ICON_REMOTE_HIGHLIGHT_PX = 3;
export function iconWeightPx(w: IconWeight | undefined): number;
```

- `strokeUnits` rejects non-finite or non-positive `sizePx` / `units` by throwing `RangeError('strokeUnits: size and units must be positive')`.
- `iconWeight` on the wire (api-schema, openapi, MCP) is the closed enum. Any other value is rejected by the existing element validation, with a message naming the field.

## Data and persistence

- `iconWeight` is optional and persisted with the element like `iconSize`. Absent means `regular`. No migration.
- Diagrams saved before this change render at 1.25px instead of 2px. This is the intended refinement.
- The format painter copies `iconWeight` (format group `size`). Change summaries list it under `ICON_KEYS`.

## Errors and edge cases

- Unknown `iconWeight` in stored data (hand-edited JSON) renders as `regular` through `iconWeightPx`.
- A `Glyph` with a non-positive `size` draws nothing visible; `strokeUnits` (exporters) rejects it with a `RangeError`.
- Off-step control sizes (11, 13, 15, 18) move to the nearest step during migration; the optical-alignment ink audit catches any shift.
- The vendor script fails (non-zero exit, message `vendor-lucide: unknown glyph <name>`) when a manifest name is missing from the pinned package.
- Emoji `text` prims keep `stroke="none"`, so weight does not affect them.

## Security and trust

- Vendored SVG data is copied at build time from a pinned, integrity-checked package. Nothing is fetched at runtime.
- `iconWeight` is a closed enum, so it cannot inject markup into exports.

## Performance and limits

- The vendored module holds only manifest glyphs, one named export each, so a bundle keeps only the glyphs it imports.
- `lucide.generated.ts` is excluded from Prettier (`.prettierignore`) because its test compares the raw generator output.
- There is no runtime cost beyond one multiplication per rendered `Glyph`.

## Presentation and UX

- The icon context menu gains a **Weight** accordion section of three tiles (Thin, Regular, Bold), each drawing the selected glyph at that weight (`IconWeightTiles`). The multi-selection menu shows the same row when the selection holds a line-art icon.
- Copy: row label "Weight"; tiles "Thin", "Regular", "Bold".
- Hover previews the weight live, as the Size row does.
- Menu icons: `MENU_ICON_PX = 14` (rows, section headers, tiles) and `QUICK_ACTION_ICON_PX = 16` (icon-only buttons), exported from `apps/live/components/palette/context-menu-icons.tsx`; every menu glyph module sizes to them.
- Contact sheet: `pnpm icons:sheet` renders every exported `*Icon` / `*Glyph` of the editor's icon modules and `@livediagram/ui`, plus every palette tile, at 1x and 4x into `$ICON_SHEET_DIR` (default `/tmp/icon-sheet`), then screenshots each page (dark, 2x) (`apps/live/scripts/icon-sheet/`).

## Accessibility

- Weight tiles are toggle buttons (`aria-pressed`), like every menu tile row (`SizeButton`), and keyboard-operable.
- `Glyph` stays `aria-hidden`. The control that holds it carries the name.
- At 1–1.25px on-screen stroke, glyphs keep 3:1 non-text contrast against the dark and light surfaces the contrast audit already covers.

## Web experience

- `Glyph` has an explicit `width`/`height`, and sizes are unchanged, so there is no CLS.
- The vendored glyphs add no network requests.

## Observability

- Weight change: `track('Element', 'Changed', 'IconWeight')`, the pair every style commit uses (`commitStyle` in `useStylePreview`).
- The vendor script logs `vendor-lucide: wrote <n> glyphs from lucide-static@<version>`.
- The centring test failure names the file, the export and the offset in px.

## Testing

| Spec rule                         | Test                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| On-screen weight by size          | `weight.test.ts`; `icons.test.tsx` (every shared icon); e2e `icon-weight.spec.ts` (computed non-scaling) |
| Ink insets                        | `ink.test.ts`, `glyph-ink.test.tsx`                                                                      |
| One weight whatever viewBox       | `Glyph.test.tsx`: 16u@16px and 24u@24px give the same px                                                 |
| Glyph centred within 0.5px        | `centring.test.ts` over every exported glyph in both homes                                               |
| Vendored, pinned, attributed      | `lucide-vendor.test.ts`: pinned version, manifest equals exports, file current, licence verbatim         |
| Icon weight default + map         | `icon-weight.test.ts`                                                                                    |
| Export honours weight             | `svg-render.test.ts`                                                                                     |
| Weight UI                         | e2e `icon-weight.spec.ts`: regular by default, set Bold, reload                                          |
| Weight on elements                | `style-presets.test.ts` (`applyIconWeightToEl`), `format-painter.test.ts`                                |
| Furniture silhouettes distinct    | `icon-catalog.test.ts`: no two ids share prims                                                           |
| No same-provider tech glyph dupes | `tech-icon-catalog.test.ts`                                                                              |
| No raw svg outside homes          | `no-restricted-syntax` with `RAW_ICON_SVG` (literal width 8–24px), `raw-svg.test.ts`                     |
| Contact sheet drift               | `pnpm icons:sheet` (on-demand review sheets)                                                             |

## Constants and configuration

| Constant                   | Value | Provenance                                        | Safe range |
| -------------------------- | ----- | ------------------------------------------------- | ---------- |
| `ICON_STROKE_PX`           | 1.25  | spec Weight (operator choice after 1x comparison) | 1–1.5      |
| `ICON_STROKE_PX_SMALL`     | 1     | spec Weight                                       | 0.75–1.25  |
| `ICON_SMALL_MAX_PX`        | 12    | spec Weight                                       | 10–12      |
| `ICON_WEIGHT_PX.thin`      | 0.75  | defaults ledger                                   | 0.75–1.25  |
| `ICON_WEIGHT_PX.regular`   | 1.25  | spec (matches chrome)                             | fixed      |
| `ICON_WEIGHT_PX.bold`      | 2     | defaults ledger                                   | 1.75–3     |
| `ICON_REMOTE_HIGHLIGHT_PX` | 3     | existing hardcoded value                          | 2.5–4      |
| Centring tolerance         | 0.5px | spec Guarding / optical alignment                 | fixed      |

## Assets and external resources

- Lucide: `lucide-static` pinned in `packages/icons/lucide-manifest.json`, ISC, source <https://github.com/lucide-icons/lucide>. The glyph data is generated by `pnpm icons:vendor`.
- Feather: the paths already in `icon-catalog-1.ts` (ids 1–98 of the review), MIT, <https://github.com/feathericons/feather>.
- Both notices are printed in full in `THIRD_PARTY_NOTICES.md`. `packages/icons/src/index.ts` and the generated file header point to it.

## Defaults ledger

See `DEFAULTS.md` rows D36–D40.
