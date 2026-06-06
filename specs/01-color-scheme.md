# Color scheme

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
- **Page background**: `slate-50`. **Canvas background**: pure white (`#FFFFFF`) so diagrams read cleanly.
- **Dark mode** uses `slate-950` page bg, `slate-900` surfaces, `brand-400` for primary actions (lighter shade reads better on dark).

## Accessibility

- All text/background pairings must meet **WCAG AA** contrast (4.5:1 for body, 3:1 for large text and UI controls).
- `brand-500` on white meets AA for large text only — for small text, use `brand-700` or darker.
- Never rely on color alone to convey status; pair semantic colors with an icon or label.

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
