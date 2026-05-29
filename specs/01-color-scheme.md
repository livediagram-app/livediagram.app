# Color scheme

The livediagram brand color is **light blue**. Everything below builds on that.

## Primary palette — Sky blue

A single brand hue with a full 50–950 ramp. Built on Tailwind's `sky` scale.

| Token         | Hex       | Usage                                                  |
| ------------- | --------- | ------------------------------------------------------ |
| `brand-50`    | `#F0F9FF` | App backgrounds, faint tints, hover surfaces           |
| `brand-100`   | `#E0F2FE` | Subtle fills, selected-row backgrounds                 |
| `brand-200`   | `#BAE6FD` | Accents, soft borders, collaborator cursor tints       |
| `brand-300`   | `#7DD3FC` | Decorative accents, secondary indicators               |
| `brand-400`   | `#38BDF8` | Light brand surfaces, illustrations                    |
| **`brand-500`** | **`#0EA5E9`** | **Primary brand color — buttons, links, focus rings** |
| `brand-600`   | `#0284C7` | Hover state for primary                                |
| `brand-700`   | `#0369A1` | Active/pressed state, emphasised text on light bg      |
| `brand-800`   | `#075985` | High-contrast emphasis                                 |
| `brand-900`   | `#0C4A6E` | Dark mode brand text                                   |
| `brand-950`   | `#082F49` | Dark mode surfaces                                     |

`brand-500` (`#0EA5E9`) is the canonical "livediagram blue" — the color that appears in the logo, primary buttons, and selection highlights.

## Neutrals — Slate

Slate complements sky cleanly (both are cool-toned). Use for text, borders, surfaces, and dividers.

| Token       | Hex       | Usage                              |
| ----------- | --------- | ---------------------------------- |
| `neutral-50`  | `#F8FAFC` | Page background (light mode)       |
| `neutral-100` | `#F1F5F9` | Card / panel background            |
| `neutral-200` | `#E2E8F0` | Subtle borders, dividers           |
| `neutral-300` | `#CBD5E1` | Default borders                    |
| `neutral-400` | `#94A3B8` | Disabled text, placeholder         |
| `neutral-500` | `#64748B` | Secondary text                     |
| `neutral-600` | `#475569` | Body text on light surfaces        |
| `neutral-700` | `#334155` | Headings                           |
| `neutral-800` | `#1E293B` | Strong text, dark surface bg       |
| `neutral-900` | `#0F172A` | Highest-contrast text, dark bg     |
| `neutral-950` | `#020617` | Dark mode page background          |

## Semantic colors

Reserved for status — never used decoratively.

| Role      | Light bg    | Foreground  | Notes                       |
| --------- | ----------- | ----------- | --------------------------- |
| Success   | `#D1FAE5`   | `#047857`   | Emerald (saves, confirmations) |
| Warning   | `#FEF3C7`   | `#B45309`   | Amber (caution, soft alerts)  |
| Error     | `#FEE2E2`   | `#B91C1C`   | Rose (destructive, errors)    |
| Info      | `brand-100` | `brand-700` | Reuses the brand ramp         |

## Usage rules

- **Primary actions** (Save, Share, Create) use `brand-500` filled, white text. Hover → `brand-600`, active → `brand-700`.
- **Secondary actions** use a `neutral-200` border with `neutral-700` text on white. No filled neutrals as buttons.
- **Links** are `brand-600` with underline on hover.
- **Focus rings** are 2px `brand-500` with a 2px `brand-100` halo for accessibility.
- **Selection / collaborator highlights** on the canvas use `brand-200`–`brand-300` tints. Individual collaborator cursors may shift hue (per-user color), but the default user's selection stays in the brand range.
- **Page background**: `neutral-50`. **Canvas background**: pure white (`#FFFFFF`) so diagrams read cleanly.
- **Dark mode** uses `neutral-950` page bg, `neutral-900` surfaces, `brand-400` for primary actions (lighter shade reads better on dark).

## Accessibility

- All text/background pairings must meet **WCAG AA** contrast (4.5:1 for body, 3:1 for large text and UI controls).
- `brand-500` on white meets AA for large text only — for small text, use `brand-700` or darker.
- Never rely on color alone to convey status; pair semantic colors with an icon or label.

## Tailwind integration

The palette is exposed via a shared theme. Apps consume it through a shared Tailwind preset (to be created in `packages/tailwind-config` when the first app lands). Sketch of the config:

```ts
// packages/tailwind-config/preset.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F0F9FF', 100: '#E0F2FE', 200: '#BAE6FD', 300: '#7DD3FC',
          400: '#38BDF8', 500: '#0EA5E9', 600: '#0284C7', 700: '#0369A1',
          800: '#075985', 900: '#0C4A6E', 950: '#082F49',
        },
      },
    },
  },
};
```
