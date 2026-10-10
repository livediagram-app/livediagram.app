# Comparison / "alternative" pages

SEO landing pages that capture high-intent "is there a `<tool>` alternative?" searches and convert them into `/new` visits. They live on the marketing site (`apps/marketing`) and follow every rule in [16-marketing-site](marketing-site.md); this spec adds the rules specific to comparisons.

## Why they exist

The marketing site's biggest organic-growth ceiling is content footprint: the editor's routes are intentionally `noindex`, so the only indexable surface is `/`, `/faq`, and the legal pages. Comparison pages add indexable, intent-matched content targeting queries like "Miro alternative", "open source Excalidraw alternative", "draw.io alternative", "Google Slides alternative". They are the first deliberate expansion of that footprint.

## Routes

- One page per competitor at **`/alternatives/<slug>`** (e.g. `/alternatives/miro`). One page per competitor is the SEO-correct shape: each targets that competitor's "alternative" query specifically, rather than a single diluted "compare" page.
- An index at **`/alternatives`** linking to all of them (gives the set an internal hub + a crawlable parent). The footer and breadcrumbs call it **Product Comparison**. It opens on the shared `PageHero` band and lays the comparisons out as a grid of `AlternativeCard`s (a tinted header panel on a dot grid carrying the `VsBadge` tiles, the page's h1, its description clamped to three lines, three highlight chips, and "Read the comparison"), closing on a `TryItCard` (`Compare.Card`) as the grid's last cell.
- Slugs + content are the single source of truth in `apps/marketing/lib/alternatives.ts`. The dynamic route (`app/alternatives/[slug]/page.tsx`) renders from it via `generateStaticParams` (with `dynamicParams = false`, so only known slugs export under `output: 'export'`), and the sitemap derives its URLs from the same list, so adding a competitor is a one-place change.

## Golden rule still applies, plus a fairness rule

Everything claimed about **livediagram** must map to a shipped feature ([16](marketing-site.md)). On comparisons there's a second rule:

- **Be fair about competitors.** Every page includes a "where `<competitor>` is the better pick" section with genuine reasons to choose them. This is non-negotiable: it builds trust, it's honest, and disparaging/one-sided comparison spam is exactly what Google demotes.
- **State competitor facts qualitatively, not with volatile specifics.** Pricing tiers, exact free-plan limits, and feature lists change. Describe positioning ("free tier, then paid plans"; "desktop-first"; "vast shape libraries"), not numbers that rot. A short dated disclaimer ("comparisons reflect general positioning and may change") sits on each page.
- **Compete on their ground.** Each page compares livediagram with the competitor at that competitor's own job, using the mode that does it: Google Slides as a presentation tool (Illustrate slide pages, decks built from the canvas, presenting), Miro and FigJam as workspaces and whiteboards, XMind as mind mapping, Microsoft Whiteboard as a whiteboard, draw.io and Lucidchart as diagram editors. Diagrams are one facet of livediagram, never the whole pitch, and "they are not a diagram tool" is never a selling point against a tool that does something else.
- **Never imply a free/open-source competitor is paid/proprietary.** Excalidraw and draw.io are themselves free and open source; the honest differentiator there is _structure_ (templates, tabs, folders, themes) and _real-time multiplayer / hosting model_, not price or licensing. Miro and XMind are the ones where "open-source, free, no sign-up" is the genuine contrast.

## Page shape

Per competitor, rendered by the shared template:

- **Breadcrumb** Home › Product Comparison › vs `<competitor>`, as a visible bar (`components/Breadcrumb.tsx`) and as `BreadcrumbJsonLd` with a `trail`.
- **Hero**: the shared `PageHero` band with a "livediagram vs `<competitor>`" eyebrow and the `VsBadge` tiles. The competitor is drawn as a generic glyph of what the tool is (a sticky note for Miro, a tree for XMind), never its logo, in line with the no-vendor-trademarks rule ([Iconography](../004-interface-design/iconography.md)). Each competitor's glyph, accent tone and card chips live in `components/compare/competitor-look.ts`; a test pins one entry per slug.
- **Layout**: on wide screens a sticky "On this page" index (At a glance, Which to pick, each deep-dive heading, FAQ) sits beside the content.
- **H1** framed for the target query (e.g. "The open-source Miro alternative", "A free, open-source Google Slides alternative").
- **Lede**: one or two honest sentences positioning livediagram against that tool.
- **Comparison table** ("At a glance", `components/compare/ComparisonTable.tsx`, a card that scrolls sideways inside itself on a phone): livediagram vs `<competitor>` across a handful of dimensions, with per-cell text authored in the data (so every claim is deliberate and accurate, no blanket "we win").
- **Which to pick**: **Why livediagram** (shipped differentiators) + **Where `<competitor>` is the better pick** (the fairness section), side by side as two cards of equal weight.
- **Deep-dive sections**: a handful of competitor-specific prose sections (`sections` in the data: heading + paragraphs) that expand on the key value themes for that comparison, e.g. the collaboration model, the free/open-source/self-hosting story, structure (templates, tabs, folders, layers, themes), and interop (Mermaid + Markdown import, PNG/SVG/PDF export, MCP for AI tools, embeds). These are where the page earns depth: real explanations of _how_ the differentiators work, not just bullet claims. Same honesty rules as everywhere else: every capability named must be shipped, competitor descriptions stay qualitative and fair.
- **Collaboration claims** describe the current guest model: a guest's new document starts in their browser and the first Share syncs it in one step, and links come at three levels (Editor, Participant, view-only). A page never implies that a guest's document is already on the server.
- **FAQ**: 3–5 competitor-specific questions (`faqs` in the data), answered honestly, including switching/migration questions where the honest answer is partial (e.g. "there's no direct Miro importer; Mermaid flowcharts round-trip"). Rendered on-page as the shared `FaqItem` accordion cards (the ones `/faq` uses) **and** emitted as `FAQPage` JSON-LD (same pattern as `/faq`), which targets the long-tail question queries around "`<tool>` alternative" searches.
- **CTA** → `/new` ("Start drawing", the page-wide primary CTA) in the shared `TryItCard`, then the dated disclaimer naming the last review date (`ALTERNATIVES_LAST_UPDATED`).
- **Other comparisons**: up to three `AlternativeCard`s for the other competitors, so a reader can move across the set.

## Metadata

Each page uses the shared `pageMetadata()` factory from `@livediagram/ui` ([16](marketing-site.md)) for `title` / `description` / `alternates.canonical` (`/alternatives/<slug>`) / OpenGraph / Twitter, generated from the competitor data via `generateMetadata`. Each detail page also emits `FAQPage` JSON-LD built from its `faqs` entries (answers are plain strings in the data, so the structured-data text stays markup-free). The index page has its own metadata + canonical `/alternatives`. All are added to `app/sitemap.ts` and internally linked from the footer so they're discoverable without relying on the sitemap alone.

The hub page (`/alternatives`) also emits an `ItemList` JSON-LD script alongside its `BreadcrumbList`, listing every comparison URL in display order. This is the schema.org shape for a curated index of related pages (see [16](marketing-site.md) "JSON-LD structured data"), built from the same `ALTERNATIVES` array, so adding a competitor updates the visible list, the sitemap, and the structured data in one place.

Both the hub and the per-competitor detail pages also emit an `article:modified_time` OpenGraph meta tag (the standard `og:type=article` companion field), wired to the same `ALTERNATIVES_LAST_UPDATED` constant the sitemap reads from `lib/alternatives.ts`. This is the machine-readable freshness signal Google + social previews look at when ranking and rendering article-type pages. Keeping it pinned to one constant (alongside the comparison data) means a content revision lands in three places at once: the visible page, the sitemap's `lastModified`, and the OG `article:modified_time`.

## Initial set

Miro, XMind, Excalidraw, draw.io (diagrams.net), and Google Slides (compared as a presentation tool, against Illustrate slide pages and Presentation mode). Add more by appending to `lib/alternatives.ts`; the hub's ItemList description names every competitor from the same list (its meta description is a fixed sentence naming a few, so it stays within 160 characters).

## Second set (October 2026)

- **Microsoft Whiteboard** (`/alternatives/microsoft-whiteboard`), listed first while it is time-sensitive: Microsoft retires Whiteboard for personal accounts (read-only since 25 September 2026, legacy boards deleted on 16 October 2026) and the standalone apps (retiring between 16 October and 30 November 2026; Microsoft's notices differ) (work and school accounts keep it in Teams and on the web, and the page says so). The angle is the [Microsoft Whiteboard import](../020-import-export/whiteboard-import.md), which needs a board export folder; the page says that plainly rather than implying a one-click migration.
- **FigJam** (`/alternatives/figjam`): no account or Figma seat, structured diagrams, workshop tools, API and MCP. No importer exists, and the FAQ says so.
- **Lucidchart** (`/alternatives/lucidchart`): no document or shape limits. No importer exists; the honest route is through draw.io, which takes a Lucidchart diagram pasted from its editor and opens Visio files, then our draw.io import. Lucidchart imports Mermaid itself, so Mermaid import is never framed as our edge there.

Candidates researched for later, by search value: tldraw, Mural, Eraser, Whimsical, Mermaid Live / Mermaid Chart; then Trello / Linear (against Plan mode) and Canva (against Illustrate), now that both modes are out of Experimental, though those products' depth (task tracking, a design asset library) is far greater, so each needs an honest angle first.
