# Specs

This folder is the **source of truth** for what livediagram is and how it works. Before building anything, check here. After every product decision, update or add a spec.

The numeric prefix is the suggested read order (purpose → constraints → architecture → apps).

## Index

| #   | Spec                                                               | Covers                                                             |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 00  | [Purpose](00-purpose.md)                                           | What the product is and who it's for                               |
| 01  | [Color scheme](01-color-scheme.md)                                 | Brand color and visual design tokens                               |
| 02  | [Build phase](02-prototype-scope.md)                               | Where we are now and what's still ahead                            |
| 03  | [Open source + distribution](03-open-source-and-business-model.md) | MIT license, self-host, hosted version. No paid tier.              |
| 04  | [Auth + guest access](04-auth-and-guest-access.md)                 | Clerk auth — but the canvas always works without sign-in           |
| 05  | [Diagram structure](05-diagram-structure.md)                       | Diagrams contain tabs; elements can link across tabs               |
| 06  | [Secrets policy](06-secrets-policy.md)                             | No secrets in source — the repo is public                          |
| 07  | [Live app](07-live-app.md)                                         | The diagram editor app at `/live`                                  |
| 08  | [Router app](08-router-app.md)                                     | Path-based routing across apps (`/` → marketing, `/live` → editor) |
| 09  | [Canvas + command palette](09-canvas-and-command-palette.md)       | Floating palette for adding shapes (square, circle) to the canvas  |
| 10  | [Deployment](10-deployment.md)                                     | GitHub Actions → Cloudflare Workers pipeline for all five apps     |
| 11  | [API app](11-api.md)                                               | REST + WebSocket API: D1 storage + Durable Object realtime room    |
| 12  | [Activity and audit log](12-activity-and-audit.md)                 | Per-diagram change log + Activity Panel UI + surgical revert       |
| 13  | [Per-tab storage](13-per-tab-storage.md)                           | Split tabs into their own D1 rows so autosave scope shrinks        |
| 14  | [New-diagram route](14-new-diagram-route.md)                       | Split the welcome / create-new flow off `/live` into `/live/new`   |
| 15  | [Folders](15-folders.md)                                           | Nested folders for diagrams in the Explorer; Unsorted default      |
| 16  | [Marketing site](16-marketing-site.md)                             | Landing page at `/`; claims must map to shipped features           |
| 17  | [Tab ↔ diagram many-to-many](17-tab-diagram-many-to-many.md)       | Link table so a tab can live in multiple diagrams                  |
| 18  | [Testing](18-testing.md)                                           | Vitest across the monorepo; shared config; co-located unit tests   |
| 19  | [Images](19-images.md)                                             | Image element + per-owner R2-backed gallery with dedupe            |
| 20  | [User preferences](20-user-preferences.md)                         | Per-user editor preference flags (footer settings dialog)          |
| 21  | [Comparison pages](21-comparison-pages.md)                         | `/alternatives/<tool>` SEO pages (Miro, XMind, Excalidraw, …)      |
| 22  | [Telemetry](22-telemetry.md)                                       | Anonymous first-party events in D1 + public `/telemetry` dashboard |
| 23  | [Marketing assets](23-marketing-assets.md)                         | `marketing/` folder: off-site copy + media for listings/promotion  |
| 24  | [Share password](24-share-password.md)                             | Optional per-diagram password gating share-link view + edit access |
| 25  | [AI assistance](25-ai-assistance.md)                               | Optional AI assistant (Build / Clean / Ask / Review) on the canvas |
| 26  | [Zen mode](26-zen-mode.md)                                         | Distraction-free focus mode: hide all chrome, keep canvas + zoom   |
| 27  | [Markdown import](27-markdown-import.md)                           | Import Markdown outlines (XMind etc.) into a themed tree diagram   |
| 28  | [Fonts](28-fonts.md)                                               | Eight Google Fonts, pickable per element + as a per-tab default    |

## Workflow

- A new feature, scope decision, or constraint goes into a spec **before** code.
- Reference specs by filename in PRs and discussions.
- If two specs conflict, that's the bug — fix the specs first, then the code.
- Keep specs terse but unambiguous. Update them when something changes; don't let them drift.
