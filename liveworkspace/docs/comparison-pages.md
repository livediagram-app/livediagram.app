# Comparison / "alternative" pages

SEO landing pages that capture high-intent "is there a `<tool>` alternative?" searches and send them
on to an app's `/new`. Every app's comparisons live in one place, on **liveworkspace.app**, so a page
can compare one app with a competitor or the whole suite with one (Notion against planning and
writing together, say).

```
liveworkspace/apps/site
├─ lib/alternatives/              the data, one source for the hub, every page and the sitemap
│  ├─ index.ts                    ALTERNATIVES, its hub groups, getAlternative
│  ├─ types.ts                    the shape of a comparison
│  ├─ livediagram.ts …            each app's own list, written about that app, with its review date
│  └─ competitor-look.ts          each competitor's glyph, tone and three card chips
├─ app/alternatives/              the hub, and one static page per slug
└─ components/compare/            the cards, table, hero, FAQ, call to action and the voice
```

Each app's marketing site keeps no comparisons of its own. Its `public/_redirects` sends `/alternatives`
and every `/alternatives/<slug>` to the page of the same slug here, permanently (301), and
`lib/comparisons-moved.test.ts` pins it; its footer's **Product Comparison** links here directly.

| App           | Live comparisons                                                           | Its marketing-site spec                                                             |
| ------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| livediagram   | Microsoft Whiteboard, Miro, XMind, Excalidraw, draw.io, FigJam, Lucidchart | [marketing-site.md](../../livediagram/docs/specs/019-marketing/marketing-site.md)   |
| liveplanner   | Trello, Asana, Monday.com, Notion, Jira, ClickUp, Airtable, Smartsheet     | [marketing-site.md](../../liveplanner/docs/specs/019-marketing/marketing-site.md)   |
| livedocuments | Google Slides                                                              | [marketing-site.md](../../livedocuments/docs/specs/019-marketing/marketing-site.md) |
| livedesign    | Figma                                                                      | [marketing-site.md](../../livedesign/docs/specs/019-marketing/marketing-site.md)    |

## Whose voice

A comparison names the apps that answer the competitor (`apps`). With one, the page speaks for that
app: "livediagram vs Miro", its prism on the vs tiles, its accent on the hero, table and cards, and a
call to action into it ("Start drawing", "Start planning", "Start creating") at `/new?via=Compare.Card`,
so its landing funnel still counts the visit. With several, it is a **suite comparison**: the page
speaks for liveworkspace, in the platform's slate, with one button per app. Suite comparisons list first
on the hub, under **The whole suite**; the rest group under their app.

In the rules below, "us" is whoever the page speaks for, and "document" is whatever that app calls
the thing a person makes: a document (livediagram, livedocuments), a project (liveplanner) or a
design (livedesign).

## Why they exist

The apps' editor routes are intentionally `noindex`, so the indexable surface is the marketing pages.
Comparison pages add indexable, intent-matched content targeting queries like "Miro alternative",
"free Asana alternative", "Google Slides alternative" or "open source Figma alternative". Gathering
them on liveworkspace.app gives them one hub and lets one page speak for several apps at once.

## Routes

- One page per competitor at **`/alternatives/<slug>`** (e.g. `/alternatives/miro`). One page per competitor is the SEO-correct shape: each targets that competitor's "alternative" query specifically. A slug is unique across every app; a competitor two apps answer gets one suite comparison, not two pages.
- A hub at **`/alternatives`**, linked from the site footer as **Product Comparison**: the hero band, then the comparisons as a grid of `AlternativeCard`s per group (a tinted header panel on a dot grid carrying the `VsBadge` tiles, the apps it is about, the page's h1, its description clamped to three lines, three highlight chips, and "Read the comparison"), closing on a `TryItCard` that points at the apps on the front door.
- `generateStaticParams` renders every slug (with `dynamicParams = false`, so only known slugs export under `output: 'export'`), and the sitemap derives its URLs from the same list, so adding a competitor is a one-place change.

## Golden rule, plus a fairness rule

Everything claimed about an app must map to a shipped feature of that app (its marketing-site spec).
On comparisons there's a second rule:

- **Be fair about competitors.** Every page includes a "where `<competitor>` is the better pick" section with genuine reasons to choose them. This is non-negotiable: it builds trust, it's honest, and disparaging/one-sided comparison spam is exactly what Google demotes.
- **State competitor facts qualitatively, not with volatile specifics.** Pricing tiers, exact free-plan limits, and feature lists change. Describe positioning ("free tier, then paid plans"; "desktop-first"; "vast shape libraries"), not numbers that rot. A short dated disclaimer ("comparisons reflect general positioning and may change") sits on each page.
- **Compete on their ground.** Each page compares us with the competitor at that competitor's own job, using the app (or apps) that does it. "They are not a `<kind of tool>`" is never a selling point against a tool that does something else. Each app's section below says which job each competitor is compared at.
- **Claims found false stay out.** `lib/alternatives/product-claims.test.ts` holds, app by app, each phrasing once found untrue on main, and fails if one comes back on a comparison that app answers or its card. Each app's own `lib/product-claims.test.ts` keeps the same list for its FAQ and landing page, so a claim found false is added to both.
- **Counts match the catalogue.** A count written out ("23 templates", "61 layouts", "25 logo layouts") must match that app's catalogue; `lib/alternatives/catalogue-counts.test.ts` reads the apps' template, theme and layout packages and fails until the copy follows a change.
- **Never imply a free/open-source competitor is paid/proprietary.** Where a competitor is itself free and open source, the honest differentiator is _structure_ (templates, tabs, folders, themes) and _real-time multiplayer / hosting model_, not price or licensing. "Open-source, free, no sign-up" is the contrast only where it is genuinely true of the competitor.
- **Keep pace with the product.** A shipped feature that changes a comparison (a new finish, mode, page kind, layout, import or export) is added to the pages it bears on in the same review that bumps the app's review date (`LIVEDIAGRAM_UPDATED` and so on, beside its list), and a competitor's dated event (such as a retirement) is rewritten in the past tense once its date passes.

## Page shape

Per competitor, rendered by `app/alternatives/[slug]/page.tsx`, in the voice's colours:

- **Breadcrumb** Home › Product Comparison › vs `<competitor>`, as a visible bar and as a BreadcrumbList (`components/compare/compare-chrome.tsx`).
- **Hero**: the `PageHero` band with a "`<us>` vs `<competitor>`" eyebrow and the `VsBadge` tiles (the app's own prism, or liveworkspace's for a suite comparison). The competitor is drawn as a generic glyph of what the tool is (a sticky note for Miro, a kanban board for Trello, a slide for Google Slides), never its logo, in line with the no-vendor-trademarks rule ([Iconography](../../livediagram/docs/specs/004-interface-design/iconography.md)). Each competitor's glyph, accent tone and card chips live in `lib/alternatives/competitor-look.ts`; a test pins one entry per slug, each with a tone of its own.
- **Layout**: on wide screens a sticky "On this page" index (At a glance, Which to pick, each deep-dive heading, FAQ) sits beside the content.
- **H1** framed for the target query (e.g. "The open-source Miro alternative", "The free Trello alternative", "A free, open-source Google Slides alternative").
- **Lede**: one or two honest sentences positioning us against that tool.
- **Comparison Table** ("At a glance", `components/compare/ComparisonTable.tsx`, a card that scrolls sideways inside itself on a phone): us vs `<competitor>`, our column tinted, across a handful of dimensions, with per-cell text authored in the data (so every claim is deliberate and accurate, no blanket "we win").
- **Which to pick**: **Why pick `<us>`** (shipped differentiators) + **Where `<competitor>` is the better pick** (the fairness section), side by side as two cards of equal weight.
- **Deep-dive sections**: a handful of competitor-specific prose sections (`sections` in the data: heading + paragraphs) that expand on the key value themes for that comparison, e.g. the collaboration model, the free/open-source story, how the product is structured, and interop (imports, exports, embeds, the API, MCP and CLI for agents). These are where the page earns depth: real explanations of _how_ the differentiators work, not just bullet claims. Same honesty rules as everywhere else: every capability named must be shipped, competitor descriptions stay qualitative and fair.
- **Collaboration claims** describe the current guest model: a guest's new document starts in their browser and the first Share syncs it in one step, and links come at three levels (Editor, Participant, view-only). A page never implies that a guest's document is already on the server.
- **FAQ**: 3–5 competitor-specific questions (`faqs` in the data), answered honestly, including switching/migration questions where the honest answer is partial (e.g. "there's no direct Miro importer; Mermaid flowcharts round-trip"). Rendered on-page as native `<details>` cards (`FaqItem`) **and** emitted as `FAQPage` JSON-LD, which targets the long-tail question queries around "`<tool>` alternative" searches.
- **CTA**: a `TryItCard` with a button into each app's `/new?via=Compare.Card`, then the dated disclaimer naming the comparison's last review.
- **Other comparisons**: up to three `AlternativeCard`s, the same apps' first, so a reader can move across the set.

## Metadata

Each page's `generateMetadata` gives its own `title` / `description` / canonical (`/alternatives/<slug>`) and OpenGraph and Twitter cards (`compareMetadata` in `components/compare/compare-chrome.tsx`), as an article whose `article:modified_time` is that comparison's review date. A description fits a search result (50 to 160 characters, pinned by a test). Each page also emits `FAQPage` JSON-LD built from its `faqs` (answers are plain strings, so the structured-data text stays markup-free).

The hub has its own metadata and canonical `/alternatives`, and emits an `ItemList` JSON-LD alongside its `BreadcrumbList`, listing every comparison URL in display order, built from the same `ALTERNATIVES` list. Its ItemList description names every competitor; its meta description is a fixed sentence naming a few, so it stays within 160 characters.

`app/sitemap.ts` lists the hub and every comparison, each dated by its review rather than the build (the hub by the newest), so the visible date, the sitemap's `lastModified` and `article:modified_time` always agree.

## livediagram

- **Compete on their ground**: Miro and FigJam as workspaces and whiteboards, XMind as mind mapping, Microsoft Whiteboard as a whiteboard, draw.io and Lucidchart as diagram editors. Diagrams are one facet of livediagram, never the whole pitch, and "they are not a diagram tool" is never a selling point.
- **Claims found false**: read-only embeds for every link, Markdown import onto a new tab, no Figma integration, unlimited document size, Mermaid export from any tab, a live status page, imports that send nothing to a server.
- **Free and open source**: Excalidraw and draw.io are themselves free and open source; Miro and XMind are the ones where "open-source, free, no sign-up" is the genuine contrast. Against Excalidraw, presenting is compared with Excalidraw+ (its hosted plan), never with the free editor, and the hand-drawn look is a shared strength: livediagram's Sketch and Marker [finishes](../../livediagram/docs/specs/008-canvas/finish.md) are named, while Excalidraw's own style and typeface stay its signature in the fairness section.
- **CTA** reads "Start drawing".

**Initial set**: Miro, XMind, Excalidraw and draw.io (diagrams.net), since joined by Microsoft Whiteboard, FigJam and Lucidchart. Google Slides (compared as a presentation tool) went with Pages mode on 2026-10-22, and is livedocuments' now.

**Second set (October 2026)**:

- **Microsoft Whiteboard** (`/alternatives/microsoft-whiteboard`), listed first while it is time-sensitive: Microsoft retires Whiteboard for personal accounts (read-only since 25 September 2026, legacy boards deleted on 16 October 2026) and the standalone Windows, iOS and Android apps (retiring on 16 October 2026, per Microsoft's support notice) (work and school accounts keep it in Teams and on the web, and the page says so). The angle is the [Microsoft Whiteboard import](../../livediagram/docs/specs/020-import-export/whiteboard-import.md), which needs a board export folder; the page says that plainly rather than implying a one-click migration.
- **FigJam** (`/alternatives/figjam`): no account or Figma seat, structured diagrams, workshop tools (facilitator, timer, votes, polls, estimate cards, temperature checks, quizzes, idea box, agendas, roll calls, pickers, decision records, stickers), API and MCP. No importer exists, and the FAQ says so; a Figma link embeds live on the canvas, but nothing syncs or imports between the two.
- **Lucidchart** (`/alternatives/lucidchart`): no plan limits on documents or shapes (a tab still has its own size cap, so the page never says a document can be any size). No importer exists; the honest route is through draw.io, which takes a Lucidchart diagram pasted from its editor and opens Visio files, then our draw.io import. Lucidchart imports Mermaid itself, so Mermaid import is never framed as our edge there.

**Candidates** researched for later, by search value: tldraw, Mural, Eraser, Whimsical, Mermaid Live / Mermaid Chart. Trello and Linear are liveplanner's to compare against now that Plan mode lives there.

## liveplanner

- **Compete on their ground**: Trello as a kanban board, Asana, Monday.com and ClickUp as work-management platforms, Notion as a workspace whose databases show as boards, Jira as an issue tracker, Airtable as a spreadsheet-database, and Smartsheet as spreadsheet-style project management. Where a competitor goes further (Jira's sprints and developer integrations, Airtable's relational bases, Asana's portfolios, Notion's docs, automation recipes and marketplaces generally), the page says so plainly, and "they are not a planner" is never a selling point.
- **Never invent a competitor's price.** Price cells say only "free plan, then paid plans", "paid plans per seat" or similar positioning; no tier names, limits or amounts.
- **Migration answers are honest.** There is no direct importer for any of these tools. The honest route is the board's CSV/TSV import (each row a card, landing in the column its Status names, with the person its Assignee names) or opening a CSV in a Sheet, and an FAQ says so rather than implying a one-click move (e.g. "there's no direct Trello importer; a CSV with a title column is all a board import needs").
- **Words**: copy says "project" for what a person creates; its tabs are Board, Sheet, Dashboard and Form tabs. Deep dives cover how boards, sheets, dashboards and forms work together in one project, and interop (CSV in and out, embeds, the API, MCP server and CLI for agents).

**The set**: Trello, Asana, Monday.com (`/alternatives/monday`), Notion, Jira, ClickUp, Airtable and Smartsheet, each compared against Plan: Board, Sheet, Dashboard and Form tabs, card types, plan views (Gantt chart, calendars, charts by field), forms whose answers become cards or rows, live collaboration and agent access.

**Retired comparisons**: the diagram-tool comparisons (Microsoft Whiteboard, Miro, XMind, Excalidraw, draw.io, Google Slides, FigJam and Lucidchart) left liveplanner when it narrowed to planning. Their old liveplanner.app addresses now land on the same comparison here, which livediagram or livedocuments answers.

**Candidates** for later, by search value: Linear, Basecamp, Wrike and Google Sheets (against Sheet tabs), each needing an honest angle first.

## livedocuments

- **Compete on their ground**: Google Slides as a presentation tool (slide pages and presenting), a design tool on infographics and posters, a writing tool on articles. Only a tool whose job is a kind of page livedocuments makes gets a comparison.
- **Claims found false**: read-only embeds for every link, Markdown import onto a new tab, importing another tool's files, no Figma integration, unlimited document size, a live status page, imports that send nothing to a server.
- **Deep dives** cover interop as Markdown import, PNG/SVG/PDF export, MCP for AI tools and embeds; the switching answer for Google Slides is "there's no Google Slides importer; start from a template".

**The set**: Google Slides (compared as a presentation tool, against slide pages and Presentation mode).

**Candidates** by fit: Canva (infographics, posters and social posts), PowerPoint and Gamma (decks), and Google Docs or Notion (articles). Each of those products is far deeper in its own job, so each needs an honest angle before it gets a page.

## livedesign

- **Compete on their ground**: a design tool on logos and wireframes, a photo editor on photos. Only a tool whose job is a kind of page livedesign makes gets a comparison.
- **Claims found false**: read-only embeds for every link, Markdown import, importing another tool's files, no Figma integration, unlimited design size, a live status page, imports that send nothing to a server.
- **Words**: copy says "design" for what a person makes. Deep dives cover interop as PNG/SVG/PDF export, the Logo Kit, PSD on photo pages, MCP for AI tools and embeds.

**The set**: Figma (`/alternatives/figma`), compared as a design tool on logos and wireframes and on the photo edits that go with them. Figma is the deeper product design tool (components, auto layout, prototypes, developer handoff), and the page says so. There is no Figma importer; a Figma link embeds live on the canvas.

**Candidates** by fit: Canva (logos), Balsamiq (wireframes) and Photopea or Pixlr (photo editing). Each of those products is far deeper in its own job, so each needs an honest angle before it gets a page.

## Suite comparisons

None yet. A suite comparison is one entry in `SUITE` (`lib/alternatives/index.ts`) naming every app it
draws on in `apps`; its rows, reasons and FAQs say which app does what, and every claim keeps each
named app's rules above. Candidates where the suite, not one app, is the honest answer: Notion
(liveplanner's boards and sheets with livedocuments' articles), Microsoft 365 or Google Workspace
(slides and documents with plans), and Canva (livedocuments' infographics with livedesign's logos).
A competitor that already has an app's page moves to the suite page under the same slug, so links
keep working.
