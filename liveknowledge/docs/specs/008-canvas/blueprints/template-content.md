# Template content

Derived from [canvas-and-palette.md](../canvas-and-palette.md) "What a template shows off" and "Written documents".
Everything here is pure data or a pure builder in `packages/templates/src`, run on every path that applies a template
(the picker, `/new`, the api and the MCP worker) through `templateCanvasOverrides(kind)` and `buildTemplate(kind)`.

## Domain and naming

| Term             | Identifier                                           | Where                               |
| ---------------- | ---------------------------------------------------- | ----------------------------------- |
| Stacked template | `STACKED_TEMPLATES`, `templateArrangement(kind)`     | `template-arrangement.ts`           |
| Deck slide build | `DeckSlide.build` (the number of columns that build) | `template-builders-layout-decks.ts` |
| Deck slide chart | `DeckSlide.chart` (the slide chart's own data)       | `template-builders-layout-decks.ts` |

## Behaviour and state

- **Stacked**: `templateCanvasOverrides(kind)` sets `pageArrangement: 'stack'` for `social-carousel` and `live-card`
  and leaves it absent (the kind's default) for every other template.
- **Builds**: for a deck slide with `build: n`, every element the slide's layout makes whose anchor lies in the
  slide's build band (below `BUILD_TOP` and above `BUILD_FOOT` of the slide's height) and that is not an arrow takes
  `build: { order: c + 1, effect: 'rise' }`, `c` the column (of `n` equal columns across the slide's width) its anchor
  falls in. Elements outside the band keep no build, so the heading and the source line are on the slide from the
  start. An arrow never takes one (an arrow follows its ends).
- **Deck chart data**: a slide with `chart` merges those fields over the first chart element (`bar-chart`,
  `line-chart`, `pie-chart`) its layout makes, after the labels are written; a slide with `progress` sets each
  `progress-ring`'s `progress`, in the order the layout makes them.
- **Written templates** (`article-templates.ts`, `article-templates-2.ts`, `article-template.ts`,
  `template-working-backwards.ts`) read their Markdown through `markdownArticleBlocks(prefix, markdown, columns)`
  (`article-markdown-blocks.ts`): ids `b-<prefix>-<n>`, the first two paragraphs the title and subtitle, a divider a
  page break, each table its column shares; `[^label]` footnotes come from the article's own Markdown reader.

## Interfaces and contracts

- `templateArrangement(kind: TemplateKind): Partial<Pick<Tab, 'pageArrangement'>>`: `{ pageArrangement: 'stack' }` or
  `{}`.
- `DeckSlide`: `{ name, layout, labels, build?: number, chart?: DeckChart, progress?: readonly number[] }`.

## Data and persistence

Nothing new is stored beyond fields the document already has: `Tab.pageArrangement`, `Element.build` and chart data
fields. A template's `kind` is never changed.

## Errors and edge cases

- A deck slide with `chart` whose layout makes no chart: nothing merges (the decks test pins the chart on each).
- More `progress` values than rings: the extra are ignored; fewer: the remaining rings keep the layout's own.

## Performance and limits

All of it runs once per template application, over a deck's few dozen elements: no measurable cost.

## Testing

| Rule                                               | Test                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Social Carousel and Group Card stack, nothing else | `template-arrangement.test.ts`                                                 |
| Build columns, band, arrows, effect                | `template-builders-layout-decks.test.ts` "builds its points"                   |
| Deck chart data reaches the chart                  | `template-builders-layout-decks.test.ts` "charts its own figures"              |
| Footnotes, contents, headers and footers           | `article-templates.test.ts`                                                    |
| New templates: catalogue, categories, previews     | `templates.test.ts`, `template-categories.test.ts`, `template-preview.test.ts` |

## Constants and configuration

| Constant     | Value                    | Why                                                      |
| ------------ | ------------------------ | -------------------------------------------------------- |
| `BUILD_TOP`  | 0.28 of the slide height | Below every slide layout's heading and its lead line     |
| `BUILD_FOOT` | 0.9 of the slide height  | Above the source line every data slide keeps at its foot |

## Defaults ledger

Rows D130 and D131 in [DEFAULTS.md](DEFAULTS.md).
