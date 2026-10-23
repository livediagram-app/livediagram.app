# Media assets

Binary and visual promotional assets: logos, screenshots, social cards,
demo recordings.

## Screenshots

Product screenshots, split by viewport so the desktop and mobile pitches stay
independent. Each should be captioned with what it shows so copywriters can
match it to a claim in [`../copy/facts.md`](../copy/facts.md).

**Not yet checked.** The captions that used to sit here described livediagram
(a mind-map hero, Kanban and retrospective boards, an org chart, the old `/new`
template modal) and matched none of the files below, so they were removed.
Before using a file, open it and check it shows livedocuments as it is today:
articles, slide decks and infographics. Retake anything showing diagrams,
whiteboards, boards, sheets or removed chrome, then add a caption here.

### Desktop (`desktop/`)

- `API_Tokens.png`
- `collaborate.png`
- `comments.png`
- `editor_1.png`
- `editor_2_animation.png`
- `editor_dark.png`
- `editor_dark_context.png`
- `editor_flowchart.png`
- `editor_generated.png`
- `editor_new_template.png`
- `editor_new_theme.png`
- `editor_wireframe.png`
- `help_1.png`
- `help_2.png`
- `isometric.png`
- `landing_page.png`
- `landing_page_2.png`
- `recent_1.png`
- `recent_2_cards.png`
- `search.png`
- `share.png`
- `spotlight.png`
- `teams.png`
- `telemetry_1.png`
- `telemetry_2.png`

### Mobile (`mobile/`)

- `article.PNG`
- `context.PNG`
- `editor.PNG`
- `editor_dark.PNG`
- `editor_recent.PNG`
- `help.PNG`
- `landing.PNG`
- `new_template.PNG`
- `new_theme.PNG`
- `recent.PNG`
- `search.PNG`
- `teams.PNG`
- `telemetry.PNG`

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

`pnpm icons:brand` (`apps/live/scripts/brand-icons/render.mjs`) regenerates every static copy from the
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
  desktop/       desktop product screenshots (see table above)
  mobile/        mobile product screenshots (see table above)
  icons/         the brand mark as PNGs (see table above)
  logo/          the mark and lockup as SVG, light + dark (see table above)
```

Likely additions as the asset set grows:

```
media/
  social/        Open Graph (1200x630) and other share-card sizes
  demo/          short screen recordings / GIFs
```
