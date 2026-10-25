# Media assets

Binary and visual promotional assets: logos, screenshots, social cards,
demo recordings.

## Screenshots

Product screenshots, split by viewport so the desktop and mobile pitches stay
independent. Each should be captioned with what it shows so copywriters can
match it to a claim in [`../copy/facts.md`](../copy/facts.md).

None yet. The ones the fork brought from livediagram showed livediagram (its
flowcharts, mind maps, wireframes and Explorer), so they were removed. Take new
ones of livedocuments as it is today (articles, slide decks and infographics)
into `desktop/` and `mobile/`, and caption each here.

## Logo (`logo/`)

The Living Prism ([Brand mark](../../docs/specs/004-interface-design/brand-mark.md)), as SVG.

| File                                  | What it is                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `livedocuments-mark-{light,dark}.svg` | The full mark (inner diagram, sheen, signal pulse) for light or dark grounds. |
| `livedocuments-logo-{light,dark}.svg` | The horizontal lockup: mark plus `livedocuments` wordmark, `live` accented.   |

The lockup's wordmark is live text in the system UI font; outline it in a design tool before print use.

## Icons (`icons/`)

The brand mark as PNGs, drawn in its light palette: the compact drawing below 48px, the full one from 48px.

| File                                     | Background                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `livedocuments-icon-{256,512,1024}.png`  | White. For surfaces that show the icon as a tile, such as social previews.                 |
| `livedocuments-icon-transparent-<n>.png` | Transparent, at 16, 32, 64, 128, 256 and 512. For surfaces that draw their own background. |

`pnpm icons:brand` (`apps/editor/scripts/brand-icons/render.mjs`) regenerates every static copy from the
brand module in `@livedocuments/ui`: the apps' `app/icon.svg` favicons, `logo/`, and both PNG sets (the white ones
also into `apps/marketing/public/`), rasterised by Playwright's Chromium. A test fails if a committed SVG drifts.

## Guidance

- **Brand color** is amber `#F59E0B` ("livedocuments amber"); the logo has its own amber-to-orange prism palette. Page background
  `#F8FAFC`, canvas white. Full palette in [Theme](../../docs/specs/004-interface-design/color-scheme.md).
- **Show, don't tell.** Screenshots should feature a real article, deck or
  infographic with visible multiplayer cursors, since "made together, live" is
  the pitch.
- **Keep claims current.** When the UI changes, retake the affected screenshot:
  a stale shot that shows a removed control is worse than none.
- **Keep large binaries out of git where practical.** Prefer SVG for logos and
  optimized PNG/WebP for screenshots. If files get heavy, consider storing them
  outside the repo and linking instead.
- Caption every asset above with what it shows so copywriters can match it to a
  claim in [`../copy/facts.md`](../copy/facts.md).

Current layout:

```
media/
  README.md      this file
  icons/         the brand mark as PNGs (see table above)
  logo/          the mark and lockup as SVG, light + dark (see table above)
```

Likely additions as the asset set grows:

```
media/
  desktop/       desktop product screenshots, captioned
  mobile/        mobile product screenshots, captioned
  social/        Open Graph (1200x630) and other share-card sizes
  demo/          short screen recordings / GIFs
```
