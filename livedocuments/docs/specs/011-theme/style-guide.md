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
