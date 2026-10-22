# Comparison / "alternative" pages

SEO landing pages that capture high-intent "is there a `<tool>` alternative?" searches and convert them into `/new` visits. They live on the marketing site (`apps/marketing`) and follow every rule in [16-marketing-site](marketing-site.md); this spec adds the rules specific to comparisons.

## Why they exist

The marketing site's biggest organic-growth ceiling is content footprint: the editor's routes are intentionally `noindex`, so the only indexable surface is `/`, `/faq`, and the legal pages. Comparison pages add indexable, intent-matched content targeting queries like "Trello alternative", "free Asana alternative", "Airtable alternative", "Notion alternative for planning". They are the first deliberate expansion of that footprint.

## Routes

- One page per competitor at **`/alternatives/<slug>`** (e.g. `/alternatives/trello`). One page per competitor is the SEO-correct shape: each targets that competitor's "alternative" query specifically, rather than a single diluted "compare" page.
- An index at **`/alternatives`** linking to all of them (gives the set an internal hub + a crawlable parent). The footer and breadcrumbs call it **Product Comparison**. It opens on the shared `PageHero` band and lays the comparisons out as a grid of `AlternativeCard`s (a tinted header panel on a dot grid carrying the `VsBadge` tiles, the page's h1, its description clamped to three lines, three highlight chips, and "Read the comparison"), closing on a `TryItCard` (`Compare.Card`) as the grid's last cell.
- Slugs + content are the single source of truth in `apps/marketing/lib/alternatives.ts`. The dynamic route (`app/alternatives/[slug]/page.tsx`) renders from it via `generateStaticParams` (with `dynamicParams = false`, so only known slugs export under `output: 'export'`), and the sitemap derives its URLs from the same list, so adding a competitor is a one-place change.

## Golden rule still applies, plus a fairness rule

Everything claimed about **liveplanner** must map to a shipped feature ([16](marketing-site.md)). On comparisons there's a second rule:

- **Be fair about competitors.** Every page includes a "where `<competitor>` is the better pick" section with genuine reasons to choose them. This is non-negotiable: it builds trust, it's honest, and disparaging/one-sided comparison spam is exactly what Google demotes.
- **State competitor facts qualitatively, not with volatile specifics.** Pricing tiers, exact free-plan limits, and feature lists change. Describe positioning ("free tier, then paid plans"; "desktop-first"; "vast shape libraries"), not numbers that rot. A short dated disclaimer ("comparisons reflect general positioning and may change") sits on each page.
- **Compete on their ground.** Each page compares liveplanner with the competitor at that competitor's own job: Trello as a kanban board, Asana, Monday.com and ClickUp as work-management platforms, Notion as a workspace whose databases show as boards, Jira as an issue tracker, Airtable as a spreadsheet-database, and Smartsheet as spreadsheet-style project management. Where a competitor goes further (Jira's sprints and developer integrations, Airtable's relational bases, Asana's portfolios, Notion's docs, automation recipes and marketplaces generally), the page says so plainly, and "they are not a planner" is never a selling point against a tool that does something else.
- **Claims found false stay out.** `lib/product-claims.test.ts` fails on any phrasing once found untrue on main, across the comparison pages, their cards, the FAQ and the landing page.
- **Never invent a competitor's price.** Price cells say only "free plan, then paid plans", "paid plans per seat" or similar positioning; no tier names, limits or amounts.
- **Migration answers are honest.** There is no direct importer for any of these tools. The honest route is the board's CSV/TSV import (each row a card, landing in the column its Status names, with the person its Assignee names) or opening a CSV in a Sheet, and an FAQ says so rather than implying a one-click move.
- **Keep pace with the product.** A shipped feature that changes a comparison (a new finish, mode, import or export) is added to the pages it bears on in the same review that bumps `ALTERNATIVES_LAST_UPDATED`, and a competitor's dated event (such as a retirement) is rewritten in the past tense once its date passes.

## Page shape

Per competitor, rendered by the shared template:

- **Breadcrumb** Home › Product Comparison › vs `<competitor>`, as a visible bar (`components/Breadcrumb.tsx`) and as `BreadcrumbJsonLd` with a `trail`.
- **Hero**: the shared `PageHero` band with a "liveplanner vs `<competitor>`" eyebrow and the `VsBadge` tiles. The competitor is drawn as a generic glyph of what the tool is (a kanban board for Trello, a database for Airtable), never its logo, in line with the no-vendor-trademarks rule ([Iconography](../004-interface-design/iconography.md)). Each competitor's glyph, accent tone and card chips live in `components/compare/competitor-look.ts`; a test pins one entry per slug.
- **Layout**: on wide screens a sticky "On this page" index (At a glance, Which to pick, each deep-dive heading, FAQ) sits beside the content.
- **H1** framed for the target query (e.g. "The free Trello alternative", "A lighter, free alternative to Jira").
- **Lede**: one or two honest sentences positioning liveplanner against that tool.
- **Comparison Table** ("At a glance", `components/compare/ComparisonTable.tsx`, a card that scrolls sideways inside itself on a phone): liveplanner vs `<competitor>` across a handful of dimensions, with per-cell text authored in the data (so every claim is deliberate and accurate, no blanket "we win").
- **Which to pick**: **Why liveplanner** (shipped differentiators) + **Where `<competitor>` is the better pick** (the fairness section), side by side as two cards of equal weight.
- **Deep-dive sections**: a handful of competitor-specific prose sections (`sections` in the data: heading + paragraphs) that expand on the key value themes for that comparison, e.g. the collaboration model, the free, no-trackers story, how boards, sheets, dashboards and forms work together in one project, and interop (CSV in and out, embeds, the API, MCP server and CLI for agents). These are where the page earns depth: real explanations of _how_ the differentiators work, not just bullet claims. Same honesty rules as everywhere else: every capability named must be shipped, competitor descriptions stay qualitative and fair.
- **Collaboration claims** describe the current guest model: a guest's new project starts in their browser and the first Share syncs it in one step, and links come at three levels (Editor, Participant, view-only). A page never implies that a guest's project is already on the server. Copy says "project", never "project", for what a person creates; its tabs are Board, Sheet, Dashboard and Form tabs.
- **FAQ**: 3–5 competitor-specific questions (`faqs` in the data), answered honestly, including switching/migration questions where the honest answer is partial (e.g. "there's no direct Trello importer; a CSV with a title column is all a board import needs"). Rendered on-page as the shared `FaqItem` accordion cards (the ones `/faq` uses) **and** emitted as `FAQPage` JSON-LD (same pattern as `/faq`), which targets the long-tail question queries around "`<tool>` alternative" searches.
- **CTA** → `/new` (the page-wide primary CTA) in the shared `TryItCard`, then the dated disclaimer naming the last review date (`ALTERNATIVES_LAST_UPDATED`).
- **Other comparisons**: up to three `AlternativeCard`s for the other competitors, so a reader can move across the set.

## Metadata

Each page uses the shared `pageMetadata()` factory from `@liveplanner/ui` ([16](marketing-site.md)) for `title` / `description` / `alternates.canonical` (`/alternatives/<slug>`) / OpenGraph / Twitter, generated from the competitor data via `generateMetadata`. Each detail page also emits `FAQPage` JSON-LD built from its `faqs` entries (answers are plain strings in the data, so the structured-data text stays markup-free). The index page has its own metadata + canonical `/alternatives`. All are added to `app/sitemap.ts` and internally linked from the footer so they're discoverable without relying on the sitemap alone.

The hub page (`/alternatives`) also emits an `ItemList` JSON-LD script alongside its `BreadcrumbList`, listing every comparison URL in display order. This is the schema.org shape for a curated index of related pages (see [16](marketing-site.md) "JSON-LD structured data"), built from the same `ALTERNATIVES` array, so adding a competitor updates the visible list, the sitemap, and the structured data in one place.

Both the hub and the per-competitor detail pages also emit an `article:modified_time` OpenGraph meta tag (the standard `og:type=article` companion field), wired to the same `ALTERNATIVES_LAST_UPDATED` constant the sitemap reads from `lib/alternatives.ts`. This is the machine-readable freshness signal Google + social previews look at when ranking and rendering article-type pages. Keeping it pinned to one constant (alongside the comparison data) means a content revision lands in three places at once: the visible page, the sitemap's `lastModified`, and the OG `article:modified_time`.

## The set

Trello, Asana, Monday.com (`/alternatives/monday`), Notion, Jira, ClickUp, Airtable and Smartsheet, each compared against Plan: Board, Sheet, Dashboard and Form tabs, card types, plan views (Gantt chart, calendars, charts by field), forms whose answers become cards or rows, live collaboration and agent access. Add more by appending to `lib/alternatives.ts`; the hub's ItemList description names every competitor from the same list (its meta description is a fixed sentence naming a few, so it stays within 160 characters).

## Retired comparisons

The diagram-tool comparisons (Microsoft Whiteboard, Miro, XMind, Excalidraw, draw.io, Google Slides, FigJam and Lucidchart) were retired when liveplanner narrowed to planning. Each old `/alternatives/<slug>` URL, with and without a trailing slash, redirects permanently (301) to `/alternatives` from `public/_redirects`; `lib/alternatives.test.ts` pins every one and checks no live comparison is redirected.

Candidates for later, by search value: Linear, Basecamp, Wrike and Google Sheets (against Sheet tabs), each needing an honest angle first.
