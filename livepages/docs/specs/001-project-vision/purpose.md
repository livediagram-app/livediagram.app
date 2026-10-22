# Purpose

livepages is a web app where teams make **documents of pages together, in real time**: articles, slide decks,
infographics, logos and wireframes.

This is the root of the spec tree: every other spec is a decision taken inside
the boundaries set here. That only works if it stays true, so it carries a
[record of the boundaries that have moved](#boundaries-that-have-moved) rather
than quietly describing a product that no longer exists.

## What it is

A multiplayer page editor in the browser. A document holds tabs, and every tab is a run of pages on a
surround ([Pages mode](../007-editor/pages-mode.md)): an article that flows across linked pages, a deck of
slides, an infographic, a logo artboard or a wireframe of a screen. Anyone with access to a document can join,
see other collaborators' cursors and edits live, and contribute simultaneously.

The page is the product. Everything else exists because a team making a document together usually ends by
showing it or sending it: a way to present the deck, a way to export the pages, a way to bring Markdown in and
take it out again.

livepages is a fork of livediagram cut down to Pages. The diagram, whiteboard, workshop and planning modes stay
in livediagram; nothing here assumes them.

## Target users

Teams who need to write, show and design together:

- Anyone writing a report, a brief or a how-to, and wanting it laid out on real pages.
- Teams building a talk, a pitch or a review deck, and presenting it from the same place.
- Marketing, product and design people making infographics, social cards, logos and screen wireframes.

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
  [articles](../007-editor/article-pages.md) that flow text across pages,
  [logo artboards](../007-editor/logo-pages.md) and [wireframes](../007-editor/wireframe-pages.md). On a page:
  text, shapes, images, charts, concept graphics, tables, code blocks, checklists, stickers, icons and embeds, plus
  web components that lay themselves out
  ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)).
- **Structure**: tabs, tab folders, per-tab layers ([Layers](../006-document/layers.md)),
  themes and the Pages templates.
- **Presenting** ([Presentation mode](../012-collaboration/presentation-mode.md)): full-screen decks with the laser
  and the spotlight.
- **Getting work in and out**: import/export as JSON, Markdown import
  ([Markdown import](../020-import-export/markdown-import.md)) and Markdown export; image and PDF export
  ([Export fidelity](../020-import-export/export-fidelity.md)); read-only embeds.
- **Comments** on elements, with mentions ([Comment mentions](../012-collaboration/comment-mentions.md)).
- **Teams** ([Teams](../013-workspace/teams.md), [Team shared documents](../013-workspace/team-shared-documents.md)): a
  named group with Admin/Member roles and a shared library of documents and
  folders. A document lives in exactly one place: someone's personal tree, or one
  team's library. Personal is the default; a team is opt-in.
- **Persistence and history**: every change is saved; undo and redo step
  back and forth through your own recent edits, and the
  [Timeline](../013-workspace/timeline.md) records what happened to each document.
- **Machine access**: a public REST API with signed-in tokens
  ([Public API and API tokens](../015-api/public-api-and-tokens.md)), an MCP server so AI tools can
  read and write documents ([MCP server](../015-api/mcp-server.md)) and a CLI ([CLI](../015-api/cli.md)).

## What it is _not_

- **Not a diagramming tool or a whiteboard.** Shapes and arrows exist because a page uses them, but there are no
  mind maps, flowcharts, pens or sticky-note sessions; that is livediagram.
- **Not a project planner.** No boards, cards, spreadsheets or forms.
- **Not a desktop app.** The web, with collaboration, is the product. Offline
  Mode is a per-document choice, not the default posture (see below).
- **Not a paid product, ever.** No tier, no billing, no feature flags gating the
  core editor ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## Boundaries that have moved

A boundary nobody maintains is not a boundary. When one moves, it gets recorded
here in the same change, with the spec that moved it.

- **"Not an offline-first desktop app"**: narrowed by
  [Offline Mode](../006-document/offline-mode.md). Still not a desktop app, and cloud is still the
  default, but a document can be kept only in this browser's IndexedDB and
  converted back and forth. Offline is a supported mode, not merely an
  unsupported state.
- **Pages only**: livepages began as livediagram with every mode, and was cut down to Pages. A feature that serves
  only a diagram, a whiteboard, a workshop or a plan does not belong here.

## Why it matters

Documents, decks and designs usually live in three tools that do not talk to each other, and the one a team
writes in is rarely the one it presents from. livepages exists to be the **fast, focused, multiplayer-from-the-start**
place where a team makes pages together and shows them.

"Focused" is the load-bearing word. The honest check on any new feature is not "is this good?" but "does a team
making pages together need this?".

## How it ships

livepages is **open source** (MIT) and also runs as a **hosted product**, free
for everyone, no paid tier. Anyone can self-host the entire codebase; the hosted
version is the easy default. See
[Open source + distribution](../002-project-scope/open-source-and-business-model.md).

The editor is **always available without signing in**: a visitor can make a
real document before being asked to create an account. Auth (Clerk) unlocks sync,
teams and per-account history on top of that. See
[Auth + guest access](../014-identity/auth-and-guest-access.md).

Usage is measured, anonymously and first-party, and published at `/telemetry`
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). That dashboard is how a claim on this page gets
checked: "the unit of value is the team" is a statement the Collaboration tab
can agree or disagree with.
