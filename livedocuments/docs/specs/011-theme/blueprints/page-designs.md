# Page Designs blueprint

Derived from [Page Designs](../page-designs.md). Paths are relative to `livedocuments/`; the model's files are under
`packages/document/src/page-designs/`.

## Domain and naming

| Term          | Identifier                                         | Where                                             |
| ------------- | -------------------------------------------------- | ------------------------------------------------- |
| page design   | `PageDesign`                                       | `packages/document/src/page-designs/tuning.ts`    |
| design id     | `PageDesignId` (the catalogue's ids)               | `packages/document/src/page-designs/catalogue.ts` |
| family        | `PageDesignFamily`, `PAGE_DESIGN_FAMILIES`         | `packages/document/src/page-designs/catalogue.ts` |
| tab design    | `Tab.pageDesign`                                   | `packages/document/src/tab-type.ts`               |
| page override | `Page.design` (`PageDesign` or `PAGE_DESIGN_NONE`) | `packages/document/src/page.ts`                   |
| design set    | `PageDesignSet`, `PAGE_DESIGN_SETS`                | `packages/document/src/page-designs/sets.ts`      |
| scrim         | `DesignScrim`                                      | `packages/document/src/page-designs/render.ts`    |
| layer         | `DesignLayer` (one SVG, perhaps moving)            | `packages/document/src/page-designs/draw-kit.ts`  |

## Data and persistence

- `PageDesign = { id; colors?: [hex, hex, hex]; intensity?; scale?; angle?; focus?: [x, y]; seed?; blur?; grain?;
calm?; variant?; animate?: true; speed?; rhythm?: true; flow?: true; guard?: 'warn' }`. A field equal to the
  design's default is not stored (`compactPageDesign`); `guard` absent is `scrim`.
- `parsePageDesign(v)`: `undefined` unless `v.id` is a catalogue id; each field kept only when of its type and in
  range (`DESIGN_RANGES`), `variant` only when one of the design's, `colors` only as three valid hex. Rounds `angle`
  to whole degrees mod 360 and `seed` to a whole number.
- `parsePageDesignOverride(v)`: `{ id: 'none' }` or `parsePageDesign(v)`.
- `pagesOf` reads `design` on every page kind; tab reads go through `tabPageDesignOf(tab)`.
- Edits (`edits.ts`): `withTabPageDesign(tab, design | null)` (the same tab when nothing changes) and
  `pageDesignSet(tab, pageId, design | 'none' | null)` (a `PageEdit`: `unknown_page`, `locked` refused as
  `pageRenamed` does; `null` clears the override; an article's pages all take it).
- Apply to All Tabs: `pageDesign` joins `TAB_STYLE_KEYS` (`../packages/workbench/src/lib/tab-style-to-all.ts`).
- The agents' route relays `pageDesign` with the pages (`PAGE_FIELDS` in `apps/api/src/changesets/pages.ts`).

## Constants and configuration

| Constant                               | Value     | Why                                                    |
| -------------------------------------- | --------- | ------------------------------------------------------ |
| `DESIGN_RANGES.intensity`              | 0.1 to 1  | below 10% a design is invisible                        |
| `DESIGN_RANGES.scale`                  | 0.5 to 2  | past these, parts vanish or one fills the page         |
| `DESIGN_RANGES.angle`                  | 0 to 359  | degrees                                                |
| `DESIGN_RANGES.seed`                   | 1 to 9999 | four digits read in the panel                          |
| `DESIGN_RANGES.speed`                  | 0.25 to 3 | the animated backgrounds' range                        |
| `blur`, `grain`, `calm`                | 0 to 1    | fractions                                              |
| `DESIGN_CACHE_MAX`                     | 160       | 100 pages (MAX_PAGES) plus room for previews and tiles |
| `RHYTHM_QUIET_INTENSITY`               | 0.55      | content pages' share of the intensity                  |
| `RHYTHM_QUIET_CALM`                    | 0.7       | content pages' least safe area                         |
| `SECTION_TEXTS_MAX`                    | 3         | a page of one to three texts reads as a section page   |
| `SCRIM_PAD`                            | 14 px     | the plate's reach past the text box                    |
| `SCRIM_OPACITY`                        | 0.82      | the plate's strength                                   |
| `TEXT_CONTRAST`, `LARGE_TEXT_CONTRAST` | 4.5, 3    | WCAG 2.2 AA                                            |
| `LAST_MAX` (screen views reuse)        | 240       | a view per page, two rows' worth                       |
| `TUNED_GAP_MS`                         | 1500      | a slider's drag is one `PageDesignTuned` event         |

## Behaviour and state

- **Resolution** (`resolve.ts`, `resolvePageDesigns(tabDesign, pages, elements)`): for each laid-out page, the page's
  override (`none` wears nothing) else the tab design; `role` = `title` for the first page, `section` for a page
  holding one to `SECTION_TEXTS_MAX` elements all texts, else `content`; with `rhythm` a `content` page's intensity is
  multiplied by `RHYTHM_QUIET_INTENSITY` and its calm raised to at least `RHYTHM_QUIET_CALM`. With `flow` on the tab
  design and a design whose catalogue entry `flows`, consecutive pages wearing the tab design form a strip: each
  page's `strip` is `{ x: the widths of the strip's pages before it, span: the strip's width }`.
- **Palette** (`palette.ts`, `designPalette(theme, page, paperDark, colors?)`): `a`, `b`, `c` from `colors` else the
  theme's accent and next colours; dark from the page's fill, else `paperDark`; on a dark page each colour is tinted
  15% toward white; `ink` is `#ffffff` on a dark page, `#0f172a` on a light one; `base` is the page's fill tone (the
  paper's white or slate-900).
- **Drawing** (`render.ts`, `paintPageDesign({ design, tuning, palette, width, height, strip?, font? })`): the
  family's drawer (`drawers.ts`, one `draw-<family>.ts` each, helpers in `draw-kit.ts`) answers layers, each SVG
  markup in page-local px with an optional motion `{ kind, seconds, x?, y?, scale?, turn?, origin? }`. Answers a
  `PaintedDesign` (`key`, `uid`, `layers`, `intensity`, `calm`, `grain`, `animate`, `speed`, `palette`, `tuning`);
  ids inside carry `uid`, so pages sharing a key share identical markup.
- **Still frame** (`pageDesignSvg(painted, at, scrims, idPrefix)`): every layer at rest inside one `<g>` at the
  page's corner, with the calm mask (a radial luminance gradient, the stops of `calmStops`, the same as the screen's
  CSS mask), the grain (an `feTurbulence` rect) and the scrims. `export.ts`'s `pageDesignExportSvg(tab, page, opts)`
  is what the page frame (`page-frame.ts` option `design`, after the pattern), the SVG renderer, the canvas export
  (`apps/editor/lib/export-tab-canvas.ts`, after the motion frame), slide thumbnails (`lib/slide-thumb.ts`) and the
  page drawer draw. PPTX gives a designed page a picture background (`backgroundKind(page, designed)`).
- **Screen**: `apps/editor/components/canvas/PageDesignLayer.tsx` draws each layer as a `<div>` holding its SVG
  markup (`builtMarkup`), a moving layer with its motion's variables; the root carries the intensity as opacity and
  the calm as a CSS radial `mask-image`; the scrims sit in a separate full-strength layer. Views are worked out by
  `apps/editor/lib/page-design-views.ts` (`pageDesignViews`, reusing a page's view while it is unchanged) through
  `usePageDesignViews` in `CanvasPages`. The minimap draws no designs: it is a map for finding your way, kept cheap.
- **Pausing**: an `IntersectionObserver` (root margin 200 px) sets `data-pd-run` on the root while it is on screen;
  `apps/editor/app/page-design.css` runs the animations only under `[data-pd-run]`, and never under reduced motion.
- **Motions** (`app/page-design.css`): drift, pan, spin, breathe, twinkle and swing; every keyframe starts at the
  identity, so the first frame is the still frame. The duration is the motion's seconds divided by the speed.
- **Guard** (`guard.ts`, `designGuard(painted, rect, elements)`): for each `text` element whose centre is on the page
  with a label and no opaque fill, the backdrop estimate is `base` mixed with each of `a`, `b`, `c` and `ink` at
  `busy x intensity x calmShareAt(calm, centre)`; its contrast is the worst against the text's colour (its
  `textColor`, else the page ink). Below `TEXT_CONTRAST` (or `LARGE_TEXT_CONTRAST` for large text) it fails. `scrim`
  guard: a rounded plate (`SCRIM_PAD`, radius 12, `base` at `SCRIM_OPACITY`) per failing text; `warn`: none. Answers
  `{ scrims, failing }`.
- **Sets** (`sets.ts`): each set's theme, font, finish, background (`designSetBackground`: the paper or one of the
  theme's gradients), design (with `rhythm`) and layouts (`designSetLayout(set, kind, index)`). The editor applies one
  with `apps/editor/lib/page-design-set-apply.ts` (`withPageDesignSetApplied`): its own theme switch
  (`withThemeApplied`, so elements follow it), font, finish, the background as New Page Background given to every
  page, the design, and the layouts on each empty, unlocked slide or infographic page, as one undo step.
- **Pick** (`pick.ts`, `pickPageDesign(words)`): each design's `keywords` matched (whole words, lower case) against
  the words; most matches wins, ties to catalogue order; none to `soft-mesh`.

## Interfaces and contracts

- Agents: `PageChange.add` and `.set` take `design?: PageDesignChoice` (a design, `'none'` or `'tab'`); a change
  `{ op: 'tab_design'; design: TabDesignChoice }` (a design, `null` or `'auto'`) (`packages/api-schema/src/pages.ts`).
  Read strictly by `packages/edit-operations/src/pages/design-input.ts` (`readPageDesign`, `readTabDesign`: an id or a
  name by `layoutNamed`, unknown ids refused `design_unknown` with the closest and the families, values out of range
  and unknown keys `invalid_value`; `rhythm` and `flow` only on the tab design) from `parse.ts`, and applied in
  `page-changes.ts` through `pageDesignSet` and `withTabPageDesign` (`tabDesignFor` resolves `auto`).
  `PageSummary.design` is set only for a page with its own (`none` or an id); the pages view prints `tab design {...}`
  and `design <id>` on such a page, and its JSON carries `tabDesign`.
- MCP: `packages/agent-verbs/src/mcp/pages-schema.ts` describes `design` and `tab_design` (the full tuning listed once,
  on `tab_design`, for the tool list's byte budget); `create_document`'s `design` (an id or `auto`) is applied as each
  new tab's `pageDesign` before the create (`apps/mcp/src/tools.ts`, `auto` per tab from its words).
- CLI: `livedocuments page set --design <id|none|tab>` (with `--page` or `--add`) and `--tab-design <id|auto|none>`,
  a change of its own (`packages/agent-verbs/src/verbs/pages.ts`).

## Presentation and UX

The Page Design panel ([Tab Style dialog](../canvas-and-theme-dialog.md) "Page Design"),
`apps/editor/components/dialogs/page-design/`:

- `PageDesignPanel.tsx`: the preview, Applies to, Design Sets, Designs and Fine Tune.
- `DesignGrid.tsx` (family chips and tiles), `DesignSetCards.tsx`, `DesignFineTune.tsx` (controls),
  `DesignTile.tsx` (a tile as an `<img>` of the still frame: forty pictures rasterised once, not live SVG nodes),
  `design-tile-svg.ts` (a tile's or preview's markup and the guard's counts), `design-tune.ts` (Reset, Shuffle, Try
  Another, scope), `page-design-door.ts` (what the door hands it), `useDesignRow.tsx` (the home row's line and tile).
- The door: `EditorModals` adds `design` to `TabStylePages` (`tab-style-pages.ts`); the profile lists the panel
  (`panels`, `renderPanel`, `panelHelp`) and the shared dialog draws the row (`panelValues`, `panelIcons`).
- Edits: `apps/editor/hooks/canvas/usePageDesignEdits.ts` (`pageDesignEdits`, mounted by `useTabCanvas`): picks and
  switches through `commitTabs`, sliders through `checkpointBurst` and `tickTabs`.
- Tiles are 3 across (2 on a phone), 16:10, a 2 px brand ring when selected; the family chips scroll the grid to their
  heading. Sliders are the shared `RANGE_SLIDER`; colour swatches open the one colour picker.

## Accessibility

- Every tile is a button named by its design with `aria-pressed`; the families are labelled sections.
- Sliders carry their label; Shuffle, Try Another, Reset and the switches are named controls.
- The design layer is `aria-hidden` and takes no pointer events.
- Reduced motion shows the still frame (system setting and `:root.reduce-motion`).

## Performance and limits

- `paintPageDesign` is memoised in an LRU of `DESIGN_CACHE_MAX` entries keyed by the design, the page size, the
  palette, the strip and (the Type Watermark only) the font. A deck of fifty same-sized slides draws once.
- A test holds every design's drawing under a CPU budget and under 1,600 nodes.
- The guard reads the settled elements, never a drag frame.
- Animated layers move by transform and opacity; off-screen pages pause.

## Observability

`debugLog('[page-design] set', { tabId, id, scope })` on each pick; the guard logs nothing (it is a pure read).

## Testing

- `packages/document/src/page-designs/catalogue.test.ts`: 40+ designs, eight families, unique ids, every design
  drawable in light and dark, controls and variants consistent, the CPU and node budgets.
- `packages/document/src/page-designs/tuning.test.ts`: parse keeps valid fields and drops the rest; compaction.
- `packages/document/src/page-designs/behaviour.test.ts`: resolution, roles and rhythm, strips, the guard, the cache,
  sets, pick and the edits. `export.test.ts`: the still frame in exports.
- Agents: `packages/edit-operations/src/pages/page-designs.test.ts`; the CLI flags in
  `packages/agent-verbs/src/verbs/pages.test.ts`; `create_document` in `apps/mcp/src/create-document-placement.test.ts`.
- Editor: `PageDesignLayer.test.tsx` (layers, pause, decoration only), `PageDesignPanel.test.tsx` (pick, scope,
  tune, reset, sets), `design-tune.test.ts`, and `usePageDesignEdits.test.ts` (one step a pick, a burst a drag, the
  lock, a set, and the Participant and Viewer roles).
