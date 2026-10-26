# How the monorepo is laid out

## The layout

```
liveworkspace/                 git root, one pnpm workspace, one lockfile, one turbo.json
├─ packages/                   shared by every product (@liveworkspace/*)
│  ├─ account-menu             the signed-in account menu, for liveworkspace.app and every app
│  ├─ agent-verbs              the parts of every product's CLI and MCP verbs that read no element union: addressing, refusals, argv lines
│  ├─ api-client               a product's api as its MCP and CLI call it (fetch, timeouts, ApiError)
│  ├─ api-kit                  the api Workers' plumbing and the protocol helpers their MCPs and CLIs share: responses and CORS, rate-limit keys, link unfurls, refusal logs, bearer and loopback reads, base64, the API-token shape, OAuth device codes and PKCE, and D1's compound-SELECT limit (`unionAll`, and the test databases' guard)
│  ├─ api-schema               the wire shapes every product's api, MCP and CLI agree on: access levels, presence, API tokens, build ids
│  ├─ auth-client              sign-in redirect, code swap, refresh, token check, the one return-path check
│  ├─ brand                    every app's logo drawn once: the Living Prism and wordmark, as React and as SVG strings
│  ├─ cli-kit                  a product CLI's shared modules: the io shape, exit codes and errors, config.toml, XDG paths, debug lines, credentials and the keychain, OAuth sign-in, the api transport, PNG pictures; each product binds its names
│  ├─ help-registry            a help centre's article shapes, links, grouping, search and telemetry ids; each product binds its catalogue
│  ├─ help-site                every help centre's pages, components, styles, SEO and catalogue checks; each product binds its own
│  ├─ explorer                 the One Explorer UI over the index, rendered at every app's /explorer
│  ├─ icons                    the line-art, Technology and sticker catalogues, the vendored Lucide glyphs, and their SVG markup
│  ├─ index-client             the One Explorer index contract: types, a client, the grant check
│  ├─ index-app                the server side of an app on the index: grants, internal doors, purge, outbox
│  ├─ community                the Community contract: apps, vocabulary, limits, wire shapes
│  ├─ comparisons              every app's comparison pages, built once; each app's marketing hosts its own
│  ├─ diagram-lint             the numbers and line formats livediagram's and livedocuments' diagram lint judge by
│  ├─ document-views           the agent views of a document that read no element union (budgets, elision, fields), for livediagram and livedocuments
│  ├─ drive                    the Drive mirror's contract: cadence, formats, the plan, wire shapes, backoff
│  ├─ edit-operations          the edit engine's parts that read no element union: element text, equality, result lines
│  ├─ email                    the one caller of Cloudflare Email Service's `send_email` binding, for accounts and every app
│  ├─ fake-google              an in-memory Google (Drive v3 and OAuth) for the Drive mirror's tests
│  ├─ model-core               what every product's model shares and needs nothing of its element union; each re-exports it
│  ├─ licences                 the /licences generator, its contract and the one pool of licence texts; each product binds its tables
│  ├─ marketing-site           the marketing pages every product shares (hero, Build with AI, FAQ, licences)
│  ├─ mcp-kit                  an MCP Worker's app: the Streamable-HTTP transport and CORS, the OAuth 2.1 server with the device grant, request and tool scopes, preview fonts, tool results and fixable errors; each product hands in its server and OAuth config
│  ├─ media                    the media contract: apps, upload limits, wire shapes, a client
│  ├─ migration                the move from the historical livediagram.app: the payload contract and the splitter
│  ├─ next-config              the Next.js settings every Next app spreads (liveworkspaceNextConfig)
│  ├─ oxlint-config            the lint rules every workspace runs, with the liveworkspace plugin
│  ├─ page-background          a colour background (fill, gradient, pattern, motion) and its parser: pages and form covers
│  ├─ prettier-config          the formatting settings, for the root and every product
│  ├─ render-png               SVG to PNG with resvg and the Inter fonts, for every api, mcp and cli
│  ├─ settings                 the settings scopes, shared keys, and each app's catalogue as plain data
│  ├─ settings-ui              the one Settings panel (this app or All) every app's Settings and liveworkspace.app open
│  ├─ sites                    liveworkspace's sites, for every logo's site switcher, and the one profile picture URL rule (`/picture`)
│  ├─ source-ast               parses the repo's own TypeScript, for the static guards that read code
│  ├─ style-guards             the motion tokens and the motion, optical and touch-target guards
│  ├─ tailwind-config          the Tailwind theme every app paints with, sky by default; each other product re-declares its ramps
│  ├─ template-previews        the template previews' hover motion, fan and story parts, for every editor
│  ├─ telemetry                the telemetry contract: apps, batch format, dashboard summary
│  ├─ telemetry-client         the browser side of telemetry, which each product binds to its app
│  ├─ trusted-types            the Trusted Types policies, boot script and header every app's pages share
│  ├─ ui                       the design system: buttons, fields, dialogs, menus, hints, optical primitives, hooks,
│  │                           chrome icons, appearance, browser repair and the site chrome a product binds
│  ├─ vitest-config            the Vitest defaults and test helpers every workspace extends
│  └─ workbench                the editor code all four editors share and that names no product: lib, hooks, primitives, menus, dialogs, tour shell
├─ liveworkspace/              the platform's own apps, and the packages only they use
│  ├─ apps/site                www.liveworkspace.app, one static site: the front door, /explorer, /telemetry, /status, /sign-in
│  ├─ apps/accounts            liveworkspace.app/api/auth and /api/account: sign-in, teams and tokens for every product
│  ├─ apps/community           liveworkspace.app/api/community: every app's listings, own D1
│  ├─ apps/media               liveworkspace.app/api/media and /api/previews: every app's images and previews, own D1 and R2
│  ├─ apps/index               liveworkspace.app/api/index: every app's items for the One Explorer, own D1
│  ├─ apps/telemetry           liveworkspace.app/api/telemetry: every product's events, own D1
│  ├─ apps/status              liveworkspace.app/api/status: hourly checks of every service, 90 days kept, own D1
│  ├─ apps/drive               liveworkspace.app/api/drive: the Google Drive mirror for every app, one Durable Object per person
│  ├─ apps/redirect            the bare liveworkspace.app: a page load's one 301 to www., everything else to the site
│  ├─ apps/migrate             the one-off move from the historical livediagram.app, run from a laptop, never deployed
│  ├─ docs/specs               the platform's specs and blueprints, one category per service
│  └─ packages/status          @liveworkspace/status, which only the site and the status Worker use: the one list of services, how an answer is judged, the history's wire shapes
├─ livediagram/                imported with full history; Diagram, Draw, Workshop
│  ├─ apps/                    editor, api, mcp, cli, marketing, help, community, router
│  └─ packages/                @livediagram/*
├─ liveplanner/                imported with full history; Plan
│  ├─ apps/                    the same set minus community
│  └─ packages/                @liveplanner/*
├─ livedocuments/              forked from livediagram in-tree (Pages mode only)
│  ├─ apps/                    the same set minus community
│  └─ packages/                @livedocuments/*
└─ livedesign/                 forked from livedocuments in-tree (logo, wireframe and photo pages)
   ├─ apps/                    live (its editor), api, mcp, cli, marketing, help, router
   └─ packages/                @livedesign/*, with photo-engine of its own
```

livedocuments (first called livepages) was forked from livediagram `main` at `82e6ed79a` on 2026-10-22
and cut down to Pages mode (livedocuments/plans/0001-livedocuments-fork.md); Phase 8 took Pages out of livediagram.

livediagram is now Diagram, Draw and Workshop. Plan (boards of cards, Sheets, dashboards and forms) lives in
liveplanner, and livediagram has no `items`, `sheets`, `forms`, `plan-art` or `page-background` packages any more
(livediagram/plans/0001-remove-plan-mode.md). A stored Plan tab opens in livediagram as an ordinary Diagram tab.

livedesign was forked from livepages (`livepages-phase-2` at `1eb2877a5`) on 2026-10-22 and cut down to
logo and wireframe pages, plus the photo pages ported from livediagram. What it makes is a design, never
a document. Logos and wireframes then left livedocuments, which keeps articles, slides and infographics.

liveplanner was forked from livediagram on 2026-10-21. At the fork, comparing each file with the product name
ignored gave these counts (taken before Plan left livediagram, so `packages/items` and `packages/sheets` are
liveplanner's alone now). They are why the sharing below was done:

|                                                                                                  | identical | changed | only in one |
| ------------------------------------------------------------------------------------------------ | --------- | ------- | ----------- |
| `apps/editor` (the editor)                                                                       | 2,718     | 1,248   | ~1,080      |
| `packages/document`                                                                              | 474       | 169     | 110         |
| `packages/ui`                                                                                    | 168       | 42      | 23          |
| `packages/templates`                                                                             | 142       | 95      | 21          |
| `packages/items`                                                                                 | 100       | 6       | 6           |
| `packages/sheets`                                                                                | 108       | 20      | 5           |
| `api-client`, `oxlint-config`, `prettier-config`, `render-png`, `source-ast`, `telemetry-client` | all       | 0       | 0           |

Copies drift as each product changes on its own, which is the case for sharing early. The last row moved to
`packages/` in step 1, below.

## The design

One platform with thin products. Everything two or more products use lives once, in `packages/`. A
product folder holds only what makes that product different.

```
liveworkspace/
├─ packages/                       @liveworkspace/*, used by every product
│  ├─ config-*                     tsconfig, oxlint, prettier, vitest, tailwind, next
│  ├─ auth-client
│  ├─ api-client, telemetry-client, render-png, source-ast, icons
│  ├─ document, document-views, edit-operations, agent-verbs, api-schema
│  ├─ templates, template-previews
│  ├─ help-site                    the help centre's pages, components and checks around each product's articles
│  ├─ marketing-site               the marketing pages every product shares (hero, Build with AI, FAQ, licences)
│  ├─ ui                           design system: buttons, menus, dialogs, tokens
│  ├─ workbench                    NEW: the editor shell lifted out of apps/editor:
│  │                               tabs, explorer, panels, chrome, split view, start
│  │                               screen, toasts, providers. A product hands it the tab
│  │                               kinds it offers.
│  └─ api-core                     NEW: the shared API routes (documents, sharing,
│                                  teams, tokens, trash) that each product's API Worker mounts
├─ liveworkspace/apps/
│  ├─ accounts                     sign-in, teams, tokens, settings
│  ├─ telemetry                    every product's anonymous events; the dashboard is the site's /telemetry
│  ├─ community                    every product's Community listings (liveworkspace/docs/specs/007-community)
│  ├─ media                        every product's uploaded images and previews (liveworkspace/docs/specs/006-media)
│  ├─ status                       hourly checks of every service and 90 days of history (liveworkspace/docs/specs/009-status)
│  ├─ index                        the One Explorer's index: every product's items, folders and sharing in one place
│  ├─ drive                        the Google Drive mirror, for every product
│  └─ site                         liveworkspace.app: the front door, the Explorer, Settings, the telemetry dashboard
├─ livediagram/
│  ├─ apps/editor                  thin: workbench + mode-draw (Diagram, Draw and Workshop)
│  ├─ apps/api                     api-core + the diagram-only routes
│  ├─ apps/…                       marketing, help, mcp, cli, community: product-specific
│  └─ packages/                    mode-draw (canvas tabs), diagram, diagram-lint, sticky-*
└─ liveplanner/
   ├─ apps/editor                  thin: workbench + mode-plan
   ├─ apps/api                     api-core + the planner-only routes
   ├─ apps/…                       marketing, help, mcp, cli
   └─ packages/                    mode-plan (Board, Sheet, Dashboard and Form tab kinds), items,
                                   sheets, forms, plan-art
```

Tabs are the example you gave. The tab strip, tab state, opening, reordering and splitting all
live in `workbench`. What's _inside_ a tab is a tab kind that a mode registers: a canvas from
`mode-draw`, a board or sheet from `mode-plan`. livediagram registers only `mode-draw`, and liveplanner
only Plan's.

Each product keeps its own deployables, databases and branding, on the one liveworkspace Cloudflare account. Shared
packages take the product's name, URLs and feature flags as configuration rather than
hard-coding them.

## Getting there, safest first

Each step is its own PR, and both products build and pass their tests after every one.

1. **Move the identical packages** (`api-client`, `telemetry-client`, `render-png`, `source-ast`,
   the style guards and the config packages) to `packages/` as `@liveworkspace/*`, then repoint
   imports in every product. This is mechanical and checked by typecheck. **Done**:
   - `prettier-config`, `vitest-config`, `oxlint-config`, `next-config`, `api-client`, `render-png`,
     `source-ast` and `style-guards` are one copy each. The platform packages and liveworkspace's site no longer borrow livediagram's
     configs. The lint plugin is `liveworkspace` (`liveworkspace/no-native-title`,
     `liveworkspace/no-raw-icon-svg`), the coverage variable `LIVEWORKSPACE_COVERAGE`, and every
     Next app spreads `liveworkspaceNextConfig()`.
   - `telemetry-client` is one copy of the code. Each product keeps a binding of about 60 lines
     as `@<product>/telemetry-client`: its app on the telemetry service, its preferences key
     (unchanged, so nobody's saved preferences or opt-out reset), its vocabulary's types and its
     error and timing tokens from its own `api-schema`. Those are product vocabulary, so they stay per
     product (the shared part of `api-schema` moved in step 3).
   - `tailwind-config` differed per product, so it moved in step 2.
2. **Small-drift packages** (`diagram-lint`, `document-views`, `icons`; `items`, `forms`, `plan-art` and
   `sheets` are liveplanner's alone now, so they stay in liveplanner): settle each diff. For each one, decide whether it's real product
   behaviour, which becomes config, or just one side being behind, where the newer side wins.
   Then move. **Done** for `diagram-lint`, `document-views`, `page-background`, `help-registry`, `tailwind-config`, `icons` and `licences`:
   - `page-background` and `icons` were one side behind (livedesign's and livediagram's copies were the
     supersets), so each is one copy with no product binding. The Lucide manifest is the union of the
     four products' glyphs; each glyph is a named export, so no bundle grows.
   - `help-registry` is one copy of the shapes, hrefs, grouping, search and telemetry ids. Each
     product's `@<product>/help-registry` keeps only its catalogue (categories and articles) and its
     telemetry-id overrides, bound with `createHelpRegistry` and `createHelpTelemetryIds`.
   - `tailwind-config` is one theme, sky by default, which livediagram and liveworkspace.app import
     as it is. liveplanner, livedocuments and livedesign keep `@<product>/tailwind-config` as their
     palette only: the shared theme, then their brand ramps; a test in the shared package keeps those
     palettes to brand tokens. Motion only one app drew moved into that app's stylesheet.
   - `licences` is one engine, one contract for the /licences page and one pool of committed texts.
     Each product's `@<product>/licences` keeps its tables (apps, overrides, embedded works) and a
     generate script that hands them to `generateLicences`.
   - `help-site` is one copy of the help centre around each product's articles: the layouts, pages and
     components, the MDX styles, the SEO helpers (metadata, social cards, JSON-LD, sitemap), the styles
     and the catalogue checks. Each help app binds it with `createHelpSite` on the server and a small
     client provider. It keeps its articles and illustrations, catalogue, card art, header and footer,
     home layout and page copy. The help pages' tints now follow each product's brand (livedocuments and
     livedesign had kept livediagram's sky).
   - `diagram-lint` and `document-views` were mostly typed on each product's element union, so only what reads no
     product's elements moved. `@liveworkspace/document-views` holds the view text helpers (`text`, with livediagram's
     newer `cellText`), field reads, view attributes, budgets and elision (with the `ViewDoor` and `Elision` shapes they
     read, the same as each `api-schema`'s), reading order and freehand runs over any element, and the shared view
     constants. `@liveworkspace/diagram-lint` holds the report text over a product's own codes, label quoting, the
     logger, the shared `LINT_*` numbers and `createSortFindings`: 22 files, about 1,200 lines with their tests, about
     1,100 lines fewer in each product. Each product's package keeps its name and surface, binds `Placed` and
     `FreehandRun` to its `Element` and `sortFindings` to its `LINT_CODES` and `LINT_SEVERITY`. Still in each product:
     the views, the lint context and checks, typed on its `Element` and `Tab`, and the wire types in its `api-schema`,
     whose lint codes and view names really differ (livediagram's group, aspect and colour checks, livedocuments'
     `pages` view).
   - `help-site` and `marketing-site`, second slice: what the help and marketing apps still had in two or more
     copies. Thirteen in-article illustration modules (troubleshooting, the settings dialog, account settings, the
     CLI, account, canvas links and notes, collaboration, explorer imports, palette rows, the drawing tools, privacy,
     tips, the title bar) are one copy in `@liveworkspace/help-site/art/illustrations`, the union of the copies; where
     a figure named the product or its work, the article now passes it (`product`, `noun`, with `art/noun` for
     plurals and capitals), and liveplanner's two real differences became props (its Session strip has no Poll, its
     R2 holds Snapshots). The retired help URLs' stubs bind `lib/moved`. `@liveworkspace/marketing-site` gains the
     Privacy band and its art (each app keeps its promises), the Try It flourish, the feature-art kit (`shared`,
     `canvas-marks`, `page-kit`, `versatility-parts`) and `lib/legal-moved` behind `/privacy`, `/terms` and
     `/security`: 24 files, about 4,900 lines, and about 13,400 fewer in the products. Every moved piece rendered
     byte-identical to main. Still in each app: the tool configs, the category-art bindings, liveplanner's help terms
     stub (its wording differs), livediagram's and liveplanner's title bar (an older header layout), livedocuments'
     palette rows and each `privacy-art.css` palette. Each help app's CSS grows by at most 90 B gzipped; liveplanner's
     marketing stylesheet leaves out the card art it never draws (`@source not`).
3. **The big ones** (`document`, `templates`, `ui`, `api-schema`, `edit-operations`,
   `agent-verbs`), in the same way, one per PR.
   - `ui`, first slice: `@liveworkspace/ui` (`packages/ui`) holds everything the four products' `ui`
     packages had in common that needs nothing of a product's: `Button`, `TextInput`, `DateInput`,
     `CountBadge`, `EmptyState`, `LoadingSweep`, `Portal`, `SheetHandle`, `JsonLd`, `Tooltip` and
     `HoverCard` with the `hint/` machinery under them, `Dialog` and `DialogHeader`, the `menu/` hooks,
     the `optical/` primitives, the brand-fill classes, the build loaders' kit, the footer's
     contributors and the hooks (`useClickOutside`, `useEscape`, `useFocusTrap`, `useMediaQuery`,
     `useCopiedFlash`, `useSheetDrag`, `useVisualViewportBand`, `safe-area`, `popover`, `relative-time`,
     `random-uuid-boot`). Every difference between the copies was a comment, or one product behind
     the others (liveplanner's `openDatePicker`, livediagram's hover-card `preview` look, which
     livedocuments had dropped as unused); the newer side won. Each product's `@<product>/ui`
     re-exports it (`export * from '@liveworkspace/ui'`), so callers did not change, and keeps only
     what is its own or still waits on a shared dependency. Apps scan it with
     `@source '../../../../packages/ui/src'`.
   - `document`, first slice: `@liveworkspace/model-core` (`packages/model-core`) holds what the four
     model packages (`@livediagram/document`, `@liveplanner/project`, `@livedocuments/document`,
     `@livedesign/design`) share and that needs nothing of a product's element union: the plain vocabulary
     that was in each `index.ts` (ids, text size, padding, alignment, icon position, arrow flows, background
     patterns), geometry primitives, the stroke points codec with its cache and debug decoder, rich-text runs,
     title captions, fonts, border, label, icon and table-cell sizing, canvas colours, code themes, names,
     plurals, hashing, seeded random, the SVG markup helpers, the arrow label wrap and avoidance, the tidy-up
     route grid, and embeds' URL rules: 65 files, about 4,950 lines, 21 of them tests. A few are used by only
     two or three products (the adder key, page fit, the person card, shape recognition). Every difference
     between copies was a comment, or one product having dropped an export it no longer used
     (`MIND_NODE_RADIUS_PX`, `isDefaultTabName`, `BOLD_EM`); the shared copy keeps it. A product that
     re-exported the whole module with `export *` now exports the kept name too (livedocuments and
     livedesign: `MIND_NODE_RADIUS_PX` and `isDefaultTabName`), unused there and tree-shaken. The one real setting is the `embed_host` Figma is told, so
     `createEmbedTargetFor` takes it and each product binds `embedTargetFor` in its own `youtube.ts`.
     Each module is a subpath (`@liveworkspace/model-core/<module>`), so a product's
     `export * from './x'` became `export * from '@liveworkspace/model-core/x'` and no caller changed.
   - Still in each product's model package: everything typed on its element union (`Element`, `ShapeElement`,
     `ArrowElement`, `BoxedElement`, `Tab`), which differs per product. That is most of the identical code
     (about 130 more files that read the same in all four, from arrow paths to the SVG renderer), because they
     import those types. They move only once the union is shared or the files become generic over it, which is
     a change to the element model rather than a move. The parsers and migrations of stored data stay per
     product too, so no stored document changes shape.
   - `ui`, second slice: the chrome that only waited on `@liveworkspace/icons`, and the site pieces that take
     their product as a parameter. `@liveworkspace/ui` now also holds the chrome icons (`icons/`: actions,
     navigation, status, badges, editor chrome, the drawing kinds' glyphs and the Community heart, the union
     of the four copies; each is a named export marked pure, so an app bundles only the glyphs it draws),
     `Select`, `DialogCloseButton`, `CompactEmptyState`, `PageNotFound`, `SnapCarousel`, `BuildWithAiLink`,
     the appearance machinery (`AppearanceIcon`, the cycle, `createAppearanceStore`, `appearanceBootScript`,
     `useAppearanceStore` and the toggle), `browser-repair`'s checks, its repair walk and its panel (each
     bound to a product's probe name, kept keys and words), and the site chrome drawn from a product's facts: `SiteSwitcher` (the app), `ShareRail` (the URL, pitch and
     Appearance card), `SiteFooter` (the tagline, the first link, the Community and GitHub links, the credits),
     `ProductNavLinks` (the Community link, when there is one) and `ExplorerLink` (its Explorer Home, and whether
     the hint cookie says signed in). Where copies differed it was a comment, or one side behind: livediagram's
     `SiteAppearanceToggle` `labelFrom`, livediagram's and livedesign's extra glyphs, livediagram's
     `SnapCarousel` `itemNoun`; the newer side won. The real differences became parameters, so every product
     renders what it did: liveplanner's footer still has no GitHub link and no credits, only livediagram's
     has the Community link, and each footer keeps its own tagline and first link. `ProductNavLinks` lost
     its unused `desc` lines. Each `@<product>/ui` keeps a thin binding of the same name for each of these
     (`export *` would otherwise hand callers the parameterised one), so callers did not change.
   - Still in each product's `ui`: the bindings above and the brand ones (`Brand.tsx`, `brand-app.ts`, over
     `@liveworkspace/brand`); the social card, whose colours and copy are the product's own; what is a
     product's own data: `site.ts` and `seo.ts` (its name, URLs and pitch), `trusted-types` (its CSP), the
     appearance key, `browser-repair`'s kept keys and its identity report (livediagram's reads the guest
     token's expiry through `@liveworkspace/index-client`, the others flag a guest whose work has not moved
     to the account: a real difference left for its own change); `EDITOR_MODE_ICONS`, typed on the product's
     modes; `identity-fill`, which needs its model package's `shade`; and the pieces bound to its `api-schema`
     and `telemetry-client`: `SiteHeader`, `HeaderPrimaryCta` and `StartBlankLink` (its CTA surfaces and
     `ctaHref`), `SiteAccount` and `SiteAccountMenu` (its hint cookie), `PageViewTracker` and `PageViewBoot`,
     and the web-vitals reporter. They follow as those packages move.
   - `edit-operations`, first slice: `@liveworkspace/edit-operations` (`packages/edit-operations`) holds the
     engine code the four copies had in common that reads no product's element union: the bounds every
     vocabulary had (`limits`: cuts, caps, distances, `PROTOTYPE_KEYS`), `equality`, the line form's
     `tokenise` (liveplanner's was behind and gains `arrowParts`), `nearest` (generic over `{ id }`),
     `graph-walk` (over arrow ends), `element-text`'s `labelOf`, `quoteCut` and `endRef`, the result lines'
     printer, and the line walk of `parse`. The real differences became bindings: each product's `parse.ts`
     binds `createParseEditOperations` to its operations, word parser and refusals, and livediagram,
     livedocuments and livedesign bind `createFormatResultFooter` with their CLI's revert command
     (liveplanner keeps its own printer: it quotes only labels and its footer has no lint). Each module is
     a subpath, so a product's file became `export * from '@liveworkspace/edit-operations/x'` (or a binding)
     and no caller changed; the shared package is at full coverage. About 600 lines fewer in each product.
   - Still in each product's `edit-operations`: everything on its element union and `EditState`
     (`state`, `selectors`, `placement`, `fields`, `colours`, `labels`, `locks`, `ids`, every operation,
     `finalise`, `replace`, `results`, `apply`), which reads the same in livediagram, livedocuments and
     livedesign but moves only once the union is shared; and what is its own vocabulary or refusals
     (`vocabulary`, `types`, `parse-line`, `parse-json`, `rejections`, `format-operation`), its `pages` slice
     and liveplanner's Plan bodies. No stored document or wire shape changed.
   - `api-schema`: `@liveworkspace/api-schema` (`packages/api-schema`) holds the wire shapes and validators the
     four `api-schema` packages had in common and that name no product: access levels, agent presence, API tokens,
     the build id and document format parsers, the template and icon catalogues, comment threads, creation use, the
     Offline Mode conversion, document dates and sources, folders, reading an api error, the image limits, sniffing
     and size, the gallery row, the MCP origin resolver, participants, placement, ref errors, share-link levels and
     lifetimes, the signed-in hint reader, the snapshot SVG helpers, the tab size cap, teams, title case, the Trash
     clock and within reach: 30 modules and 21 tests, about 1,900 lines. Every difference between copies was a
     comment or one side behind (livediagram's `importMarksUse`, the room ticket's `adderKey`, `IconSearchResponse`);
     the newer side won. What carries a product's name became a binding it keeps: its build, format and conversion
     headers, its MCP origin (`createMcpOriginResolver`), its hint cookie (`createSignedInHintReader`) and its Trash
     tokens; liveplanner and livedesign re-export under their nouns (`projectDates`, `DesignPlacement`). Types the
     api's OpenAPI document names (`TrashedProject`, `ProjectSource`, `DesignCommentThread`, …) keep a local
     declaration, so `/api/openapi.json` did not change. The SHA-256 digest four packages each held is one copy in
     `@liveworkspace/model-core/sha256`. Each module is a subpath and each product's `api-schema` re-exports it, so
     no caller changed. Still per product: what is typed on its element model (`drag-preview`, `embed-images`), its
     vocabularies (telemetry, lint, room ops, changesets, views, CTA surfaces, page views), the workbench messages
     (their types carry the product's prefix) and its envelopes, which name its noun.
   - `ui`, third slice, with `template-previews` and the licences bindings: the palette icons and the diagram build
     animation moved to `@liveworkspace/ui` as they were. The social card, page metadata, site header (its CTA,
     start-blank link and signed-in hint), page-view tracker, web-vitals report and reporter, and identity fill
     became `createX(config)` factories that take each product's brand, data and telemetry. The account slot is
     `createSiteAccount` in `@liveworkspace/account-menu`, so ui needn't depend on it. The previews' motion kit, story
     parts, both stylesheets, a generic `PreviewFan` and one shared check suite are `@liveworkspace/template-previews`;
     each product keeps only its drawings, and every app's `@source` names the shared fan. Licences have one
     `generate-product.ts` that reads a product's `src/product.ts`, and one `describeLicenceTables` suite in place of
     four copies each of the generate script and the apps, dependencies and texts tests. Each product package keeps
     its name and re-exports, so callers didn't change, and every product renders exactly as before (each moved piece
     rendered byte-identical). livedocuments now ships the whole shared `preview-motion.css`, about 0.5 KB gzipped of
     rules it never matches. help-registry had nothing left to share beyond product data.
   - `agent-verbs`, first slice: `@liveworkspace/agent-verbs` (`packages/agent-verbs`) holds what the four products'
     agent-verbs packages shared once the product's name, noun and collection were set aside: 16 modules and their
     tests, about 2,750 lines, and about 1,600 to 2,000 fewer lines in each product. The verb shape (`define`), short
     refs, the element-command line (`argv-line`), the list helpers and the MCP tool helper were the same in all four;
     where they differed, one side was behind (livediagram's `connect` arrow and `telemetryType`), and the newer side
     won. Read copies, the library sweep (`find`), folders, addressing, the changeset write and the folder verbs
     differed only in the product's CLI name, noun and collection, so each is a `createX(binding)` and each product's
     `agent-product.ts` holds those facts (liveplanner's messages say "plan" where its api says "project"). The api
     refusals, the image gallery and `image ls` are shared by the three products that keep images. The shared code
     never imports a product's api-schema: it declares the fields it reads, and each product hands in `revOfEtag`,
     `CHANGESET_SUMMARY_MAX` and its element fingerprint. Every product's verb catalogue and MCP tools dump
     byte-identical before and after; the shared suites run against a made-up product, so a word left unbound fails.
   - Still in each product's agent-verbs: the catalogue, the MCP schemas, guides and skill, and the verbs typed on its
     elements or its api-schema (lifecycle, edit, tab, changeset, the pages and plan verbs). Presence, comment and
     workbench sit on its api-schema's rules and its model's ref functions; the `find-*` and `verbs/shared` bindings
     stay because the apps read their product-named keys (`Libraries.personal.documents`, `tabOf`'s
     `{ document, tab }`).
4. **Carve `workbench` out of `apps/editor`** one area at a time (`lib/split`, `lib/tags`,
   `components/chrome`, the tab system, explorer, …). Each slice is moved once and deleted from
   every editor.
   - First slice: `@liveworkspace/workbench` (`packages/workbench`) holds the editor code that reads
     the same in all four editors (`livediagram/apps/editor`, `liveplanner/apps/editor`,
     `livedocuments/apps/editor`, `livedesign/apps/live`) and whose imports stay inside it, the shared
     `@liveworkspace/*` packages and npm: no `@<product>/*` and no editor file. It keeps the editor's
     folders (`lib/…`, `hooks/ui/…`, `hooks/canvas/…`, `components/primitives/…`), and its tests came
     with it: 254 files, about 13,100 lines (174 modules, 8,800 lines; 80 tests, 4,300 lines), about
     12,750 lines fewer in each editor. 125 were byte-identical and self-contained as they stood. 129
     more followed once two seams were settled: 89 copies differed only in their comments (one
     product's nouns, a renamed spec, one side behind), which now read the same; and they imported
     shared names (`Button`, `HoverCard`, `Portal`, `useMediaQuery`, the menu hooks) through the
     product's ui, which re-exports `@liveworkspace/ui` unchanged, so they import them from there.
     Every module is a subpath (`@liveworkspace/workbench/lib/listeners`) with no barrel, so an editor
     bundles only what it imports. What a product needs to differ is handed in as props, or as a small
     module the workbench exports for each editor to bind (`createX(config)`), never as a product
     import. The editors' repo-scan guards read `packages/workbench/src` beside their own folders, the
     style guards (optical, touch targets, motion budget) run in the package, and each editor's
     stylesheet scans it with `@source '../../../../packages/workbench/src'`.
   - Second slice: bindings. What blocked most of the rest was a product module imported at module
     level by files that otherwise read the same: `lib/telemetry.ts` (the product's telemetry
     client), `lib/user-preferences.ts`, `lib/debug-log.ts` (its storage key), `lib/api/core.ts`,
     `lib/canvas.ts`, the reload guard's keys and the stale-build signals. Those are now handed in
     once at startup: `@liveworkspace/workbench/bindings` exports `configureWorkbench({ … })`, each
     editor's `lib/workbench-bindings.ts` calls it with its facts (from its root providers and
     `app/global-error.tsx`), and workbench code reads them through `workbench` (`workbench.track`,
     `workbench.debugKey`, `workbench.api`, …). The bindings are `debugKey`, `track`,
     `reloadGuardKey`, `appRecoveryFlag`, `formatLogScope`, `runningStaleBuild`, `readPreferences`,
     `api` and `zoomMax` (packages/workbench/README.md lists what each is and who reads it). Types stay
     precise: `track` takes the narrow subset of events workbench code sends, so each product's
     wider `track` binds unchanged. Each default is a safe no-op, a development build warns once if a
     binding is read before it is set, and each product's keys stay constants in its
     `lib/workbench-keys.ts`, unchanged. Where a module was the same but for a type or a constant,
     the type became the subset the module reads (`UiScalePreferences`) or moved to the workbench with
     its module (`ApiError`, `QuickConnectDirection`, `Offset`, the zoom bounds in `lib/zoom-range`),
     which the product re-exports. That moved 44 more files (27 modules, 17 tests; about 3,200
     lines), about 2,600 lines fewer in each editor.
   - Still in each editor: the settings catalogue and the modules on it (`settings-kit`,
     `settings-model`, `lib/search.ts` differ per product); `lib/canvas-gesture.ts` (liveplanner has no
     erase gesture) and the drag, long-task and selection code on `DragState`, which is typed on each
     product's element union; and the identical tests of modules that differ. Those are product
     differences or a change to the element model, not a missing binding.
   - Third slice: the editor code two or more editors carried in the same words, 99 modules, each at its editor
     path as its own subpath, with its tests: about 10,200 lines in `packages/workbench` and about 24,900 fewer across
     the editors. Where copies differed, the newer one won. Where a module held a product key or event name, it now
     reads a binding (`openSettingsEvent`, `panelPresenceEvent`, `panelLayoutEvent`, `startQueryKey`,
     `localMoveDismissedPrefix`, and the optional `emptyCardDismissedKey`, `formatConfigKey` and `spotlightConfigKey`),
     with the values unchanged in each `lib/workbench-keys.ts`. A value only one component reads became a prop
     (`E2EAuthBridge`'s `sessionKey`). A drag type that a product's drop targets match lives beside `ICON_DND_MIME` in
     that product's `lib/icons.ts`. `useCanvasLongTaskLog` takes the editor's gesture reader, and livediagram's `crc32`
     is the one copy the zip writer and the PNG encoder share. Still in the products: routes, product copy and ids,
     the phone toolbar, the gesture reader, the modules whose names carry the product noun (share state, tombstones,
     visibility stores, which could move after a neutral rename), and the few variants with real behaviour of their
     own: livediagram's isometric grips, indicators and tour API, and liveplanner's select handlers and settings art.
   - Fourth slice: the editor UI that waited only on the product's ui, 28 modules that two or more editors carried in
     the same words once nouns are set aside (toasts, the table icons and controls, the palette dropdown, option rows,
     menu tiles, the context-menu and template-picker icons, the page lock and empty-page invite, the import report,
     the locked-element menu and more), each at its editor path as its own subpath, with their tests: about 3,570
     lines in `packages/workbench` and about 9,550 fewer across the editors. They import `Glyph`, `Tooltip`,
     `HoverCard`, `Button`, `Portal` and the rest from `@liveworkspace/ui` directly. `NotFound`, `SharePasswordGate` and
     `TrashedCard` differ only by the product's noun, so they take `noun` and each editor keeps a thin door at the old
     path that binds its word, leaving routes and copy unchanged. The menu icons' size steps sit in `menu-icon-base`,
     so an editor with its own context-menu icons pulls in none of the workbench's.
5. **`api-core`** out of the two `apps/api` Workers.
   - First slices, the plumbing every product's api, MCP and CLI had in its own copy, each one copy
     now with the product's own names handed in:
     - `api-kit`: the api Workers' responses and CORS (each product's `responses.ts` binds its
       extra headers and keeps its own answers), rate-limit keys (an IPv6 caller by its /64), link
       unfurls, the refusal log and the `cloudflare:workers` test shim, plus the protocol helpers
       their `api-schema`s re-export (bearer and loopback reads, base64, the API-token shape, OAuth
       device codes and PKCE).
     - `mcp-kit`: the MCP Worker itself (`createMcpApp`: CORS, health, the Streamable-HTTP
       transport, the OAuth 2.1 server with the device grant), its request and tool scopes and
       preview fonts. Each MCP hands in its server and an `OauthServer` config (its CLI client and
       consent base) and keeps its tools.
     - `cli-kit`: the io shape (livediagram's extends it for the repository link), exit codes and
       errors, `config.toml`, XDG paths, debug lines, credentials and the keychain, OAuth sign-in,
       the api transport and PNG pictures. Each CLI's `product.ts` names it (`CliProduct`) and thin
       modules bind it, so callers did not change.
   - Still per product: the routes, tools and commands themselves, and what sits on a product's
     `api-schema`, `agent-verbs` or fake host (`route.ts`, `parse-flags.ts`, `print.ts`,
     `testing/fake-io.ts` and the suites on it). Those follow `api-schema` and `agent-verbs` in
     step 3.

   - Second slices, the copies the first ones left, each one copy now:
     - `cli-kit`: the verbs' flag fields, the real `nodeIo` and the suites' `fakeIo`. Each CLI's `testing/fake-io.ts`
       binds it to its `PRODUCT` and its host's capabilities, and livediagram's io and fake io spread them for the
       repository link.
     - `mcp-kit`: the Worker's `Env`, the preview budget and `svgToPngBase64`, and the `show_my_<record>` prompt every
       server registers with its own nouns.
     - `mcp-kit` (`tool-result`): the tools' text, view and error results, the bearer-token guard, `ToolInputError`,
       the behaviour annotations and the rule that a fixable mistake answers as a tool error. Each MCP's
       `tool-helpers.ts` and `tool-annotations.ts` re-export them beside its own links, `loadTab` and `registerTool`.
     - `api-kit`: the room's access closes, follows, multiplayer count and agent presence (each room hands in its
       trashed op), the image reference extractor, the telemetry relay's localhost check and the OpenAPI document
       types. About 4,600 lines of copies went; tool names, prompt text, CLI output and wire formats are unchanged.
     - Still per product: the lint and test configs (a few lines each), the CLI's version, png and io bindings,
       `room-scope.ts` (its op kinds are the product's) and `person-tag.ts`.

## One home

This monorepo is the one home of every product. Their work, CI and deploys happen here; the old
per-product repositories are history. The products came in with `git subtree add` and keep their
history; the `.github/` folders under each product are inert, since GitHub reads workflows only from
the root ([ci.md](ci.md)). The pre-push hook is the root's, driven by CI's planner
([ci.md](ci.md#before-a-push)); the products' own `.githooks/` are not installed.
