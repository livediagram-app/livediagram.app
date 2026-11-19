# One help centre

liveworkspace runs one help centre for every app. It is built once, by `apps/help`, and shown at
`www.liveworkspace.app/help` and at each app's own `/help`, the way the Explorer is
([one-explorer.md](../004-index/one-explorer.md#4-the-explorer-is-built-once-by-liveworkspaceapp-and-shown-at-every-apps-address)).
An article about something the apps share is written once; where an app works differently, the article says so in a
note marked with that app's logo.

## Why

Each product had its own help app: five Next.js apps, ten Workers (each with staging), five registries and five
telemetry streams, with 976 articles between them. Measured on main (2026-11-19): 173 subjects appeared in two to
five products as articles more than 90% identical once the product's name was swapped, 696 files that were really
173 articles. Another 45 subjects were 70 to 90% alike: the same feature with a product's details. Most were platform
features (sharing, roles, teams, Community, tabs, the Explorer, the Trash, signing in, MCP, dark mode, the command
palette, the audit log), so every platform change meant five help edits, and the copies drifted. A reader who
used two apps searched two help centres. One centre holds about 450 articles.

## Where it is shown

| Address                                   | Shows           | Colours and header                         |
| ----------------------------------------- | --------------- | ------------------------------------------ |
| `www.<app>.app/help/…` (each of the five) | that app's help | the app's palette, logo and header buttons |
| `www.liveworkspace.app/help/…`            | All Apps        | liveworkspace's slate, its logo            |

The address decides the scope, so a link always opens the same view and there is no hidden state. Each app's router
answers `/help` and `/help/…` by forwarding to the one help centre's Worker over its `HELP` service binding, naming
its app in the `x-help-app` header, so the address bar keeps the app's name and there is no redirect.

## Choosing an app

Every page carries the **app switch**, in the home's search box and in the header's search on other pages: a
segment naming the current scope with a caret, and an **All Apps** segment. The caret opens a menu of three groups:
**This App** (the app whose address this is, ticked), **All Apps** (with its guide count), and **Another App** (the
other apps, each with its logo and guide count). On liveworkspace.app the first segment reads **Choose App** and
**All Apps** is selected.

Choosing moves the reader, never just the filter:

- **All Apps** goes to the same path on `www.liveworkspace.app/help`.
- **Another app** goes to the same path on that app's address when the page applies to that app, or to that app's
  help home when it does not.
- **This app** from liveworkspace.app goes to the same path on that app's address, by the same rule.

**A search survives the move.** When the search box holds a query, the move carries it (`?q=<query>`), and the
page it lands on opens with the same query in its search box and its results showing, scoped to the new address.
So a reader can type, see few results, switch to another app or All Apps and keep reading without retyping.
**Search All Apps instead** at the foot of the results is the same move.

The switch is links (`<a href>`), so it works without script, opens in a new tab and is crawlable; with script, the
links' `q` follows the search box as the reader types.

## Articles and the apps they apply to

Every article names the apps it **applies to** in the registry (`apps`, one or more app ids). An app's help shows
only the articles that apply to it; All Apps shows every article.

- **The logos.** An article's header shows, at its top right, an **Applies To** row of the apps' marks (the Living
  Prism, `BrandGlyph` from `@liveworkspace/brand`, stateless and without motion), the current app's first and ringed
  in its accent, with a line under it ("Every liveworkspace app", or the apps' names). An article for one app shows
  that app's mark alone. A category card's illustration carries the same row, small, in its top right corner, with
  "All apps", "N apps" or "+N", when the category holds shared articles. Search results show it at the row's end.
- **App notes.** Inside an article, an `<AppNote app="…">` block holds what is true for one app only (or for some
  of the apps, `app="livediagram,liveplanner"`). It is drawn as
  an accented box in that app's palette: a light tint of the app's brand, a border of the same hue, the app's mark at
  its start and "In <app>" as its label. In an app's help that app's notes are open, the other apps' notes fold into
  one closed row ("How this works in N other apps", with their marks). Under All Apps every note is open, in the
  registry's app order. Apps an article applies to that have no note are listed in one quiet line ("Works the same
  in livedocuments and livedesign").
- **The work's name.** Shared copy names the work with `<Noun />` (and `<Noun plural />`, `<Noun capital />`), which
  reads canvas, plan, document, design or Space for the current app and "file" under All Apps, the words the
  Explorer uses. Product names in shared copy come from `<AppName />`.
- **Figures** may carry one variant per app; a page shows the current app's, and a shared figure in liveworkspace's
  slate where an app has none.
- **Read It In.** An article for more than one app lists those apps in its Contents card under **Read It In**, the
  current one marked Reading, each a link to the article on that app's address.

### Per-app wording

A shared article or category may be worded differently for one app: `byApp` on its registry entry holds that app's
own `title`, `description`, `group` and `category` (a category's `title` and `description`). An app's help shows its
own wording everywhere it names the article (the page's title and description, its metadata, category cards,
landings, search and the editors' panels); apps without an entry, and All Apps, show the shared copy. Under All Apps a
search result for an article that applies to one app alone reads as that app words it. The MDX page passes the
shared title, and the layout takes the shown title and description from the registry entry for the page's path.

## The home pages

- **An app's home** keeps the layout its help had as its own app:
  the hero with the guide count, search and Popular chips; Start Here with its scene and steps; the About and Tips
  and Tricks cards beside it; the app's category sections, each card with its scene; and the dark Still Stuck band.
  Each app keeps its own home layout (`HelpHomeLayout`), now naming categories from the one catalogue.
- **The All Apps home** (`www.liveworkspace.app/help`): "Help for every app", the guide count across apps, search
  and Popular chips; **Pick an App**, five tiles each with its mark on a band in its palette, its line and its guide
  count, linking to its help; **New to liveworkspace?** (Start Here for the account, the Explorer, connected files
  and sharing); **Written once, for every app**, the shared categories with their scenes in slate and the five-app
  row; and Still Stuck.

### Home layout rules

Both kinds of home open on the canvas wash (below) with two pills (the guide count, "Search them from inside the
editor too" in an app's help), the display heading "How can we help?", one line of lede, the large search box and a
row of **Popular** chips that link straight to the articles most readers come for. The home's sections, top to bottom:

1. **Start Here.** A full-width card: the app's own Getting Started scene beside numbered steps (the first four
   Getting Started guides) and a link to every Getting Started guide, then About and Tips and Tricks as two wide cards.
2. **Editor Guides.** The feature categories as art cards, three across on a computer.
3. **Your account and data.** Account and Data, Privacy and Security, Supported Devices and Policies.
4. **Developers.** Developers, as a wide card.
5. **Still Stuck.** A dark closing band: the contact form (and, where the app has one, GitHub issues) as buttons,
   beside the Troubleshooting card.

Every category in the catalogue for the scope appears in exactly one section (Contact as the closing band's second
half), so a new category cannot be left off a home without a test failing, and a test checks every Popular chip and
every Start Here step names a real article. Each app's popular chips and steps:

| App           | Popular chips                                                                 | Start Here steps                                         |
| ------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| livediagram   | Your first diagram, Sharing, Keyboard shortcuts, Templates, Exporting, Editor modes | the first four Getting Started guides                    |
| liveplanner   | Your First Plan, Sharing Your Plan, Keyboard Shortcuts, Templates, Exporting, Plan Mode | Your First Plan, Boards, Sheets, Sharing Your Plan       |
| livedocuments | Your first document, Sharing, Keyboard shortcuts, Templates, Exporting, Slide pages | Your First Document, Working with Pages, Writing Articles, Sharing Your Document |
| livedesign    | Your first design, Sharing, Keyboard shortcuts, Templates, Exporting, Logo pages | Your First Design, Logo Pages, Layers, Sharing Your Design |
| livehuddle    | Your first Space, Sharing, Keyboard shortcuts, Templates, Exporting, Avatar mode | the first four Getting Started guides                    |

livedocuments' Editor Guides are Pages, Canvas, Palette, Selection Modes, Tabs, Collaboration, Explorer, User
Interface and Tools Panel; liveplanner's lead with Plan.

## Category pages

A category page opens on the canvas-wash header: an eyebrow (the category kind, `Help Topic` or `Editor Guide`;
`Editor Guides` on the Features index), the title, the description, the guide count (and how many sections), and the
category scene on the right from `lg` up.

**Groups.** A category with more than a dozen cards is split into named groups, each a heading over its own grid, so
the page reads as a table of contents rather than a wall. A group is the article's `group` field; a category's
`groups` field fixes the order its groups appear in (otherwise first appearance). From `lg` up, a page with groups
shows a sticky **jump list** of its groups beside the grids. Categories of twelve or fewer cards stay one grid. The
groups, in order:

| App           | Category | Groups                                                                      |
| ------------- | -------- | --------------------------------------------------------------------------- |
| livediagram   | Canvas   | Basics, Modes and Boards, Text and Notes, Styling Elements, Layers and Locking |
| livediagram   | Palette  | Everyday Elements, Diagram Kits, Workshop Kits, Palette Settings            |
| livediagram   | Explorer | Your Library, Activity, Assets and Imports                                  |
| liveplanner   | Plan     | Getting Going, Boards and Cards, Sheets, Forms and Dashboards               |
| livedocuments | Pages    | Basics, Kinds of Page                                                       |
| livedocuments | Canvas   | Basics, Text and Notes, Styling Elements, Layers and Locking                |
| livedocuments | Palette  | Everyday Elements, Page Blocks, Palette Settings                            |
| livedocuments | Explorer | Your Library, Activity, Assets and Imports                                  |
| livedesign    | Canvas, Palette, Explorer | as livedocuments, with Pages (Basics, Kinds of Page) first     |
| livehuddle    | Canvas   | Basics, Text and Notes, Styling Elements                                    |
| livehuddle    | Palette  | Everyday Elements, Layout Kits, Workshop Kits, Palette Settings             |
| livehuddle    | Explorer | Your Library, Activity, Assets                                              |

A shared category shows only the groups its scope's articles fall in.

## Article pages

The article header uses the canvas wash and names its category as an eyebrow link above the title. The page has an
auto-generated table of contents, breadcrumbs, reading time, a related-guide sidebar, a back-to-top button and
"Was this helpful?" feedback. An article's sections (the tinted bands between its `##` headings) are grouped while it
renders, so the static HTML already has them, and the reading-time row holds its height before the time is counted:
nothing moves after the page appears. Below the article, before the helpful vote, every article ends on **previous
and next** links: the articles beside it in its own reading order, which is the catalogue order of its siblings (the
sub-articles of the same parent, or a category's top-level articles) within the scope. The first article has no
previous link and the last no next link. A closing **Still need help?** card links Troubleshooting and Contact.
Sub-articles nest under their parent's folder, and a landing's slug never equals its category's slug (`the-canvas`,
`the-explorer`, `using-tabs`), which would break the breadcrumb's parent link.

## Look and category scenes

Every page wears the marketing sites' language, so moving between an app's `/` and `/help` reads as one product:

- **The canvas wash.** A page's header band is the marketing hero's band: its colours and the canvas's dot grid
  fading out at its foot come from one stylesheet shared with marketing (`packages/ui/hero-band.css`), in the
  scope's palette.
- **Display headings.** Page titles are bold, tight-tracked and dark ink (`slate-900`, `slate-50` in dark); a home's
  title is display size.
- **Eyebrows.** A section opens on a small uppercase brand label above its heading (`Start Here`, `Editor Guides`).
- **Cards** are white on the page's slate, `rounded-2xl`, with the brand glow on hover (`card-glow`).
- **Header.** A fixed 72px (`h-18`) at every breakpoint, on the page's `max-w-7xl` / `md:px-8` column so the logo lines
  up with the breadcrumb and article below; the sticky breadcrumb bar (`top-18`) and the article sidebar's sticky
  offset rely on it. It holds the brand (hover for liveworkspace's other sites), the search in its centre slot from
  `sm` up and, in an app's help, that app's **Start Blank** and **Choose Template** pair (`ctaSurface="Help"`, so its
  links carry `Help.HeaderBlank` and `Help.Header` for the landing funnel), Start Blank hidden below `md` so the search
  keeps room. It leaves the page-edge ShareRail off: the rail would cover the article sidebar on an `xl` screen.

**Category scenes.** Every category has one **category scene**: a large SVG illustration of that area of the app at
work, in the shared help illustration kit so it matches the in-article figures' house style and dark appearance. A
scene is a composed moment, not a row of glyphs: real labels lifted from the editor (panel names, menu items, element
text, real shortcuts and API fields, checked against the articles), people where the area is about people, and at
least two accent hues beside the brand. It is drawn on a **400 by 220** stage whose dotted ground runs far past its
edges, so a frame of any shape (a card's banner, half of a wide card, a page header) shows the whole scene on
unbroken ground: never cropped, never shrunk to a strip of icons. Every category except Contact (which has no card)
has its own scene, and an unknown slug renders nothing rather than a stand-in. The art shows on a category's card
(across its top, or beside the copy on a `wide` card) and on the right of the category page's header from `lg` up. It
is decorative (`aria-hidden`); the card's title and description say what the picture shows.

Each app tells its own story in its own brand colours (`brand-*` classes and `var(--color-brand-*)`, so a scene
follows the app's hue), and a scene is never copied from another app. A scene whose story is the same in every app
(the policies, a share link's safeguards, a page that would not load, one piece of work on three devices, one search
box, the API from outside, the keyboard) is drawn once and takes the app's content as props: its words, its share
host, its formats, its work drawn on each screen. Under All Apps a shared category's scene is drawn in liveworkspace's
slate. The Getting Started scene tells the app's own first three steps on three numbered cards. Tabs, Developers
and Supported Devices are drawn once for livediagram and livehuddle. What the scenes show:

| Scene                | Where                | Shows in each app                                                                                                                                  |
| -------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Getting Started      | own                  | livediagram: a first diagram (a starting point, shapes and arrows, the share link); liveplanner: a board, a sheet, the share link; livedocuments: an article, slide or infographic page, writing, the share link; livedesign: a logo artboard and wireframe screens, layers, the share link; livehuddle: a first Space (a starting point, walk in, the share link) |
| About                | own                  | three windows: livediagram a workshop's stickies, a diagram and a sketch; liveplanner Board, Sheet and Form; livedocuments a slide, an article and an infographic; livedesign a logo, a wireframe and a photo; livehuddle the day's stickies, a Team Pod and a timer |
| Canvas, Palette, Selection Modes, Collaboration, Explorer, Tabs, User Interface | own | each app's own editor surface at work (Explorer: My Work and a grid of that app's work; Tabs: one file's tabs stacked behind the tab bar; User Interface: numbered callouts on the parts; livedocuments and livedesign also have Pages, a page of each kind labelled as the editor labels it; liveplanner has Plan, a board with its done count filling) |
| Tools                | shared, with its own | beside the shared appearance switch and Zen mode: livediagram Auto Layout tidying a sign-up flow; liveplanner Zen mode leaving the board; livedocuments Markdown Import; livedesign and livehuddle Auto-align snapping |
| Tips and Tricks      | shared, with its own | the command palette on the app's own commands and its own single-key shortcuts                                                                    |
| Search Panel         | shared, with its own | "roadmap" finding the app's own work, a tab, an element or card, and a guide                                                                      |
| Supported Devices    | shared, with its own | the app's work on a laptop, a tablet and a phone                                                                                                  |
| Developers           | shared, with its own | the app's `POST /api/…` creating its own work (`documents`, `projects` with the `kanban` template, `designs` with `wireframe-mobile-app`, `documents` with `slide-deck`) |
| Account and Data     | shared, with its own | a profile, synced work, and the app's export formats (liveplanner CSV, PNG, PDF, JSON; the others PNG, SVG, PDF, JSON, livedocuments leading with PDF) |
| Troubleshooting      | shared, with its own | work that did not load and the checklist fixing it                                                                                                |
| Privacy and Security | shared, with its own | the app's own share link with its safeguards                                                                                                      |
| Policies             | shared, the same     | the terms and the privacy policy, sealed                                                                                                          |

## Figures and card icons

- **Figures** are inline SVG mocks of the real editor surface they describe (the palette, a dialog, the tab bar, a
  flow, live cursors), not screenshots, so they stay crisp, theme with the brand ramp, add no binary assets to the
  static export and never drift from a UI rebrand. They are added where a concrete UI surface, a before and after or
  a spatial relationship benefits, not to every section; scenes are reused wherever the same surface recurs. A figure
  shared by several apps is drawn once, and takes the app's words as props where only a product name or what it
  calls its work differs.
- A figure's words are its caption: the `<figcaption>` names the `<figure>`, and the SVG is `aria-hidden` (an unnamed
  `role="img"` was an image with no alternative). A picture that teaches something says it in its caption.
- A figure draws the editor as it is today. The bottom bar's tabs are drawn once, in the editors' footer shape: the
  open tab a white card standing on the bar's bottom edge, rounded only at the top, its name in the accent; other
  tabs bare names with no fill and no divider; a tab open in the other pane a dashed outline. No figure draws a
  filled pill for a tab. A comment thread's figure shows the reaction chips under a comment (an emoji and a count,
  the reader's own highlighted). Segmented controls inside dialogs (the Link and image pickers) keep the `Tabs`
  primitive.
- No figure's text may run outside its scene; the shared palette strip is spaced to fit beside the menu card.
- The frame is rounded with a soft shadow, matching the cards. Figures, like scenes, are checked in light and dark.

**Card icons and accents.** Every card carries a small outline glyph in a tinted tile. Feature cards take their
glyph and hue from two maps kept **key-for-key identical** (a bespoke glyph beside a fallback hue reads as an
oversight, and a test fails on it). Both fall back to the article's top-level category (its first slug segment),
not a single default: the category fallback is the net a new card lands on before someone draws it, and a new
landing arrives with its own entry in both maps, as it arrives with its own catalogue entry. Support cards use the
same idea one level simpler: a glyph per article, the tone from the brand, a generic fallback only as a net, and
Getting Started leading with a numbered step badge instead (the test reads which browse pages number their cards
rather than assuming). A grid where most tiles are identical is decoration, not a catalogue. Drawing rules:

- Draw what the element does, never the control itself (every behaviour element is a button; the family glyph
  already draws one).
- A glyph must differ from every glyph in the set and from its own category's fallback; when the obvious drawing is
  taken (a padlock is locking, a chain is links, a picture is images), draw the next detail down.
- Half a subject drawn clearly beats the whole drawn ambiguously (a bar without the ring, a part-filled scale
  without the star).
- Draw a category at a time so a batch reads as a set, and look at each glyph rendered at 24px before shipping.
- Every path must parse, and every anchor sits far enough inside the 24-unit box that its stroke does not clip
  (arc flags may be glued to the next coordinate, so a checker must split arc parameters properly).

## Search

One index of every article. In an app's help, results that apply to the app come first under **In <app>**, then up
to three under **From other apps**, each marked with its app; the panel's foot links **Search All Apps instead**
(the same query on liveworkspace.app). Under All Apps, results are one list, each with its apps' marks. The editors'
search panels search only their app's slice of the catalogue.

Each build serves its own index as static JSON, so a page loads only what it searches. An app's help fetches
`/help/search-index.json`, the articles that apply to it (in its wording, no bodies), when the search box opens, and
`/help/search-all.json`, every article, only once the panel is open with a query, to fill **From other apps**. All
Apps fetches its one index. `lib/search-index.test.ts` caps each app's index and the full one in bytes, so the panel's
download cannot grow unnoticed.

**Keys and accessibility.** The search box answers `/` from anywhere on the page (unless focus is already in a text
field, or a modifier is held) and shows a `/` key hint at its right edge while empty (not on a touch screen). On a
home the large box takes the key, elsewhere the header's. `Escape` closes the results, and a second `Escape` leaves
the box. Each result shows its category as a small label above its title. A polite live region says what the dropdown
holds ("3 articles found", "No articles found for ...") and the list is a region named Search results, since the
results appear below the field with nothing else to tell a screen reader they came.

**Ranking.** Matches are best first: a title that starts with the query, then a title with a word starting with it,
then a title containing it, then a description match, then a keyword match alone, then, for a query of several words,
an article holding every word somewhere across its title, description and keywords (more of them in the title first:
"export png" finds Exporting Diagrams in livediagram and Exporting Pages in livedocuments and livedesign); catalogue
order breaks ties (`searchArticles`). Matching is case-insensitive over title, description and **keywords**. Every
article carries a required, space-separated, lowercase `keywords` field of the words people type when they do not know
the title: synonyms ("transparency" for opacity, "hotkey" for keyboard shortcuts), adjacent spellings ("color" beside
"colour") and concept words the copy does not use; a test fails an article without keywords. (Born from a report:
searching "Opacity" found nothing because the article is titled "Layer Order and Opacity".)

**In the editors.** Each editor's global search panel has a **Help** group, so "how do I..." is answerable without
leaving the canvas: every article of that app (title, description and keywords, from the app's slice of the
catalogue, with no second hand-curated list), at most 6, ranked last so navigation and edit results keep the default
Enter, with a non-empty query only; picking one opens the article in a new tab, counted as `UI·Opened` with the
article's telemetry id. This group keeps flat matching, every word across title and keywords, not the ranking above
(weighted ranking there is out of scope until noise shows). The editor's tab bar has a **Help** link on its right
edge beside GitHub, a plain `<a href="/help/" target="_blank">` that fires `track('UI', 'Opened', 'Help')`. Surfaces
that link one article contextually (`help-articles.ts`) are the contextual help links spec.

## Addresses, canonicals and the old paths

- An article's path is `/help/<categorySlug>/<slug>/`, the same on every address it applies to.
- **Canonical.** An article for one app is canonical on that app's `www` address. An article for two or more apps is
  canonical on `www.liveworkspace.app/help/…`, and the app copies point there, so search engines index one page.
- An app address asked for an article that does not apply to it answers `308` to the article on its canonical
  address.
- Every old help path keeps working: where merging moved an article, its old path answers `308` to the new one on
  the same address. The redirect map is generated from the merge and tested, every path of the five old registries
  answering 200 or a 308 that lands on a 200.

## Page metadata

One rule for every public page, shared with the marketing sites' SEO rules; an app's help names itself
(`siteName: '<app> Help'`, All Apps `liveworkspace Help`).

- **The title passes through as given.** `og:title` and `twitter:title` carry the bare article title with the site
  name beside it. The document `<title>` reads "<Title> | <app>" (the root layout's template), and a home, which the
  template does not reach, spells it out as `Help | <app>`.
- **The Features index describes itself from the catalogue**: "Browse <app> feature guides by area: ...", every
  feature category in catalogue order, at most 160 characters (past that it names as many as fit and ends "and
  more."). No route file writes it by hand; a test holds the real one to the list and the length.
- **Every article and category landing has its own card**: `og:type` article, Twitter `summary_large_image`, a
  1200x630 PNG at `/help/og/<route>.png`, rendered at build time through the shared social-card renderer marketing
  uses. It shows the top category as its kicker (Help Topic on a landing), the title, the card description (two
  lines, ending on a whole word) and "Help Centre" in its footer beside the app's address pill. Pages outside the
  catalogue (the homes, the features index) carry the brand card marketing generates.
- **The sitemap dates each page by its last commit**: one `git log` pass over the pages at build time, a landing
  dated by its newest article. A shallow clone, or no git, leaves `lastModified` out rather than claim every page
  changed today, so the deploy builds from full history.
- **Structured data.** Category landings carry `CollectionPage` whose `ItemList` names the articles the landing
  lists, in order; a home carries `WebSite` with no `SearchAction` (Google retired the sitelinks search box, and the
  `q` carry is not an indexed search page). Every page carries a `BreadcrumbList` rooted at the home.
- **A sub-article's parent crumb and its `TechArticle` url come from its route**, one folder up and its own route,
  never rebuilt from the page's `categorySlug` prop (which names the top category on some pages and the parent's path
  on others). The category crumb is the route's first segment, so it never shares a URL with the parent; a sub-article
  whose MDX names no parent gets the article at its `categorySlug` path. A test checks every sub-article sits
  directly under a real page.
- **Meta descriptions are 50 to 160 characters**, written for the search result and not copied from the search card,
  and **page titles are unique** across articles, static pages and landings; a test holds every page to both.

## Catalogue rules

- Every category's article count is the number of entries whose `categorySlug` is exactly that category, sub-articles
  included, and is pinned by a test, along with: every article sits in a category that exists, and every `parentSlug`
  names another article or the category's own landing.
- Categories are **support** (standalone articles) or **feature** (`kind: 'feature'`, the in-depth guides, shown under
  "Editor Guides" on a home and listed on the `/features` index); each feature category has a card-grid index at
  `/help/<slug>/` and each feature its landing plus optional sub-articles. The support categories are About, Getting
  Started, Tips and Tricks, Account and Data, Privacy and Security, Developers, Troubleshooting, Supported Devices,
  Policies and Contact; the feature categories are each app's own (below).
- **No paid tier.** Every liveworkspace app is free and MIT-licensed here, so there is no "Accounts and Billing"
  category and no "Pro" callouts.
- **Developers** is the human companion to the machine-readable `GET /api/openapi.json`: an overview with the base
  URL, Authentication (bearer API tokens against the guest path), worked `curl` examples for the app's own resource
  (`documents`, `projects`, `designs`) and Errors and Rate Limits, linking out to the OpenAPI rather than duplicating
  it.
- **Policies** holds Reporting a Vulnerability. The Terms of Use and Privacy Policy cover every app and live at
  `https://www.liveworkspace.app/terms` and `/privacy`; their old help paths (`/help/policies/terms/`,
  `/help/policies/privacy-policy/`, `/help/privacy-and-security/privacy-policy/`) and the marketing `/terms` and
  `/privacy` stay as thin `noindex` redirects to them.
- **Troubleshooting has one working tool**: Repair This Browser renders the shared browser-repair panel, so a person
  whose editor will not start can clear its stuck settings from the help centre, which shares the editor's origin
  (livediagram, liveplanner, livedocuments, livedesign).
- **Help never leaves a visible control undocumented**: an article stays while an editor offers what it documents
  (reachable from the palette, the search panel, a menu, a dialog or the Explorer), and leaves with the code that
  cuts it. A shared article drops an app from its `apps` when that app cuts the feature.

### Feature categories by app

- **livediagram**: Explorer, Palette (Selection Modes, Elements, Palette Settings), Canvas, Tabs, Collaboration, Tools,
  Search Panel.
- **liveplanner**: Plan, User Interface, Explorer, Tabs, Collaboration, Tools, Search Panel.
- **livedocuments**: Pages first (it is what the app is for), User Interface, Explorer, Selection Modes, Palette
  (including The Library), Canvas, Tabs, Collaboration, Tools, Search Panel.
- **livedesign**: as livedocuments, with Pages for logos, wireframes and photos; no slide deck and no isometric view.
- **livehuddle**: Spaces, the boards (tabs) a Space holds, Avatar mode and the Spaces templates, the meeting palette
  (its groups: Everyday Elements, Layout Kits, Workshop Kits, Palette Settings) and session tools, and meeting
  together live. Its Calls have two articles under Collaboration, Proximity Audio and Cameras and Screen Sharing,
  linked both ways, which say that where calls are off there is no microphone to join and promise no date; the
  Stage has its own article under Palette. Its About and Getting Started describe a Space a team walks into as
  characters, and name no workshop, retro, poll, quiz, deck, diagram or drawing tool. Diagram vocabulary stays only
  where it names a real canvas thing (a diagram key, a Mermaid diagram, a swimlane, a draw.io import).

## Retired and renamed articles

A removed or renamed article keeps its old address landing on the nearest live article through `HELP_REDIRECTS`
(`308`), and a removed category lands on the help home. A test pins every target to a live page and keeps a live
article or category from being redirected away. What each app has retired:

- **livediagram**: the container's rename to document (Add to Diagram, Diagram Not Loading, and the like), Whiteboards
  to Draw mode, Highlighter to the palette's Tools, the Activity Panel (to Undo and Redo), the Welcome Tour to the
  Diagram Tour, Facilitate Mode to Workshop Mode, Infographics, Illustrate Mode and Pages Mode (to Editor Modes),
  Custom Themes and the Explorer's Themes (to Themes), Tags (to Folders), the in-editor AI assistant (to Connect AI
  and MCP), and the Self-Hosting category (to the help home, also for a bare `/self-hosting/...`). "Your First
  Diagram" and "Exporting Diagrams" keep their addresses.
- **livedocuments**: Self-Hosting (to the help home), Isometric Mode (to Selection Modes), Tab Windows (to Pages).
- **livedesign**: the Slide Deck and its three sub-articles, and Isometric Mode (both to Selection Modes).
- **livehuddle**: everything its refocus on meeting in Spaces removed (the slide deck, presenting and Page articles,
  Diagram and Draw modes and their mode-only elements, Event Storming and repositories, and Auto Layout), each landing
  on the nearest article that stays; it renamed Your First Diagram to Your First Space and Exporting Diagrams to
  Exporting Spaces.

## Telemetry

One stream. Each help event counts for its scope (the app whose help it is, or liveworkspace.app for All Apps) and,
where it is about an article, carries the article's id, so one dashboard reads every app's help and each app's
alone. Moving with the app switch is counted too, by the scope moved to.

## Roles

The help centre is public and has no roles: it shows the same to signed-in people, guests and the signed out.

## What goes

The five product help apps (`<product>/apps/help`), their Workers and staging Workers, their help registries'
articles (each product's `packages/help-registry` keeps only what its editor's contextual help links need, over
the one catalogue) and their `018-help` specs, whose rules move here. The help-loop audits the one centre.

## Out of scope

- A help centre for the platform's own pages beyond the All Apps home (accounts, billing): none exist yet.
- Translations.
