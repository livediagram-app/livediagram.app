# Page Designs

A **page design** is a backdrop drawn behind everything on a page: decoration only, never content. It sits over the
page's background (its fill and pattern, [Pages](../007-editor/pages-mode.md) "Backgrounds") and under every element
and an article's writing, so a deck, an infographic or an article can look art directed rather than plain. Designs are
picked and tuned in Tab Style's **Page Design** panel ([Tab Style dialog](canvas-and-theme-dialog.md) "Page
Design").

## Why

Tab Style sets a tab's theme, finish, font and page background, but every page then sits on a flat fill or a
gradient, so decks, infographics and articles look alike. Designs give a page a striking, unique backdrop in one
click, drawn from the tab's theme so nothing clashes, and kept calm where the words are so it never costs
readability.

## Domain language

- **Page design** (`PageDesign`): a design from the catalogue with its tuning. Never "background" (the fill and
  pattern under it), never "template" (what a document was made from) and never "layout" (what is on a page).
- **Tab design**: the design every page of a tab wears (`Tab.pageDesign`).
- **Page override**: a page's own design (`Page.design`), worn in place of the tab design; `{ id: 'none' }` is a page
  that wears no design while the tab has one.
- **Family**: a group of designs in the catalogue (Gradients, Geometric and the rest).
- **Tuning**: a design's settings beyond its id (colours, intensity, scale and the rest, "Fine tuning").
- **Design set**: a curated bundle of theme, font, finish, page background, design and layouts, applied in one
  click ("Design sets").
- **Scrim**: a soft plate in the page's own colour laid under a text the contrast guard finds hard to read.

## The catalogue

Forty-three designs in eight families, each **procedural**: drawn as SVG from its tuning, the page's size and the
theme, never a fixed picture, so it fits any page size, stays crisp at any zoom and in every export, and weighs
nothing to store. The catalogue's order is the picker's.

| Family    | Designs                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| Gradients | Soft Mesh, Aurora, Duotone Sweep, Radial Glow, Sunset Bands                    |
| Geometric | Grid, Dots, Isometric, Hexagons, Triangles, Concentric Rings, Diagonal Stripes |
| Organic   | Blobs, Waves, Topographic, Flowing Ribbons, Marbled                            |
| Texture   | Paper Grain, Noise, Linen, Risograph, Halftone, Blueprint                      |
| Light     | Glass Panels, Spotlight, Bokeh, Soft Shadows, Layered Cards                    |
| Frames    | Corner Accents, Edge Bands, Side Rail, Torn Paper, Offset Border               |
| Bold      | Brutalist Blocks, Memphis, Swiss Grid, Split Fields, Type Watermark            |
| Tech      | Circuit, Starfield, Constellations, Data Grid, Scanlines                       |

- **Decoration only.** A design adds nothing selectable, searchable or exported as content: it is drawn inside the
  page's sheet, under the element layer, takes no pointer events and is hidden from screen readers. Type Watermark
  draws a decorative glyph (an ampersand, an asterisk, a section mark and the like), never words.
- **Same everywhere.** One pure renderer draws a design for the editor, present mode, shared and embedded views, the
  page thumbnails, the Tab Style previews, the agents' page previews and every export, so they always match.

## Where a design applies

- **The tab design** applies to every page of the tab. A page's **override** wins over it: another design, its own
  tuning, or **No design**. Clearing the override puts the page back on the tab design.
- A design is drawn over the page's fill and pattern and over an animated background's moving parts, and under every
  element and an article's writing.
- Every page kind takes a design: infographic, slide, article and flashcard pages alike.
- **Locked pages** keep their override: setting a page override on a locked page is refused, as any page edit is. A
  tab design reaches a locked page, as a theme does.

## Fine tuning

Every design exposes the controls that mean something for it; each design lists its own.

| Control   | What it sets                                                                 | Range              | Default          |
| --------- | ---------------------------------------------------------------------------- | ------------------ | ---------------- |
| Colours   | Three colours the design draws in: the theme's, or three of the person's own | theme or three hex | theme            |
| Intensity | How strongly the design shows                                                | 10% to 100%        | the design's own |
| Scale     | How large or dense its parts are                                             | 50% to 200%        | 100%             |
| Angle     | Which way it runs or turns                                                   | 0° to 355°         | the design's own |
| Position  | Where its focus sits (a glow's centre, a spotlight's source)                 | the page, x and y  | the design's own |
| Seed      | Which variation of its random parts, with **Shuffle** for a new one          | 1 to 9999          | 1                |
| Blur      | How soft its edges are                                                       | 0% to 100%         | the design's own |
| Grain     | A fine film grain over it                                                    | 0% to 100%         | 0%               |
| Safe area | How calm the middle of the page stays                                        | 0% to 100%         | the design's own |
| Style     | The design's own options (Grid's lines, dashes or crosses, say)              | the design's       | its first        |

- **Live preview.** Every control applies as it moves; a slider's drag is one undo step on release.
- **Reset** puts the design back on its own defaults, keeping the design.
- **Shuffle** gives a new seed; **Try Another** picks another design of the same family, keeping the tuning that
  family shares.

## Theme drives colour

A design's colours come from the tab's theme unless the person chose their own: the theme's accent, its second and
its third colour (a multi-colour theme's next branches, else the accent deepened, as the theme gradients take them,
[Pages](../007-editor/pages-mode.md) "Backgrounds"). So a theme change, or a Look, recolours every design at once.
On a dark page the colours are lifted, so they glow rather than sink, and lines and textures draw in light ink; on a
light page, in the theme's own colours and dark ink. The plain paper on screen in dark chrome counts as a dark page;
exported, the paper is white and counts as light. The **Type Watermark** draws in the tab's font.

## Animation

Thirteen designs can move: Soft Mesh, Aurora, Duotone Sweep, Radial Glow, Waves, Blobs, Flowing Ribbons, Spotlight,
Bokeh, Starfield, Constellations, Circuit (pulses) and Scanlines.

- **Animate** is a switch in their fine tuning, **off by default**, with **Speed** from 25% to 300% (100% is the
  design's own pace).
- **Calm and cheap.** A design moves whole layers by transform and opacity only, so the compositor runs it with no
  repaint; loops run 8 to 60 seconds.
- **Reduced motion** (the system setting or the editor's Reduce Motion) shows the still frame.
- **Off screen, it pauses.** A page whose design is not on screen holds still until it comes back, so a long deck
  runs only the pages in view.
- **Still everywhere else.** Exports (PDF, PNG, SVG, PPTX), thumbnails and previews draw the **still frame**: every
  layer at rest, which is also the first frame the animation shows, so nothing jumps when it starts.

## Readability

Designs keep words readable in three ways.

- **Safe area.** Each design keeps the middle of the page calmer (its Safe area, a soft fall-off from the edges to
  the centre), where layouts put their words.
- **Content zones.** A page's words are its content zones: every text on the page, wherever a layout or a person put
  it. The contrast guard checks each one.
- **Contrast guard.** For every text that sits on the page with no fill of its own, the guard estimates the backdrop
  under it (the page's fill with the design's colours at the strength they show there) and checks the text's colour
  against it: 4.5 to 1 for body text, 3 to 1 for large text (WCAG 2.2 AA). A text that fails gets a **scrim**, a soft
  plate of the page's own colour under it, drawn with the design (on screen and in every export). The guard is a
  setting of the design: **Add a scrim** (the default) or **Warn only**, which draws no scrim and says in the panel how
  many texts are hard to read.

## Rhythm and continuity

- **Rhythm** (the tab design's **Bold Title and Section Pages** switch): the design shows fully on title and section
  pages and quieter on content pages (its intensity at 55% and its safe area at least 70%), so a deck reads as
  designed rather than repeated. The first page is the title page; a section page is one holding only one to three
  texts.
- **Continuity** (the tab design's **Flow Across Pages** switch, offered by the designs that can flow: Soft Mesh,
  Aurora, Duotone Sweep, Waves, Flowing Ribbons, Topographic, Blobs, Diagonal Stripes and Starfield): the design is
  drawn as one long strip across every page in the tab's order, each page showing its stretch, so a wave or a gradient
  runs on from one page into the next.

## Design sets

Eight curated bundles, each applied in one click from the top of the Page Design panel: the tab's theme, font and
finish, the background every page takes (as a Look gives it, [Tab Style dialog](canvas-and-theme-dialog.md) "Looks"),
the tab design with rhythm on, and its layouts: each empty slide or infographic page is laid out with the set's title
layout (the first page) or its content layout (the rest), the slide ones below on a deck and their infographic
counterparts on infographic pages. A page with anything on it keeps its content. One undo step.

| Set           | Theme    | Font          | Finish       | Pages          | Design        | Slide layouts (title, content) |
| ------------- | -------- | ------------- | ------------ | -------------- | ------------- | ------------------------------ |
| Keynote Dark  | Midnight | Inter         | Professional | Theme ink      | Aurora        | Title, Bullets                 |
| Editorial     | Cream    | Lora          | Professional | Paper          | Offset Border | Title, Two Columns             |
| Startup Pitch | Ocean    | Poppins       | Flexible     | Theme dawn     | Soft Mesh     | Title, Three Stats             |
| Field Notes   | Mocha    | Nunito        | Sketch       | Theme mist     | Topographic   | Title, Bullets                 |
| Blueprint     | Steel    | Space Grotesk | Professional | Theme ink      | Blueprint     | Title, Three Points            |
| Gallery       | Mono     | Inter         | Professional | Paper          | Swiss Grid    | Title, Two Columns             |
| Neon Night    | Abyss    | Space Grotesk | Professional | Theme twilight | Circuit       | Title, Three Points            |
| Playground    | Rainbow  | Nunito        | Flexible     | Paper          | Memphis       | Title, Bullets                 |

A set is not stored, as a Look is not: the tab carries the ordinary settings.

## Stored data

- `Tab.pageDesign?: PageDesign` and `Page.design?: PageDesign | { id: 'none' }`.
- `PageDesign = { id, colors?, intensity?, scale?, angle?, focus?, seed?, blur?, grain?, calm?, variant?, animate?,
speed?, rhythm?, flow?, guard? }`; every tuning field is absent at its default, so a stored design is small.
- **Read leniently.** A design whose id the catalogue does not hold is dropped (the page wears the tab design, or
  none); a field out of range or of the wrong type is dropped (its default stands). An older editor, which knows no
  designs, ignores the fields and draws the page without one.
- **Apply to All Tabs** copies the tab design with the rest of the style.

## Agents

- `change_pages` sets a page's override (`design` on `add` and `set`: a design, `"none"`, or `"tab"` to clear it) and
  the tab design (the `tab_design` change: a design, `null` to clear, or `"auto"`), and `create_document` takes a
  `design` for its tabs (an id, or `"auto"`, picked for each tab's words); `"auto"` picks a fitting design for the tab's words ([Pages for
  agents](../024-agents/pages-for-agents.md) "Page designs"). The `pages` view names each page's design.
- The command line (`livedocuments page set`) takes the same, as `--design` and `--tab-design`.

## Share roles

- **Editor**: picks and tunes the tab design and page overrides, and applies design sets.
- **Participant** and **Viewer**: see every design (animated ones animate), and change none: the Tab Style dialog is
  only offered on an editable tab, and the setters refuse a blocked session.

## Performance

- A design's drawing is worked out once per design, tuning, page size and theme, and shared by every page wearing
  it (a deck's fifty slides draw one), from a bounded cache.
- A page's design is one SVG string per layer, set as markup, never thousands of React elements.
- The contrast guard runs on the elements as they settle, never on every frame of a drag.
- Only animated designs on screen animate; layers move by transform and opacity alone.
- While a Fine Tune control is moving, only the pages on screen redraw; the rest keep their last drawing and catch up
  a moment after the control stops. A flowing design draws a strip per page, so a fifty-page deck would otherwise
  redraw fifty strips on every tick.

## Telemetry

`Tab · Changed · PageDesign` (a design picked for the tab), `PageDesignPage` (a page override), `PageDesignTuned` (a
tuning change), `PageDesignSet` (a design set), `PageDesignAnimated` (Animate turned on).

## Non-goals

- Pictures as designs (a page's picture background is its Image fill).
- A design per element, or decoration in front of content.
- Saved designs in a team library: a later step with the platform's design systems.
