# Corner radius: blueprint

Derived from [Corner radius](../corner-radius.md). Defaults in [DEFAULTS.md](DEFAULTS.md).

## Interfaces and contracts

```ts
// packages/document/src/border-style.ts
export const CORNER_RADIUS_MAX_SHARE = 0.25;
export function cornerRadiusPx(
  preset: BorderRadius | undefined,
  width: number,
  height: number,
  fallbackPx: number,
): number;
```

- `preset === 'full'` → `BORDER_RADIUS_PX.full` (9999; the consumer's own clamp to half the shorter
  side makes the pill or circle). Otherwise `wanted` = `BORDER_RADIUS_PX[preset]`, or `fallbackPx`
  when the preset is unset; the result is `min(wanted, CORNER_RADIUS_MAX_SHARE * min(width, height))`,
  never negative (a non-finite or non-positive side reads as 0).
- `CORNER_RADIUS_MAX_SHARE` = 0.25, safe range 0.2 to 0.5 (at 0.5 the rule only restates the CSS clamp):
  Excalidraw's adaptive and proportional roundness are 25% of the shorter side.

## Call sites (every reader of `borderRadius` that draws or hit-tests)

| File                                                                       | Fallback px                               |
| -------------------------------------------------------------------------- | ----------------------------------------- |
| `apps/live/components/canvas/element-variant.ts`                           | 8 (`DEFAULT_BOX_RADIUS_PX`), 12 mind node |
| `apps/live/components/canvas/BoxedElementView.tsx` (dashed-border overlay) | 8, 12 mind node                           |
| `apps/live/components/canvas/ImageElementView.tsx`                         | 4                                         |
| `apps/live/components/canvas/web/BannerFace.tsx`                           | `lg`'s px (24)                            |
| `apps/live/components/canvas/web/SiteHeaderFace.tsx`                       | `md`'s px (12)                            |
| `apps/live/components/canvas/web/StatRowFace.tsx`                          | `md`'s px (12)                            |
| `packages/document/src/svg-render-border.ts` (`borderOf`)                  | `DEFAULT_BOX_RADIUS_PX`                   |
| `packages/document/src/svg-render-describe.ts`                             | 4 (images)                                |
| `packages/document/src/svg-render-web.ts`                                  | the caller's fallback                     |
| `packages/document/src/svg-render.ts`                                      | 12 (mind node)                            |
| `packages/document/src/shape-hit.ts`                                       | `CSS_DEFAULT_RADIUS_PX`                   |

The PNG export rasterises the SVG export, so it follows. Web component faces whose sub-boxes (a stat
row's cards) are smaller than the element pass the sub-box size.

## Quick style: the Corners row

See the quick style blueprint's "Corners row".

## Excalidraw

- Import: `roundness` set (any type) → scene `rounded: true` → `borderRadius: ROUNDED_CORNER_PRESET`
  (`'lg'`, `apps/live/lib/board-scene/land-boxes.ts`) on both landing profiles (`land-boxes.ts`,
  `land-diagram.ts`).
- Export: unchanged rule, `borderRadius !== 'none'` → `roundness: { type: 3 }`.

## Testing

| Rule                                                                                                                                             | Test                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Quarter cap, presets, fallback, Full exempt, None 0, broken sides                                                                                | `packages/document/src/corner-radius.test.ts`                                 |
| Shorter side at least 4x the preset: unchanged, every preset                                                                                     | same                                                                          |
| SVG export and hit outline use the rule (small rounded square)                                                                                   | `packages/document/src/corner-radius-renderers.test.ts`, `svg-render.test.ts` |
| Canvas variant uses the rule (presets, kind defaults, Full, mind node)                                                                           | `apps/live/components/canvas/element-variant.test.ts`                         |
| Excalidraw 13.9 x 14.6 type 3 lands `lg` on both profiles, draws about 3.5 px; types 1 and 2 too; matches Excalidraw up to 96 px; exports type 3 | `apps/live/lib/excalidraw-import.test.ts` "rounded corners"                   |

## Constants and configuration

| Constant                  | Value | Provenance                                      | Safe range |
| ------------------------- | ----- | ----------------------------------------------- | ---------- |
| `CORNER_RADIUS_MAX_SHARE` | 0.25  | Excalidraw's roundness: 25% of the shorter side | 0.2 to 0.5 |
