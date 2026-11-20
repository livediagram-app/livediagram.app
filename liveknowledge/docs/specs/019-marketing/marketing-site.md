# Marketing site

Status: **built, not yet verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) step 14).

The marketing app (`apps/marketing`) is the public site served at `/` (everything the router does not hand to the editor's routes, `/api/*` or `/telemetry`, see [Router app](../016-platform/router-app.md)). Static Next.js export, no SSR. Its job is to say what liveknowledge is and send a visitor to `/new`.

What every product's marketing site has in common lives once, in `@liveworkspace/marketing-site` ([its README](../../../../packages/marketing-site/README.md)): the page hero, sections, the CTA link and band classes, the Build with AI page, the FAQ browser, the licences page, the template band, the privacy band, the shared stylesheets and the source guards. This app keeps its words, its art, its routes and its header and footer, and hands them over as props.

## The pitch

**A team knowledgebase, for people and for AI.** ([Purpose](../001-project-vision/purpose.md).) The site sells four things, each a shipped feature: trust is part of the page, agents are first-class readers, Ask does not guess, and it belongs to the workspace.

**Knowledgebase** is one word in every string a reader sees. The product is never called a "wiki" and never a "knowledge base"; "wiki" appears only where a page compares liveknowledge with the wiki category (a comparison's heading or prose, a search description). `lib/product-claims.test.ts` holds this.

## Golden rule: claims map to shipped features

**Every claim on the site is something a visitor can do today.** No roadmap in the present tense.

- What the fork brought and liveknowledge cut ([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md)) is never named as ours: slides, slide decks, infographics, flashcards, posters, PowerPoint, page layouts, presenting, presenter notes, paper sizes, GIF export. `lib/product-claims.test.ts` fails if one returns to the landing copy, the FAQ or a comparison. A sentence that says liveknowledge is _not_ a slide or page layout tool (the FAQ's "What is liveknowledge not?", pointing at livedocuments) is the one exception, and the test names it.
- What v1 leaves for later is said plainly where a visitor would expect it, never implied: databases, page-level permissions, semantic search, public sites with their own domain, Google Docs import, attachments other than pictures, a native mobile app, reminder emails.
- **Ask** is always described with who pays: the team, on its own Claude API key. Search and everything else need no key.
- Counts match their source: the templates are `@liveknowledge/templates`' catalogue (writing only) under its five categories (Engineering, Handbooks, Onboarding, Product, Support); a test pins any count the copy writes out.
- A picture of the product is drawn (SVG and React in the app), never a screenshot, and never shows real data.

## Structure

The landing page (`app/page.tsx`), top to bottom:

1. **Header**: the shared `SiteHeader` (Build with AI, Explorer, the account menu when signed in).
2. **Hero** (below).
3. **Promises** (`PromisePrism`): "Built With Your Values in Mind", four promises on the deep band, the prism's light landing on each: No Account Needed, Open Source, Private by Design, Real-Time Collaboration.
4. **Six feature sections** (below), alternating which side the art sits and the tinted ground.
5. **Build With AI** (`BuildWithAiBand`): the MCP server and the CLI, beside a drawn transcript of an agent's three calls, linking to `/ai`.
6. **Templates** (`#templates`): the shared template band over the catalogue, Blank Slate open, then the five categories. Every card creates that page straight away (`/new?template=<kind>`).
7. **Community**: the six featured knowledgebases, loaded after the page.
8. **Privacy** (`#privacy`): the shared privacy band with this product's six promises.
9. **FAQ** (`#faq`): the landing questions (`LANDING_FAQ` in `lib/faq-content.tsx`), each a native `<details>`, with a link to `/faq`.
10. **Closing CTA** (`#get-started`) and the shared **Footer**.

### Hero

A band in the brand mark's lime (`@liveknowledge/ui` `hero-band.css`) over the dot grid, filling the first screen from `sm` up to a cap (`hero-tall.css`). Two columns from `lg` (copy, then the illustration); one column below, the illustration under the copy.

- **Badges:** "Free and Open Source", and from `sm` "No Sign-Up to Start".
- **Headline (h1):** "The knowledgebase your team and its AI both trust."
- **Lead:** the pitch line, then one sentence: every page has an owner and a verified date, every answer names its source, and agents read the same pages under the same rules.
- **Primary CTA:** "Start a Knowledgebase", to `/new` as `Home.Hero`.
- **Secondary CTA:** "Import From Notion or Confluence", to the page's own `#import` section, which says where import lives (the editor's Import dialog) and what it takes. `/new` has no import entry of its own.
- **The illustration** (`components/HeroIllustration.tsx`, one inline SVG, 600 by 474, decorative with one label) is the Knowledgebase Home's drawing ([Knowledgebase Home](../030-knowledgebase/knowledgebase-home.md) "Hero") finished for the site: an isometric lime platform with a dashed ring; five small cubes in the other apps' colours (sky, violet, amber, rose, emerald), each joined by a dashed connector to one large lime cube whose faces carry lines of writing and a tick; above it two white cards with a lime offset shadow, a person's question and an agent's cited, verified answer, each joined to the cube by a dotted curve. The cards hold words, not grey bars: a question, its answer with a citation, the page it came from and who verified it. The amber cube stands for livedocuments and is the only amber on the site.
- **Motion:** the connectors' dashes run towards the cube, the ring turns slowly, the two cards float a few pixels, the small cubes bob in turn, the tick draws once on load. CSS only (`app/hero-animations.css`), all of it still under `prefers-reduced-motion`, and the drawing's box is `content-visibility: auto`, so nothing animates off screen. No script runs for the hero.
- The editor's Home and this hero draw the same picture from two copies; they should come to share one drawing in a package once the editor's Home settles.

### Feature sections

`LANDING_SECTIONS` (`lib/landing-content.tsx`), each a `StoryBeat`: its icon and plain name, a Title Case heading, two or three plain sentences, three ticked points, and its art in a framed card. The art shows at every width (under the text on a phone). There are no `/features/<id>` pages: each section is whole on the landing page.

| Id          | Heading                            | Says                                                                                                          | Art (`components/feature-art/`)                                            |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pages`     | Pages That Stay Organised          | The page tree, one continuous page, `[[` links and Linked From                                                | `PagesArt`: the tree beside a page with a page link and its backlinks      |
| `trust`     | Trust Built Into Every Page        | Owner, Verified, Review Due, the review interval, Still Right                                                 | `TrustArt`: a page's meta row, Page Health and a page that has come due    |
| `ask`       | Ask, With Sources                  | Cited answers, the Sources rail, the trust line, a Knowledge Gap, the team's own Claude key                   | `AskArt`: a question, a cited answer, its sources and a gap card           |
| `agents`    | The Knowledgebase Your Agents Read | The MCP server and CLI, trust fields on every passage, suggested edits a person accepts, unanswered questions | `AgentsArt`: a passage with its trust fields, a suggested edit, a question |
| `import`    | Bring Everything With You          | Import a Markdown folder, a Notion or a Confluence export; export Markdown, PDF and Word                      | `ImportExportArt`: three sources into the knowledgebase, three formats out |
| `workspace` | Part of liveworkspace              | Live embeds from the five other apps, one account, Editor, Participant and Viewer roles, Offline, Drive       | `WorkspaceArt`: a page with an embedded item, and each app's logo          |

- The art is drawn in the app as SVG and React on one kit (`components/feature-art/kit.tsx`: the frame, the card with its lime offset shadow, ticks, pills, lines of writing), in the brand ramp and slate, following light and dark. One file per section, none past the shared 650-line limit.
- `WorkspaceArt` names each app with the shared brand component (`Brand` from `@liveknowledge/ui`: logo mark and wordmark), never a hand-drawn logo.
- Review Due is drawn in orange, the nearest hue to the editor's pill that keeps the fork's brand hue off the art.
- Motion is the kit's `fa-*` loops (`app/feature-art/core.css`), still under reduced motion; each frame is `content-visibility: auto`.

### Closing CTA

`StartDrawingCta`, on the deep band with the lime glow: "Start Your Knowledgebase", one line, **Start a Knowledgebase** (`/new`, `Home.Closing`) and **Browse Templates** (`/#templates`), then three ticks (Free for Everyone, Open Source, Works Offline).

## Tone and brand

Plain, concrete sentences. Title Case for headings and buttons. No em dashes. No superlatives and no stock AI phrasing. Brand lime ([`packages/tailwind-config/theme.css`](../../packages/tailwind-config/theme.css)): accent `#4d7c0f`, tints `#f7fee7` `#ecfccb` `#d9f99d`, dark accent `#a3e635`. Text on any ground is at least 4.5:1 in light and dark (`lib/brand-contrast.test.ts`).

## Auth messaging

The editor works without signing in, and the site says so. It also says what needs an account, because a knowledgebase's trust features do: Verify, Ask, AI Knowledge, sharing and the agent connection. A guest's knowledgebase is kept Offline in the browser until they sign in.

## Comparisons

`/alternatives` and `/alternatives/<slug>`, built from `lib/alternatives.ts` by `@liveworkspace/comparisons` ([its README](../../../../packages/comparisons/README.md) "liveknowledge"): Notion (`notion-wiki`, since `notion` is liveplanner's page), Confluence, Slite, Guru, GitBook and Outline, each compared as a team knowledge tool. Every page says where the other tool is the better pick, and where liveknowledge is behind: databases, page-level permissions, integrations, a mature mobile app, semantic search, public sites.

## SEO and metadata

- **Title:** "liveknowledge: A team knowledgebase, for people and for AI". **Description:** "A free, open-source team knowledgebase. Pages with owners and verified dates, cited answers on your own Claude key, and an MCP server your agents read." Both in `lib/site-words.ts`; the manifest reads the same description.
- **Social card** (`app/opengraph-image.tsx`, `twitter-image.tsx`, 1200 by 630): the shared card (`@liveworkspace/ui/social-card`) on the lime ground with the brand's lime cube, the `knowledge` wordmark, the headline "The knowledgebase your team and its AI both trust." and the pitch (`lib/social-card.tsx`). Comparison pages draw their own from the same card.
- **JSON-LD** (`app/layout.tsx`): Organization, WebSite and SoftwareApplication (free, `applicationCategory` BusinessApplication). `/faq` and each comparison emit FAQPage; the comparisons hub an ItemList; inner pages a BreadcrumbList.
- **Sitemap** (`app/sitemap.ts`): `/`, `/ai`, `/faq`, `/alternatives` and each comparison, `/licences`, the gallery. No `/features` entries.
- **Manifest** (`app/manifest.ts`): installable, lime theme colour.
- `/licences` reads the generated licence manifest for this product; `/terms`, `/privacy` and `/security` are the shared stubs.
- The site words in `@liveknowledge/ui` (`SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_PITCH`, `renderSocialCard`) are still the fork's and are read by the help centre and the editor's share rail; the marketing app does not use them. Moving `lib/site-words.ts` and `lib/social-card.tsx` into `@liveknowledge/ui` is the follow-up.

## Content pages (FAQ)

`/faq` is the shared FAQ browser over `FAQ_CATEGORIES` (`lib/faq-content.tsx`): Getting Started, Trust and Verification, Ask and AI, Agents, Import and Export, Sharing and Privacy. Every answer is a plain statement of what is built, including what is not (Google Docs import, page-level permissions, a paid tier). The landing page shows eight of them (`LANDING_FAQ`).

## Performance

- The hero and every feature art are static inline SVG in the exported HTML, drawn once (never per breakpoint), animated by CSS alone. The landing page adds no script for them.
- The template band and the Community section are loaded with `next/dynamic`, so their hydration is deferred.
- Art that loops is `content-visibility: auto`, so it rests while off screen.
