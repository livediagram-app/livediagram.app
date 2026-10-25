# Help pages

What each kind of page in the help centre ([Help app](help-app.md)) looks like and how a reader moves between them:
the home page, a category page and an article page. The help app spec owns the registry, the SEO rules and the
illustration kit; this spec owns the layout and journeys built on them.

## Why

The help centre had fallen behind the marketing site it sits beside. Its category art was a 64px strip of small
motifs, the home page was one flat grid of twenty cards in registry order, the biggest categories (Canvas 31 cards,
Palette 35) were long unsorted grids that hid whole editor modes, and an article page ended in a dead end with no
way on but the browser's back button. A reader should be able to tell what each area is from its picture, find the
path that fits who they are (new, stuck, managing data, building on the API), and keep reading without hunting.

## Shared look

Every page wears the marketing site's language, so moving between `/` and `/help` reads as one product:

- **The canvas wash.** A page's header band (`../packages/help-site/src/components/HelpHero.tsx`) is the marketing hero's band: its colours
  and the canvas's dot grid fading out at its foot come from one stylesheet, `packages/ui/hero-band.css`, which
  both apps import. It replaces the flat tinted band the article and category headers had.
- **Display headings.** Page titles are bold, tight-tracked and dark ink (`slate-900`, `slate-50` in dark); the
  home title is display size.
- **Eyebrows.** A section opens on a small uppercase brand label above its heading (`Start Here`, `Editor Guides`).
- **Cards** are white on the page's slate, `rounded-2xl`, with the brand glow on hover (`card-glow`).

## Category art

Every category has one **category scene**: a large SVG illustration of that area of the product at work, drawn from
the help illustration kit (`../packages/help-site/src/art/primitives.tsx`, with the stage and its motifs in
`../packages/help-site/src/art/parts.tsx`) so it shares the in-article figures' house
style and dark appearance. A scene is a composed moment, not a row of glyphs: real labels lifted from the editor
(panel names, menu items, element text), people where the area is about people, and at least two accent hues
beside the brand. It is drawn on a 400 by 220 stage. The scene always shows whole, and the stage's dotted ground runs far past
its edges, so a frame of any shape (a card's banner, half of a wide card, a page header) shows the whole
scene on unbroken ground: never cropped, and never shrunk to a strip of icons.

- Scenes live one per file in `components/category-art/<slug>.tsx`, each exporting one component, and
  `components/category-art/index.tsx` maps a category slug to its scene. Every category in the registry except
  Contact (which has no card) has its own scene; an unknown slug renders nothing rather than a stand-in.
- The art shows in two places: on a category's card (across its top, or beside the copy on a `wide` card), and
  on the right of the category page's header from `lg` up.
- Each help centre tells its own story, in its own brand colours (`brand-*` classes and `var(--color-brand-*)`, so
  a scene follows the product's hue). A scene is never copied from another product's help centre. A scene whose
  story is the same in every product (the policies, a share link's safeguards, a page that would not load, one
  piece of work on three devices, one search box, the API from outside, the keyboard) is drawn once, in
  `../packages/help-site/src/art/scenes/<slug>.tsx`, and takes the product's content as props: its words, its
  share host, its formats, its work drawn on each screen. The app's `components/category-art/<slug>.tsx` binds it.
  Every other scene is the product's own. The Getting Started scene in particular tells this product's first
  three steps, on three numbered cards.
- Labels in a scene are the editor's own (real shortcuts, real API fields), checked against the articles.
- The art is decorative (`aria-hidden`); the card's title and description say what the picture shows.

livediagram's scenes:

| Scene                | Where                | What it shows                                                                        |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| Getting Started      | own                  | a first diagram: pick a starting point, add shapes and arrows, share the link        |
| About                | own                  | three windows: a workshop's stickies, a diagram and a sketch                         |
| Canvas               | own                  | a flowchart mid-build, a sticky note, the palette strip, undo and zoom               |
| Palette              | own                  | the Shapes category open and a diamond dragged onto the canvas                       |
| Selection Modes      | own                  | the mode picker, a marquee and the laser's trail                                     |
| Collaboration        | own                  | three people on one canvas: cursors, a live selection, a comment thread, Share       |
| Explorer             | own                  | My Work and a grid of diagrams                                                       |
| Tabs                 | own                  | one document's canvases stacked behind the tab bar                                   |
| User Interface       | own                  | the editor with numbered callouts on its parts                                       |
| Tools                | shared, with its own | Auto Layout tidying a sign-up flow, beside the shared appearance switch and Zen mode |
| Tips and Tricks      | shared, with its own | the command palette on ⌘K (Zoom to fit, Next editor mode, Zen mode) and R, T and N   |
| Search Panel         | shared, with its own | "roadmap" finding a canvas, a tab, a sticky note and a guide                         |
| Supported Devices    | shared, with its own | a little diagram on a laptop, a tablet and a phone                                   |
| Developers           | shared, with its own | `POST /api/documents` making a Service map                                           |
| Account and Data     | shared, with its own | a profile, synced diagrams, and PNG, SVG, PDF and JSON                               |
| Troubleshooting      | shared, with its own | a canvas that didn't load and the checklist fixing it                                |
| Privacy and Security | shared, with its own | a livediagram.app share link with its safeguards                                     |
| Policies             | shared, the same     | the terms and the privacy policy, sealed                                             |

## Home page

Top to bottom:

1. **Hero.** The canvas wash; two pills (the guide count, "Search them from inside the editor too"); the display
   heading "How can we help?"; one line of lede; the large search box; and a row of **popular topics**, chips that
   link straight to the articles most readers come for (Your First Diagram, Sharing Your Canvas, Keyboard
   Shortcuts, Templates, Exporting Diagrams, Editor Modes). The list is `POPULAR_TOPICS` in `lib/home-sections.ts`
   and a test checks every entry names a real article.
2. **Start here.** A full-width card: livediagram's own Getting Started scene (drawing a first diagram: pick a starting point, add shapes and arrows, share the link) beside
   the first four Getting Started guides as numbered steps and a link to the rest, then About livediagram and
   Tips and Tricks as two wide cards.
3. **Editor guides.** The feature categories as art cards, three across on a computer.
4. **Your account and data.** Account and Data, Privacy and Security, Supported Devices and Policies.
5. **Developers.** Developers, as a wide card.
6. **Still stuck?** A dark closing band: the contact form and GitHub issues as buttons, beside the
   Troubleshooting card.

The sections and their categories are `HOME_SECTIONS` in `lib/home-sections.ts`. Every category in the registry
appears in exactly one section (Contact as the closing band's second half), so a new category cannot be left off
the home page without a test failing.

## Category pages

A category page opens on the canvas-wash header: eyebrow (the category kind, `Help Topic` or `Editor Guide`;
`Editor Guides` on the Features index), title, description, the guide count (and how many sections), and the
category scene on the right from `lg` up.

**Groups.** A category with more than a dozen cards is split into named groups, each a heading over its own grid,
so the page reads as a table of contents rather than a wall. A group is the article's `group` field in the
registry; a category's `groups` field fixes the order its groups appear in (otherwise first appearance). From `lg`
up, a page with groups shows a sticky **jump list** of its groups beside the grids.

| Category | Groups, in order                                                               |
| -------- | ------------------------------------------------------------------------------ |
| Canvas   | Basics, Modes and Boards, Text and Notes, Styling Elements, Layers and Locking |
| Palette  | Everyday Elements, Diagram Kits, Workshop Kits, Palette Settings               |
| Explorer | Your Library, Activity, Assets and Imports                                     |

The remaining categories have twelve or fewer cards and stay one grid.

## Article pages

The article header uses the canvas wash and names its category as an eyebrow link above the title. Below the
article, before the helpful vote, every article ends on **previous and next** links: the articles beside it in its
own reading order, which is the registry order of its siblings (the sub-articles of the same parent, or a
category's top-level articles). The first article has no previous link and the last no next link. A closing
**Still need help?** card links Troubleshooting and Contact.

## Search

The search box answers `/` from anywhere on the page (unless focus is already in a text field, or a modifier is
held), and shows a `/` key hint at its right edge while empty (not on a touch screen), so a keyboard reader can
search without reaching for the mouse. On the home page the large box takes the key, elsewhere the header's.
`Escape` closes the results, and a second `Escape` leaves the box. The results list shows each article's
category as a small label above its title. A polite live region says what the dropdown holds ("3 articles found",
"No articles found for …") and the list is a region named Search results, since the results appear below the field
with nothing else to tell a screen reader they came.

**Ranking.** Matches are best first: a title that starts with the query, then a title with a word starting with
it, then a title containing it, then a description match, then a keyword match alone, then, for a query of
several words, an article holding every word somewhere across its title, description and keywords (more of them in
the title first: "export png" finds Exporting Diagrams); registry order breaks ties (`searchArticles` in
`@livediagram/help-registry`). The editor's Help group in global search keeps its own flat matching, every word
across title and keywords ([Help app](help-app.md), "Out of scope").

## In-article figures

The figures inside articles keep the illustration kit and its house style ([Help app](help-app.md),
"In-article illustrations"); their frame (`../packages/help-site/src/components/Figure.tsx`) matches the cards, rounded with a soft
shadow. No figure's text may run outside its scene. A browser sweep of every article found the shared palette
strip (`Strip` in `components/illustrations/toolbar-layout.tsx`) running past its 420-wide scenes in eleven
figures, cutting off Media and Search, so the strip is spaced to fit beside the menu card.

## Share roles

The help centre is public static content with no document in it; there is nothing an Editor, Participant or
Viewer could do differently, so no role gates apply.
