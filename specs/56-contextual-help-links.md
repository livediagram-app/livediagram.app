# 56 - Contextual help links

Status: accepted

## Problem

The help centre (spec/55) holds 130+ articles, but the editor only exposes
**one** entry point to it: the global Help icon in the editor header
(`EditorHeader.tsx`, to the right of the Share button). A user looking at a specific dialog (Share expiry, password
gate, export formats) or a specific toggle (auto-attach arrows, AI assistant)
has no in-context path to the article that explains it; they have to open the
help centre and search for it by hand.

Several surfaces carry descriptive helper text but no link to the deeper
article. The descriptive text answers "what is this control"; the article
answers "how do I use this well, and what are the edge cases".

## Decision

Add small, contextual "learn more" affordances that deep-link from a UI
surface to its matching help article. These supplement (never replace) the
global Help icon and the inline helper text.

### One reusable affordance

A single component, `HelpArticleLink` (`apps/live/components/primitives/HelpArticleLink.tsx`),
is the only way the editor links to a help article. It:

- takes an `article` key (see the registry below), not a raw URL;
- renders either a `?` icon button (`variant="icon"`, default) for placing
  next to a control label or in a panel's header chrome, or a `"Learn more"`
  text link (`variant="text"`) for dialog headers / empty states;
- draws that `?` as **one look everywhere**: a bare glyph that picks up a soft
  rounded hover background, the same affordance the floating panels' own
  chrome (reset / minimise) uses. It is never a ring or a bordered circle
  around the mark — an outlined `?` in a dialog header beside a bare `?` on a
  panel reads as two different controls for the same thing, and the drift is
  self-propagating: the since-removed `ShortcutsDialog` had already grown a row of `!important`
  overrides to cancel the ring locally. Only the hit box varies, via
  `size` (`sm`, the default, for panel chrome and inline control labels;
  `md` for a dialog header, matching `DialogCloseButton`'s `h-7`);
- opens `/help/<slug>/` in a new tab (`target="_blank"`,
  `rel="noreferrer noopener"`), matching the existing header Help link;
- wraps the trigger in the shared `Tooltip` (custom tooltips only, never a
  native `title` - see the toolbar-tooltip rule). The tooltip's copy comes
  from `HELP_LINK_COPY` in `apps/live/lib/help-articles.ts`, one entry per
  article key: a **"Learn about …"** title naming the thing the reader is
  looking at ("Learn about the Explorer") and one line saying what the
  article does for them ("Tips and tricks to help you get the most out of
  the Explorer."). A surface passes its own `title` / `description` only
  when it needs a different framing; none does today. Before this table
  every floating panel's `?` said a bare "Learn more" with no description,
  which told the reader nothing about where it went;
- fires `track('UI', 'Opened', <article id>)` on click, reusing the existing
  `UI`/`Opened` telemetry pair. The `type` is the article's **telemetry id**
  (`helpArticleTelemetryId`, from `@livediagram/help-registry/telemetry`):
  its slug (e.g. `share-link-expiry`), or an explicit token where two
  articles share a slug (spec/22 Help). It fits `TELEMETRY_TYPE_PATTERN`
  (`[A-Za-z0-9 ._-]{1,40}`, no slashes) - the full nested slug would not -
  and it is the same id the help centre reports for that page. It used to
  be the bare last path segment, which two pairs of articles share.

This follows the reuse-over-duplication and no-god-files principles: every
surface links the same way, and no surface hand-rolls an `<a href="/help/...">`.

### One source for slugs

`apps/live/lib/help-articles.ts` exports a frozen `HELP_ARTICLES` map of
named keys -> nested article slug (the path under `/help`, e.g.
`collaboration/sharing/share-link-expiry`). This map is the live app's single
source for help slugs on surfaces that deep-link ONE article, and keys are
referenced symbolically so a slug change is a one-line edit. (Search is
different: the SearchPanel's Help group derives from the full
`@livediagram/help-registry` catalogue, see spec/55.) Slugs here must match a
real page under `apps/help/app/.../page.mdx` (and its registry entry) - a key
pointing at a missing article is a bug, the same way an unregistered article
is.

## Placements (initial set)

Grouped by priority; each links the keyed article.

> **Floating-panel headers carry no help icon.** The Explorer, Palette,
> Activity, Comments, and AI panels previously each had a bare-glyph
> `HelpArticleLink` in their header. These were removed: the editor header
> already has a prominent global Help icon, and a `?` on every panel made the
> canvas chrome noisy. Contextual links now live only in dialogs, in-panel
> settings (the Settings dialog's rows), and **empty-state messages** (the
> empty-canvas Quick Start banner keeps its link). The articles themselves
> (`explorerPanel`, `palette`, `reverting-changes`, `comments`, `ai-tools`)
> stay in the registry, reachable from the help centre and the header.

**High priority**

- Share dialog - expiry dropdown -> `share-link-expiry`
- Share dialog - password section -> `share-passwords`
- Share dialog - header (roles / real-time) -> `sharing`
- Palette settings - auto-attach arrows -> `auto-attach-arrows`
- Palette settings - alignment guides -> `alignment-guides`
- Settings - AI assistant toggle -> `ai-tools`
- AI panel - **Connect agent** button (on the Ask / Clean row) -> `connect-ai-mcp`. Uses the
  `button` variant with a custom `label` + plug `icon` (the variant now accepts both; absent
  a custom label it still reads "Help").
- Export dialog header -> `exporting-diagrams` (isometric toggle -> `isometric-mode`)
- Import dialog header -> `import-tabs`. The Markdown note (`markdown-import`)
  rides on the **Markdown format's own paste step**, not the format picker:
  under the grid it asked "Importing a Markdown outline?" of a reader who had
  not picked a format yet. A format carries its own footnote (`note` on the
  `FORMATS` entry), so any other format can grow one the same way.
- Team form / invite -> `team-roles-and-invites`

**Medium priority**

- Canvas/Theme dialog -> `changing-the-background` / `changing-theme`
- Link picker -> `links` (tab links -> `linking-tabs`)
- Themes pane empty state -> `custom-themes`
- Image gallery pane -> `image-gallery`
- Line/chart data editor -> `data-elements`
- Settings - minimal panels -> `minimal-panels`
- Settings - telemetry -> `what-we-collect`

**Onboarding / empty states**

- Empty-canvas Quick Start banner -> `your-first-diagram`
- Template picker -> `templates`
- Settings - Keyboard category (was the Shortcuts dialog) -> `keyboard-shortcuts`
- Sign-in reasons modal -> `guest-vs-account`

The set can grow; new placements reuse `HelpArticleLink` + a `HELP_ARTICLES`
key and never introduce a second linking pattern.

## Non-goals

- No in-app article rendering: links open the standalone help centre.
- No change to the help app, its registry, or its sitemap.
- No new telemetry category/action: reuse `UI` / `Opened`.

## Panel headers carry their article

Every floating panel that a help article explains renders a `?` in its header
chrome, beside reset / minimise, from a `helpArticle` prop on `MovablePanel`
(forwarded by `ModePanel`, so a tool panel opts in with one word).

Declared on the shared component rather than left to each panel's own
`headerActions`, so the affordance sits in the SAME place on every panel — a
help button that moves around teaches people not to look for it. It renders in
both the desktop header and the mobile / minimal band, and stops the pointer so
pressing it opens the article rather than starting a panel drag.

Wired: Palette, Explorer, Activity, Layers, Map, Collaborate, Poll, Vote, and
the seven tool panels (Avatar, Laser, Spotlight, Eraser, Format, Highlighter,
Slide Deck). This closed the gap the feature was written for and had never
reached: 21 surfaces linked an article, and every one of them was a dialog, so
a panel you were looking at could not tell you there was a page about it.

`help-articles.test.ts` already refuses a key that resolves to no page, or one
no surface references, so a panel pointing at a dead article fails the build
rather than shipping a 404.
