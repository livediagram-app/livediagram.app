# Page Designs blueprint

Derived from [Page Designs](../page-designs.md). Paths are relative to `livedocuments/`.

## Domain and naming

| Term          | Identifier                                         | Where                                        |
| ------------- | -------------------------------------------------- | -------------------------------------------- |
| page design   | `PageDesign`                                       | `packages/document/src/page-designs/tuning.ts` |
| design id     | `PageDesignId` (the catalogue's ids)               | `page-designs/catalogue.ts`                  |
| family        | `PageDesignFamily`, `PAGE_DESIGN_FAMILIES`         | `page-designs/catalogue.ts`                  |
| tab design    | `Tab.pageDesign`                                   | `packages/document/src/tab-type.ts`          |
| page override | `Page.design` (`PageDesign` or `PAGE_DESIGN_NONE`) | `packages/document/src/page.ts`              |
| design set    | `PageDesignSet`, `PAGE_DESIGN_SETS`                | `page-designs/sets.ts`                       |
| scrim         | `DesignScrim`                                      | `page-designs/guard.ts`                      |
| layer         | `DesignLayer` (one SVG, perhaps moving)            | `page-designs/render.ts`                     |

## Data and persistence

- `PageDesign = { id; colors?: [hex, hex, hex]; intensity?; scale?; angle?; focus?: [x, y]; seed?; blur?; grain?;
  calm?; variant?; animate?: true; speed?; rhythm?: true; flow?: true; guard?: 'warn' }`. A field equal to the
  design's default is not stored (`compactPageDesign`); `guard` absent is `scrim`.
- `parsePageDesign(v)`: `undefined` unless `v.id` is a catalogue id; each field kept only when of its type and in
  range (`DESIGN_RANGES`), `variant` only when one of the design's, `colors` only as three valid hex. Rounds `angle`
  to whole degrees mod 360 and `seed` to a whole number.
- `parsePageDesignOverride(v)`: `{ id: 'none' }` or `parsePageDesign(v)`.
- `pagesOf` reads `design` on every page kind; `newPageBackground`-style tab reads go through `tabPageDesignOf(tab)`.
- Edits (`page-designs/edits.ts`): `withTabPageDesign(tab, design | null)` (the same tab when nothing changes) and
  `pageDesignSet(tab, pageId, design | 'none' | null)` (a `PageEdit`: `unknown_page`, `locked` refused as
  `pageRenamed` does; `null` clears the override).
- Apply to All Tabs: `pageDesign` joins `TAB_STYLE_KEYS` (`packages/workbench/src/lib/tab-style-to-all.ts`).
- The agents' route relays `pageDesign` with the pages (`PAGE_FIELDS` in `apps/api/src/changesets/pages.ts`).

## Constants and configuration

| Constant                  | Value                    | Why                                                     |
| ------------------------- | ------------------------ | ------------------------------------------------------- |
| `DESIGN_RANGES.intensity` | 0.1 to 1                 | below 10% a design is invisible                         |
| `DESIGN_RANGES.scale`     | 0.5 to 2                 | past these, parts vanish or one fills the page          |
| `DESIGN_RANGES.angle`     | 0 to 359                 | degrees                                                 |
| `DESIGN_RANGES.seed`      | 1 to 9999                | four digits read in the panel                           |
| `DESIGN_RANGES.speed`     | 0.25 to 3                | the animated backgrounds' range                         |
| `blur`, `grain`, `calm`   | 0 to 1                   | fractions                                               |
| `DESIGN_CACHE_MAX`        | 160                      | 100 pages (MAX_PAGES) plus room for previews and tiles  |
| `RHYTHM_QUIET_INTENSITY`  | 0.55                     | content pages' share of the intensity                   |
| `RHYTHM_QUIET_CALM`       | 0.7                      | content pages' least safe area                          |
| `SECTION_TEXTS_MAX`       | 3                        | a page of one to three texts reads as a section page    |
| `SCRIM_PAD`               | 14 px                    | the plate's reach past the text box                     |
| `SCRIM_OPACITY`           | 0.82                     | the plate's strength                                    |
| `TEXT_CONTRAST`, `LARGE_TEXT_CONTRAST` | 4.5, 3      | WCAG 2.2 AA                                             |
| `LARGE_TEXT_PX`           | 24                       | WCAG large text (18 pt)                                 |

## Behaviour and state

- **Resolution** (`resolve.ts`, `resolvePageDesigns(tab, pages, opts)`): for each laid-out page, the page's override
  (`none` wears nothing) else the tab design; `role` = `title` for the first page, `section` for a page holding one to
  `SECTION_TEXTS_MAX` elements all texts, else `content`; with `rhythm` a `content` page's intensity is multiplied by
  `RHYTHM_QUIET_INTENSITY` and its calm raised to at least `RHYTHM_QUIET_CALM`. With `flow` on the tab design and a
  design whose catalogue entry `flows`, consecutive pages wearing the tab design form a strip: each page's `strip` is
  `{ x: the widths of the strip's pages before it, span: the strip's width }`.
- **Palette** (`designPalette(theme, page, paperDark)`): `a`, `b`, `c` from `colors` else `themeAccent` and
  `themeSecondaries`; `dark` from `pageIsDark(page)` (a page with a fill) else `paperDark`; on a dark page each
  colour is tinted 15% toward white; `ink` is `#ffffff` on a dark page, `#0f172a` on a light one; `base` is the
  page's fill tone (the paper's white or slate-900).
- **Drawing** (`render.ts`, `designLayers(design, ctx)`): the design's `draw(ctx)` answers layers, each SVG markup in
  page-local px (0 to width, 0 to height; a panning layer is wider) with an optional motion `{ kind, seconds, x?, y?,
  turn?, scale? }`. The wrapper answers `{ key, layers, calm, intensity, grain }`; ids inside are prefixed with a hash
  of the key, so two pages with the same key share identical markup and defs.
- **Still frame** (`pageDesignSvg(...)`): every layer at rest inside one `<g>` at the page's rect, with the calm mask
  (a radial luminance gradient, the same stops as the screen's CSS mask) and the grain (an `feTurbulence` rect) and the
  scrims; this is what exports, thumbnails and previews draw.
- **Screen**: `PageDesignLayer` draws each layer as a `<div>` holding its SVG markup (`builtMarkup`), a moving layer
  with its motion's class; the root carries the intensity as opacity and the calm as a CSS radial `mask-image`.
- **Pausing**: an `IntersectionObserver` (root margin 200 px) sets `data-pd-run` on the root while it is on screen;
  `app/page-design.css` runs the animations only under `[data-pd-run]`, and never under reduced motion.
- **Motions** (`app/page-design.css`): `pd-drift` (translate to `--pd-x`, `--pd-y`, alternate), `pd-pan` (translate
  by `--pd-x`, linear, endless; its layer is drawn one period wider so the loop is seamless), `pd-spin` (a turn),
  `pd-breathe` (scale to `--pd-s` and back), `pd-twinkle` (opacity to 35% and back). Every keyframe starts at the
  identity, so the first frame is the still frame. The duration is `--pd-d` divided by the design's speed.
- **Guard** (`guard.ts`, `designGuard(page, elements, paint)`): for each `text` element reaching the page with a label
  and no opaque fill, the backdrop estimate is `base` mixed with each of `a`, `b`, `c` and `ink` at
  `busy x intensity x (1 - calmAt(centre))`; its contrast is the worst against the text's colour (its `textColor`,
  else the page ink). Below `TEXT_CONTRAST` (or `LARGE_TEXT_CONTRAST` at `textSize` `lg` or 24 px and over) it
  fails. `scrim` guard: a rounded plate (`SCRIM_PAD`, radius 12, `base` at `SCRIM_OPACITY`) per failing text;
  `warn`: none. Answers `{ scrims, failing }`.
- **Sets** (`sets.ts`): `applyPageDesignSet(tab, setId, theme)` gives the tab the set's theme (the editor's own theme
  switch, so elements follow it), font, finish, New Page Background (given to every page as a Look does) and design
  (with `rhythm`), and lays out each empty slide or infographic page with the set's title layout (the first page) or
  content layout. One undo step in the editor; the editor composes it from its own setters' transforms.
- **Pick** (`pick.ts`, `pickPageDesign(words)`): each design's `keywords` matched (whole words, lower case) against
  the words; most matches wins, ties to catalogue order; none to `soft-mesh`.

## Interfaces and contracts

- Agents: `PageChange.add` and `.set` gain `design?: PageDesignInput` (a design object, an id string, `'none'` or
  `'tab'`); a new change `{ op: 'tab_design'; design: PageDesignInput | null | 'auto' }`. Read strictly by
  `packages/edit-operations/src/pages/parse.ts` (`design_unknown`, `invalid_value`, unknown keys refused by name);
  applied in `page-changes.ts` through `pageDesignSet` and `withTabPageDesign`. `PageSummary.design: string | null`.
- MCP: `pages-schema.ts` describes `design` and `tab_design`; `create_document`'s `design` is applied as each new
  tab's `pageDesign` before the create (`auto` picks per tab from its words).
- CLI: `livedocuments pages --design <id|none|tab>` (the page named) and `--tab-design <id|none|auto>`.

## Presentation and UX

The Page Design panel ([Tab Style dialog](../canvas-and-theme-dialog.md) "Page Design"):
`apps/editor/components/dialogs/page-design/`: `PageDesignPanel.tsx` (the panel), `DesignGrid.tsx` (families and
tiles), `DesignSetCards.tsx`, `DesignFineTune.tsx` (controls), `design-tile-svg.ts` (a tile's markup),
`page-design-context.ts` (what the door hands it). Tiles are 3 across (2 on a phone), 16:10, rounded 10 px, a 2 px
brand ring when selected; the family chips scroll the grid to their heading. Sliders are the shared `Slider`; colour
swatches open the one colour picker.

## Accessibility

- Every tile is a button named "<Design>, <Family>" with `aria-pressed`; the families are headed groups.
- Sliders carry their label and value text; Shuffle, Try Another, Reset and the switches are named buttons.
- The design layer is `aria-hidden` and takes no pointer events.
- Reduced motion shows the still frame (system setting and `:root.reduce-motion`).

## Performance and limits

- `designLayers` is memoised in an LRU of `DESIGN_CACHE_MAX` entries keyed by the design (compacted), the page size,
  the palette, the strip and the role. A deck of fifty same-sized slides draws once.
- Each design draws at most about 400 SVG nodes at 1920 x 1080 and scale 1; the busiest at scale 0.5 stays under
  about 1,600. A test holds every design's drawing at 1920 x 1080 under a CPU budget.
- The guard walks the settled elements once per page set (O(n) with the pages' rects), never on a drag frame.
- Animated layers move by transform and opacity; off-screen pages pause.

## Observability

`debugLog('[page-design] set', { tabId, id, scope })` on each pick; the guard logs nothing (it is a pure read).

## Testing

- `page-designs/catalogue.test.ts`: 40+ designs, eight families, unique ids, every design drawable at three sizes in
  light and dark, controls and variants consistent, the CPU budget.
- `page-designs/tuning.test.ts`: parse keeps valid fields and drops the rest; compaction; ranges.
- `page-designs/resolve.test.ts`: override over tab, none, roles and rhythm, strips.
- `page-designs/guard.test.ts`: a failing text gets a scrim, `warn` none, a filled text none.
- `page-designs/sets.test.ts`, `pick.test.ts`, `edits.test.ts`.
- `page-frame.test.ts`: the design in the export frame. Agents: `parse.test.ts`, `page-changes.test.ts`.
- Editor: `PageDesignLayer.test.tsx` (layers, pause, decoration only), `PageDesignPanel.test.tsx` (pick, scope,
  tune, reset, sets, roles).
