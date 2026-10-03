# Theme

The livediagram brand color is **light blue**. Everything below builds on that.

## Primary palette — Sky blue

A single brand hue with a full 50–950 ramp. Built on Tailwind's `sky` scale.

| Token           | Hex           | Usage                                                 |
| --------------- | ------------- | ----------------------------------------------------- |
| `brand-50`      | `#F0F9FF`     | App backgrounds, faint tints, hover surfaces          |
| `brand-100`     | `#E0F2FE`     | Subtle fills, selected-row backgrounds                |
| `brand-200`     | `#BAE6FD`     | Accents, soft borders, collaborator cursor tints      |
| `brand-300`     | `#7DD3FC`     | Decorative accents, secondary indicators              |
| `brand-400`     | `#38BDF8`     | Light brand surfaces, illustrations                   |
| **`brand-500`** | **`#0EA5E9`** | **Primary brand color — buttons, links, focus rings** |
| `brand-600`     | `#0284C7`     | Hover state for primary                               |
| `brand-700`     | `#0369A1`     | Active/pressed state, emphasised text on light bg     |
| `brand-800`     | `#075985`     | High-contrast emphasis                                |
| `brand-900`     | `#0C4A6E`     | Dark mode brand text                                  |
| `brand-950`     | `#082F49`     | Dark mode surfaces                                    |

`brand-500` (`#0EA5E9`) is the canonical "livediagram blue" — the color that appears in the logo, primary buttons, and selection highlights.

## Neutrals — Slate

Slate complements sky cleanly (both are cool-toned). Use for text, borders, surfaces, and dividers.

| Token       | Hex       | Usage                          |
| ----------- | --------- | ------------------------------ |
| `slate-50`  | `#F8FAFC` | Page background (light mode)   |
| `slate-100` | `#F1F5F9` | Card / panel background        |
| `slate-200` | `#E2E8F0` | Subtle borders, dividers       |
| `slate-300` | `#CBD5E1` | Default borders                |
| `slate-400` | `#94A3B8` | Disabled text, placeholder     |
| `slate-500` | `#64748B` | Secondary text                 |
| `slate-600` | `#475569` | Body text on light surfaces    |
| `slate-700` | `#334155` | Headings                       |
| `slate-800` | `#1E293B` | Strong text, dark surface bg   |
| `slate-900` | `#0F172A` | Highest-contrast text, dark bg |
| `slate-950` | `#020617` | Dark mode page background      |

In dark mode the three surface stops are the blue-slate of the [dark palette](#dark-palette-steel) instead.

## Semantic colors

Reserved for status — never used decoratively.

| Role    | Light bg    | Foreground  | Notes                          |
| ------- | ----------- | ----------- | ------------------------------ |
| Success | `#D1FAE5`   | `#047857`   | Emerald (saves, confirmations) |
| Warning | `#FEF3C7`   | `#B45309`   | Amber (caution, soft alerts)   |
| Error   | `#FEE2E2`   | `#B91C1C`   | Rose (destructive, errors)     |
| Info    | `brand-100` | `brand-700` | Reuses the brand ramp          |

## Usage rules

- **Primary actions** (Save, Share, Create) use `brand-500` filled, white text. Hover → `brand-600`, active → `brand-700`.
- **Secondary actions** use a `slate-200` border with `slate-700` text on white. No filled neutrals as buttons.
- **Links** are `brand-600` with underline on hover.
- **Focus rings** are 2px `brand-500` with a 2px `brand-100` halo for accessibility.
- **Selection / collaborator highlights** on the canvas use `brand-200`–`brand-300` tints. Individual collaborator cursors may shift hue (per-user color), but the default user's selection stays in the brand range.
- **Page background**: `slate-50`. **Canvas background**: pure white (`#FFFFFF`) so what's on the canvas reads cleanly.
- **Dark mode** uses `slate-950` page bg, `slate-900` surfaces and the Steel accent, as the [dark palette](#dark-palette-steel) sets out.
- **Glyphs in a circle or pill** centre their ink, not their line box, in both appearances: see
  [Optical alignment](optical-alignment.md).
- **A circle at the end of a pill is concentric with it.** When a pill holds a circle at its start that fills the
  pill's height bar the inset (a step number, an avatar; not a small glyph such as a spinner), the circle sits as far
  from the pill's leading edge as from its top and bottom: the leading padding equals the vertical padding, at every
  breakpoint, so the pill's round cap hugs the circle instead of leaving a crescent of pill around it. The trailing
  side may be roomier; it frames text, not the circle.

## Dark palette (Steel)

Dark mode is its own palette, not the light one with the lights off. It lives in `packages/tailwind-config/theme.css`
under `.dark` and **retargets tokens only**: every `slate-*` / `brand-*` utility keeps its name, and light mode keeps
every colour it has. The canvas half of the palette (backdrop, grid, element ink, arrows, selection) belongs to the
Default colour scheme's dark half, specified in [Canvas and palette](../008-canvas/canvas-and-palette.md).

### Surfaces

A blue-slate, one hue with the canvas (`#0d121a`) so chrome and paper read as one material.

| Token       | Dark value | Usage                               |
| ----------- | ---------- | ----------------------------------- |
| `slate-950` | `#0b0f16`  | Page background, deepest wells      |
| `slate-900` | `#131b26`  | Panels, dialogs, header, tab bar    |
| `slate-800` | `#16202e`  | Raised rows, inputs, hover surfaces |

The lighter stops (`slate-50`…`slate-700`) keep Tailwind's values: they carry dark-mode text and borders.

### Accent: the Steel ramp

In dark mode the brand ramp is **Steel**, an accent drawn from the surface hue itself, so a filled button reads as
part of the chrome rather than a sticker on it.

| Token       | Dark value | Usage in dark mode                               |
| ----------- | ---------- | ------------------------------------------------ |
| `brand-50`  | `#eef3fa`  | Text on brand-tinted fills                       |
| `brand-100` | `#dbe6f4`  | Hover text                                       |
| `brand-200` | `#bcd0ea`  | Emphasised text                                  |
| `brand-300` | `#9bb9de`  | Brand text, badges                               |
| `brand-400` | `#8fb3e0`  | Brand text and links, the lightest accent        |
| `brand-500` | `#5b86bf`  | Rings, tinted fills (`brand-500/10`), decoration |
| `brand-600` | `#3a6599`  | **Solid fills under white text**                 |
| `brand-700` | `#2f5484`  | Hover on a solid fill                            |
| `brand-800` | `#26446b`  | Deep accents                                     |
| `brand-900` | `#1d3553`  | Deep accents                                     |
| `brand-950` | `#142538`  | Deepest accent surfaces                          |

The wordmark's "diagram" half is the one vivid note: **sky-400 `#38bdf8`** in dark mode. Light mode keeps
`brand-500`, and the logo mark keeps its own colour in both.

### Rules

- **Solid brand fill with white text** (primary buttons, active segments, filled step circles, avatar discs, count
  badges) sits on `brand-600` in dark mode, and a control hovers to `brand-700`: white on `#3a6599` is 6.0:1. The
  pairing lives in two shared class constants in `@livediagram/ui`, `SOLID_BRAND_DARK` for a static fill and
  `SOLID_BRAND_DARK_CONTROL` for a control, never re-typed per component.
- **The selected segment of a segmented control** (a two- or more-way switch, a tab strip drawn as segments) is
  that solid fill, in both appearances: `ACTIVE_SEGMENT` in `@livediagram/ui`. A fill that only lifts off the
  track (white on `slate-100`, `slate-900` on `slate-800`) is about 1.1:1 and does not mark a state; the
  selection is held to 3:1 against its track (WCAG 2.2 SC 1.4.11), measured in the Home switch's end-to-end test. The
  track is `SEGMENT_TRACK`, the deepest surface in dark mode (`slate-950`): `brand-600` reads 3.2:1 there, 2.7:1 on
  `slate-800`.
- **White text on an identity colour** (avatar initials, cursor and presence labels, a comment author's disc, a
  team's tile: a participant's or team's colour under white text) sits on a **deeper shade of the same hue** in dark
  mode (`identityDeep`): each participant colour's own Tailwind 700 step (5.0 to 7.9:1 under white), and for any
  other colour the lightest darkening that reaches 4.5:1. White fails AA on all ten participant colours as they
  are. The text stays white, and light mode keeps the colour exactly. The colour is carried by the shared
  `identityVars` style and `IDENTITY_FILL` class, never an inline background, which the dark shade could not
  override.
- **Secondary text** in dark mode is `slate-400` or lighter (6.4:1 on `slate-900`). `slate-500` is for non-text only
  in dark mode: as text it is 3.4 to 3.9:1 on every dark surface.
- **Brand-coloured text** in dark mode is `brand-400` or lighter (`#8fb3e0` on `slate-900` is 8.0:1).
- **Tinted fills** (`brand-500/10`, `brand-500/15`…) and purely decorative uses (spinners' tracks, glyph strokes on a
  tinted plate, shadows) keep their tokens: the Steel ramp restyles them by itself.
- **Themed tabs tint on top.** A tab on a colour scheme with an accent retargets the brand ramp (both appearances)
  and the dark surface stops ([Canvas and theme dialog](../011-theme/canvas-and-theme-dialog.md)); that tint
  outranks the Steel base by selector, not by stylesheet order, so the Steel palette is only ever what a Default tab
  shows.
- **Surfaces painted inline use the tokens.** The active tab pill paints its dark surface as `var(--color-slate-800)`,
  not a literal, so it follows the dark palette and a themed tab's tint.
- **Light mode is untouched.** No light token, class or colour changes with the dark palette.

## Accessibility

- All text/background pairings must meet **WCAG AA** contrast (4.5:1 for body, 3:1 for large text and UI controls).
- `brand-500` on white meets AA for large text only — for small text, use `brand-700` or darker.
- Never rely on color alone to convey status; pair semantic colors with an icon or label.
- **Contrast guard (dark mode).** A Playwright audit (`apps/live/e2e/contrast-audit.spec.ts`) walks every visible
  text node on the New Document wizard, the editor, its dialogs and panels, and the Explorer in dark mode, composites
  the real background under it, and fails below 4.5:1 (3:1 for large text: 24px, or 18.66px bold). It has no
  allow-list. It covers **dark mode only**: light mode's colours are owned by Thomas
  ([@tommcclean](https://github.com/tommcclean)) under [#74](https://github.com/livediagram-app/livediagram.app/issues/74),
  which stays open for the light half.

## Tailwind integration

The palette is exposed as a Tailwind v4 theme in `packages/tailwind-config/theme.css`. Apps consume it by importing the package alongside Tailwind itself in their `globals.css`:

```css
@import 'tailwindcss';
@import '@livediagram/tailwind-config';
```

The package's `theme.css` declares the brand ramp as CSS variables inside a `@theme` block, which Tailwind v4 turns into the `brand-50`…`brand-950` utility classes automatically:

```css
@theme {
  --color-brand-50: #f0f9ff;
  --color-brand-100: #e0f2fe;
  --color-brand-200: #bae6fd;
  --color-brand-300: #7dd3fc;
  --color-brand-400: #38bdf8;
  --color-brand-500: #0ea5e9;
  --color-brand-600: #0284c7;
  --color-brand-700: #0369a1;
  --color-brand-800: #075985;
  --color-brand-900: #0c4a6e;
  --color-brand-950: #082f49;
}
```

Slate, success / warning / error utilities live on Tailwind's own defaults — only the `brand` ramp is custom.
