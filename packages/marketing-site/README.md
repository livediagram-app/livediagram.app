# @liveworkspace/marketing-site

What every product's marketing site has in common, built once. Each product hosts its own site
(`<product>/apps/marketing`) in its own colours and voice; this package holds the pages and pieces
they share, and the app hands over only its words, its art and its data.

```
packages/marketing-site/src
├─ components/
│  ├─ PageHero.tsx, Section.tsx, CtaLink.tsx, LegalRedirect.tsx
│  │                            the page hero, a feature section and its grid, the CTA link, the
│  │                            noindex redirect behind /terms, /privacy and /security
│  ├─ StartDrawingArt.tsx       the Try It card's line illustration
│  ├─ privacy/                  the landing page's Privacy band (PrivacySection, handed the product's
│  │                            promises) and its art (PrivacyArt; DataIsYoursArt takes the work's noun)
│  ├─ feature-art/              what every product's card art draws from: shared (Frame, colours, the
│  │                            teammate Cursor), canvas-marks, page-kit, versatility-parts
│  ├─ ai/                       the Build with AI page (BuildWithAi) and its client picker, code
│  │                            blocks, copy buttons, address card, prompts, control and help
│  ├─ faq/                      the FAQ browser (search, category index) and the question card
│  └─ licences/                 the /licences page body and its lazy licence texts
├─ lib/
│  ├─ ai-clients.ts             the AI clients as data, bound to a product by aiClients()
│  ├─ faq.ts                    the FAQ's shape, its plain-text answers and its search
│  ├─ licences-manifest.ts      reads generated/licences.json at build time
│  ├─ legal-moved.ts            the /terms, /privacy and /security stubs' metadata and words, by product
│  ├─ view-transition-guard.ts  the inline script that skips a transition into another app
│  ├─ hero-fan-boot.ts          the inline script that deals the hero fan's shuffled hand
│  ├─ silent-sign-in.ts         the inline script that signs a liveworkspace session in once the page is idle
│  └─ eyebrow, band-classes, feature-anchor, shelf-scroll
├─ css/                         hero-fan, promises, page-motion and licences stylesheets
└─ guards/                      the source guards, run over every product's marketing app and this
                                package (optical, touch targets, dark borders, rail, motion, size)

<product>/apps/marketing
├─ app/ai/page.tsx              wraps BuildWithAi in its header and footer, with its own words and art
├─ lib/ai-clients.ts            AI_PRODUCT (its name, MCP_URL, hosted MCP host) and its starter prompts
├─ lib/faq-content.tsx          its questions; components/faq/FaqBrowser.tsx hands them over
└─ app/licences/page.tsx        its heading and lede for the licences page
```

The components colour themselves with the app's `brand-*` Tailwind ramp, so the accent is the app's.
Each app's `globals.css` scans `packages/marketing-site/src` with `@source` and imports the shared
stylesheets from `@liveworkspace/marketing-site/css/*`; its `next.config.ts` transpiles the package.
Icons are drawn with `lucideGlyph` from `@liveworkspace/ui`, so the package needs no product's ui.

A product's words stay in the product: its starter prompts, its FAQ, the sentence that says what it
makes, its licences heading. Client components take only what a server page can pass; where the data
holds icons or JSX (the FAQ), the app hands it over from a thin client module of its own.

The guards in `src/guards` read the four apps' sources, so turbo lists those as this package's test
inputs (`turbo.json`, `@liveworkspace/marketing-site#test`). Each app keeps the tests that check its own
content (its claims, its counts, its help links, its motion budget).

| Product       | Its marketing-site spec                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| livediagram   | [marketing-site.md](../../livediagram/docs/specs/019-marketing/marketing-site.md)   |
| liveplanner   | [marketing-site.md](../../liveplanner/docs/specs/019-marketing/marketing-site.md)   |
| livedocuments | [marketing-site.md](../../livedocuments/docs/specs/019-marketing/marketing-site.md) |
| livedesign    | [marketing-site.md](../../livedesign/docs/specs/019-marketing/marketing-site.md)    |
