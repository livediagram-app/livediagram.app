# Iconography blueprint

Derived from [Iconography](../iconography.md).

## Domain and naming

| Term (spec)        | Identifier                                                                                                           | Home                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| On-screen stroke   | `ICON_STROKE_PX`, `ICON_STROKE_PX_SMALL`                                                                             | `packages/icons/src/weight.ts`                       |
| Stroke in units    | `strokeUnits(px, sizePx, units)`                                                                                     | `packages/icons/src/weight.ts`                       |
| Icon size step     | `GlyphSize` = `12 \| 14 \| 16 \| 20 \| 24`, `GLYPH_SIZES`                                                            | `packages/icons/src/weight.ts`                       |
| Icon primitive     | `Glyph`                                                                                                              | `packages/ui/src/icons/Glyph.tsx`                    |
| Icon weight        | `IconWeight` = `'thin' \| 'regular' \| 'bold'`                                                                       | `packages/diagram/src/icon-weight.ts`                |
| Icon weight px     | `ICON_WEIGHT_PX`, `DEFAULT_ICON_WEIGHT`                                                                              | `packages/diagram/src/icon-weight.ts`                |
| Element field      | `iconWeight?: IconWeight`                                                                                            | `BoxedElement` in `element-types.ts`                 |
| Vendored Lucide    | one `lucide<Name>` export per glyph in `packages/icons/src/lucide.generated.ts`, subpath `@livediagram/icons/lucide` | written by `packages/icons/scripts/vendor-lucide.ts` |
| Vendor manifest    | `packages/icons/lucide-manifest.json`                                                                                | pinned version + glyph names                         |
| Centring exception | `CENTRING_EXCEPTIONS`                                                                                                | `packages/icons/src/centring.ts`                     |
| Art allow-list     | `ICON_ART_ALLOWLIST`                                                                                                 | packages/eslint-config/raw-svg.js (planned)          |

"Glyph" is the rendered icon; "icon" in `shape: 'icon'` is the canvas element. Do not use either as a synonym for the other in code.

## Behaviour and state

- `Glyph` computes `strokeWidth = strokeUnits(px, size, units)`, where `px = weight ?? (size <= ICON_SMALL_MAX_PX ? ICON_STROKE_PX_SMALL : ICON_STROKE_PX)`.
- The canvas icon's stroke is `ICON_WEIGHT_PX[element.iconWeight ?? DEFAULT_ICON_WEIGHT]` in screen pixels (`vector-effect: non-scaling-stroke`, as today).
- A remote participant's selection keeps its highlight stroke, `ICON_REMOTE_HIGHLIGHT_PX`.
- An icon drawn inside another shape (`shape-inline-icon-layout`) uses `ICON_WEIGHT_PX.regular`.
- Palette thumbnails (Icons tab, favourites, search results) render through `Glyph`-equivalent sizing at `ICON_STROKE_PX`.
- Setting the weight on a multi-selection applies to every `shape: 'icon'` line-art element. Technology tiles ignore it.

## Interfaces and contracts

```ts
// packages/icons/src/weight.ts
export const ICON_STROKE_PX = 1.5;
export const ICON_STROKE_PX_SMALL = 1.25;
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
export const ICON_WEIGHT_PX: Record<IconWeight, number>; // thin 1, regular 1.5, bold 2.25
export const DEFAULT_ICON_WEIGHT: IconWeight; // 'regular'
export const ICON_REMOTE_HIGHLIGHT_PX = 3;
export function iconWeightPx(w: IconWeight | undefined): number;
```

- `strokeUnits` rejects non-finite or non-positive `sizePx` / `units` by throwing `RangeError('strokeUnits: size and units must be positive')`.
- `iconWeight` on the wire (api-schema, openapi, MCP) is the closed enum. Any other value is rejected by the existing element validation, with a message naming the field.

## Data and persistence

- `iconWeight` is optional and persisted with the element like `iconSize`. Absent means `regular`. No migration.
- Diagrams saved before this change render at 1.5px instead of 2px. This is the intended refinement.
- The format painter copies `iconWeight` (format group `size`). Change summaries list it under `ICON_KEYS`.

## Errors and edge cases

- Unknown `iconWeight` in stored data (hand-edited JSON) renders as `regular` through `iconWeightPx`.
- `Glyph` with a non-positive or non-finite `size` throws the `strokeUnits` RangeError at render, surfacing in the error boundary and its log.
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

## Accessibility

- Weight tiles are toggle buttons (`aria-pressed`), like every menu tile row (`SizeButton`), and keyboard-operable.
- `Glyph` stays `aria-hidden`. The control that holds it carries the name.
- At 1.25–1.5px on-screen stroke, glyphs keep 3:1 non-text contrast against the dark and light surfaces the contrast audit already covers.

## Web experience

- `Glyph` has an explicit `width`/`height`, and sizes are unchanged, so there is no CLS.
- The vendored glyphs add no network requests.

## Observability

- Weight change: `track('Element', 'Changed', 'IconWeight')`, the pair every style commit uses (`commitStyle` in `useStylePreview`).
- The vendor script logs `vendor-lucide: wrote <n> glyphs from lucide-static@<version>`.
- The centring test failure names the file, the export and the offset in px.

## Testing

| Spec rule                         | Test                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| On-screen weight by size          | `weight.test.ts`: `glyphStrokePx`, `strokeUnits`                                                 |
| One weight whatever viewBox       | `Glyph.test.tsx`: 16u@16px and 24u@24px give the same px                                         |
| Glyph centred within 0.5px        | `centring.test.ts` over every exported glyph in both homes                                       |
| Vendored, pinned, attributed      | `lucide-vendor.test.ts`: pinned version, manifest equals exports, file current, licence verbatim |
| Icon weight default + map         | `icon-weight.test.ts`                                                                            |
| Export honours weight             | `svg-render.test.ts`                                                                             |
| Weight UI                         | e2e `icon-weight.spec.ts`: regular by default, set Bold, reload                                  |
| Weight on elements                | `style-presets.test.ts` (`applyIconWeightToEl`), `format-painter.test.ts`                        |
| Furniture silhouettes distinct    | `icon-catalog.test.ts`: no two ids share prims                                                   |
| No same-provider tech glyph dupes | `tech-icon-catalog.test.ts`                                                                      |
| No raw svg outside homes          | lint rule `livediagram/no-raw-svg` + its rule test                                               |
| Contact sheet drift               | Playwright snapshot of `pnpm icons:sheet` output                                                 |

## Constants and configuration

| Constant                   | Value | Provenance                            | Safe range |
| -------------------------- | ----- | ------------------------------------- | ---------- |
| `ICON_STROKE_PX`           | 1.5   | spec Weight; median of today's chrome | 1.25–1.75  |
| `ICON_STROKE_PX_SMALL`     | 1.25  | spec Weight                           | 1–1.5      |
| `ICON_SMALL_MAX_PX`        | 12    | spec Weight                           | 10–12      |
| `ICON_WEIGHT_PX.thin`      | 1     | defaults ledger                       | 0.75–1.25  |
| `ICON_WEIGHT_PX.regular`   | 1.5   | spec (matches chrome)                 | fixed      |
| `ICON_WEIGHT_PX.bold`      | 2.25  | defaults ledger                       | 2–3        |
| `ICON_REMOTE_HIGHLIGHT_PX` | 3     | existing hardcoded value              | 2.5–4      |
| Centring tolerance         | 0.5px | spec Guarding / optical alignment     | fixed      |

## Assets and external resources

- Lucide: `lucide-static` pinned in `packages/icons/lucide-manifest.json`, ISC, source <https://github.com/lucide-icons/lucide>. The glyph data is generated by `pnpm icons:vendor`.
- Feather: the paths already in `icon-catalog-1.ts` (ids 1–98 of the review), MIT, <https://github.com/feathericons/feather>.
- Both notices are printed in full in `THIRD_PARTY_NOTICES.md`. `packages/icons/src/index.ts` and the generated file header point to it.

## Defaults ledger

See `DEFAULTS.md` rows D36–D40.
