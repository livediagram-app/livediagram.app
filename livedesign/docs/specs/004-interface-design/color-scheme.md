# Theme

The livedesign brand color is **rose**. Everything below builds on that.

## The product accent

Every live product carries its own accent and shares everything else: the layout, the neutrals, the components and the
Living Prism mark. livediagram is sky blue and liveplanner violet; **livedesign is rose**. The accent lives in one ramp,
the `brand-*` tokens in `packages/tailwind-config/theme.css`, and in the prism palette the mark and every icon are
generated from (`PRISM_PALETTES` in `packages/ui/src/brand-prism.ts`, written out by `pnpm icons:brand`). The places
that cannot read a CSS token (the email templates, the social card, the web manifest, the unthemed tab accent, the help
centre's print styles) name the same hexes, and a change of accent changes them together.

## Primary palette — Rose

A single brand hue with a full 50–950 ramp. Built on Tailwind's `rose` scale, unchanged.

| Token           | Hex           | Usage                                                      |
| --------------- | ------------- | ---------------------------------------------------------- |
| `brand-50`      | `#fff1f2`     | App backgrounds, faint tints, hover surfaces               |
| `brand-100`     | `#ffe4e6`     | Subtle fills, selected-row backgrounds                     |
| `brand-200`     | `#fecdd3`     | Accents, soft borders, collaborator cursor tints           |
| `brand-300`     | `#fda4af`     | Decorative accents, secondary indicators                   |
| `brand-400`     | `#fb7185`     | Light brand surfaces, illustrations                        |
| **`brand-500`** | **`#f43f5e`** | **Primary brand color — accents, focus rings, decoration** |
| `brand-600`     | `#e11d48`     | Focus outlines, decorative accents with no text            |
| `brand-700`     | `#be123c`     | **Solid fills under white text**, **all light brand ink**  |
| `brand-800`     | `#9f1239`     | Hover on a solid fill, high-contrast emphasis              |
| `brand-900`     | `#881337`     | Dark mode brand text                                       |
| `brand-950`     | `#4c0519`     | Dark mode surfaces                                         |

`brand-500` (`#f43f5e`) is the canonical "livedesign rose": the color of selection highlights, accents and focus rings.
It carries no white text: white on it is 3.7:1, so a primary button sits two steps deeper, on `brand-700`. The logo
draws on its own prism palette, rose into pink into deep brown ([Brand mark](./brand-mark.md)).

**Why no stop is hand-tuned.** Rose is deep enough at Tailwind's own steps for every role: `brand-600` (`#e11d48`), the focus outline, is 4.7:1 on white and 3.9:1 on `slate-100` and `brand-100`, past the 3:1 a focus indicator needs, and `brand-700` (`#be123c`) holds white at 6.3:1, so a banner's 90% white copy clears 4.5:1. (Amber, livedocuments' accent, needed both stops deepened.) `brand-100` is also the Warning chip's background ([Semantic colors](#semantic-colors)); the two stay
apart by the Warning's icon and label, never by colour alone.

## Neutrals — Slate

Slate is cool where rose is warm, so the accent stands off the neutrals rather than blending into them. Use it for text,
borders, surfaces, and dividers.

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

Small text (13 px and under) in the editor's chrome reads at WCAG 2.2 AA, 4.5:1, in light mode: never `slate-300`
or `slate-400` on a light surface (2.6:1 at best on white), and `slate-600`, not `slate-500`, on a `slate-100` or
`slate-200` chip or track (`slate-500` there is 4.3:1 and 3.9:1). A test in `apps/live/lib/small-text-contrast.test.ts`
holds the class strings to it. White words on a coloured banner (the sign-in banner, a tour's offer and last card) sit on a colour white reads on at 5.9:1 or more, so their 90% white copy still clears 4.5:1: `brand-700` and darker, or a tab's accent deepened to it.

## Semantic colors

Reserved for status — never used decoratively.

| Role    | Light bg    | Foreground  | Notes                          |
| ------- | ----------- | ----------- | ------------------------------ |
| Success | `#D1FAE5`   | `#047857`   | Emerald (saves, confirmations) |
| Warning | `#FEF3C7`   | `#B45309`   | Amber (caution, soft alerts)   |
| Error   | `#FEE2E2`   | `#B91C1C`   | Rose (destructive, errors)     |
| Info    | `brand-100` | `brand-700` | Reuses the brand ramp          |

## Usage rules

- **Primary actions** (Save, Share, Create) use `brand-700` filled, white text. Hover → `brand-800`.
- **Solid brand fill with white text** (primary buttons, active segments, filled step circles, avatar discs, count
  badges, the closing call-to-action band) sits on `brand-700` in light mode, and a control hovers to `brand-800`: white
  on `#be123c` is 6.3:1 and on `#9f1239` 8.0:1, both above WCAG 2.2 AA's 4.5:1 for small text. Neither lighter step
  carries white text: white on `brand-500` is 3.7:1, and `brand-600` (4.7:1) stays the focus outline. Dark mode keeps its own pairing
  (`brand-600`, through `SOLID_BRAND_DARK` / `SOLID_BRAND_DARK_CONTROL`, [below](#rules)). `apps/live/app/light-palette.test.ts`
  reads every app's and package's source and fails a light `bg-brand-500` or `bg-brand-600` under white text. Tinted
  fills (`brand-500/10`) and decoration with no text on it (progress bars, dots, underlines) keep `brand-500`.
- **Secondary actions** use a `slate-200` border with `slate-700` text on white. No filled neutrals as buttons.
- **Brand ink** (links, the wordmark's "live" half, eyebrows, active pills and tabs, and glyphs that carry meaning:
  checks, row icons, icon chips on a `brand-50` / `brand-100` tint) is `brand-700` in light mode, and a hover that
  deepens it goes to `brand-800`. `brand-700` reads 6.3:1 on white, 5.7:1 on `brand-50` and 5.2:1 on `brand-100`;
  `brand-500` is 3.7:1 on white, under AA's 4.5:1 for small text, and `brand-600` (4.7:1 on white, 4.5:1 on `slate-50`)
  clears it only narrowly, so neither is ink.
  `apps/live/app/light-palette.test.ts` fails a light `text-brand-500` or `text-brand-600` in any app's or package's
  source, outside a short list of decorative uses with no text (a loading spinner, a drag ghost, a sparkline).
- **Links** are `brand-700` with underline on hover.
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

**slate-800 is a surface, not an edge.** It sits one step off slate-900, so a slate-900 card outlined in
slate-800 shows no edge in dark. A card on a slate-900 or slate-950 band takes a **slate-700** border; slate-800 stays
for hover surfaces, inputs and rules inside a card. On the marketing site `apps/marketing/lib/dark-card-borders.test.ts`
fails on a rounded, bordered slate-900 card outlined in slate-800 (the hero's editor mocks and the feature-card art are
exempt: they draw the editor's own chrome).

### Accent: the Steel ramp

In dark mode the brand ramp is **Steel**: the product accent muted to the saturation and lightness of the surfaces, so a
filled button reads as part of the chrome rather than a sticker on it. Each stop keeps the saturation and lightness of
livediagram's sky Steel and takes the hue of `rose-600`, so the ramp is a muted bronze.

| Token       | Dark value | Usage in dark mode                               |
| ----------- | ---------- | ------------------------------------------------ |
| `brand-50`  | `#faeef0`  | Text on brand-tinted fills                       |
| `brand-100` | `#f4dbdf`  | Hover text                                       |
| `brand-200` | `#eabcc4`  | Emphasised text                                  |
| `brand-300` | `#de9ba6`  | Brand text, badges                               |
| `brand-400` | `#e08f9d`  | Brand text and links, the lightest accent        |
| `brand-500` | `#bf5b6c`  | Rings, tinted fills (`brand-500/10`), decoration |
| `brand-600` | `#993a4a`  | **Solid fills under white text**                 |
| `brand-700` | `#842f3e`  | Hover on a solid fill                            |
| `brand-800` | `#6b2632`  | Deep accents                                     |
| `brand-900` | `#531d26`  | Deep accents                                     |
| `brand-950` | `#38141a`  | Deepest accent surfaces                          |

The wordmark's "live" half is the one vivid note: **rose-400 `#fb7185`** in dark mode. Light mode uses
`brand-700`, and the logo mark switches between its own light and dark prism palettes ([Brand mark](./brand-mark.md)).

### Rules

- **Solid brand fill with white text** (primary buttons, active segments, filled step circles, avatar discs, count
  badges) sits on `brand-600` in dark mode, and a control hovers to `brand-700`: white on `#993a4a` is 4.6:1, on `#842f3e` 5.8:1. The
  pairing lives in two shared class constants in `@livedesign/ui`, `SOLID_BRAND_DARK` for a static fill and
  `SOLID_BRAND_DARK_CONTROL` for a control, never re-typed per component. Rose at Steel's lightness is the
  lightest of the accents, so this is the rule's narrowest margin; a deeper Steel `brand-600` is the fix if it ever slips. In light mode the same fill is `brand-700`
  ([Usage rules](#usage-rules)).
- **The selected segment of a segmented control** (a two- or more-way switch, a tab strip drawn as segments) is
  that solid fill, in both appearances: `ACTIVE_SEGMENT` in `@livedesign/ui`. A fill that only lifts off the
  track (white on `slate-100`, `slate-900` on `slate-800`) is about 1.1:1 and does not mark a state; the
  selection is held to 3:1 against its track (WCAG 2.2 SC 1.4.11), measured in the Home switch's end-to-end test. The
  track is `SEGMENT_TRACK`, the deepest surface in dark mode (`slate-950`): `brand-600` reads 4.2:1 there, 3.6:1 on
  `slate-800`. In light mode the selection is `brand-700` on `slate-100`, 5.4:1.
- **White text on an identity colour** (avatar initials, cursor and presence labels, a comment author's disc, a
  team's tile: a participant's or team's colour under white text) sits on a **deeper shade of the same hue** in dark
  mode (`identityDeep`): each participant colour's own Tailwind 700 step (5.0 to 7.9:1 under white), and for any
  other colour the lightest darkening that reaches 4.5:1. White fails AA on all ten participant colours as they
  are. The text stays white, and light mode keeps the colour exactly. The colour is carried by the shared
  `identityVars` style and `IDENTITY_FILL` class, never an inline background, which the dark shade could not
  override.
- **Secondary text** in dark mode is `slate-400` or lighter (6.4:1 on `slate-900`). `slate-500` is for non-text only
  in dark mode: as text it is 3.4 to 3.9:1 on every dark surface.
- **Brand-coloured text** in dark mode is `brand-400` or lighter (`#e08f9d` on `slate-900` is 9.6:1).
- **Tinted fills** (`brand-500/10`, `brand-500/15`…) and purely decorative uses (spinners' tracks, glyph strokes on a
  tinted plate, shadows) keep their tokens: the Steel ramp restyles them by itself.
- **Themed tabs tint on top.** A tab on a colour scheme with an accent retargets the brand ramp (both appearances)
  and the dark surface stops ([Canvas and theme dialog](../011-theme/canvas-and-theme-dialog.md)); that tint
  outranks the Steel base by selector, not by stylesheet order, so the Steel palette is only ever what a Default tab
  shows.
- **Surfaces painted inline use the tokens.** The active tab pill paints its dark surface as `var(--color-slate-800)`,
  not a literal, so it follows the dark palette and a themed tab's tint.
- **Light mode is untouched.** No light token, class or colour changes with the dark palette.

### Explorer: Midnight

In dark mode the Explorer pages (`/explorer/*`) wear **Midnight**, the marketing site's night section, instead of
Steel: a deep navy ground and the vivid rose accent, so the Explorer reads as the front of the product. The account and
connect pages wear it too ([Night Band](../014-identity/auth-and-guest-access.md#the-look-night-band)). The editor, its
Explorer panel and every other page keep Steel.

- **How.** While the Explorer (or an account or connect page) is mounted, the design root carries `data-palette="midnight"`; under `.dark` that
  attribute retargets the same tokens Steel does (selector `.dark[data-palette='midnight']`, which outranks `.dark`).
  Menus, dialogs and tooltips opened from the Explorer portal to the body and so follow it too. The attribute is set
  before the first paint and removed when the page unmounts (`useMidnightPalette`, `apps/live/hooks/ui/`).
- **Surfaces**

  | Token       | Midnight  | Usage                                              |
  | ----------- | --------- | -------------------------------------------------- |
  | `slate-950` | `#070b1a` | Deepest wells, segment tracks                      |
  | `slate-900` | `#0a0f24` | The page, header, bottom bar                       |
  | `slate-800` | `#111833` | Cards, panels, inputs, the sidebar's current pill  |
  | `slate-700` | `#1f2a55` | Edges of cards on the page, hover surfaces         |
  | `slate-600` | `#2e3b6e` | Stronger edges                                     |
  | `slate-500` | `#56658f` | Non-text only, as in Steel                         |
  | `slate-400` | `#8f9cc4` | Secondary text: 7.0:1 on the page, 6.4:1 on a card |
  | `slate-300` | `#c3cde6` | Body text on cards                                 |
  | `slate-200` | `#dde4f3` | Emphasised text                                    |
  | `slate-100` | `#eef2fb` | Headings                                           |

- **Accent.** The brand ramp is light mode's rose from `brand-50` `#fff1f2` to `brand-500` `#f43f5e`, then one step
  deeper: `brand-600` `#be123c` (light mode's `brand-700`), `brand-700` `#9f1239`, `brand-800` `#881337`, `brand-900`
  `#5f0918` and `brand-950` `#4c0519`, so the Steel rules hold with their own numbers: a solid fill under white text is
  `brand-600` (5.9:1), it hovers to `brand-700` (7.1:1); brand text is `brand-400` (11.4:1 on the page, 10.5:1 on a
  card) or lighter; a selected segment on the `slate-950` track is 3.3:1.
- Every Steel rule above applies unchanged; only the values differ.

## Accessibility

- All text/background pairings must meet **WCAG AA** contrast (4.5:1 for body, 3:1 for large text and UI controls).
- `brand-500` on white fails AA for small text (3.7:1) and `brand-600` only just clears it (4.7:1); light brand ink is `brand-700` or darker
  ([Usage rules](#usage-rules)).
- **Muted text in light mode** is `slate-500` on white or `slate-50` (4.8:1, 4.6:1) and `slate-600` on `slate-100` or a
  tint, never `slate-400` (2.6:1), which stays for icons, placeholders and disabled controls. The public sites
  (marketing, help, telemetry), the New Design wizard and the editor's small and uppercase labels follow
  it ([#863](https://github.com/livedesign-app/livedesign.app/issues/863)), held by
  `apps/live/label-contrast.test.ts`, which fails a class string pairing a small size (`text-xs`, `text-sm`,
  `text-[9px]` to `text-[13px]`) or `uppercase` with a light-mode `text-slate-400`. Dark mode keeps `slate-400`.
- **The active tab's label** is its tab's accent, nudged (hue kept, 10% at a time toward black, or white in dark) until
  it reads at 4.5:1 on the pill's own surface, white or `slate-800` (`legibleColor`, `apps/live/lib/tab-accent.ts`).
- Never rely on color alone to convey status; pair semantic colors with an icon or label.
- **Contrast guard (dark mode).** A Playwright audit (`apps/live/e2e/contrast-audit.spec.ts`) walks every visible
  text node on the New Design wizard, the editor, its dialogs and panels, and the Explorer in dark mode, composites
  the real background under it, and fails below 4.5:1 (3:1 for large text: 24px, or 18.66px bold). It has no
  allow-list. It covers **dark mode only**: light mode's colours are owned by Thomas
  ([@tommcclean](https://github.com/tommcclean)) under [#74](https://github.com/livedesign-app/livedesign.app/issues/74).
- **Contrast guard (light mode, brand ramp).** #74's light half is settled: white text on a solid brand fill and brand
  ink on white are both `brand-700` ([Usage rules](#usage-rules)), held by `apps/live/app/light-palette.test.ts`, which
  reads every app's and package's source and checks the light ramp's ratios against white.

## Tailwind integration

The palette is exposed as a Tailwind v4 theme in `packages/tailwind-config/theme.css`. Apps consume it by importing the package alongside Tailwind itself in their `globals.css`:

```css
@import 'tailwindcss';
@import '@livedesign/tailwind-config';
```

The package's `theme.css` declares the brand ramp as CSS variables inside a `@theme` block, which Tailwind v4 turns into the `brand-50`…`brand-950` utility classes automatically:

```css
@theme {
  --color-brand-50: #fff1f2;
  --color-brand-100: #ffe4e6;
  --color-brand-200: #fecdd3;
  --color-brand-300: #fda4af;
  --color-brand-400: #fb7185;
  --color-brand-500: #f43f5e;
  --color-brand-600: #e11d48;
  --color-brand-700: #be123c;
  --color-brand-800: #9f1239;
  --color-brand-900: #881337;
  --color-brand-950: #4c0519;
}
```

Slate, success / warning / error utilities live on Tailwind's own defaults — only the `brand` ramp is custom.
