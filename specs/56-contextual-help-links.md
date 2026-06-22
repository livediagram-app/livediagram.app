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

A single component, `HelpArticleLink` (`apps/live/components/HelpArticleLink.tsx`),
is the only way the editor links to a help article. It:

- takes an `article` key (see the registry below), not a raw URL;
- renders either a small `?` icon button (`variant="icon"`, default) for
  placing next to a control label, or a `"Learn more"` text link
  (`variant="text"`) for dialog headers / empty states;
- opens `/help/<slug>/` in a new tab (`target="_blank"`,
  `rel="noreferrer noopener"`), matching the existing header Help link;
- wraps the trigger in the shared `Tooltip` (custom tooltips only, never a
  native `title` - see the toolbar-tooltip rule);
- fires `track('UI', 'Opened', <leaf-slug>)` on click, reusing the existing
  `UI`/`Opened` telemetry pair. The `type` is the article's **leaf** slug
  (e.g. `share-link-expiry`), which fits `TELEMETRY_TYPE_PATTERN`
  (`[A-Za-z0-9 ._-]{1,40}`, no slashes) - the full nested slug would not.

This follows the reuse-over-duplication and no-god-files principles: every
surface links the same way, and no surface hand-rolls an `<a href="/help/...">`.

### One source for slugs

`apps/live/lib/help-articles.ts` exports a frozen `HELP_ARTICLES` map of
named keys -> nested article slug (the path under `/help`, e.g.
`collaboration/sharing/share-link-expiry`). The editor lives in a separate
build from `apps/help`, so it cannot import that app's `articles.ts` registry;
instead this map is the live app's single source for help slugs, and keys are
referenced symbolically so a slug change is a one-line edit. Slugs here must
match a real page under `apps/help/app/.../page.mdx` (and its registry entry) -
a key pointing at a missing article is a bug, the same way an unregistered
article is.

## Placements (initial set)

Grouped by priority; each links the keyed article.

**High priority**

- Share dialog - expiry dropdown -> `share-link-expiry`
- Share dialog - password section -> `share-passwords`
- Share dialog - header (roles / real-time) -> `sharing`
- Palette settings - auto-attach arrows -> `auto-attach-arrows`
- Palette settings - alignment guides -> `alignment-guides`
- Settings - AI assistant toggle -> `ai-tools`
- AI panel header -> `ai-tools`
- Export dialog header -> `exporting-diagrams` (isometric toggle -> `isometric-mode`)
- Import dialog header -> `import-tabs` (Markdown note -> `markdown-import`)
- Team form / invite -> `team-roles-and-invites`

**Medium priority**

- Canvas/Theme dialog -> `changing-the-background` / `changing-theme`
- Link picker -> `links` (tab links -> `linking-tabs`)
- Activity panel -> `reverting-changes`
- Comments panel -> `comments`
- Themes pane empty state -> `custom-themes`
- Image gallery pane -> `image-gallery`
- Line/chart data editor -> `data-elements`
- Settings - minimal panels -> `minimal-panels`
- Settings - telemetry -> `what-we-collect`

**Onboarding / empty states**

- Empty-canvas Quick Start banner -> `your-first-diagram`
- Template picker -> `templates`
- Shortcuts dialog -> `keyboard-shortcuts`
- Sign-in reasons modal -> `guest-vs-account`

The set can grow; new placements reuse `HelpArticleLink` + a `HELP_ARTICLES`
key and never introduce a second linking pattern.

## Non-goals

- No in-app article rendering: links open the standalone help centre.
- No change to the help app, its registry, or its sitemap.
- No new telemetry category/action: reuse `UI` / `Opened`.
