# Media assets

Binary and visual promotional assets: logos, screenshots, social cards,
demo recordings.

## Screenshots

Product screenshots of the live app at [livediagram.app](https://livediagram.app),
split by viewport so the desktop and mobile pitches stay independent. Each is
captioned with what it shows so copywriters can match it to a claim in
[`../copy/facts.md`](../copy/facts.md).

### Desktop (`desktop/`)

| File                | Shows                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing.png`       | The marketing landing page: "A picture tells a thousand words, tell your story" hero, the **Start drawing** CTA, and a mind-map editor preview below.                            |
| `explorer.png`      | The Explorer library (`/live/explorer`): folders (Unsorted, Management, Product) with diagram counts, the Recent / Folders / Image Gallery / Shared sidebar, New diagram/folder. |
| `new.png`           | The **Quick Start** new-diagram modal (`/live/new`): the template grid (Blank, Mind map, Org chart, Retrospective, Flowchart, Kanban, SWOT, Timeline) and the theme picker.      |
| `share.png`         | The **Share this diagram** dialog: editor vs view-only links, optional password gate, active links with copy, create-new-link.                                                   |
| `comments.png`      | A comment thread open on an element, the element toolbar, and the Comments panel listing comment-bearing elements.                                                               |
| `more.png`          | The element context menu: Duplicate, Edit link, Bring to front / Send to back, Add note, Comment.                                                                                |
| `settings.png`      | The Settings dialog with its grouped toggles: Canvas, Interface (Minimal panel layout), AI (AI Assistant), Privacy (anonymous usage events).                                     |
| `org-hierarchy.png` | An org-chart diagram (CEO to VPs to leads) in **dark mode**, with theme-coloured tabs.                                                                                           |
| `backlog.png`       | A Kanban sprint board (Backlog to Done) in dark mode, with the compact dock popover open.                                                                                        |
| `sprint-review.png` | A retrospective / Sprint Review board with per-person image-upload cards, and the Tab Activity log panel.                                                                        |

### Mobile (`mobile/`)

| File           | Shows                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `canvas.PNG`   | The mobile editor: a diagram on the canvas with the bottom dock visible.                         |
| `diagram.PNG`  | A diagram open on a phone, the dock collapsed so the canvas takes the full viewport.             |
| `explorer.PNG` | The Explorer library on mobile, with the diagram list and the sidebar accessible from the dock.  |
| `palette.PNG`  | The mobile palette popover open above the dock, showing the shapes / tools / devices accordions. |
| `search.PNG`   | The search panel on mobile, surfacing results across diagrams, folders, tabs, and elements.      |

## Guidance

- **Brand color** is sky blue `#0EA5E9` ("livediagram blue"). Page background
  `#F8FAFC`, canvas white. Full palette in [spec/01](../../specs/01-color-scheme.md).
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
```

Likely additions as the asset set grows:

```
media/
  logo/          wordmark + mark, SVG preferred, light + dark variants
  social/        Open Graph (1200x630) and other share-card sizes
  demo/          short screen recordings / GIFs
```
