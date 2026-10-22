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

- **The canvas wash.** A page's header band (`components/HelpHero.tsx`) is the marketing hero's band: its colours
  and the canvas's dot grid fading out at its foot come from one stylesheet, `packages/ui/hero-band.css`, which
  both apps import. It replaces the flat tinted band the article and category headers had.
- **Display headings.** Page titles are bold, tight-tracked and dark ink (`slate-900`, `slate-50` in dark); the
  home title is display size.
- **Eyebrows.** A section opens on a small uppercase brand label above its heading (`Start Here`, `Editor Guides`).
- **Cards** are white on the page's slate, `rounded-2xl`, with the brand glow on hover (`card-glow`).

## Category art

Every category has one **category scene**: a large SVG illustration of that area of the product at work, drawn from
the help illustration kit (`components/illustrations/primitives.tsx`) so it shares the in-article figures' house
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
- Labels in a scene are the editor's own (real shortcuts, real API fields), checked against the articles.
- The art is decorative (`aria-hidden`); the card's title and description say what the picture shows.

## Home page

Top to bottom:

1. **Hero.** The canvas wash; two pills (the guide count, "Search them from inside the editor too"); the display
   heading "How can we help?"; one line of lede; the large search box; and a row of **popular topics**, chips that
   link straight to the articles most readers come for (Your First Diagram, Sharing Your Document, Keyboard
   Shortcuts, Templates, Exporting Diagrams, Plan Mode). The list is `POPULAR_TOPICS` in `lib/home-sections.ts`
   and a test checks every entry names a real article.
2. **Start here.** A full-width card, the Getting Started scene beside the first four Getting Started guides as
   numbered steps and a link to the rest, then About liveplanner and Tips and Tricks as two wide cards.
3. **Editor guides.** The feature categories as art cards, three across on a computer.
4. **Your account and data.** Account and Data, Privacy and Security, Supported Devices and Policies.
5. **Developers.** Developers, as a wide card.
6. **Still stuck?** A dark closing band: the contact form as a button, beside the
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
`@liveplanner/help-registry`). The editor's Help group in global search keeps its own flat matching, every word
across title and keywords ([Help app](help-app.md), "Out of scope").

## In-article figures

The figures inside articles keep the illustration kit and its house style ([Help app](help-app.md),
"In-article illustrations"); their frame (`components/Figure.tsx`) matches the cards, rounded with a soft
shadow. No figure's text may run outside its scene. A browser sweep of every article found the shared palette
strip (`Strip` in `components/illustrations/toolbar-layout.tsx`) running past its 420-wide scenes in eleven
figures, cutting off Media and Search, so the strip is spaced to fit beside the menu card.

## Share roles

The help centre is public static content with no document in it; there is nothing an Editor, Participant or
Viewer could do differently, so no role gates apply.
