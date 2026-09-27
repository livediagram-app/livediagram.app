# Dark palette (Steel): blueprint

Derived from [Colour scheme, Dark palette (Steel)](../color-scheme.md#dark-palette-steel), with the canvas half from
[Canvas and palette, Default scheme, dark half](../../008-canvas/canvas-and-palette.md#default-scheme-dark-half), the
dark selection from [Canvas and palette, Selection](../../008-canvas/canvas-and-palette.md#selection) and the audit
from [End-to-end smoke tests](../../003-system-architecture/e2e-smoke.md). The spec decides; this file adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.
The Charcoal migration has its own blueprint ([Retired schemes](../../011-theme/blueprints/retired-schemes.md)).

Scope, by file:

| File                                                  | Role                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/tailwind-config/theme.css`                  | `.dark` surface + Steel tokens; `@utility text-optical-centre`                           |
| `packages/ui/src/brand-classes.ts`                    | `SOLID_BRAND_DARK`, `SOLID_BRAND_DARK_CONTROL`                                           |
| `packages/ui/src/Brand.tsx`                           | Wordmark accent `dark:text-sky-400`                                                      |
| `packages/diagram/src/canvas-colors.ts`               | Dark canvas + pattern constants                                                          |
| `packages/diagram/src/colors.ts`                      | `DARK_INK`, `defaultArrowLabelColor`                                                     |
| `packages/diagram/src/svg-render-arrows.ts`           | Export caption colour through `defaultArrowLabelColor`                                   |
| `packages/template-previews/src/preview-art-tile.css` | Editor `.dark` tile rule landing on the canvas colour                                    |
| `apps/live/components/canvas/ArrowView.tsx`           | Canvas caption colour through `defaultArrowLabelColor`                                   |
| `apps/live/components/canvas/element-variant.ts`      | `DARK_SELECTION_RING` on every single selection                                          |
| `apps/live/components/canvas/element-parts.tsx`       | `RESIZE_HANDLE_CLASS`                                                                    |
| `apps/live/hooks/ui/editor-accent.ts`                 | `editorAccentCss`: tint selectors that outrank the Steel base                            |
| `apps/live/lib/identity-fill.ts`                      | `identityDeep`, `identityVars`, `IDENTITY_FILL`                                          |
| `apps/live/components/chrome/TabPill.tsx`             | Active pill's dark surface as `var(--color-slate-800)`                                   |
| `apps/live/app/dark-palette.test.ts`                  | Source guards: tokens, light ramp, wordmark, solid fills, brand text, numerals, identity |
| `apps/live/e2e/contrast.ts`, `contrast-audit.spec.ts` | Runtime contrast guard, dark mode                                                        |

## Domain and naming

| Term                | Identifier                                               | Meaning                                                       |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Dark palette        | `.dark` block in `theme.css`                             | The token overrides that make dark mode Steel                 |
| Steel ramp          | `--color-brand-50` ... `--color-brand-950` under `.dark` | The brand ramp's dark-mode values                             |
| Dark surfaces       | `--color-slate-800/900/950` under `.dark`                | The blue-slate chrome                                         |
| Solid brand fill    | `SOLID_BRAND_DARK`                                       | `dark:bg-brand-600`, a static fill under white text           |
| Solid brand control | `SOLID_BRAND_DARK_CONTROL`                               | `dark:bg-brand-600 dark:hover:bg-brand-700`, a clickable fill |
| Wordmark accent     | `dark:text-sky-400` on the "diagram" span                | The one vivid note in dark chrome                             |
| Dark canvas         | `DARK_CANVAS_BACKGROUND_COLOR`                           | `#0d121a`                                                     |
| Dark pattern        | `DARK_CANVAS_PATTERN_COLOR`                              | `#1c2735`, the opaque blend of `#2e4057` at 45 %              |
| Dark ink            | `DARK_INK` (`fill`, `stroke`, `text`, `annotationFill`)  | Unpainted element colours on dark paper                       |
| Caption colour      | `defaultArrowLabelColor(arrow, surface)`                 | An arrow caption's colour when it carries no `textColor`      |
| Dark selection ring | `DARK_SELECTION_RING`                                    | Blue ring, glow and transparent offset on a single selection  |
| Resize handle       | `RESIZE_HANDLE_CLASS`                                    | The corner handle's classes, both appearances                 |
| Accent tint CSS     | `editorAccentCss(accent)`                                | The `<style>` text `useEditorAccent` injects                  |
| Identity fill       | `identityDeep`, `identityVars`, `IDENTITY_FILL`          | A runtime colour under white text, deepened in dark mode      |
| Optical centring    | `text-optical-centre` (`@utility`)                       | Centre a numeral's ink in its circle / pill                   |
| Contrast audit      | `auditContrast(page)`, `contrast-audit.spec.ts`          | The Playwright guard                                          |

Banned: "night mode"; "Steel theme" for the palette (Steel is also a colour scheme id: say "the dark palette", its ramp
"the Steel ramp"); "identity ink" (the text stays white; it is the fill that changes).

## Behaviour and state

There is no new state. Every value is a function of two existing inputs: the `.dark` class on `<html>` (appearance)
and the canvas surface (`canvasSurface(backdrop)`).

- **B1:** with `.dark` present, every `brand-*` / `slate-800/900/950` utility resolves to the dark value; without it,
  to the light value.
- **B2:** with a themed tab open, `editorAccentCss` wins over B1 for the stops it sets, in both appearances.
- **B3:** on a dark surface, an element with no stored colour paints from `DARK_INK`; an arrow with no stored stroke
  from `DARK_INK.stroke`; its caption, with no `textColor` and no `strokeColor`, from `#94a3b8`.
- **B4:** an element carrying `IDENTITY_FILL` paints `--identity` in light and `--identity-deep` in dark.

Invariants:

- **I1 (light untouched):** the `@theme` block's values, and every class a component carries without a `dark:`
  prefix, are unchanged. Every addition is `dark:`-prefixed, scoped to `.dark`, or a colour moved from an inline
  style into `--identity` with the same light value.
- **I2:** every string carrying a solid brand fill (`bg-brand-500` / `bg-brand-600`, any `hover:` / `group-hover:`
  prefix, no opacity) together with `text-white` also carries the pairing.
- **I3:** every string carrying `text-brand-500`...`text-brand-950` also carries a `dark:text-*` token.
- **I4:** `defaultArrowLabelColor(arrow, 'light')` equals the stroke the arrow is drawn in (unchanged behaviour).
- **I5:** no element paints white text on an inline runtime `backgroundColor`; it uses `identityVars` + `IDENTITY_FILL`.
- **I6:** in dark mode no text is `slate-500` (`dark:text-slate-500` does not occur); secondary text is `slate-400`.

## Interfaces and contracts

```ts
// packages/ui/src/brand-classes.ts
export const SOLID_BRAND_DARK = 'dark:bg-brand-600';
export const SOLID_BRAND_DARK_CONTROL = 'dark:bg-brand-600 dark:hover:bg-brand-700';

// packages/diagram/src/colors.ts
export function defaultArrowLabelColor(
  arrow: { strokeColor?: string; textColor?: string },
  surface?: CanvasSurface, // default 'light'
): string; // textColor ?? strokeColor ?? (dark ? '#94a3b8' : defaultArrowStrokeColor('light'))

// apps/live/hooks/ui/editor-accent.ts
export function editorAccentCss(accent: string): string; // `html:root{--color-brand-*}html.dark{--color-slate-600..950}`

// apps/live/lib/identity-fill.ts
export function identityDeep(color: string): string;
export function identityVars(color: string): CSSProperties; // { '--identity', '--identity-deep' }
export const IDENTITY_FILL = 'bg-(--identity) dark:bg-(--identity-deep)';

// apps/live/e2e/contrast.ts
export function auditContrast(page: Page): Promise<ContrastReport>; // { measured, failures, skipped }
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

Rejections are the guards': a missing pairing fails `dark-palette.test.ts` naming the file and literal (or line); a
low-contrast node fails the audit with its text, colours, ratio and element.

## Data and persistence

Nothing new is stored. `DARK_CANVAS_*` reach stored data only through tabs saved with the Default scheme in dark
mode (their backdrop). Tabs holding the previous dark half are migrated on read; see
[Retired schemes](../../011-theme/blueprints/retired-schemes.md).

## Errors and edge cases

| Case                                          | Handling                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Themed tab in dark mode                       | `html:root` / `html.dark` (0,1,1) outrank `.dark` (0,1,0): tint wins (B2)                                      |
| Stylesheet order changes                      | Irrelevant: precedence is by specificity                                                                       |
| Browser without `text-box`                    | `@supports not` fallback `translateY(0.1em)` (D13)                                                             |
| Padding-sized pill wrapping a trimmed numeral | Host fixed at its previous rendered height (`h-3`, `h-3.5`, `h-[12.6px]`, `h-[17px]`, `h-[19px]`, `h-5`) (D12) |
| Arrow with `strokeColor`, no `textColor`      | Caption follows the stroke on either paper (D17)                                                               |
| Inline style would beat a `dark:` class       | Runtime colours move into custom properties (I5)                                                               |
| Identity colour outside the participant set   | `identityDeep` darkens in 5 % steps until white reads at 4.5:1 (D20)                                           |
| Non-hex identity colour                       | Passed through unchanged                                                                                       |
| Tile art darker than `#f3faff`                | Untouched by the `darken` veil; inverted with hue kept                                                         |
| Marketing gallery tile                        | `.preview-art-tile-dark` rule unchanged                                                                        |
| Disabled solid button in dark                 | `dark:disabled:*` sorts after `dark:bg-*`; inactive controls are exempt (1.4.3)                                |

## Security and trust

No trust boundary: static tokens and pure colour functions. `editorAccentCss` and `identityVars` interpolate colours
that are either built-in or validated hex (custom themes validate on save); the ramp and shade functions only emit
`#rrggbb`, and a custom property value cannot break out of its declaration in React's style serialisation.

## Performance and limits

- Token overrides are one unlayered rule; no runtime cost.
- `defaultArrowLabelColor` is O(1) per arrow per render; `identityDeep` is a map lookup, or at most 20 shade steps.
- The contrast audit reads computed styles up each text node's ancestor chain; a screen of 30 to 80 text nodes
  audits in well under a second, with colour parses cached per value.

## Presentation and UX

- Surfaces, ramp, wordmark: the spec tables.
- Selection (dark, single, every kind): `dark:ring-blue-500/80 dark:shadow-[0_0_20px_rgba(37,99,235,0.15)]
dark:ring-offset-transparent` (D19). Multi-selection and remote rings unchanged.
- Resize handle: the floating control's light classes, unchanged; dark: `dark:rounded-[1px] dark:border-blue-900
dark:bg-blue-400 dark:shadow-none`, and the same on `dark:hover:` so only the opacity lift signals hover (D11).
- Preview tile (editor, dark): `position: relative; isolation: isolate; background-color: #f3faff;
filter: invert(0.95) hue-rotate(180deg)`, plus `::after { inset: 0; background: #f3faff; mix-blend-mode: darken;
border-radius: inherit; pointer-events: none }`.
- Optical centring: the digit (or poll letter) is wrapped in `<span class="text-optical-centre">`; hosts that took
  their height from padding become `inline-flex items-center` at their previous rendered height (D12).
- Secondary text in dark: `dark:text-slate-400`, dropped where the base class is already `text-slate-400` (D21).
- Identity colours: `identityVars(color)` in style, `IDENTITY_FILL` in class, text stays `text-white`.

## Accessibility

| Pair (dark)                              | Ratio      | Bar          |
| ---------------------------------------- | ---------- | ------------ |
| White on `brand-600` `#3a6599`           | 6.00       | 4.5 text     |
| White on `brand-700` `#2f5484` (hover)   | 7.71       | 4.5 text     |
| `brand-400` `#8fb3e0` on `slate-900`     | 7.99       | 4.5 text     |
| Sky `#38bdf8` on `slate-950`             | 8.96       | 4.5 text     |
| `slate-400` on `slate-900` / `slate-800` | 6.4 / 6.1  | 4.5 text     |
| White on identity 700 steps              | 5.0 to 7.9 | 4.5 text     |
| Element text white on `#141b26`          | 17.29      | 4.5 text     |
| Caption `#94a3b8` on `#0d121a`           | 7.32       | 4.5 text     |
| Element stroke `#64748b` on `#0d121a`    | 3.95       | 3.0 non-text |
| Handle `#60a5fa` on `#0d121a`            | 7.38       | 3.0 non-text |

The runtime guard enforces text contrast on the wizard (both steps), the editor with its default panels and a
selection, Settings, Share, Join and the Explorer (D18). Light mode is out of its scope by operator decision (#74).
Motion: none added.

## Web Experience

- **CLS:** zero. Tokens change colour only; numeral hosts keep their rendered size (measured: 24x24 circles and
  17.8x14 badges before and after); the tile veil is absolutely positioned.
- **LCP / INP:** unaffected; no new requests, no script.

## Observability

Colour tokens have no runtime decision point. The audit attaches a per-screen report to the Playwright result
(`contrast: <screen>`: nodes measured, skipped by reason), and a failure names the node, both colours and the ratio.
The Charcoal migration logs as its blueprint states.

## Testing

| Rule                                                         | Test                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Dark canvas, blended pattern, ink values                     | `packages/diagram/src/canvas-ink.test.ts`, `default-scheme.test.ts`        |
| Stroke >= 3:1 on canvas and fill; text >= 4.5:1              | `canvas-ink.test.ts`, "dark ink contrast"                                  |
| Caption colour (B3, I4)                                      | `canvas-ink.test.ts`, "defaultArrowLabelColor"                             |
| Export caption uses the same colour                          | `svg-render.test.ts`, "caption colour on dark paper"                       |
| Surface + Steel tokens; light ramp unchanged (I1)            | `apps/live/app/dark-palette.test.ts`, "the dark palette tokens"            |
| Wordmark accent dark-only                                    | `dark-palette.test.ts`, "the wordmark"                                     |
| I2 solid fills, I3 brand text                                | `dark-palette.test.ts`, "solid brand fills", "brand-coloured text"         |
| Optical utility defined; every counted value wrapped         | `dark-palette.test.ts`, "optical numerals"                                 |
| I5 identity colours                                          | `dark-palette.test.ts`, "white text on an identity colour"                 |
| `identityDeep` at AA on every colour; fallback; pass-through | `apps/live/lib/identity-fill.test.ts`                                      |
| Tint outranks base (B2)                                      | `apps/live/hooks/ui/editor-accent.test.ts`                                 |
| Selection ring + glow dark-only, every kind                  | `apps/live/components/canvas/element-variant.test.ts`                      |
| Handle dark classes; light classes unchanged                 | `apps/live/components/canvas/element-parts.test.ts`, "RESIZE_HANDLE_CLASS" |
| Tile lands on canvas; marketing rule unchanged               | `apps/live/app/dark-mode-coverage.test.ts`                                 |
| No slate-500 text in dark (I6)                               | `dark-palette.test.ts`, "secondary text in dark mode"                      |
| Real screens meet AA in dark                                 | `apps/live/e2e/contrast-audit.spec.ts`                                     |
| Default tab paints the new dark canvas + ink                 | `apps/live/e2e/appearance.spec.ts`                                         |

## Constants and configuration

| Constant                       | Value                                    | Provenance                                   | Safe range                         |
| ------------------------------ | ---------------------------------------- | -------------------------------------------- | ---------------------------------- |
| `DARK_CANVAS_BACKGROUND_COLOR` | `#0d121a`                                | Operator decision 1                          | Dark (`isLightColor` false)        |
| `DARK_CANVAS_PATTERN_COLOR`    | `#1c2735`                                | `#2e4057` x 0.45 + `#0d121a` x 0.55, rounded | Visible, below 1.5:1 on the canvas |
| `DARK_INK.fill`                | `#141b26`                                | Operator decision 1                          | Stroke >= 3:1 on it                |
| `DARK_INK.stroke`              | `#64748b`                                | slate-500                                    | >= 3:1 on canvas and fill          |
| `DARK_INK.text`                | `#ffffff`                                | Operator decision 1                          | >= 4.5:1 on fill                   |
| `DARK_INK.annotationFill`      | `#1c2533`                                | Operator decision 1                          | Lighter than `DARK_INK.fill`       |
| `DARK_ARROW_LABEL_COLOR`       | `#94a3b8`                                | slate-400                                    | >= 4.5:1 on the canvas             |
| Surfaces 950 / 900 / 800       | `#0b0f16` / `#131b26` / `#16202e`        | Operator decision 2                          | Dark, ordered                      |
| Steel ramp                     | spec table                               | Operator decision 3                          | White on 600 >= 4.5:1              |
| Wordmark accent                | `#38bdf8`                                | Tailwind sky-400                             | >= 4.5:1 on slate-950              |
| `PARTICIPANT_DEEP`             | each colour's Tailwind 700 step          | Operator choice (identity avatars, option B) | White >= 4.5:1                     |
| `SHADE_STEP`                   | `0.05`                                   | D20                                          | 0.01 to 0.1                        |
| Tile plate / veil              | `#f3faff`                                | Measured: maps to `#0d1318` under the filter | Within 2 of the canvas per channel |
| Tile invert                    | `0.95`                                   | Operator decision 6                          | 0.9 to 1                           |
| Glow                           | `0 0 20px rgba(37,99,235,0.15)`          | Operator decision 5                          | Alpha <= 0.25                      |
| AA thresholds                  | 4.5 / 3.0; large = 24px, or 18.66px bold | WCAG 2.2 SC 1.4.3                            | Fixed                              |
| Picture-scale text             | glyphs under 6px                         | D15                                          | 4 to 8px                           |

## Assets and external resources

None: no fonts, images or icons are added.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D9 to D24.
