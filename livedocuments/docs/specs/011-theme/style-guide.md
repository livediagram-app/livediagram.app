# Style guide

When to use each part of a tab's style, so an agent dresses a document for its content and tone as a person does in
Tab Style (owner, 2026-11-25). Code: `packages/document/src/style-guide.ts`.

## What it holds

- A **use when** line and a tone (formal, neutral, friendly, playful, bold) for every theme, page design, typeface and
  finish. The catalogues stay the source of the ids; tests hold the guide to them: every id described, none unknown.
- **Recipes**: whole looks by occasion (formal-report, strategy, editorial, product-pitch, keynote, technical,
  teaching, workshop, celebration, playful, nature, premium), each a theme, design, typeface and finish that go
  together, with words that point to it.

The rules it teaches: keep the tones together; formal or text-heavy work takes the Professional finish and a quiet
design (paper, corner accents, side rail); bold designs suit title and section pages.

## Agents

- The MCP serves it as the `livedocuments://guide/styles` resource (Markdown), and the server instructions point to it.
- `create_document` takes `style`: a recipe id, or `"auto"` for the recipe the document's words suit best (the first,
  formal-report, when none match). It sets every new tab's theme, design, typeface and finish; `theme`, `finish`,
  `design` and `font` given beside it win.
- `create_document` takes `font`: every new tab's typeface, one of the catalogue's.
- `change_pages` takes `tab_style {style, theme, font, finish}` to restyle a tab that exists, as Tab Style does: a
  recipe (or `"auto"`, for the tab's words) sets the theme, typeface, finish and page design together, and a part named
  beside it wins; one part alone changes only that. The theme lands as picking it in Tab Style does (`tabWithTheme`,
  shared with the editor, in the light half): colours still on the old theme's take the new one's, colours set by hand
  stay, arrows always take the new stroke, and pages on the old theme's own fill take the new one's. Asked to "make it
  look like X", an agent had no way to change an existing document's look.
- A tab's typeface reaches its articles: `create_document`'s font (or its style's), a new article written into a tab
  with one, and `tab_style`'s font set each article's headings in it, and its paragraphs too when it is a face long
  text reads in (Inter, Poppins, Nunito, Space Grotesk, Lora, Roboto Slab); a display, condensed, handwritten or
  monospace face leaves them in the look's body font. A look named in `write_article` sets its own fonts.
- The one liveworkspace MCP's `create_item` passes a doc's `style` and `font` on to `create_document`.

## Templates

Every template that is a deck, a stack of flashcards or a written document opens dressed (owner, 2026-11-25):
a page design, typeface and finish chosen from this guide for what it is for (`packages/templates/src/template-style.ts`),
applied with its other tab settings (`templateCanvasOverrides`), so the picker, `/new` and the MCP land the same.

- The theme stays the document's: a design draws in the theme's colours and follows a theme change.
- Decks take the design with rhythm (bold on title and section slides, quieter between); a slide on a moving
  background wears no design over it (one design to a page).
- Written documents wear quiet designs (paper grain, linen, side rail, corner accents, edge bands, soft shadows, noise,
  grid) and formal ones the Professional finish.
- The designed deliverables (poster, year in review, résumé, recipe card, group card, storyboard, floor plan, social
  carousel) carry their own art and take no design; the infographic documents built from layouts take a typeface and
  finish only.
