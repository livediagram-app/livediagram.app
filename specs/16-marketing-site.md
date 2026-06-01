# 16, Marketing site

The marketing app (`apps/marketing`) is the public landing site served at `/` (everything except `/live/*` and `/api/*`, see [08-router-app](08-router-app.md)). Static Next.js export, no SSR. It is the top of the acquisition funnel: its only job is to explain what livediagram is and send visitors to `/live/new`.

## Golden rule: claims map to shipped features

**Every feature claim on the marketing site must correspond to something a visitor can actually do today.** No aspirational copy, no roadmap dressed as present tense.

- If a feature is not built (export, teams/permissions, Pro specifics, true concurrent/CRDT editing, see [02-prototype-scope](02-prototype-scope.md)), it does **not** appear on the landing page, even softened.
- When the editor gains or loses a feature, update the landing page in the same change. Drift between the page and the product is a bug.
- Counts (templates, themes, shapes) must match the source of truth ([09-canvas-and-command-palette](09-canvas-and-command-palette.md), `apps/live/lib/templates.ts`, `apps/live/lib/themes.ts`). As of this spec: **16 templates** (8 default + 8 extra, including Mobile / Laptop / Slide-deck wireframes that pair with the device-frame shapes and a Flywheel momentum loop), **18 themes** (12 default + 6 extra).
- Be honest about trade-offs where it builds trust: realtime is **last-write-wins**, not CRDT, say so rather than implying conflict-free merging.

## Structure

Single landing page (`app/page.tsx`) with a sticky header, hero, themed feature sections, a closing CTA, and a footer. Feature sections group related capabilities (rather than two large catch-all grids) and alternate the `tinted` background for rhythm.

0. **Header** (`components/Header.tsx`), sticky bar with the `Brand`, the **social share row** (see below), and the primary CTA → `/live/new` ("Start drawing").
1. **Hero** (`components/Hero.tsx`), headline ("A picture tells a thousand words, tell your story"), conversion-focused subhead, a single primary CTA → `/live/new` ("Start drawing") with a no-sign-up note, and the animated `HeroIllustration`. The illustration runs one 16s `hero-*` timeline with **no per-element delays**, so entrances are staggered via keyframe percentages and the whole canvas clears together (then a brief blank) before rebuilding; the beats are build → theme recolour → rename a box → comment → teammate cursor → clear. The editor chrome stays put; only the canvas content clears.
2. **Simple by design** (`#why`): the positioning lead-in. Tagline "Simple by design, powerfully deep" plus the easy-yet-powerful duality (start in one click, looks simple/runs deep, multiplayer with no setup, works on any device) and the three easiest-start features: templates, themes, and wireframe-ready device frames (browser / monitor / laptop / phone / tablet, paired with the mobile / laptop / slide-deck wireframe templates). The duality cards use light icon badges; the templates / themes / wireframe cards keep their canvas mocks.
3. **Collaboration** (`#collaboration`, tinted): the shared-canvas story. Editor/view-only links, live presence, selection glow, realtime edits, comments, the laser pointer, and stop-sharing/revoke.
4. **Refine** (`#refine`): working the canvas: multi-select, group, lock, format painter, folders. (The earlier `#features` "Draw" section that itemised shapes + arrows was retired; the shape library and arrow styles are demonstrated in the hero illustration and via templates instead, and the section count stayed manageable.)
5. **Tabs** (`#tabs`, tinted): unlimited tabs per diagram, link elements across tabs, copy a tab into another diagram (a one-time copy, not a live sync), lock a tab, reorder and theme-colour-code. Tabs have no manual colour or order field: order is array position (drag), colour is derived from the tab's theme accent.
6. **Diagrams you can rely on** (`#reliability`): autosave, undo/redo, activity log + revert, durable save (survives a refresh). Reliability-focused; the link/revoke tiles moved up into Collaboration and the collaborator-name tile was dropped. Note: undo/redo is capped at `HISTORY_LIMIT = 3` steps, so the copy says "recent edit", not unlimited.
7. **Open and honest** (`#foundations`, tinted): MIT license, self-host, no telemetry. See [03-open-source-and-business-model](03-open-source-and-business-model.md).
8. **Closing CTA** (`#get-started`), "no sign-up wall" message + `/live/new`.

The primary CTA reads **"Start drawing"** everywhere (header, hero, closing CTA), keep it consistent.

Reusable building blocks: `Section` + `FeatureGrid` (`components/Section.tsx`), `Header`, `Footer`, `Brand` (from `@livediagram/ui`). Add new feature cards by editing the `items` arrays in `page.tsx`, do not fork the grid.

## Social sharing

Word of mouth is part of the acquisition funnel, so the page lets a happy visitor pass it on in one click. `components/ShareButtons.tsx` renders a **"Share" button** (share-nodes icon) in the header, just left of the "Start drawing" CTA. Clicking it opens a small **popover** listing the share targets (X, LinkedIn, Facebook, WhatsApp, email) plus a **Copy link** action. The popover closes on outside click or Escape; the button keeps its icon at every width and shows the "Share" label from the `sm` breakpoint up.

- **Share targets are plain anchor links** to each network's public share-intent URL (`twitter.com/intent/tweet`, `linkedin.com/sharing/share-offsite`, `facebook.com/sharer`, `wa.me`, `mailto:`). No SDKs, no tracking pixels (keeps the "no tracking pixels" claim honest under [03](03-open-source-and-business-model.md)). They open in a new tab (`target="_blank"` + `rel="noopener noreferrer"`) and close the popover on click.
- **Copy link** uses the Clipboard API to copy the canonical URL and flips its row to "Link copied" for a beat.
- The shared URL is the canonical production site (`https://livediagram.app`) and the share text mirrors the product's one-line description. Both live as constants in the component, update them together if the positioning copy changes.
- The component carries the only `'use client'` boundary on the page; everything else stays a server component for static export.

**Feature-card illustrations.** Every feature card carries a small animated mock of the real editor surface it describes (`components/FeatureArt.tsx`), passed via the card's `art` slot. Like the hero, the motion is **pure CSS**, shared keyframe classes (`fa-*`) live in `app/globals.css`, so it works under static export with no JS and settles to a finished frame under `prefers-reduced-motion`. The mocks must stay faithful to how the feature actually looks (brand-blue rounded shapes, dot-grid canvas, presence avatars, the explorer / share / activity panels); when a feature's UI changes, update its art. This is part of the golden rule above, an illustration is a claim too.

## Tone & brand

- Product name **livediagram** (lowercase). Brand colour sky-blue `#0EA5E9` (`brand-500`), see [01-color-scheme](01-color-scheme.md).
- Fast, clean, structured. Plain and confident; not cutesy, not enterprise-jargon.
- Positioning: multiplayer-from-the-start diagramming for teams who think visually, between casual whiteboards and heavyweight suites (see [00-purpose](00-purpose.md)).

## Auth messaging

The canvas works without signing in, and that stays the headline ("no sign-up wall", [04-auth-and-guest-access](04-auth-and-guest-access.md)). Do not advertise account-only benefits (cross-device sync, teams) until they are shipped and verified end-to-end.

## Not yet present

- No `/pricing` page yet (the router reserves the path). Add one only when free/Pro tiers are concrete, Pro benefits are TBD ([03](03-open-source-and-business-model.md)).

## SEO and metadata

The marketing site is the indexable surface for the product, so its `<head>` carries the search and social signals. The editor at `/live/*` and the API at `/api/*` are not optimised for organic search (the editor lives behind client-side bootstraps and has nothing useful to index).

- `metadataBase`: `https://livediagram.app`. Lets relative paths in metadata resolve into absolute URLs (the canonical, OG image, sitemap entries).
- `alternates.canonical`: every static page declares its own canonical (`/`, `/faq`, `/terms`, `/privacy`). Stops query-string variants and the `www` mirror from competing with the canonical form.
- `openGraph`: title, description, url, siteName, locale (`en_GB`), type (`website` for the landing page, `article` for FAQ/legal). Mirrors the page-level title/description so social cards match the actual head.
- `twitter`: card `summary_large_image`, title, description. The card image falls back to the favicon until a dedicated OG image lands; copy stays identical to the OG / page-level title and description.
- `robots`: explicit `{ index: true, follow: true }` on every page. The hosted product wants indexing; ambiguity about defaults is the kind of thing a future migration silently breaks.
- `app/sitemap.ts`: lists the four indexable URLs (`/`, `/faq`, `/terms`, `/privacy`) with `lastModified: new Date()` at build time. Next.js generates `/sitemap.xml` at the root from this.
- `app/robots.ts`: allows the marketing routes, points at the sitemap, and `Disallow`s `/live/` and `/api/`. The router worker stitches all three apps onto the same hostname, so an unconditional allow would let crawlers waste budget on the editor's auth-walled HTML and the API's JSON responses. The live app also declares `noindex, nofollow` at its root layout (see [07-live-app.md](07-live-app.md)) as the in-page complement; together the two signals tell crawlers to skip the live app entirely.
- **`viewport` export** (Next 15 metadata API): the root layout exports a `Viewport` object carrying `themeColor: '#0EA5E9'` (brand-500, see [01-color-scheme](01-color-scheme.md)) and `colorScheme: 'light'`. The first tints mobile browser chrome (Android Chrome's URL bar, iOS PWA status bar) to the brand, the second declares the site is light-mode-only (no dark theme has shipped). Both are head meta, not page content, so they don't conflict with the "claims map to shipped features" rule.
- **`app/manifest.ts`**: emits `/manifest.webmanifest` at build time with `name`, `short_name`, `start_url: '/'`, `display: 'standalone'`, the brand theme + background colours, and the existing `/icon.svg` as the icon (which `purpose: 'any'` covers since the SVG is monochrome on a single brand stroke). Surfaces the Android Chrome "Add to Home Screen" prompt + the iOS Safari "Add to Home Screen" landing icon, with no behaviour change for normal page loads. Same `export const dynamic = 'force-static'` opt-in as robots.ts / sitemap.ts so it round-trips through `output: 'export'`.
- **JSON-LD structured data**: the root layout renders a single `<script type="application/ld+json">` carrying a `@graph` of two schema.org types: `WebSite` (so the brand-name search produces a rich result) and `SoftwareApplication` (so the product is categorised correctly in browse / category-style results). Both schemas restate facts already in the page (name, url, description) and the SoftwareApplication offer is `price: "0"` (truthful: the hosted product is free to use today; the Pro tier hasn't shipped). No claims that aren't already true on the surface.
- **FAQ JSON-LD**: `/faq` emits an additional `<script type="application/ld+json">` with schema.org `FAQPage` + a `Question` / `Answer` pair per entry. Unlocks Google's "expandable FAQ" rich result for the page. The JSON-LD `acceptedAnswer.text` is the plain-text form of each answer; entries that render JSX (a link to /privacy in the data-storage question, for instance) carry a parallel `aText` field with the same sentence, sans markup. The FAQ component reuses the existing `FAQS` array as the source so the structured data can't drift from the visible content.

When a new public page lands, add it to both `app/sitemap.ts` and its own metadata block (with `alternates.canonical`). Updating one without the other is a regression.

## Content pages (FAQ, legal)

`/faq` (`app/faq`), `/terms` and `/privacy` (`app/terms`, `app/privacy`) are static routes. Terms and Privacy use the shared `components/LegalPage.tsx` shell; FAQ is a question/answer list. All share the `.legal-prose` styling in `globals.css`. The footer links to FAQ / Terms / Privacy / Contact (a `mailto:`), plus a GitHub link by the licence, a Manager Toolkit cross-promo, and an author link (tommcclean.me). These are plain-English first drafts grounded in what the hosted service actually does (Cloudflare for hosting/DB, Clerk for auth, a localStorage guest id, no trackers/telemetry); they have **not** had legal review, and the contact address (`hello@livediagram.app`) and any governing-law / legal-entity details are placeholders to confirm. Keep the privacy page honest against the data the product really touches (it backs the "no tracking pixels" claim).
