# Specs

This folder is the **source of truth** for what livediagram is and how it works. Before building anything, check here. After every product decision, update or add a spec.

The numeric prefix is the suggested read order (purpose → constraints → architecture → apps).

## Index

| #   | Spec                                                                 | Covers                                                             |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 00  | [Purpose](00-purpose.md)                                             | What the product is and who it's for                               |
| 01  | [Color scheme](01-color-scheme.md)                                   | Brand color and visual design tokens                               |
| 02  | [Prototype scope](02-prototype-scope.md)                             | What's in/out for the current build phase                          |
| 03  | [Open source + business model](03-open-source-and-business-model.md) | MIT license, self-host, hosted Pro subscription                    |
| 04  | [Auth + guest access](04-auth-and-guest-access.md)                   | Clerk auth — but the canvas always works without sign-in           |
| 05  | [Diagram structure](05-diagram-structure.md)                         | Diagrams contain tabs; elements can link across tabs               |
| 06  | [Secrets policy](06-secrets-policy.md)                               | No secrets in source — the repo is public                          |
| 07  | [Live app](07-live-app.md)                                           | The diagram editor app at `/live`                                  |
| 08  | [Router app](08-router-app.md)                                       | Path-based routing across apps (`/` → marketing, `/live` → editor) |
| 09  | [Canvas + command palette](09-canvas-and-command-palette.md)         | Floating palette for adding shapes (square, circle) to the canvas  |
| 10  | [Deployment](10-deployment.md)                                       | GitHub Actions → Cloudflare Workers pipeline for all four apps     |
| 11  | [API app](11-api.md)                                                 | REST + WebSocket API: D1 storage + Durable Object realtime room    |
| 12  | [Activity and audit log](12-activity-and-audit.md)                   | Per-diagram change log + Activity Panel UI + surgical revert       |
| 13  | [Per-tab storage](13-per-tab-storage.md)                             | Split tabs into their own D1 rows so autosave scope shrinks        |
| 14  | [New-diagram route](14-new-diagram-route.md)                         | Split the welcome / create-new flow off `/live` into `/live/new`   |

## Workflow

- A new feature, scope decision, or constraint goes into a spec **before** code.
- Reference specs by filename in PRs and discussions.
- If two specs conflict, that's the bug — fix the specs first, then the code.
- Keep specs terse but unambiguous. Update them when something changes; don't let them drift.
