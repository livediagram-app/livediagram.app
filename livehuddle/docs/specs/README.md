# Specs

Follow the references below only as needed; never upfront.

This folder is the **source of truth** for what livehuddle is and how it works. Before building anything, check
here. After every product decision, update or add a spec.

**Status: forked.** The product spec written for the owner's approval (Work Tracker #99) sets where livehuddle is
going: its [vision](./001-project-vision/purpose.md), [v1 scope](./002-project-scope/v1-scope.md),
[apps and storage](./003-system-architecture/apps-and-storage.md), [roadmap](./005-project-roadmap/README.md),
[share roles](./013-workspace/share-roles.md) and [platform registration](./016-platform/platform-registration.md).
Every other spec was forked from livediagram's at the commit the code was (`.forked-from`, `fd73b2c921`), with the
code fork's renames, so it describes the code as forked less the cuts made so far (Diagram and Draw modes went in step 5.1): Event
Storming, the Community and the rest are still here until their cuts ([Build plan](./005-project-roadmap/build-plan.md) step 5).
Each cut removes its specs in the same PR as its code, so the tree never describes a feature livehuddle no longer
has. The decisions still open are in [Open decisions for the owner](./005-project-roadmap/open-decisions.md).

Specs live in numbered category folders: the reserved `001`-`005` first (vision, scope, architecture, interface
design, roadmap), then one folder per domain concept, numbered as livediagram numbers them so a forked spec keeps its
place. The specs themselves are unnumbered and named by subject.

## Categories

- ./001-project-vision/README.md - when you need the why: the problem, audience and value proposition, and what livehuddle is not
- ./002-project-scope/README.md - when deciding what is in or out: the v1 features, the non-goals and the apps livehuddle ships; licence, distribution, third-party licences, vulnerability disclosure, hard constraints
- ./003-system-architecture/README.md - when touching where livehuddle keeps its data or how its apps fit together (one Durable Object per space, no D1), source layout, the test setup, console logging, or cross-cutting code structure
- ./004-interface-design/README.md - when working on the visual language: colour, fonts, motion, accessibility, shared UI mechanics
- ./005-project-roadmap/README.md - when asking how livehuddle gets built, what comes after v1 (audio, video, screen sharing), what the owner still has to decide, and what the forked code holds today
- ./006-document/README.md - when working on the document model and its domain language: tabs, tab kinds, layers, storage, snapshots, offline documents, stroke points
- ./007-editor/README.md - when working on the live editor shell: routes, editor modes, side by side tabs, preferences, power user mode, panels, tours (incl. Show Me), AI, command palette
- ./008-canvas/README.md - when working on canvas tools and gestures: drawing, arrows, snapping, sizing, corner radius, finishes (Flexible / Professional / Sketch / Marker), tool panels and the Quick Style Panel
- ./009-elements/README.md - when adding or changing an element kind or its content
- ./010-palette/README.md - when working on the palette: categories, per-mode layouts and Popular, icon and sticker catalogues, presets
- ./011-theme/README.md - when working on tab themes: built-in and multi-colour themes
- ./012-collaboration/README.md - when working on realtime, sessions, facilitation, comments, actions or room tools
- ./013-workspace/README.md - when gating any feature by share role (Editor, Participant and Viewer in livehuddle), or working on the Explorer, its filters, folders, default folders, teams, favourites, tags, shape libraries, share links, the Trash or the empty document clean-up
- ./014-identity/README.md - when working on auth, guest access, profiles or account email
- ./015-api/README.md - when working on the api worker, its OpenAPI document, tokens, the MCP server or the CLI
- ./016-platform/README.md - when registering livehuddle with liveworkspace (sites, accounts, index, telemetry, media, CI, DNS and the 3500 port block), or working on routing, deployment or the staging environment, the new version prompt and stale builds, or web performance (what a page loads up front)
- ./017-telemetry/README.md - when adding or changing anonymous events or the telemetry dashboard
- ./018-help/README.md - when working on the help centre or contextual help links
- ./019-marketing/README.md - when working on the marketing site, comparison pages or outbound assets
- ./020-import-export/README.md - when working on Markdown, Mermaid, Excalidraw or draw.io import/export, pasting from Excalidraw, imported images, board scenes and board imports from Miro or Microsoft Whiteboard, or export fidelity
- ./022-drive-mirror/README.md - when looking for livehuddle's Google Drive sync (now liveworkspace's, for every app)
- ./024-agents/README.md - when an agent reads, writes or comments on documents: changesets, presence, views, edit operations, lint
- ./025-community/README.md - when working on Community: publishing documents to the public gallery, the Community app, likes, copies, and reports (moderation by reports alone)
- ./028-animation/README.md - when working on element animations: the animation set each element takes (Shape, Text, Sticky, Drawing, Media, Table), the per-set menu categories, reveals, loops and the quality bar

## Workflow

- A new feature, scope decision, or constraint goes into a spec **before** code.
- Reference specs by filename in PRs and discussions.
- If two specs conflict, that's the bug: fix the specs first, then the code.
- A cut (build plan step 5) removes the specs of what it removes, in the same PR as the code.
- Keep specs terse but unambiguous. Update them when something changes; don't let them drift.
