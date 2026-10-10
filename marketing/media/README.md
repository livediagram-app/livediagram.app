# Media assets

Binary and visual promotional assets: logos, screenshots, social cards,
demo recordings.

## Screenshots

Product screenshots of the live app at [livediagram.app](https://livediagram.app),
split by viewport so the desktop and mobile pitches stay independent. Each is
captioned with what it shows so copywriters can match it to a claim in
[`../copy/facts.md`](../copy/facts.md).

### Desktop (`desktop/`)

| File                | Shows                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing.png`       | The marketing landing page: "A picture tells a thousand words, tell your story" hero, the **Start drawing** CTA, and a mind-map editor preview below.                                  |
| `explorer.png`      | The Explorer library (`/live/explorer`): folders (Unsorted, Management, Product) with document counts, the Recent / Folders / Image Gallery / Shared sidebar, New diagram/folder.      |
| `new.png`           | The **Quick Start** new-document modal (`/live/new`): the template grid (Blank, Mind map, Org chart, Retrospective, Flowchart, Kanban, SWOT, Timeline) and the theme picker.           |
| `share.png`         | The **Share this diagram** dialog: editor vs view-only links, optional password gate, active links with copy, create-new-link.                                                         |
| `comments.png`      | A comment thread open on an element, the element toolbar, and the Comments panel listing comment-bearing elements.                                                                     |
| `more.png`          | The element context menu: Duplicate, Edit link, Bring to front / Send to back, Add note, Comment.                                                                                      |
| `settings.png`      | The Settings dialog with its grouped toggles: Canvas, Interface, AI (AI Assistant), Privacy (anonymous usage events). Stale: it shows the removed Minimal panel layout toggle; retake. |
| `org-hierarchy.png` | An org-chart diagram (CEO to VPs to leads) in **dark mode**, with theme-coloured tabs.                                                                                                 |
| `backlog.png`       | A Kanban sprint board (Backlog to Done) in dark mode. Stale: it shows the removed Minimal layout's dock popover; retake.                                                               |
| `sprint-review.png` | A retrospective / Sprint Review board with per-person image-upload cards. Stale: it shows the removed Tab Activity panel; retake.                                                      |

### Mobile (`mobile/`)

Stale: these predate the phone's Toolbar layout (the palette as one strip across the top, the Explorer behind a menu button) and show the old dock chrome, which is gone. Retake them.

| File           | Shows                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `canvas.PNG`   | The mobile editor: a diagram on the canvas with the bottom dock visible.                         |
| `diagram.PNG`  | A diagram open on a phone, the dock collapsed so the canvas takes the full viewport.             |
| `explorer.PNG` | The Explorer library on mobile, with the document list and the sidebar accessible from the dock. |
| `palette.PNG`  | The mobile palette popover open above the dock, showing the shapes / tools / devices accordions. |
| `search.PNG`   | The search panel on mobile, surfacing results across documents, folders, tabs, and elements.     |

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

`pnpm icons:brand` (`apps/live/scripts/brand-icons/render.mjs`) regenerates every static copy from the
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
