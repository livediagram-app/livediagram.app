# Help app

A standalone help centre at `/help`, modelled on the Manager Toolkit help centre but with livediagram's information architecture, content, and brand.

## Why

The editor is friction-free and discoverable, but there's no place that explains features in depth, answers "how do I…", or covers account/privacy/self-hosting questions. A searchable help centre fills that gap and doubles as SEO surface (every article is an indexable static page).

## Shape

A new Next.js app, `apps/help`, deployed as the `livediagram-help` Worker and stitched in by the router under `/help` — the same pattern as `apps/telemetry` (see [spec/08](08-router-app.md), [spec/22](22-telemetry.md)):

- `output: 'export'`, `basePath: '/help'`, `assetPrefix: '/help'`. Static only, no SSR (see [hard constraints](../CLAUDE.md)).
- The router strips `/help` and forwards to the worker, which serves `./out`.
- Content is **MDX** (`@next/mdx`) plus a TypeScript article index (`lib/articles.ts`). Navigation/index pages are TSX.

It behaves **exactly like the Manager Toolkit help centre**: hero + client-side search, a category grid, a "Feature Guides" grid, article pages with an auto-generated table of contents, breadcrumbs, "Was this helpful?" feedback, reading time, related-guide sidebar, and a back-to-top button. The difference is the categories/content (livediagram's) and the **brand**: livediagram is light + sky-blue (`brand-500`, see [spec/01](01-color-scheme.md)), not MT's dark purple, so every surface uses the shared `@livediagram/tailwind-config` brand ramp and slate neutrals to match `apps/marketing` and `apps/telemetry`.

### No paid tier

livediagram is free and MIT-licensed with no plan for a paid tier (see [spec/03](03-open-source-and-business-model.md)). So the help centre has **no "Accounts and Billing" category and no "Pro" callouts**. Instead it carries a **Self-hosting** category, reflecting that anyone can run their own instance.

## Information architecture

`lib/articles.ts` is the single source of truth for categories and articles. Two flat arrays (`categories`, `articles`) plus helpers (`getArticlesByCategory`, `getCategoryGroups`, `getSubArticles`, `searchArticles`). An article's `categorySlug` is its full nested path (e.g. `canvas/the-canvas`); `parentSlug` links a sub-article to its feature landing page.

**Sub-category grouping.** A feature category's landing cards can be split into labelled sub-category sections on its index page via an optional `group` field on each landing (e.g. Palette's `Selection Modes` / `Elements` / `Palette Settings`). `getCategoryGroups` buckets the category's landings by `group` in first-appearance order, and `FeatureCategoryIndex` renders one card grid per group under a heading. Landings without a `group` render in a single ungrouped grid, so other feature categories are unchanged.

Categories fall into two kinds. The **support** categories carry standalone articles; the **feature** categories (`kind: 'feature'`) carry the in-depth feature guides and are grouped under a separate "Feature Guides" heading on the home page and the `/features` index. Each feature category has a card-grid index page at `/help/<slug>/` (shared `FeatureCategoryIndex` component), and within it each feature has its own landing page plus optional sub-articles.

| slug                   | title                | icon      | kind    |
| ---------------------- | -------------------- | --------- | ------- |
| `about`                | About livediagram    | info      | support |
| `getting-started`      | Getting Started      | rocket    | support |
| `tips-and-tricks`      | Tips and Tricks      | lightbulb | support |
| `account-and-data`     | Account and Data     | user      | support |
| `privacy-and-security` | Privacy and Security | shield    | support |
| `self-hosting`         | Self-Hosting         | server    | support |
| `troubleshooting`      | Troubleshooting      | wrench    | support |
| `supported-devices`    | Supported Devices    | devices   | support |
| `contact`              | Contact              | mail      | support |
| `explorer`             | Explorer             | folder    | feature |
| `palette`              | Palette              | palette   | feature |
| `canvas`               | Canvas               | frame     | feature |
| `tabs`                 | Tabs                 | tabs      | feature |
| `customisation`        | Customisation        | swatch    | feature |
| `collaboration`        | Collaboration        | users     | feature |
| `activity-panel`       | Activity Panel       | activity  | feature |
| `tools`                | Tools                | tools     | feature |
| `search-panel`         | Search Panel         | search    | feature |

The feature categories group the feature guides by area:

- **Explorer** — the diagram library (explorer/15, teams/32+35): The Explorer overview, Recent, Shared with you, My Work and folders, Team Spaces, Image Gallery, and Saved Themes, one guide per sidebar section.
- **Palette** — the floating palette, in three sub-categories grouped on the index (see "Sub-category grouping" below): **Selection Modes** (one guide per tool-picker mode: Select, Hand, Eraser, Format Painter, Laser, Spotlight, Isometric), **Elements** (one guide per palette tab: Shapes (+ shape markers), Arrows (+ arrow styles, curve/elbow handles, arrow-to-arrow), Tools (+ drawing/shape-recognition, images, data elements 46+51+52+53), Components, Devices, Icons, Technology 41), and **Palette Settings** (one guide per gear-menu setting: Auto-Attach Arrows, Alignment Guides, Minimal Panels, Reset Palette Position).
- **Canvas** — the infinite canvas (09), selecting and grouping (selection/groups), links and link cards (40), annotations (38).
- **Tabs** — multiple boards (13+17+30): Tabs, Tab Folders, Linking Across Tabs, Add a Tab to Another Diagram, Importing (27), Exporting, and Cleanup (47), one guide per tab-menu action.
- **Customisation** — themes (29+42+44), templates, style presets (48), text and fonts (28), isometric (45).
- **Collaboration** — comments, live presence (07: live cursors / selections / per-tab presence), teams (32+35), sharing and embeds (24+33+34), session tools (39).
- **Activity Panel** — the per-diagram change log (12) promoted to its own category: What it is, How it works, Undo, Redo, and Reverting a change, one guide each.
- **Tools** — AI assistance (25), zen mode (26), light/dark UI mode (07), Markdown import (27), layout cleanup (47).
- **Search Panel** — the global search (09): an overview landing plus sub-articles for each thing search does, finding diagrams/folders, teams, tabs and elements, adding palette items to the canvas, and the Create-new-tab action.

Where a feature's name would equal its category slug, the landing slug is distinguished (`the-canvas`, `the-explorer`, `using-tabs`) so a feature slug never equals a category slug (which would break the breadcrumb's parent link).

There is **no Presentation Mode guide**: spec/31 is a draft and the feature is not built, so the article was unpublished rather than ship documentation for a non-existent feature.

## In-editor entry point

The editor's `TabBar` gains a **Help** link on its right edge, beside the existing GitHub link — a plain `<a href="/help/" target="_blank">` (same convention as the GitHub link, no editor-page wiring). It fires `track('UI', 'Opened', 'Help')` (see [spec/22](22-telemetry.md); reuses existing `UI`/`Opened` enum pair). A "Help" link also lives in the help app's own header/footer.

## Analytics

The help app is a static site outside the editor, so it does not use the editor's first-party telemetry pipeline. It emits nothing by default (no third-party scripts), keeping it self-host-clean. The in-editor Help link is the only telemetry touchpoint, via the existing pipeline.

## Deployment

A `deploy-help` job in `.github/workflows/deploy.yml` mirrors `deploy-telemetry` (build artifact → `wrangler deploy`). The router's `deploy-router` job already depends on the static apps; it gains a dependency on `deploy-help`, and `apps/router/wrangler.toml` gains a `HELP` service binding to `livediagram-help`.

## Out of scope (for now)

- Contextual deep-links from specific editor dialogs to specific articles (MT's modal `?` buttons). The single editor Help link covers the entry point; per-dialog links can come later.
- Help results inside the editor's palette / search.
