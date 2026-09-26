# Dark palette (Steel): blueprint

Derived from [Colour scheme, Dark palette (Steel)](../color-scheme.md#dark-palette-steel), with the canvas half from
[Canvas and palette, Default scheme, dark half](../../008-canvas/canvas-and-palette.md#default-scheme-dark-half) and
the dark selection from [Canvas and palette, Selection](../../008-canvas/canvas-and-palette.md#selection). The spec
decides; this file adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`. The Charcoal migration has its own blueprint
([Retired schemes](../../011-theme/blueprints/retired-schemes.md)).

Scope, by file:

| File                                                  | Role                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/tailwind-config/theme.css`                  | `.dark` surface + Steel tokens; `@utility text-optical-centre`        |
| `packages/ui/src/brand-classes.ts`                    | `SOLID_BRAND_DARK`, `SOLID_BRAND_DARK_CONTROL`                        |
| `packages/ui/src/Brand.tsx`                           | Wordmark accent `dark:text-sky-400`                                   |
| `packages/diagram/src/canvas-colors.ts`               | Dark canvas + pattern constants                                       |
| `packages/diagram/src/colors.ts`                      | `DARK_INK`, `defaultArrowLabelColor`                                  |
| `packages/diagram/src/svg-render-arrows.ts`           | Export label colour through `defaultArrowLabelColor`                  |
| `apps/live/components/canvas/ArrowView.tsx`           | Canvas label colour through `defaultArrowLabelColor`                  |
| `apps/live/components/canvas/element-variant.ts`      | Dark single-selection ring + glow                                     |
| `apps/live/components/canvas/element-parts.tsx`       | `RESIZE_HANDLE_CLASS`                                                 |
| `apps/live/hooks/ui/useEditorAccent.ts`               | `editorAccentCss`: tint selectors that outrank the Steel base         |
| `packages/template-previews/src/preview-art-tile.css` | Editor `.dark` tile rule landing on the canvas colour                 |
| `apps/live/app/dark-palette.test.ts`                  | Source guards: tokens, light untouched, solid-fill + brand-text rules |
| `apps/live/e2e/contrast-audit.spec.ts`                | Runtime contrast guard, dark mode                                     |

## Domain and naming

| Term                | Identifier                                              | Meaning                                                           |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Dark palette        | `.dark` block in `theme.css`                            | The token overrides that make dark mode Steel                     |
| Steel ramp          | `--color-brand-50` ... `--color-brand-950`              | The brand ramp's dark-mode values                                 |
| Dark surfaces       | `--color-slate-800/900/950` under `.dark`               | The blue-slate chrome                                             |
| Solid brand fill    | `SOLID_BRAND_DARK`                                      | `dark:bg-brand-600`, for a static fill under white text           |
| Solid brand control | `SOLID_BRAND_DARK_CONTROL`                              | `dark:bg-brand-600 dark:hover:bg-brand-700`, for a clickable fill |
| Wordmark accent     | `dark:text-sky-400` on the "diagram" span               | The one vivid note in dark chrome                                 |
| Dark canvas         | `DARK_CANVAS_BACKGROUND_COLOR`                          | `#0d121a`                                                         |
| Dark pattern        | `DARK_CANVAS_PATTERN_COLOR`                             | `#1c2735`, the opaque blend of `#2e4057` at 45 %                  |
| Dark ink            | `DARK_INK` (`fill`, `stroke`, `text`, `annotationFill`) | Unpainted element colours on dark paper                           |
| Arrow label colour  | `defaultArrowLabelColor(arrow, surface)`                | A caption's colour when the arrow carries no `textColor`          |
| Resize handle       | `RESIZE_HANDLE_CLASS`                                   | The corner handle's classes, both appearances                     |
| Accent tint CSS     | `editorAccentCss(accent)`                               | The `<style>` text `useEditorAccent` injects                      |
| Optical centring    | `text-optical-centre` (`@utility`)                      | Centre a numeral's ink in its circle / pill                       |
| Contrast audit      | `contrast-audit.spec.ts`                                | The Playwright guard                                              |

Banned: "night mode", "Steel theme" for the palette (Steel is also a colour scheme id; the palette is "the dark
palette", its ramp "the Steel ramp").

## Behaviour and state

There is no new state. Every value is a function of two existing inputs: the `.dark` class on `<html>` (appearance)
and the canvas surface (`canvasSurface(backdrop)`).

- **B1:** with `.dark` present, every `brand-*` / `slate-800/900/950` utility resolves to the dark value; without it,
  to the light value. Nothing else toggles.
- **B2:** with a themed tab open, `editorAccentCss` wins over B1 for the stops it sets, in both appearances.
- **B3:** on a dark surface, an element with no stored colour paints from `DARK_INK`; an arrow with no stored stroke
  from `DARK_INK.stroke`; its caption, when it has no `textColor` and no `strokeColor`, from `#94a3b8`.

Invariants:

- **I1 (light untouched):** the `@theme` block's values, and every class a component carries without a `dark:`
  prefix, are byte-identical to before. Every addition is `dark:`-prefixed or scoped to `.dark`.
- **I2:** every string literal carrying a solid brand fill (`bg-brand-500` / `bg-brand-600`, any `hover:` /
  `group-hover:` prefix, no opacity) together with `text-white` also carries `dark:bg-brand-600`.
- **I3:** every string literal carrying `text-brand-500`...`text-brand-950` also carries a `dark:text-*` token.
- **I4:** `defaultArrowLabelColor(arrow, 'light')` equals the stroke the arrow is drawn in (unchanged behaviour).

## Interfaces and contracts

```ts
// packages/ui/src/brand-classes.ts
export const SOLID_BRAND_DARK = 'dark:bg-brand-600';
export const SOLID_BRAND_DARK_CONTROL = 'dark:bg-brand-600 dark:hover:bg-brand-700';

// packages/diagram/src/colors.ts
export function defaultArrowLabelColor(
  arrow: Pick<ArrowElement, 'strokeColor' | 'textColor'>,
  surface?: CanvasSurface, // default 'light'
): string;
// textColor ?? (strokeColor ?? (surface === 'dark' ? '#94a3b8' : defaultArrowStrokeColor('light')))

// apps/live/hooks/ui/useEditorAccent.ts
export function editorAccentCss(accent: string): string;
// `html:root{--color-brand-*}html.dark{--color-slate-600..950}`
```

```css
/* theme.css */
@utility text-optical-centre {
  display: inline-block;
  line-height: 1;
  text-box: trim-both cap alphabetic;
  @supports not (text-box: trim-both cap alphabetic) {
    transform: translateY(0.1em);
  }
}
```

Rejections: none at runtime. The contracts are enforced by the guards in Testing: a missing dark pairing fails
`dark-palette.test.ts` with the file and literal; a low-contrast node fails the audit with its text, colours and ratio.

## Data and persistence

Nothing new is stored. `DARK_CANVAS_*` reach stored data only through tabs saved with the Default scheme in dark
mode (their backdrop). Tabs holding the previous dark half are migrated on read; see
[Retired schemes](../../011-theme/blueprints/retired-schemes.md).

## Errors and edge cases

| Case                                           | Handling                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Themed tab in dark mode                        | `html:root` / `html.dark` outrank `.dark` (0,1,1 > 0,1,0): tint wins (B2)                           |
| Stylesheet order changes (route CSS injected)  | Irrelevant: precedence is by specificity, not order                                                 |
| Browser without `text-box`                     | `@supports not` fallback `translateY(0.1em)` (D13)                                                  |
| Arrow with `strokeColor`, no `textColor`, dark | Label follows the stroke, as in light (the user picked the wire's colour)                           |
| Arrow with `textColor`                         | Always `textColor`                                                                                  |
| Tile art darker than `#f3faff`                 | Untouched by the `darken` veil; inverted with hue kept                                              |
| Marketing gallery tile                         | `.preview-art-tile-dark` rule unchanged; the `.dark .preview-art-tile` rule is editor-only by class |
| Disabled solid button in dark                  | `disabled:opacity-50` over `brand-600`; inactive controls are exempt (WCAG 1.4.3)                   |

## Security and trust

No trust boundary: static tokens and pure colour functions. `editorAccentCss` interpolates a colour derived from the
theme's `elementStroke`, which is either built-in or a custom theme's validated hex (custom themes validate on save,
`custom-theme-row.ts`); the ramp functions only ever emit `#rrggbb`.

## Performance and limits

- Token overrides are one extra unlayered rule; no runtime cost.
- `defaultArrowLabelColor` is O(1) per arrow per render.
- The contrast audit walks at most every text node in one screen (a few hundred); each node reads computed styles up
  its ancestor chain (depth < 40). Budget: under 2 s per screen.

## Presentation and UX

- Surfaces, ramp, wordmark: exactly the spec tables.
- Selection (dark, single): `dark:ring-blue-500/80 dark:shadow-[0_0_20px_rgba(37,99,235,0.15)]` appended to the
  single-selection ring of every element kind. Multi-selection and remote rings unchanged.
- Resize handle: light classes as before (`rounded-full border border-brand-200 bg-white text-brand-600 shadow-md`,
  plus the floating-control light hover); dark: `dark:rounded-[1px] dark:border-blue-900 dark:bg-blue-400
dark:shadow-none` (`#1e3a8a`, `#60a5fa`); dark hover keeps the fill and only lifts opacity (D11).
- Preview tile (editor, dark): `position: relative; isolation: isolate; background-color: #f3faff;
filter: invert(0.95) hue-rotate(180deg)`, plus `::after { inset: 0; background: #f3faff; mix-blend-mode: darken;
border-radius: inherit; pointer-events: none }`.
- Optical centring: the digit is wrapped in `<span class="text-optical-centre">`; a count badge host becomes
  `inline-flex h-3.5 items-center justify-center` (was `py-0.5` with the line box deciding height).

## Accessibility

| Pair (dark)                            | Ratio | Bar          |
| -------------------------------------- | ----- | ------------ |
| White on `brand-600` `#3a6599`         | 6.00  | 4.5 text     |
| White on `brand-700` `#2f5484` (hover) | 7.71  | 4.5 text     |
| `brand-400` `#8fb3e0` on `slate-900`   | 7.99  | 4.5 text     |
| Sky `#38bdf8` on `slate-950`           | 8.96  | 4.5 text     |
| Element text white on `#141b26`        | 17.29 | 4.5 text     |
| Arrow label `#94a3b8` on `#0d121a`     | 7.32  | 4.5 text     |
| Element stroke `#64748b` on `#0d121a`  | 3.95  | 3.0 non-text |
| Handle `#60a5fa` on `#0d121a`          | 7.38  | 3.0 non-text |

The runtime guard enforces text contrast on real screens; light mode is out of its scope by operator decision (#74).
Motion: none added.

## Web Experience

- **CLS:** zero. Tokens change colour only; the optical-centring utility changes no box size (the badge's fixed
  `h-3.5` equals its previous rendered height, D12); the tile veil is absolutely positioned.
- **LCP / INP:** unaffected; no new requests, no script.

## Observability

Colour tokens have no runtime decision point. The decisions that do run are logged where they are made: the
contrast audit attaches a per-screen report (nodes measured, skipped with reason) to the Playwright result, and the
Charcoal migration logs as its blueprint states.

## Testing

| Rule                                                          | Test                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Dark canvas, blended pattern, ink values                      | `packages/diagram/src/canvas-ink.test.ts`, `default-scheme.test.ts` |
| Stroke >= 3:1 on canvas and fill; text >= 4.5:1               | `canvas-ink.test.ts`, "dark ink contrast"                           |
| Label colour: dark default, stroke-following, textColor, I4   | `canvas-ink.test.ts`, "defaultArrowLabelColor"                      |
| Export label uses the same colour                             | `svg-render-arrows` test, "caption colour on dark paper"            |
| Surface + Steel tokens under `.dark`; `@theme` unchanged (I1) | `apps/live/app/dark-palette.test.ts`                                |
| Wordmark accent dark-only                                     | `dark-palette.test.ts`, "wordmark"                                  |
| I2 solid fills, I3 brand text                                 | `dark-palette.test.ts`, "solid brand fills", "brand text"           |
| Tint outranks base (B2)                                       | `apps/live/hooks/ui/editor-accent.test.ts`                          |
| Selection ring + glow dark-only                               | `apps/live/components/canvas/element-variant.test.ts`               |
| Handle dark classes; light classes unchanged                  | `element-parts` handle test                                         |
| Tile rule lands on canvas; marketing rule unchanged           | `apps/live/app/dark-mode-coverage.test.ts`                          |
| Optical utility defined; used by wizard + badges              | `dark-palette.test.ts`, "optical numerals"                          |
| Real screens meet AA in dark                                  | `e2e/contrast-audit.spec.ts`                                        |
| Default tab paints the new dark canvas + ink                  | `e2e/appearance.spec.ts`                                            |

## Constants and configuration

| Constant                       | Value                                   | Provenance                                   | Safe range                          |
| ------------------------------ | --------------------------------------- | -------------------------------------------- | ----------------------------------- |
| `DARK_CANVAS_BACKGROUND_COLOR` | `#0d121a`                               | Operator decision 1                          | Dark (`isLightColor` false)         |
| `DARK_CANVAS_PATTERN_COLOR`    | `#1c2735`                               | `#2e4057` x 0.45 + `#0d121a` x 0.55, rounded | Visible, below 1.5:1 on the canvas  |
| `DARK_INK.fill`                | `#141b26`                               | Operator decision 1                          | Stroke >= 3:1 on it                 |
| `DARK_INK.stroke`              | `#64748b`                               | slate-500                                    | >= 3:1 on canvas and fill           |
| `DARK_INK.text`                | `#ffffff`                               | Operator decision 1                          | >= 4.5:1 on fill                    |
| `DARK_INK.annotationFill`      | `#1c2533`                               | Operator decision 1                          | Lighter than `DARK_INK.fill`        |
| `DARK_ARROW_LABEL_COLOR`       | `#94a3b8`                               | slate-400                                    | >= 4.5:1 on the canvas              |
| Surfaces 950 / 900 / 800       | `#0b0f16` / `#131b26` / `#16202e`       | Operator decision 2                          | Dark, ordered                       |
| Steel ramp                     | spec table                              | Operator decision 3                          | White on 600 >= 4.5:1               |
| Wordmark accent                | `#38bdf8`                               | Tailwind sky-400                             | >= 4.5:1 on slate-950               |
| Tile plate / veil              | `#f3faff`                               | Measured: maps to `#0d1318` under the filter | Maps within 2 of canvas per channel |
| Tile invert                    | `0.95`                                  | Operator decision 6                          | 0.9 to 1                            |
| Glow                           | `0 0 20px rgba(37,99,235,0.15)`         | Operator decision 5                          | Alpha <= 0.25                       |
| AA thresholds                  | 4.5 / 3.0; large = 24px or 18.66px bold | WCAG 2.2 SC 1.4.3                            | Fixed                               |

## Assets and external resources

None: no fonts, images or icons are added.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D9 to D18.
