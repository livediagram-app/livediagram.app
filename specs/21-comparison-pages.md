# 21, Comparison / "alternative" pages

SEO landing pages that capture high-intent "is there a `<tool>` alternative?" searches and convert them into `/live/new` visits. They live on the marketing site (`apps/marketing`) and follow every rule in [16-marketing-site](16-marketing-site.md); this spec adds the rules specific to comparisons.

## Why they exist

The marketing site's biggest organic-growth ceiling is content footprint: the editor at `/live/*` is intentionally `noindex`, so the only indexable surface is `/`, `/faq`, and the legal pages. Comparison pages add indexable, intent-matched content targeting queries like "Miro alternative", "open source Excalidraw alternative", "draw.io alternative", "diagrams in Google Slides". They are the first deliberate expansion of that footprint.

## Routes

- One page per competitor at **`/alternatives/<slug>`** (e.g. `/alternatives/miro`). One page per competitor is the SEO-correct shape: each targets that competitor's "alternative" query specifically, rather than a single diluted "compare" page.
- An index at **`/alternatives`** linking to all of them (gives the set an internal hub + a crawlable parent).
- Slugs + content are the single source of truth in `apps/marketing/lib/alternatives.ts`. The dynamic route (`app/alternatives/[slug]/page.tsx`) renders from it via `generateStaticParams` (with `dynamicParams = false`, so only known slugs export under `output: 'export'`), and the sitemap derives its URLs from the same list, so adding a competitor is a one-place change.

## Golden rule still applies, plus a fairness rule

Everything claimed about **livediagram** must map to a shipped feature ([16](16-marketing-site.md)). On comparisons there's a second rule:

- **Be fair about competitors.** Every page includes a "where `<competitor>` is the better pick" section with genuine reasons to choose them. This is non-negotiable: it builds trust, it's honest, and disparaging/one-sided comparison spam is exactly what Google demotes.
- **State competitor facts qualitatively, not with volatile specifics.** Pricing tiers, exact free-plan limits, and feature lists change. Describe positioning ("free tier, then paid plans"; "desktop-first"; "vast shape libraries"), not numbers that rot. A short dated disclaimer ("comparisons reflect general positioning and may change") sits on each page.
- **Never imply a free/open-source competitor is paid/proprietary.** Excalidraw and draw.io are themselves free and open source; the honest differentiator there is _structure_ (templates, tabs, folders, themes) and _real-time multiplayer / hosting model_, not price or licensing. Miro and XMind are the ones where "open-source, free, no sign-up" is the genuine contrast.

## Page shape

Per competitor, rendered by the shared template:

- **Breadcrumb** Home › Alternatives › `<competitor>` (`BreadcrumbJsonLd` with a `trail`).
- **H1** framed for the target query (e.g. "The open-source Miro alternative"; for Google Slides, "A canvas built for diagrams, not slides").
- **Lede**: one or two honest sentences positioning livediagram against that tool.
- **Comparison table**: livediagram vs `<competitor>` across a handful of dimensions, with per-cell text authored in the data (so every claim is deliberate and accurate, no blanket "we win").
- **Why livediagram** (shipped differentiators) + **Where `<competitor>` is the better pick** (the fairness section).
- **CTA** → `/live/new` ("Start drawing", the page-wide primary CTA).

## Metadata

Each page uses the `subpageMetadata()` factory ([16](16-marketing-site.md)) for `title` / `description` / `alternates.canonical` (`/alternatives/<slug>`) / OpenGraph / Twitter, generated from the competitor data via `generateMetadata`. The index page has its own metadata + canonical `/alternatives`. All are added to `app/sitemap.ts` and internally linked from the footer so they're discoverable without relying on the sitemap alone.

## Initial set

Miro, XMind, Excalidraw, draw.io (diagrams.net), and Google Slides (used for diagrams). Add more by appending to `lib/alternatives.ts`.
