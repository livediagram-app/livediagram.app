# Media assets

Binary and visual promotional assets: logos, screenshots, social cards,
demo recordings.

## Screenshots

Product screenshots of the editor app at [livediagram.app](https://livediagram.app),
split by viewport so the desktop and mobile pitches stay independent. Each is
captioned with what it shows so copywriters can match it to a claim in
[`../copy/facts.md`](../copy/facts.md).

Most of these show an older Explorer, telemetry page and editor chrome: today the Explorer and the telemetry
dashboard are liveworkspace.app's, and livediagram has no Pages or Plan modes. Retake a shot before using it for a
claim about those surfaces.

### Desktop (`desktop/`)

| File                      | Shows                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `landing_page.png`        | The marketing landing page: the "A picture tells a thousand words, tell your story" hero, **Start drawing**, a live preview. |
| `landing_page_2.png`      | A landing-page feature block: "Draw, write, and annotate" (freehand that snaps to shapes, rich text, notes).                 |
| `editor_flowchart.png`    | The editor with the "Lost & Found Process" flowchart, the Explorer panel, the palette and the minimap.                       |
| `collaborate.png`         | The same flowchart shared, with a teammate's cursor and avatars, and the Technology palette open.                            |
| `comments.png`            | A comment thread open on the "Show error" step, and the Comments panel listing it.                                           |
| `editor_1.png`            | A mind map ("Our product") in a warm theme.                                                                                  |
| `editor_2_animation.png`  | The same mind map with an element's menu open on its Animation choices.                                                      |
| `editor_dark.png`         | A "Growth flywheel" cycle in a dark theme.                                                                                   |
| `editor_dark_context.png` | The dark flywheel with a selected square's menu open, and the old Tab Activity panel.                                        |
| `spotlight.png`           | Spotlight mode on the dark flywheel: the canvas dimmed round the element under the cursor.                                   |
| `isometric.png`           | The flowchart in the Isometric view, raised into 3D blocks.                                                                  |
| `search.png`              | The search panel over the dark flywheel, searching "tab": tabs, actions, elements to add and help articles.                  |
| `share.png`               | The **Share this diagram** dialog: Edit or View only links, expiry, an active link with Embed and Live image, a password.    |
| `editor_new_template.png` | The **New Diagram** wizard's template step: Blank, Mind maps, Flowcharts, Hierarchies, Agile and more.                       |
| `editor_new_theme.png`    | The wizard's theme step: Basic, Formal, Cool, Warm, Dark, Multi-colour and Custom.                                           |
| `recent_1.png`            | The old full-page Explorer's Recent view, empty.                                                                             |
| `recent_2_cards.png`      | The old Explorer's Recent view as cards: the flywheel, the flowchart and the mind map.                                       |
| `editor_generated.png`    | The old Explorer's Generated view, empty, offering to set up an AI agent.                                                    |
| `teams.png`               | The old Explorer's team page ("Web Team"): its member, invite by link and the team's folders.                                |
| `API_Tokens.png`          | The old Explorer's API tokens page with two active tokens.                                                                   |
| `help_1.png`              | The help centre's home: "How can we help?" search and the category cards.                                                    |
| `help_2.png`              | A help article ("Spotlight") with its contents sidebar.                                                                      |
| `telemetry_1.png`         | The old telemetry page ("Telemetry, in the open"): daily volume and its tabs.                                                |
| `telemetry_2.png`         | The old telemetry page's Palette tab: what people reach for in the palette.                                                  |

### Mobile (`mobile/`)

These need retaking too: they show Explorer and Palette buttons, where the phone now has the Toolbar layout (the
palette as one strip across the top, the Explorer behind a menu button).

| File                | Shows                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| `landing.PNG`       | The marketing landing page's hero on a phone.                                           |
| `editor.PNG`        | The flowchart on a phone, a teammate's cursor on "Create account" and a comment marker. |
| `editor_dark.PNG`   | The dark flywheel on a phone.                                                           |
| `editor_recent.PNG` | The flowchart with the Explorer popover open on Recent.                                 |
| `context.PNG`       | The mind map with an element's menu open on its Presets.                                |
| `search.PNG`        | The search panel: documents, shared, teams, tabs and elements.                          |
| `new_template.PNG`  | The New Diagram wizard's template step.                                                 |
| `new_theme.PNG`     | The wizard's theme step.                                                                |
| `recent.PNG`        | The old Explorer's Recent view as cards.                                                |
| `teams.PNG`         | The old Explorer's team page.                                                           |
| `help.PNG`          | The help centre's Features categories.                                                  |
| `article.PNG`       | A help article ("Explorer Panel").                                                      |
| `telemetry.PNG`     | The old telemetry page's metric cards.                                                  |

## Logo (`logo/`)

The Living Prism ([Brand mark](../../docs/specs/004-interface-design/brand-mark.md)), as SVG.

| File                                | What it is                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `livediagram-mark-{light,dark}.svg` | The full mark (inner diagram, sheen, signal pulse) for light or dark grounds. |
| `livediagram-logo-{light,dark}.svg` | The horizontal lockup: mark plus `livediagram` wordmark, `live` accented.     |

The lockup's wordmark is live text in the system UI font; outline it in a design tool before print use.

## Icons (`icons/`)

The brand mark as PNGs, drawn in its light palette: the compact drawing below 48px, the full one from 48px.

| File                                   | Background                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `livediagram-icon-{256,512,1024}.png`  | White. For surfaces that show the icon as a tile, such as social previews.                                       |
| `livediagram-icon-transparent-<n>.png` | Transparent, at 16, 32, 64, 128, 256 and 512. For surfaces that draw their own background, such as Google Drive. |

`pnpm icons:brand` (`apps/editor/scripts/brand-icons/render.mjs`) regenerates every static copy from the
brand module in `@livediagram/ui`: the apps' `app/icon.svg` favicons, `logo/`, and both PNG sets (the white ones
also into `apps/marketing/public/`), rasterised by Playwright's Chromium. A test fails if a committed SVG drifts.

## Guidance

- **Brand color** is sky blue `#0EA5E9` ("livediagram blue"); the logo has its own sky-to-indigo prism palette. Page background
  `#F8FAFC`, canvas white. Full palette in [Theme](../../docs/specs/004-interface-design/color-scheme.md).
- **Show, don't tell.** Screenshots should feature a real diagram with visible
  multiplayer cursors, since "no sign-in, real-time" is the pitch.
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
