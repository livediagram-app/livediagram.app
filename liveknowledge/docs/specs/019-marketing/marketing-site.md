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
- What v1 leaves for later is said plainly where a visitor would expect it, never implied: databases, page-level permissions, semantic search, public sites with their own domain, Google Docs import, attachments other than pictures, a native mobile app. (The Review Due email is built: verification.md "Reminders".)
- **Ask** is always described with who pays: the team, on its own Claude or OpenAI key. **Describe to Set Up** runs on built-in AI (Cloudflare Workers AI, liveknowledge's) when the team has no key, and on the team's key when it has one ([Describe to Set Up](../030-knowledgebase/describe-to-set-up.md) "The model"), so the site never says liveknowledge runs no model of its own. Search, verification and everything else need no model and no key.
- Counts match their source: the templates are the knowledgebase structures (`@liveknowledge/knowledge` `SETUP_STRUCTURES`, thirty-two) under their eight groups; a test pins any count the copy writes out.
- A picture of the product is drawn (SVG and React in the app), never a screenshot, and never shows real data.

## Structure

The landing page (`app/page.tsx`), top to bottom:

1. **Header**: the shared `SiteHeader` (Build with AI, Explorer, the account menu when signed in).
2. **Hero** (below).
3. **Templates** (`#templates`): "Browse every template", the shared template band over the **knowledgebase structures** (owner, 2026-11-21: "Templates should do more than create a single page, they should be entire knowledgebase structures, not about the content so much"; [Describe to set up](../030-knowledgebase/describe-to-set-up.md#the-start-screen)), the same thirty-two the editor's start offers. Its shelves are the structures' eight groups of four, so an open shelf fills its four-across row (Company first, open on load; Engineering; Product; Customers; Operations; Community; Education; Personal), Blank Knowledgebase leading the folded group tiles as a link that makes a blank knowledgebase (no group of its own; owner 2026-11-21). Each card is the structure, not a picture of a page, as on the editor's start: its name and its page count ("13 Pages"), its picture as the editor's start draws it ([Describe to set up](../030-knowledgebase/describe-to-set-up.md#the-start-screen) "A card's picture": a miniature knowledgebase window in its group's colour, its real top pages in the tree, its emblem on the chosen page's cover), and its one line. Every card is a link that makes a new knowledgebase from that structure straight away (`/new?structure=<id>` as `Home.Gallery`, [New document route](../007-editor/new-document-route.md) "The other parameters"); a folded group's tile fans its first three structures, each drawn small as the same window (its group's colour, its emblem on the cover, its tree as bars), and the folded groups' structures are plain links under the tiles ("Every Template A to Z"). The data is `lib/template-gallery.ts`, the card `components/StructureCard.tsx`; the shared band (`@liveworkspace/marketing-site` `TemplateGallery`) is unchanged, so the other products' galleries are too. It comes right after the hero (owner, 2026-11-21), so the first scroll shows what a knowledgebase can start as. The hero has no template search, so nothing else on the page finds a structure.
4. **Promises** (`PromisePrism`): "Built With Your Values in Mind", four promises on the deep band, the prism's light landing on each, each with its title and one line and, set large in its hue, a short value where one helps: No Account Needed (no value: its title says it all, as in every app since #2091), **MIT** Open Source, **0 trackers** Private by Design, **Live** Real-Time Collaboration.
5. **Six feature sections** (below), alternating which side the art sits and the tinted ground, each with a link to its own page (`/features/<id>`, "Feature pages").
6. **Build With AI** (`BuildWithAiBand`): the MCP server and the CLI, beside a drawn transcript of an agent's three calls, linking to `/ai`.
7. **Community**: the six featured knowledgebases, loaded after the page.
8. **Privacy** (`#privacy`): the shared privacy band with this product's six promises.
9. **FAQ** (`#faq`): the landing questions (`LANDING_FAQ` in `lib/faq-content.tsx`), each a native `<details>`, with a link to `/faq`.
10. **Closing CTA** (`#get-started`) and the shared **Footer**.

### Hero

A band in the brand mark's lime (`@liveknowledge/ui` `hero-band.css`) over the dot grid and a drawn backdrop. From `sm` it takes the shared screen-filling height (`hero-tall.css`) under a lower cap of its own (`--hero-tall-cap: 46rem`, owner 2026-11-21: "less tall", then "a bit taller"), so the template band shows under it on a laptop. Two columns from `lg` (copy, then the illustration); one column below, the illustration under the copy.

- **Backdrop** (`components/HeroBackdrop.tsx`, owner 2026-11-21: "do more with the background, slightly illustrated"): a knowledgebase drawn faintly into the ground, one decorative inline SVG on each side. On the left a page tree, rows of page sheets joined by its elbow guides, one with a verified tick and one with a review due dot; on the right loose page sheets joined by dashed page links, one carrying a `[[` link chip. Lime on lime in light and slate on slate in dark (the band's own tokens), each side only as wide as the band's margin beside the content (cut at the window's edge, so it drifts in from off page) and masked so it fades towards the copy, never behind a word. Motion (owner 2026-11-21: "landing illustrations should be animated"): the right side's sheets float a few pixels each at its own pace, the dashes run along the page links, the tick and the due dot pop in turn (the `kb-*` classes, `app/feature-art/knowledge.css`); still under reduced motion, and the side's box is `content-visibility: auto`, so it rests once the hero scrolls away. Drawn from `xl`, where the band has that margin; below it the dot grid alone.
- **Badges:** "Open Source", and from `sm` "No Sign-Up to Start".
- **Headline (h1):** "Knowledge your team and its AI can trust." (`HERO_HEADLINE`), "trust" under a lime marker stroke.
- **Lead:** one sentence (owner, 2026-11-21: "too long"): "A team knowledgebase where every page has an owner and a verified date, and every answer names its source."
- **Primary CTA:** "Start a Knowledgebase", to `/new` as `Home.Hero`.
- **Import:** beside it, a quieter capsule as tall as the button: "Import From", then the **Notion** and **Confluence** marks and no other words (owner, 2026-11-21: "only the logos, to keep it smaller"). Each mark is a link to its own card on the Import page (`/features/import#from-notion`, `#from-confluence`), named by its accessible name ("Notion", "Confluence") and the shared `Tooltip` with the same word. The marks are simple inline SVG drawings of the two brands' own logos, in their own colours: the one place the site draws another product's logo, at the owner's request (the `/ai` page and the editor's Import dialog still draw none).
- **The illustration** (`components/HeroIllustration.tsx`, one inline SVG, 600 by 474, decorative with one label) is the Knowledgebase Home's drawing ([Knowledgebase Home](../030-knowledgebase/knowledgebase-home.md) "Hero") finished for the site: an isometric lime platform with a dashed ring; five small cubes in the other apps' colours (sky, violet, amber, rose, emerald), each joined by a dashed connector to one large lime cube whose faces carry lines of writing and a tick; above it two white cards with a lime offset shadow, a person's question and an agent's cited, verified answer, each joined to the cube by a dotted curve. The cards hold words, not grey bars: a question, its answer with a citation, the page it came from and who verified it. The amber cube stands for livedocuments and is the only amber on the site. From `lg` its column is 31rem wide, so the headline keeps two lines and the band stays short.
- **Motion:** the connectors' dashes run towards the cube, the ring turns slowly, the two cards float a few pixels, the small cubes bob in turn, the tick draws once on load. CSS only (`app/hero-animations.css`), all of it still under `prefers-reduced-motion`, and the drawing's box is `content-visibility: auto`, so nothing animates off screen. The hero's only script is the two marks' tooltips (the shared `Tooltip`, a small client island); the rest is static.
- The editor's Home and this hero draw the same picture from two copies; they should come to share one drawing in a package once the editor's Home settles.

### Feature sections

`LANDING_SECTIONS` (`lib/landing-content.tsx`), each a `StoryBeat`: its icon and plain name, a Title Case heading, two or three plain sentences, three ticked points, and its art in a framed card. The art shows at every width (under the text on a phone). Under its points each section links to its own page, **See Everything in <label>** (`/features/<id>`, "Feature pages").

| Id          | Heading                            | Says                                                                                                          | Art (`components/feature-art/`)                                            |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pages`     | Pages That Stay Organised          | The page tree, one continuous page, `[[` links and Linked From                                                | `PagesArt`: the tree beside a page with a page link and its backlinks      |
| `trust`     | Trust Built Into Every Page        | Owner, Verified, Review Due, the Review Period, Still Right                                                   | `TrustArt`: a page's meta row, Page Health and a page that has come due    |
| `ask`       | Ask, With Sources                  | Cited answers, the Sources rail, the trust line, a Knowledge Gap, the team's own Claude key                   | `AskArt`: a question, a cited answer, its sources and a gap card           |
| `agents`    | The Knowledgebase Your Agents Read | The MCP server and CLI, trust fields on every passage, suggested edits a person accepts, unanswered questions | `AgentsArt`: a passage with its trust fields, a suggested edit, a question |
| `import`    | Bring Everything With You          | Import a Markdown folder, a Notion or a Confluence export; export Markdown, PDF and Word                      | `ImportExportArt`: three sources into the knowledgebase, three formats out |
| `workspace` | Part of liveworkspace              | Live embeds from the five other apps, one account, Editor, Participant and Viewer roles, Offline, Drive       | `WorkspaceArt`: a page with an embedded item, and each app's logo          |

- The art is drawn in the app as SVG and React on one kit (`components/feature-art/kit.tsx`: the frame, the card with its lime offset shadow, ticks, pills, lines of writing), in the brand ramp and slate, following light and dark. One file per section, none past the shared 650-line limit.
- `WorkspaceArt` names each app with the shared brand component (`Brand` from `@liveknowledge/ui`: logo mark and wordmark), never a hand-drawn logo.
- Review Due is drawn in orange, the nearest hue to the editor's pill that keeps the fork's brand hue off the art.
- Motion is the kit's `fa-*` loops (`app/feature-art/core.css`) and the knowledgebase timeline (`kb-*`, `app/feature-art/knowledge.css`, owner 2026-11-21: "landing illustrations should be animated"): on one 8s loop, each drawing assembles in order (rows and cards rise in, lines of writing type in, ticks and pills pop) and holds, then starts again. Transform, opacity and a stroke's dash only; still, and finished, under reduced motion; each frame is `content-visibility: auto`, so a drawing off screen rests.

### Feature pages

Owner, 2026-11-21: "Each section on the landing page needs a drill-in page like livediagram does, where we explain the features in broken-down illustrated blocks." One page per landing section at `/features/<id>` (`app/features/[slug]/page.tsx`, static, `dynamicParams = false`), read from the same `LANDING_SECTIONS` entry, built as livediagram's are:

1. **Header** (surface `Feature`) and the breadcrumb (Home, then the section's label), with its `BreadcrumbList` JSON-LD.
2. **Hero** (`FeatureCategoryHero`): the section's glyph and label as the eyebrow, its heading as the h1, its description, **Start a Knowledgebase** (`/new`, `Feature.Hero`), and beside it from `lg` the section's landing art, so arriving from the beat reads as a continuation.
3. **Everything in <label>**: the section's `items`, six each, in the shared `FeatureGrid` (`@liveworkspace/marketing-site` `Section`): each a card with a small drawing over a Title Case name and two plain sentences, and a **Learn More** foot linking its help article (`/help/knowledgebase/…`, held by `lib/help-links.test.ts`). Each card's id is `featureAnchor(title)`, so the hero's Notion and Confluence marks land on theirs ("From Notion", "From Confluence").
4. **Explore More of liveknowledge** (`OtherCategories`): a link to each other section's page.
5. The closing CTA (`Feature.Closing`) and the footer.

| Id          | Cards                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pages`     | A Page Tree; Read First, Edit on Purpose; Links Between Pages; Linked From; Covers; Start From a Structure (Describe to Set Up)        |
| `trust`     | An Owner for Every Page; Verified, With a Name and a Date; Reviews That Come Due; Changed Since Verified; Page Health; Yours to Review |
| `ask`       | Every Claim Cited; A Sources Rail; It Does Not Guess; Your Own Claude or OpenAI Key; Search Needs No Key; Save an Answer as a Page     |
| `agents`    | An MCP Server; A Command Line; Always in Context; Trust Fields on Every Passage; Suggested Edits; AI Knowledge                         |
| `import`    | From Notion; From Confluence; A Folder of Markdown; A Review Before Anything Lands; Links Become Page Links; Export Whenever You Like  |
| `workspace` | Live Embeds From Five Apps; Editor, Participant and Viewer; Knowledgebase Style; Offline; The Google Drive Mirror; One Account         |

- **The card drawings** (`components/feature-art/cards/`, one file per section, on one kit, `cards/kit.tsx`) sit in the shared `Frame` (300 by 96), drawn in the brand ramp and slate, following light and dark, with the same golden rule as everything else: each shows something the product does today, with words on it, never a screenshot. Animated on the same `kb-*` timeline as the landing art (rows rise in, lines type in, ticks and pills pop, arrows draw, a caret blinks), each piece at its own delay; the shared `Frame` is `content-visibility: auto`, so only the cards on screen move, and reduced motion shows each drawing finished.
- **Metadata:** `pageMetadata` with `/features/<id>`, the title "<label>: <heading> | liveknowledge" and the section's `metaDescription` (50 to 160 characters, `lib/meta-descriptions.test.ts`).
- **Sitemap:** each page is listed (`changeFrequency` monthly, priority 0.7).
- Automations are not a section yet: when they are built in liveknowledge, they arrive as a seventh section and page.

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
- **Social card** (`app/opengraph-image.tsx`, `twitter-image.tsx`, 1200 by 630): the shared card (`@liveworkspace/ui/social-card`) on the lime ground with the brand's lime cube, the `knowledge` wordmark, the headline "Knowledge your team and its AI can trust." (`HERO_HEADLINE`) and the pitch (`lib/social-card.tsx`). Comparison pages draw their own from the same card.
- **JSON-LD** (`app/layout.tsx`): Organization, WebSite and SoftwareApplication (free, `applicationCategory` BusinessApplication). `/faq` and each comparison emit FAQPage; the comparisons hub an ItemList; inner pages a BreadcrumbList.
- **Sitemap** (`app/sitemap.ts`): `/`, `/ai`, `/faq`, each `/features/<id>`, `/alternatives` and each comparison, `/licences`, the gallery.
- **Manifest** (`app/manifest.ts`): installable, lime theme colour.
- `/licences` reads the generated licence manifest for this product; `/terms`, `/privacy` and `/security` are the shared stubs.
- The site words in `@liveknowledge/ui` (`SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_PITCH`, `renderSocialCard`) are still the fork's and are read by the help centre and the editor's share rail; the marketing app does not use them. Moving `lib/site-words.ts` and `lib/social-card.tsx` into `@liveknowledge/ui` is the follow-up.

## Content pages (FAQ)

`/faq` is the shared FAQ browser over `FAQ_CATEGORIES` (`lib/faq-content.tsx`): Getting Started, Trust and Verification, Ask and AI, Agents, Import and Export, Sharing and Privacy. Every answer is a plain statement of what is built, including what is not (Google Docs import, page-level permissions). Price is said as it stands, never promised: free to start, and no paid tier at launch ("Is there a paid tier?", whose answer never says "no paid tier" as a promise). The answers cover reading and editing (a page opens to read; Edit opens a shared draft), the roles (a Participant is an Editor minus the Review Period, Knowledgebase Style, AI Settings and sharing), covers, AI Context and Always in Context, Describe to Set Up on built-in AI, and the Review Due email. The landing page shows eight of them (`LANDING_FAQ`).

## Performance

- The hero and every feature art are static inline SVG in the exported HTML, drawn once (never per breakpoint), animated by CSS alone. The landing page adds no script for them.
- The template band and the Community section are loaded with `next/dynamic`, so their hydration is deferred; the template band's markup is in the HTML right under the hero.
- The hero's backdrop and the feature pages' card drawings are inline SVG with no script; their motion is CSS on transform, opacity and stroke dash offset only, and rests off screen (`content-visibility: auto`).
- Art that loops is `content-visibility: auto`, so it rests while off screen.
