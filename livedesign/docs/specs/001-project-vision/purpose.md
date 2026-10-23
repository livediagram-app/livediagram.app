# Purpose

livedesign is a web app where teams make **designs of pages together, in real time**: logos, wireframes and
photos.

This is the root of the spec tree: every other spec is a decision taken inside
the boundaries set here. That only works if it stays true, so it carries a
[record of the boundaries that have moved](#boundaries-that-have-moved) rather
than quietly describing a product that no longer exists.

## What it is

A multiplayer page editor in the browser. A design holds tabs, and every tab is a run of pages on a
surround ([Pages mode](../007-editor/pages-mode.md)): a logo artboard, a wireframe of a screen, or a photo to
edit in layers ([Photo pages](../031-photo/photo-pages.md)). Anyone with access to a design can join,
see other collaborators' cursors and edits live, and contribute simultaneously.

The page is the product. Everything else exists because a team making a design together usually ends by
showing it or sending it: a way to present the pages, and a way to export them as PDF, PNG, SVG, a Logo Kit or
a photo's own files.

livedesign is a fork of livediagram cut down to Pages, and then to three page kinds. The diagram, whiteboard,
workshop and planning modes stay in livediagram; articles, slide decks and infographics stay in livedocuments.
Nothing here assumes them.

## Target users

Teams who need to design and show their work together:

- Founders, marketers and designers making a logo and the kit of files that goes with it.
- Product teams sketching the screens of an app or a site as wireframes, and walking through them.
- Anyone touching up a photo, a banner or a social image in layers, without a desktop image editor.

The unit of value is the **team**. The entry point is one person: the editor
works fully without signing in, and a guest gets persistence, share links and
real-time collaboration ([Auth + guest access](../014-identity/auth-and-guest-access.md)). That is not a
contradiction, it is the funnel. Somebody tries it alone, and the product earns
the second person. What it must not become is a tool where the second person
never arrives.

## Core capabilities

- **Real-time multiplayer editing** ([Live app](../007-editor/live-app.md),
  [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)): live cursors, selection
  awareness, per-element merge so concurrent edits don't clobber, and an ordered
  room with reconnect catch-up, plus Follow Me ([Follow-me viewport](../012-collaboration/follow-me-viewport.md)).
- **Pages** ([Pages mode](../007-editor/pages-mode.md)): page sizes, backgrounds, layouts and page snapping;
  [logo artboards](../007-editor/logo-pages.md), [wireframes](../007-editor/wireframe-pages.md) and
  [photos](../031-photo/photo-pages.md), a layered pixel editor with adjustments and filters. On a page:
  text, shapes, images, charts, concept graphics, tables, code blocks, checklists, stickers, icons and embeds, plus
  web components that lay themselves out
  ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)).
- **Structure**: tabs, tab folders, per-tab layers ([Layers](../006-design/layers.md)),
  themes and the templates (Logos, Photos, Wireframes).
- **Presenting** ([Presentation mode](../012-collaboration/presentation-mode.md)): the Slides view steps through a
  tab's pages full screen, with the laser and the spotlight.
- **Getting work in and out**: import/export as JSON; PDF, PNG and SVG export of the pages, the Logo Kit of a logo
  page, and a photo page as PNG, JPEG, WebP or PSD ([Export fidelity](../020-import-export/export-fidelity.md));
  read-only embeds.
- **Comments** on elements, with mentions ([Comment mentions](../012-collaboration/comment-mentions.md)).
- **Teams** ([Teams](../013-workspace/teams.md), [Team shared designs](../013-workspace/team-shared-designs.md)): a
  named group with Admin/Member roles and a shared library of designs and
  folders. A design lives in exactly one place: someone's personal tree, or one
  team's library. Personal is the default; a team is opt-in.
- **Persistence and history**: every change is saved; undo and redo step
  back and forth through your own recent edits, and the
  [Timeline](../013-workspace/timeline.md) records what happened to each design.
- **Machine access**: a public REST API with signed-in tokens
  ([Public API and API tokens](../015-api/public-api-and-tokens.md)), an MCP server so AI tools can
  read and write designs ([MCP server](../015-api/mcp-server.md)) and a CLI ([CLI](../015-api/cli.md)).

## What it is _not_

- **Not a diagramming tool or a whiteboard.** Shapes and arrows exist because a page uses them, but there are no
  mind maps, flowcharts or sticky-note sessions; that is livediagram. The markers and the Pen are there to draw a
  logo.
- **Not a word processor or a deck builder.** No articles, slide pages or infographics; that is livedocuments.
- **Not a project planner.** No boards, cards, spreadsheets or forms.
- **Not a facilitation tool.** No Q&A, polls or quizzes.
- **Not a desktop app.** The web, with collaboration, is the product. Offline
  Mode is a per-design choice, not the default posture (see below).
- **Not a paid product, ever.** No tier, no billing, no feature flags gating the
  core editor ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## Boundaries that have moved

A boundary nobody maintains is not a boundary. When one moves, it gets recorded
here in the same change, with the spec that moved it.

- **"Not an offline-first desktop app"**: narrowed by
  [Offline Mode](../006-design/offline-mode.md). Still not a desktop app, and cloud is still the
  default, but a design can be kept only in this browser's IndexedDB and
  converted back and forth. Offline is a supported mode, not merely an
  unsupported state.
- **Pages only**: livedesign began as livediagram with every mode, and was cut down to Pages. A feature that serves
  only a diagram, a whiteboard, a workshop or a plan does not belong here.
- **Logos, wireframes and photos only**: the Pages it kept were cut down to three page kinds. Articles (and
  Markdown in and out), slide pages, infographics and the animated GIF export went with livedocuments; presenting
  stays, as the Slides view over any tab's pages. Photo pages came in from livediagram's photo editor
  ([Photo pages](../031-photo/photo-pages.md)).

## Why it matters

A logo, the wireframes of the product it names and the pictures that sell it usually live in three tools that
do not talk to each other, and rarely in one the whole team can open. livedesign exists to be the **fast, focused,
multiplayer-from-the-start** place where a team designs them together and shows them.

"Focused" is the load-bearing word. The honest check on any new feature is not "is this good?" but "does a team
making pages together need this?".

## How it ships

livedesign is **open source** (MIT) and also runs as a **hosted product**, free
for everyone, no paid tier. Anyone can self-host the entire codebase; the hosted
version is the easy default. See
[Open source + distribution](../002-project-scope/open-source-and-business-model.md).

The editor is **always available without signing in**: a visitor can make a
real design before being asked to create an account. Auth (Clerk) unlocks sync,
teams and per-account history on top of that. See
[Auth + guest access](../014-identity/auth-and-guest-access.md).

Usage is measured, anonymously and first-party, and published at `/telemetry`
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). That dashboard is how a claim on this page gets
checked: "the unit of value is the team" is a statement the Collaboration tab
can agree or disagree with.
