# Media assets

Binary and visual promotional assets: logos, screenshots, social cards,
demo recordings.

## Screenshots

Product screenshots of the live app at [liveplanner.app](https://liveplanner.app),
split by viewport so the desktop and mobile pitches stay independent. Each is
captioned with what it shows so copywriters can match it to a claim in
[`../copy/facts.md`](../copy/facts.md).

**To be re-shot.** Every screenshot below was taken before liveplanner became a
planner, so it shows diagram canvases, diagram templates or the old sky-blue
accent. Treat them as placeholders: retake each one in liveplanner (a project
with Board, Sheet, Dashboard and Form tabs, violet accent) before using it, and
delete the old file when its replacement lands. The diagram-only shots
(flowchart, wireframe, isometric, spotlight, animation, article) have already
been removed.

### Desktop (`desktop/`)

| File                      | Re-shoot as                                                                    |
| ------------------------- | ------------------------------------------------------------------------------ |
| `landing_page.png`        | The marketing home page hero, with its template fan.                           |
| `landing_page_2.png`      | A landing story beat (boards, sheets or forms) further down the home page.     |
| `editor_1.png`            | A project open on a Board tab: columns, cards, WIP limits, live cursors.       |
| `editor_dark.png`         | The same board in dark mode.                                                   |
| `editor_dark_context.png` | A card's context menu or detail panel, in dark mode.                           |
| `editor_generated.png`    | A board or sheet an AI agent filled in over MCP.                               |
| `editor_new_template.png` | Start Planning: the template step with Plan templates (boards, sheets, forms). |
| `editor_new_theme.png`    | A Dashboard tab of live slots (board, sheet, chart, note).                     |
| `collaborate.png`         | Two or three people in one project, presence avatars and selections showing.   |
| `comments.png`            | A comment thread open on a card, with an @mention.                             |
| `share.png`               | The Share dialog: editor, participant and view-only links, expiry.             |
| `teams.png`               | A team and its shared folder of projects.                                      |
| `recent_1.png`            | The Explorer's Home: recent projects and what happened.                        |
| `recent_2_cards.png`      | The Explorer's project cards in a folder.                                      |
| `search.png`              | Search across projects, tabs and cards.                                        |
| `API_Tokens.png`          | The API tokens settings page used by MCP and the CLI.                          |
| `help_1.png`              | The help centre home.                                                          |
| `help_2.png`              | A Plan help article (boards, sheets or forms).                                 |
| `telemetry_1.png`         | The anonymous usage telemetry page.                                            |
| `telemetry_2.png`         | The same, scrolled to its charts.                                              |

### Mobile (`mobile/`)

| File                | Re-shoot as                                       |
| ------------------- | ------------------------------------------------- |
| `landing.PNG`       | The marketing home page on a phone.               |
| `editor.PNG`        | A Board tab on a phone, columns scrolling across. |
| `editor_dark.PNG`   | The same board in dark mode.                      |
| `editor_recent.PNG` | A Sheet tab on a phone.                           |
| `context.PNG`       | A card's detail on a phone.                       |
| `new_template.PNG`  | Start Planning on a phone.                        |
| `new_theme.PNG`     | A public form, as someone answering it sees it.   |
| `recent.PNG`        | The Explorer on a phone.                          |
| `search.PNG`        | Search on a phone.                                |
| `teams.PNG`         | Teams on a phone.                                 |
| `help.PNG`          | The help centre on a phone.                       |
| `telemetry.PNG`     | The telemetry page on a phone.                    |

## Logo (`logo/`)

The Living Prism ([Brand mark](../../docs/specs/004-interface-design/brand-mark.md)), as SVG.

| File                                | What it is                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `liveplanner-mark-{light,dark}.svg` | The full mark (inner prism, sheen, signal pulse) for light or dark grounds. |
| `liveplanner-logo-{light,dark}.svg` | The horizontal lockup: mark plus `liveplanner` wordmark, `live` accented.   |

The lockup's wordmark is live text in the system UI font; outline it in a design tool before print use.

## Icons (`icons/`)

The brand mark as PNGs, drawn in its light palette: the compact drawing below 48px, the full one from 48px.

| File                                   | Background                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `liveplanner-icon-{256,512,1024}.png`  | White. For surfaces that show the icon as a tile, such as social previews.                 |
| `liveplanner-icon-transparent-<n>.png` | Transparent, at 16, 32, 64, 128, 256 and 512. For surfaces that draw their own background. |

`pnpm icons:brand` (`apps/live/scripts/brand-icons/render.mjs`) regenerates every static copy from the
brand module in `@liveplanner/ui`: the apps' `app/icon.svg` favicons, `logo/`, and both PNG sets (the white ones
also into `apps/marketing/public/`), rasterised by Playwright's Chromium. A test fails if a committed SVG drifts.

## Guidance

- **Brand colour** is violet `#8B5CF6` ("liveplanner violet"); the logo has its own violet-to-purple prism palette.
  Page background `#F8FAFC`. Full palette in [Theme](../../docs/specs/004-interface-design/color-scheme.md).
- **Show, don't tell.** Screenshots should feature a real plan (a board with
  cards that look like a team's actual work) with visible multiplayer
  presence, since "no sign-up, real-time" is the pitch.
- **Say "project" in captions**, never "document".
- **Keep claims current.** When the UI changes, retake the affected screenshot:
  a stale shot that shows a removed control is worse than none.
- **Keep large binaries out of git where practical.** Prefer SVG for logos and
  optimised PNG/WebP for screenshots. If files get heavy, consider storing them
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
