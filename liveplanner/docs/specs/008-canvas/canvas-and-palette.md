# Canvas and palette

The editor's canvas is the surface every tab is drawn on. A Board, a Sheet, a plan view, a chart and a note are
canvas elements that sit on a tab or fill it ([Plan tabs](../026-plan/plan-tabs.md)), and the canvas host, viewport,
selection, history, labels and element sync described here carry them. The canvas draws and edits every element
kind the model holds (`packages/project`), so a tab whose elements arrived another way (an imported tab, a paste of
the `liveplanner.elements` clipboard, an older tab of the general `diagram` kind) is moved, restyled, connected and
labelled as this spec describes. What a person **places** comes from the surfaces that own it: Start Planning, a
column's Add card, a board's widgets and a Dashboard's slots ([Plan mode](../026-plan/plan-mode.md#no-palette)).

## Palette

The editor shows **no palette**: no strip of tiles, no category picker, no armed tile ([Toolbar layout](../007-editor/toolbar-layout.md)).
The element menus (`components/palette/*`) and the tile definitions that Start Planning and the Dashboard slot
pickers draw from keep the folder's name.

### Canvas tools

`CanvasTool` is `'pan' | 'select'` (`components/palette/palette.types.ts`):

- **Hand** (`pan`) is the tool a project opens on and keeps: `useCanvasTool` starts on Select on a desktop and Hand on
  a touch viewport, and `usePlanDefaultTool` moves it to Hand when the editor mounts, since a board's cards take the
  pointer themselves. No control switches it, so a drag on the empty canvas pans. Middle-click and Space+drag pan
  too.
- **Select** (`select`) is the drag-on-empty marquee ([Marquee box-select](#marquee-box-select)); the editor offers
  no way to choose it, so the marquee is reached only where a host starts on Select.
- **No Format or Isometric tool**: the format painter ([Format painter](#format-painter)) and the isometric view are
  not part of liveplanner.

**Zen mode** (`Z`) is not a canvas tool but an orthogonal focus toggle that hides all chrome. See [Zen mode](../007-editor/zen-mode.md).

## Explorer

Opens as a popover from the **menu button** at the top left of the canvas (`ToolbarExplorerButton`,
[Toolbar layout](../007-editor/toolbar-layout.md)), on a desktop and a phone alike. That button is the only way in:
the Explorer never shows docked or open on its own, and the status screens (deleted, couldn't load, not found) show no
Explorer and no menu button at all, only their card, whose own links reach the Explorer page.

The panel is the platform's: `ExplorerPanel` from `@liveworkspace/explorer`, with the same lists, menus and dialogs as
the `/explorer` page, read from liveworkspace's index ([One Explorer](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)).
`components/panels/Explorer.tsx` hosts it in the editor's movable panel and hands it this app's parts: the open plan
on top (read once from the index when the panel opens, with Rename and Trash), the header menu, the plan
thumbnails, the share, Inbox and teams hosts, and the sign-in prompt as its notice
([Sign-in encouragement](../014-identity/sign-in-encouragement.md)).

## Text alignment

Each boxed element carries an optional pair of fields controlling where its label sits inside the box:

- `textAlignX: 'left' | 'center' | 'right'` — horizontal alignment.
- `textAlignY: 'top' | 'middle' | 'bottom'` — vertical alignment.

Defaults:

- **Shape, Text:** `center` / `middle`.
- **Sticky note:** `left` / `top` (natural for multi-line notes).

Selectable from the element's edit-text toolbar (and the right-click context menu) as a **3 × 3 grid** of small icon buttons — each cell represents one combination of horizontal and vertical alignment. The currently active cell is visibly highlighted.

Behaviour per label renderer:

| Renderer           | How alignment is applied                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Scaling (auto-fit) | The SVG `preserveAspectRatio` is set to the matching `x{Min/Mid/Max}Y{Min/Mid/Max} meet` so the text scales into the chosen corner. |
| Fixed-size single  | CSS `align-items` + `text-align` on a flex container.                                                                               |
| Sticky multi-line  | CSS `align-items` for vertical + `text-align` on the inner block.                                                                   |

The label editor (input/textarea) inherits the horizontal alignment so the cursor appears where the committed text will land.

## Colours

Boxed elements carry three optional colour fields:

- `fillColor` — background fill. **Shapes and sticky notes** only.
- `strokeColor` — outline / border colour. **Shapes and sticky notes** only.
- `textColor` — label colour. **All boxed elements** (shape, text, sticky).

All stored as CSS-compatible colour strings (typically `#rrggbb`).

A **stock colour** (Ink, Grey, Blue, Red, Orange, Yellow, Green, Teal, Violet, Pink) is stored by name instead, in
`penColour` (the line) or `penTextColour` (the text), and drawn in its version for the canvas; an
own colour in `strokeColor` / `textColor` wins over a name
([One look](../007-editor/editor-modes.md#one-look)). The context menu's **Text**, **Border**, **Line**
and caption colour rows offer the strong standard colours (Ink first,
[Colour picker](../004-interface-design/colour-picker.md)) by name wherever the element can store a
name (shapes, text, notes' text, arrows, pen strokes); choosing one stores its name, and choosing any
other colour clears it. An element with no name field takes the colour's light-paper hex. Text with no
colour of its own is drawn in Ink.

### Default scheme, dark half

The Default colour scheme's dark half is the canvas a dark-mode reader sees on an un-themed tab: a blue-slate one
hue with the dark chrome ([Colour scheme](../004-interface-design/color-scheme.md#dark-palette-steel)). Unpainted
elements take its ink (`defaultFillColor` / `defaultStrokeColor` / `defaultTextColor` with the `dark` surface).

| Role                   | Colour    | Note                                                          |
| ---------------------- | --------- | ------------------------------------------------------------- |
| Canvas                 | `#0d121a` | `DARK_CANVAS_BACKGROUND_COLOR`                                |
| Pattern (grid, lines…) | `#1c2735` | `#2e4057` at 45 % over the canvas, stored as the opaque blend |
| Element fill           | `#141b26` | A step above the canvas                                       |
| Element stroke         | `#64748b` | slate-500: 3.95:1 on the canvas, 3.63:1 on the fill (≥ 3:1)   |
| Element text           | `#ffffff` | 17.3:1 on the fill                                            |
| Annotation fill        | `#1c2533` | A shade above the element fill, so a marker reads as a chip   |
| Arrow stroke           | `#64748b` | Matches the shapes it connects                                |
| Arrow label            | `#94a3b8` | slate-400, 7.3:1 on the canvas; colour only, no plate         |

The pattern kinds and the single-level grid are the same in both halves; only colours differ. An arrow label with no
`textColor` of its own follows the arrow's stroke on light paper and on any arrow the user coloured; on dark paper an
uncoloured arrow's label is `#94a3b8`, a step lighter than its line so the words read before the wire. The canvas and
the SVG export share one `defaultArrowLabelColor`, so an export shows the same caption.

A tab saved with the Default scheme in dark mode stores the dark half it was saved under.

**Sticky text auto-fits.** On a multi-line label (sticky), `scale` means FILL THE NOTE, a pure binary search (`fitMultilineFontPx`, over the same wrap + measure helpers the SVG export uses) finds the px at which the wrapped text just fits its box, between 10 and 44px. Short text runs large, a long sentence shrinks, exactly like writing on real paper; past the floor the box clips as before. The display label and the inline editor call the SAME helper with the same inputs, that is what keeps double-click shift-free, and the editor re-fits live as you type.

**A note writes in its own ink**: its words (plain, formatted runs and the editor alike) take the note's `textColor`, else the note default (amber-950), so a sticky colour with light ink (Charcoal, Ink) or an imported note reads on its own paper.

**Sticky notes read as paper**: square corners (die-cut, never rounded — the canvas and the SVG export agree on `rx=0`), **no border by default** (the sheet's edge against its shadow is the border; a user-set `strokeColor` still draws one — the Border swatch stays functional — and the canvas + export agree, `stroke="none"` otherwise), and the default shadow says the note is glued along its TOP STRIP with the rest of the sheet lifting ever so slightly off the canvas. **Nothing about the note itself changes** — same flat rectangle, same fill — and **no mask or clip is involved anywhere, so no hard shadow edge can exist**: `.lvd-sticky-peel::before` (globals.css) hangs a caster behind the note whose FILL is a long vertical gradient (`#0f172a00` above ~10%, full slate-32% ink from 77%) under one small 2px blur, running 3px proud of the sides and 5px below — a whisper of shadow hugs the sides and deepens continuously toward the bottom (a continuous ramp never reads as a band or start-line, where masked fades and clipped trapezoids both did) before throwing under the bottom edge. `::after` repaints the sheet over the caster's interior (negative-z pseudos paint above their element's background), leaving only the shadow that escapes the edges, plus a pressed-glue wash at the top strip (a flat 3% band to 14%, releasing by 33%) and a 1px definition halo (`0 0 1px`) so the sheet's edge reads against any backdrop — the halo lives on the pseudo because an inline wrapper box-shadow would override the Tailwind selection ring. The recipe was hand-tuned on a live canvas in a 25-variant bake-off against Miro's renderer output. **The blur is drawn, not run**: the caster is a ramp down its height times a box across it, so its blur is the product of the two blurs, and `../packages/workbench/src/lib/sticky-peel-image.ts` computes that picture once per page from the recipe (screenshots of the old and new peel differ by at most 6 of 255 levels in Chrome and Safari, light and dark) and the canvas root hands it to `::before` as a stretched border-image (`--lvd-sticky-peel`, a short blob URL); the sides stretch to the note's height, keeping the ramp's proportions. A live `filter: blur()` was run again by Safari for every note on screen on every frame of a pan or zoom ([Canvas performance](canvas-performance.md) "A pan or zoom repaints no filter"). **On a dark canvas the peel deepens**: the slate ink is tuned against light paper and all but disappears on a dark wall, so the canvas surface flags itself (`data-dark-canvas`, see `isDarkCanvas`) and a stronger, slightly longer black throw takes over — same construction, no mask, no hard edge. A user-set element shadow ([Element shadows](element-shadows.md)) replaces the peel outright (the class is dropped with it): an explicit choice wins.

Defaults follow the design system per type:

| Type   | Fill        | Stroke      | Text          |
| ------ | ----------- | ----------- | ------------- |
| Shape  | `brand-50`  | `brand-500` | `brand-800`   |
| Sticky | `amber-100` | `amber-200` | amber-950-ish |
| Text   | transparent | transparent | `slate-800`   |
| Arrow  | n/a         | n/a         | n/a           |

Setting a colour applies to every member of the current selection that supports it.

The **Text colour** picker lives in the element's right-click context menu under **Colours**, alongside **Background** and **Border** (shown only for elements that support them), plus two rows that appear on the elements that have the surface: **Heading** on a lane or table ([The lane](../009-elements/lane.md)) and **Pointer** on an arrow, which colours the arrowheads independently of the line. An arrow with a pointer colour carries its OWN SVG marker, because the shared markers paint with `context-stroke`, which is by definition the line's colour. Where the browser cannot paint a marker with `context-stroke` (WebKit: Safari, and so every browser on an iPhone or iPad, which paints the head its default black, lost on a dark canvas), every arrow carries its own marker, painted its line's colour (`markersTakeLineColour`, asked once through `CSS.supports('fill', 'context-stroke')`).

Every row is led by an **icon drawing the surface it paints** (a letter over a bar, a filled box, an outlined box, a banded box, an arrowhead). Those labels are four words of similar length and shape; in a dense menu the glyph is what separates them at a glance, before anyone reads one.

**Every row opens the one colour picker** ([Colour picker](../004-interface-design/colour-picker.md)) in a popover beside it, since the menu is narrower than the picker: no colour first ("No text colour", a checkerboard on the row's chip), the **Theme** group, the standard colours (strong on Text, Border, Line, Pointer and Icon; soft on Background, Heading, a caption's background and a cell's background), **Custom colours** (the project's own custom colours) and **Add a custom colour** (four coloured dots), the custom colour editor with its eyedropper. A pick commits and closes it; hovering or focusing a swatch previews it.

**No colour.** "No colour" is the one option no theme provides and several elements want: a frame or shape showing the canvas through it, a border that is simply absent. A frame in fact DEFAULTS to it.

The same picker is offered wherever an element's colour is chosen, including a **table cell's own menu** (`TableCellMenu`). Its rows hover-preview over the selected cells like every other row, without committing, so sweeping the colours costs no undo entries.

**The Theme Palette.** The active theme's colours (`themePresetColors` in `apps/editor/lib/themes.ts`), so they match it rather than a fixed rainbow, each named by a colour word (`colourWords`: "Blue", "Light blue", "Deep blue"). The set is a **ramp**, not just the single theme colour: the theme's accent hue is spun into light → base → dark variants, plus the fill / text colours, then a neutral ramp (white → light grey → slate → ink). A multi-colour theme ([Multi-colour (rainbow) themes](../011-theme/multicolour-themes.md)) instead leads with a tint + base of every branch hue. Deduped, capped at 20. Tints / shades are computed via `tint` / `shade` in `packages/project/src/colors.ts`.

**Pick a colour off the screen.** The custom colour editor behind **Add a custom colour** has a **pipette**: click it, then click anything on screen (an image on the canvas, a logo in another window, an element already coloured the way you want) and the editor takes that colour. It uses the browser's `EyeDropper` (`../packages/workbench/src/hooks/ui/useEyeDropper.ts`) and is offered only where the browser has one (Chromium); elsewhere there is no pipette rather than a button that can't work.

Arrows don't expose any colour pickers yet.

Future iterations: stroke width, dash patterns, gradient fills, named theme colours, transparency.

## Aspect ratio lock

Each boxed element can have its **aspect ratio locked**. Stored as `aspectLocked?: boolean` (defaults to `false`).

- Toggled from the **Lock Aspect Ratio** button in the selection popover.
- When on, every resize handle keeps the width-to-height ratio of the moment the drag started (the same constraint Shift applies, see [Resize](#resize)):
  - A corner is led by the axis the pointer has moved further along, in canvas pixels; an edge handle by its own axis.
  - The leading side follows the pointer; the other is derived from the source ratio.
- The opposite-corner anchor still stays put; an edge handle anchors the opposite edge, the other axis centred on it.
- Move/resize on locked-position elements (the other `locked` flag) is still disabled regardless of aspect lock.

### Current Tab section

Tab-level controls live in **context menus**, not a side panel: the **tab menu** (the tab's ellipsis, a right-click on a tab, a right-click or a long-press on the empty canvas) is one menu at every entry point, and the tab's theme, canvas background and font live in the **Tab Style** dialog (Looks, then the Colours, Finish, Text and Canvas panels, [Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)). The menu has no Add section. Every context menu shares one width (`w-56`). The controls below are described by what they do; their home is that menu or that dialog.

> **Element menu anchor:** an element's context menu opens from the element's **top-right corner** rather than the cursor / finger / toolbar, so the menu sits beside the element (down + right) instead of covering the thing being edited. This is shared (one helper, `../packages/workbench/src/lib/context-menu-anchor.ts`) by all three entry points: **right-click** (desktop), **long-press** (touch), and the selection toolbar's **⋯ "More"** button. If the fixed-width (`w-56`) menu wouldn't fit to the right of the element, it flips to the element's **top-left** corner and opens leftward; either way it's held a few px off the edge so a thick border / selection ring isn't tucked under it, and it still clamps back on-screen vertically near a viewport edge. The empty-canvas / tab menu still opens at the cursor. **Arrows anchor the same way**, using the top-right corner of the arrow's on-screen bounding box (the wide hit band's rect, so zoom / pan are baked in), right-click, long-press, and a right-click on the arrow's label all open beside the arrow rather than under the pointer, falling back to the pointer position only if the arrow's DOM node can't be measured.

Tab-level styling + tools: **Theme**, **Canvas** (background) and **Font** live in the **Tab Style** dialog ([Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)); **Auto-align** and the **Session** tools live in the canvas / tab context menu; **Remove all content** lives in the tab's context menu. What each does:

- **Theme**: the theme browser (`ThemeBrowser`): every theme in one flat list, nine to a carousel page, the same wherever a theme is picked (the Tab Style dialog's Colours panel). Picking a theme writes `theme: ThemeId` onto the tab AND updates the tab's `backgroundColor`, `backgroundPattern`, and `patternColor`. The backdrop follows the **same preserve-customs rule as element colours** (`switchThemeBackdrop` in `apps/editor/lib/themes.ts`): each field adopts the new theme's value only when it's unset or still matches the _previous_ theme's value, so a deliberately-chosen pattern survives a theme switch. Newly added boxed elements inherit the theme's `elementFill / elementStroke / elementText` colours (sticky notes keep their amber identity regardless). The catalogue (`packages/project/src/themes-data.ts`) ships **12 default schemes** (Default, Pink, Forest, Sunset, Lavender, Mono, Ocean, Sky, Midnight, Cream, Rose, Sand) plus **12 marked `extra`** (Olive, Indigo, Steel, Mocha, the dark schemes Pine, Plum, Abyss, Espresso, the three multi-colour themes Rainbow, Pastel, Tropical, see [Multi-colour (rainbow) themes](../011-theme/multicolour-themes.md), and the formal **UML** theme, see [Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)). `extra?: boolean` is catalogue metadata only; no theme surface gates on it. Every theme works in light and dark mode: each person sees a tab in their own appearance's half ([Light and dark halves](../011-theme/light-and-dark.md)). Most themes paint every element one colour; the **multi-colour** themes tint each branch of the diagram's hierarchy a different hue. A theme card previews its colours via the shared `ThemeSwatch`, in the reader's half, one dot for single-colour themes, a row of stripes for multi-colour ones, and a stripe per shape-kind colour for UML.
- **Canvas**: per-tab background controls. Eighteen pattern choices total, shown in **two labelled sections** (`CanvasStyleControls` splits the single `PATTERNS` catalogue by `isAnimatedPattern`, so the same split renders everywhere the picker appears, the Tab Style dialog included). **Pattern** (the static set, a 4-column grid of equal-width buttons): eight defaults (Grid, Blank, Lines, Graph, Crosshatch, Confetti, Stripes, Diagonal, two full rows) plus five behind a "Show More Patterns" toggle (Waves, Bricks, Hexagonal, Engineering, Checkerboard). **Animated** (its own section, always shown in full so it stays discoverable): the five animated patterns below. Five **seasonal patterns** (Sparkles, Eggs, Cobwebs, Snowflakes, Candy Stripes) are deliberately not in `PATTERNS`, so no picker shows them; a tab wears one only through a seasonal look ([Seasonal looks](../011-theme/canvas-and-theme-dialog.md#seasonal-looks)). Patterns store as `backgroundPattern?: BackgroundPattern`. When the user pans, the pattern phase tracks the pan offset so the (static) pattern tiles indefinitely. The static pattern lives in **world space**: it pans and zooms with the canvas content (`worldPatternOrigin` in `apps/editor/lib/canvas-backgrounds.ts` maps its origin exactly as the element layer maps world `(0, 0)`, and its tiles scale by the zoom), so an element stays on the same part of the pattern at any zoom.

  **Animated patterns** (`ANIMATED_BACKGROUND_PATTERNS` / `isAnimatedPattern` in `packages/project`) bring the canvas to life with soft ambient motion, and are clearly distinct from every static texture: **Flow** streams diagonal lines, **Drift** floats rising motes, **Aurora** drifts soft colour glows, **Ripple** expands gentle concentric rings, and **Ribbons** sweeps thick curved lines that flow along their paths (each ribbon a tint/shade of `patternColor`). They render via the `AnimatedCanvasBackground` overlay (a full-bleed, pointer-transparent layer behind the canvas content) rather than a CSS `background-image`, because per-element motion can't be a tiling image; `tabBackgroundStyle` contributes only the backdrop colour for them. A page that covers the canvas (a Form tab, a Dashboard, a board maximised or filling its tab: `CanvasCover`) inherits the canvas's colour and static pattern but would hide this layer, so it draws the animated pattern again in its own `TabPatternLayer` (fed by `CanvasPatternContext`), and the canvas's copy under it stops while covered. A form link's page draws the tab's pattern the same way (`look.canvas`, [Forms](../030-forms/forms.md#look)). The motion is **ambient** (decorative, not pan-locked), **theme-matched** (every glyph paints in `patternColor`), **size-aware** and **opacity-aware** (the pattern-size and opacity sliders scale and fade the layer), **speed-aware** (a Speed slider, shown only while an animated pattern is active, writes `backgroundAnimationSpeed` — a rate multiplier the keyframes divide their tuned durations by via `--lvd-bg-speed`), **reduced-motion safe** (each glyph's resting frame is already a pleasant still pattern, so `prefers-reduced-motion` simply freezes it), and **deterministic** (fixed position/delay tables, no randomness). Axis-aligned line grids (Lines, Stripes, Graph, Engineering) are built from tiled `linear-gradient`s with an explicit `background-size` so lines stay crisp and never double; the diagonal grids (Crosshatch, Diagonal) and Hexagonal render via inline `data:image/svg+xml` tiles that rasterize once and repeat seamlessly; Checkerboard is a tiled `conic-gradient`. Confetti renders a fixed multi-colour scatter and ignores the pattern colour; the SVG and Waves patterns pick up the active pattern colour. Plus Canvas + Pattern colour pickers, an Opacity slider, and a **pattern-size slider** (`backgroundPatternScale`, 50–200%, default 100%) that multiplies each pattern tile's `background-size` (never the pan phase, so the pattern keeps tracking the pan at any size; Blank has no tile so the slider is a no-op there).

- **Content** — destructive operations on the tab's contents (today: a single "Remove all content" button, disabled when there's nothing to clear).
- **Cleanup** — tidiness operations on the tab's existing content. Today: a single "Auto align" button that snaps every boxed element's position (x / y) and dimensions (width / height) to the nearest 10 px (the canvas's grid unit), so almost-aligned shapes become exactly aligned and minor dimension drift collapses. Aspect-locked shapes (circle, diamond, actor) stay square / proportional by snapping the larger axis and matching the other to it. Free-endpoint arrows snap their endpoints to the same grid; pinned arrow endpoints stay attached to their anchored elements (which themselves get snapped). Width / height never go below `MIN_SIZE`. The operation is one undoable commit, so the user can undo it like any other edit. Disabled when the tab has no boxed elements.

### Selected Element section

Per-element controls live in the **right-click element context menu** (Layer / Shape / Rotation / Progress / Animation / Colours / Border / arrow Line + Pointer / Text / Icon / Image / Table / Link categories, with Assign Action, Comment, Link, Note and Clear Styles on its [quick bar](element-menu-quick-bar.md)) and the floating selection toolbar.

When an element is selected, these per-element controls are available from its **right-click context menu** (and the floating selection toolbar), grouped into **collapsible categories**. Each category is **closed by default**; clicking its header toggles it open. Category contents follow the house **tile pattern**: options render as icon-over-label `MenuTile` grids (`MenuTileGrid`, 2 to 4 columns), not vertical rows of buttons. Fixed-action dropdown menus app-wide use the same tile grids (the Explorer panel's + New header menu, the folder / team / project row menus, the /explorer page's row and card menus, the marquee toolbar's selection filter); one-per-row lists remain for dynamic list pickers (copy-to-project, move-to-folder), where a scrolling list of user content reads better than a grid, and for the Share dialog's Embed / Live image copy menus, a short list of "Copy …" verbs that reads down like a normal dropdown (plain `MenuActionRow`s, icon left).

**Category order is fixed and consistent** across the single-element and multi-selection menus, sorted into visually-separated bands (no band titles — tried and dropped as noise). **Markers and Alignment are grouped under a single "Text" category** (in the band between the style and content groups) that, instead of expanding inline, opens them in a **side flyout** — a panel floated to the right of the menu (or the left when there's no room), so the two categories don't lengthen the menu's vertical stack. Inside the flyout they are the same two collapsible categories (Markers, [Shape markers](../009-elements/shape-markers.md); and Alignment — the 3×3 grid) working exactly as before; both only show once the element actually has label text (a marker decorates the label, and there's nothing to align without text), and the whole "Text" row hides when neither applies. The side-flyout is a **reusable primitive** (`MenuFlyoutSection` in `components/primitives/`, honoured by both `ContextMenu` and `PortalMenu`'s outside-click) that any context menu can use to fold a cluster of categories behind one row; flyout sub-categories always start closed (auto-expanding the first one flipped the shared one-open-section state and collapsed whatever accordion was open in the host menu), and the flyout tracks its trigger row per-frame so a host menu that grows or shrinks never strands it. A flyout's own open/closed state is **lifted into the shared menu scaffold** (`flyoutProps(id)` beside `sectionProps(id)` in `useContextMenuScaffold`, at most one flyout open) rather than held locally in the component: conditional sibling sections mean the flyout row can remount when the menu's target element changes, and local state made the open category collapse on every element switch. `MenuFlyoutSection` still falls back to internal state when no controlled props are passed. Its outside-click dismiss also ignores clicks on canvas elements (`[data-element-id]`) — those retarget the host menu rather than dismiss it, so the open flyout rides along — and clicks inside a text-edit session (`[data-rich-text-session]`, see the rich-text section). **Presets, Colours, and Border are likewise grouped under a single "Style" flyout row** (the second use of the pattern, replacing their three stacked slots), and **the data-shape controls — Progress (bar / ring), Rating, and the chart Data + Chart sections — fold behind a single "Tools" flyout row **whenever more than one of them applies at once**, which today means charts (Data + Chart) and nothing else — see "A category with one thing in it is not a category" below** (sliders glyph) in the single-element menu, so a data element's menu doesn't grow a band of bespoke rows; the generic Animation row stays top-level. Rows within a band sit **flush** (no per-row hairline); the only rules in the menu are the band separators (a slightly inset, stronger divider), drawn only when the following band has a visible category so an absent band leaves no dangling rule. The bands:

1. **Placement** — Layer, Shape, Rotation.
2. **Appearance** — Progress, Animation, Colours, Border.
3. **Content** — Line, Pointer, Text, Icon, Image, Table, Link.
4. **Collaboration**: assign action, comments, link and note, on the menu's [quick bar](element-menu-quick-bar.md) above every category.

Every category renders conditionally (hidden when its gate doesn't apply), but a shown category always lands in this order, so the menu never reshuffles between element kinds. The multi-selection menu has **parity with the single-element menu for every formatting category** — Layer (front/back, move-to-layer, opacity, aspect lock), Shape morph (with Reset Aspect Ratio), Rotation, Presets, Animation, Colours (with Reset to Theme), Border (strength / pattern / radius), Icon size, Typography (Font / Size / Padding), Alignment, Markers, Table structure, and the arrow Line / Pointer / Text categories all appear when any member of the selection matches, each applying selection-wide (display values read off the first matching member) — so anything you can restyle on one element works on a marquee too. The multi menu is **never empty**: the placement band applies to every element kind, so even an image-only marquee gets Layer / opacity / Rotation. Animation is **type-aware on homogeneous selections** (all-charts get the slice set, all-icons the glyph set; mixed selections fall back to the shared boxed set). Both menus use the **Style** and **Text** side-flyout groupings identically (Style = Presets + Colours + Border; Text = Typography + Alignment + Markers), and the Text row sits inside the style band — no separator of its own. Only the truly per-element categories (Image pick/replace, the link-card Link, Note, Comments, Assign Action, and the data-shape editors — Progress / Timeline / Rating / Chart Data) stay single-element.

**A category with one thing in it is not a category.** `MenuFlyoutSection` counts the sections that actually rendered (`Children.toArray` drops the `false` / `null` a conditional branch leaves behind), and when there is exactly **one**, it renders that section **in the host menu in its own place** and draws no flyout row at all. So a record's menu shows **FIELDS**, not **TOOLS ›** hiding **FIELDS**; a picker shows **PICKER**; a session button shows **SESSION**. Charts, the one element with two Tools sections, keep the row.

The reasoning is the row's own: Tools exists to stop a band of bespoke rows lengthening the menu, and one row is not a band. Opening a side panel to choose between one option is an extra tap and a second surface for a menu with no choice in it, and the parent's name is strictly less informative than the child's.

Promoted, it is an ordinary collapsible row participating in the menu's one-open-at-a-time state, because a permanently-expanded row in the main menu would be worse than the flyout it replaced. Only a **controlled accordion** is promoted; a lone child of any other shape has no row to become, so it stays behind the flyout.

**Every Collaborate element carries a `…`.** They are the elements you configure most and the ones whose settings are least guessable — "what does this Picker pick from", "how many dots does this vote give" — and until this existed the only way in was a right-click that nothing on the face advertised. The button sits in the element's top-right corner, except on a collaboration panel (Temperature check, Decision record), where it **leads the title** in the card's title row: a control that belongs to the thing named reads as part of it there, and stranded in the far corner it read as random (`CollabSettingsSlot` hands it to `CollabPanel`; a card's own richer `…` takes the same spot). It opens that element's **own context menu**, anchored from the ELEMENT's rect so it lands exactly where a right-click on the same element would: one menu, one position, whichever way you asked for it. Two do without one: the Comment and Action panels, whose every act is already on the card and which have no settings of their own; each is reached by right-click like any element.

It opens the real menu rather than a second copy of each form. A per-kind popover would be a dozen settings surfaces to keep in step with the dozen that already exist, and they would drift. It also only reads well because of the lone-section promotion above — pressing `…` on a Picker lands you on a menu with **PICKER** in it, not on **TOOLS**.

One kind draws a **richer `…` of its own** instead (`drawsOwnElementMenu`): the Session button, with a Timer's length presets or a Vote's dots. Those are the settings worth one press mid-session, and it is never a dead end — it ends with an **All Settings…** row into the full menu. The shared button is suppressed for exactly those kinds, because two ellipses in the same corner of the same card is a bug you can see from across the room.

**An open element menu follows the selection.** Clicking another element while the single-element menu is open retargets the menu to the newly-selected element in place (same screen position) instead of dismissing it, so the same tweak can be applied to several elements one after another with one click each. The retarget preserves the menu's expanded state — the open accordion (scaffold `sectionProps`) and the open flyout (`flyoutProps`) both stay open, showing the new element's values — so styling five shapes via the Style flyout never re-drills the category path.

Control groups (rendered as context-menu categories, hidden when their gate doesn't apply):

- **Shape** _(shape elements only)_
  - Shape grid (Square, Circle, Diamond, Cylinder, Parallelogram, Hexagon, Project, Stadium, User, Cloud, Triangle, Trapezoid, Star, Speech bubble, plus the device frames Web browser, Computer monitor, Laptop, Phone, Tablet, Smartwatch) — clicking morphs the selected element into that kind in place, preserving size + colour overrides. (The Frame container is not a morph target.) Circle and diamond force the bounding box square; the rest preserve free aspect.
  - **Reset Aspect Ratio** button — snaps the shape back to its kind's default width:height proportion (`SHAPE_DEFAULT_SIZE` in `packages/project/src/factories.ts`), e.g. a stretched cylinder returns to its canonical taller-than-wide look. It preserves the shape's current visual **area** (so it doesn't jump in size, just re-proportions) and re-centres about the old centre so it doesn't drift. Emits `track('Element', 'Changed', 'AspectRatioReset')`.
  - **Lock Aspect Ratio** toggle — when on, resize handles enforce the current width:height ratio.
  - **Padding** preset (None / Small / Medium / Large) — distance between the label and the element box, snapped to a preset for round-trip simplicity.
- **Layer**
  - Front — bring to top of the z-order.
  - Back — send to bottom of the z-order.
  - Opacity slider — 0–100% on the element's `opacity` field. Folded into Layer (was a standalone "Appearance" accordion until the merge — single-control accordions weren't worth the extra header).
- **Text** _(boxed elements only)_
  - Text size — Scale, or a 6 to 48 px slider. See [Text size](#text-size).
  - Text alignment — 3 × 3 grid. See [Text alignment](#text-alignment).
  - Bold / Italic / Underline / Strikethrough toggles.
- **Colours**
  - **Text** swatch — colours the element's label. Shown for every boxed kind (shape, text, sticky).
  - **Background** swatch — fill colour. Shapes & sticky notes only.
  - **Border** swatch — outline colour. Shapes & sticky notes only.
  - **Line** swatch _(arrows)_ — the arrow's `strokeColor`. An arrow's Colours section holds just this swatch + Reset to Theme (caption colours live in the content **Caption** category once the arrow has a label). In the multi-selection menu an arrow-only selection shows the same Line swatch; a mixed selection's Border swatch recolours the arrows too (one stroke setter selection-wide).
  - See [Colours](#colours). Text elements show only the Text swatch; shapes and sticky notes show all three.
- **Pointer** _(arrows only)_
  - **Line thickness** — four snapped presets (Thin / Medium / Thick / Extra-thick → 1 / 2 / 4 / 7 px on the arrow's `strokeWidth`). Snapping is one-way for display so legacy free-number widths still highlight the nearest preset.
  - **Line style** — Straight / Curved / Angled. Drives the geometry (single line / quadratic bezier — elbow-corner control for pinned ends, ¼-chord bow for free ones / axis-aligned L-elbow). See [Arrows → Data model](#data-model).
  - **Line pattern** — Solid / Dashed / Dotted. Stored as `strokeStyle: BorderStyle` on the arrow (shares the union with the shape Border accordion's pattern row so future style additions, e.g. "long-dash", land on both surfaces with one schema change). The renderer maps to an SVG `strokeDasharray` via the same `BORDER_DASH_ARRAY` lookup the shape outlines use; the selection halo around a selected arrow stays solid for visibility.
  - **Arrowhead type** — Start only / End only / Both / No pointers. Stored as `arrowEnds`.
  - **Arrowhead size** — Small / Medium / Large / Extra-large (4 / 6 / 8.5 / 12 px marker size). Sits **below** Arrowhead type so the user picks whether they want a head before sizing it; hidden entirely when `arrowEnds === 'none'` (nothing to size).
  - **Arrowhead shape** — Filled triangle (default) / Hollow triangle / Open V / Dot / Hollow dot / Filled diamond / Hollow diamond, and the five ER ends: One (`one`, two bars), Zero or One (`zero-or-one`, a bar and a ring), Many (`many`, a crow's foot), Zero or Many (`zero-or-many`, a crow's foot and a ring) and One or Many (`one-or-many`, a crow's foot and a bar), drawn as strokes in the line's colour, the ring hollow on the paper. An arrow may give its start a different end (`arrowheadStartShape`; absent, the start takes `arrowheadShape`), as an ER relationship does: a one at one table, a many at the other. The menu picks one shape for both ends (choosing one clears the start's own), and the format painter carries the start's head with the rest. Stored as `arrowheadShape: ArrowheadShape` on the arrow, independent of size + ends so a UML diagram can pair, e.g., a hollow triangle (inheritance) or diamond (aggregation / composition) with any line weight. The renderer emits one SVG `<marker>` per (shape × size) pair; hollow variants fill with the canvas paper (the tab's background colour, so a hollow head reads hollow on a dark canvas too) and outline with the line colour, the open V has no fill. Sits below Arrowhead size and hides with it when `arrowEnds === 'none'`. Defaults to the filled triangle so arrows authored before the field render unchanged.

### Arrow labels

Double-clicking an arrow opens its label editor. Where the label sits, how it wraps, the knockout that breaks the line behind it, and the editor itself are specified in [Arrow labels](arrow-labels.md); dragging the label to override its placement (stored as `labelOffset: { t, offset }`) is unchanged. Empty label string strips the field on commit so persisted JSON stays clean. **Caption formatting:** an arrow carries the same label-text fields as boxed elements (`textSize`, `textBold`, `textItalic`, `textUnderline`, `textStrikethrough`, `textColor`, `font`) plus a `labelFill`, and once it has a label its right-click context menu gathers all of them into one **Caption** category: size, bold/italic/underline/strikethrough, font, the **Text** colour and the **Background** colour. It is called Caption rather than Text because that is what words beside a line are, and because "Text" on an arrow reads as the label field itself rather than how it is painted; alignment + padding are omitted since the label sits at the midpoint. `labelFill` is absent by default, which is how a label has always drawn (straight onto the canvas, no plate) — a colour is for a caption that has to stay readable over its own line or a busy backdrop, and it stays opt-in because a plate on an otherwise clean diagram adds a box nobody asked for.

The **export** paints the caption as it is actually styled, never a fixed label, so an export looks like the canvas; `arrowLabelFontSize` and the label layout engine live in `@liveplanner/project` so both renderers work from one set of numbers ([Arrow labels](arrow-labels.md)). `textColor` falls back to the arrow's stroke colour when unset, so the label matches the line by default; `textSize` defaults to small (12px) to match arrows authored before the fields existed. The fields ride the same `useElementStyle` setters as boxed labels (extended to accept `el.type === 'arrow'`).

Each context-menu category header shows a chevron that rotates 180° when open; the body slides open/closed via a `grid-template-rows` 0fr↔1fr transition (~200 ms) so motion is smooth and free of layout jumps. The header's leading icon sits in a **fixed-width centred slot** so every category title starts at the same x regardless of the glyph's own width — the labels line up in a clean column down the menu.

### Undo / Redo

A separate row at the bottom of the palette (separated from the add-buttons by a thin divider) holds two history controls:

- **Undo** (left-curve arrow) — reverts the last change.
- **Redo** (right-curve arrow) — reapplies an undone change.

History is kept to a maximum of **500 steps** in each direction (`HISTORY_LIMIT`), on desktop and mobile alike. Older states are dropped. Snapshots share every unchanged tab and element, so a step costs about one pointer per element of the changed tab: 500 steps on a 2,000-element board hold roughly 8 MB, light enough for a phone.

Undo-able actions: adding/deleting any element, label commits, lock toggle, layer order (bring/send), format-paint apply, duplicate-and-connect, drag-end (move or resize, including arrow-endpoint drags). A drag's snapshot is **armed** at the start but only **taken on the first actual movement** (the first `tick` past the engage threshold), so undo returns to the pre-drag state without intermediate frames, and a plain click that merely selects an element, or a press on a locked element / tab that never mutates, leaves the history untouched. The same holds for every commit: one that writes the values already there (a menu box committed without a change, a colour picked twice) is not a step, so Undo always undoes something and Redo survives it.

Not in history: selection, edit mode entry, panel positions, format-painter mode.

**A locked tab pauses undo and redo.** While the active tab is locked, undo and redo are unavailable from every route: the toolbar buttons are greyed, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y do nothing, and the command palette drops Undo and Redo. Otherwise an undo straight after locking would unlock the tab, or roll it back past the lock. The gate is applied once, where `useEditorState` hands `canUndo` / `canRedo` to every consumer.

**Collaboration + history.** A remote peer's `tab` / `project-meta` op merges into the present via `applyRemote`, which keeps the local undo/redo stacks intact (peers autosave ~every 600ms, so a history-clearing `reset` would wipe undo continuously during a shared session). The retained past states predate the peer's change, so undoing far enough can locally drop a collaborator's edit, an accepted limitation of last-write-wins collab without OT/CRDT. Genuine context switches (mount hydration, opening another project, loading a tab) still use `reset`, which clears history.

### Element kinds

The canvas draws every `ShapeKind` and the other element types in `packages/project`, each from its default box (`shape-factory.ts`) when it is built without one. The editor creates a few itself: Plan's boards, sheets, views and charts, and a sticky, text, a page and the session tools, from the tiles in `palette-tile-defs.tsx` that Start Planning and the Dashboard slot pickers render. The other kinds arrive on a tab by import, paste or an older tab, and are drawn and edited as follows.

**Shapes** (general shapes), with the box each is built at:

- **Square**: a 120×120 square node to the active tab.
- **Circle**: a 120×120 circle node to the active tab.
- **Diamond**: a 120×120 diamond (decision-node, UML-style). Rendered as an SVG polygon overlay so the diamond outline matches the element's bounding box.
- **Cylinder**: a 100×140 cylinder (taller than wide to match the natural shape).
- **Parallelogram**: a 160×100 parallelogram (wider than tall).
- **Hexagon**: a 140×120 flat-top hexagon.
- **Project**: a 140×110 project shape (slightly wider than tall).
- **Stadium**: a 160×64 pill (flowchart Start / End terminator).
- **User**: a 90×130 UML actor (stickman + label band below). While the name fits the figure's own band the figure fills the box as it always has; when the name needs more room (a second line, a larger size, an imported caption), the figure shrinks and rises so its legs end where the name's lines begin, and never draws over them (`actorFigureRect`, `packages/project/src/actor-figure.ts`, used by the canvas, the export, hit-testing and anchors).
- **Cloud**: a 180×140 cloud container (networking / architecture).
- **Triangle**: a 130×120 upward triangle (SVG polygon).
- **Trapezoid**: a 160×110 trapezoid (wider at the base; flowchart manual operation).
- **Star**: a 130×130 five-pointed star.
- **Speech Bubble**: a 180×130 callout: a rounded body with a tail dropping from the bottom-left.

A **Frame** (`frame`) is a 360×260 transparent outlined container with a "Frame" label in the top-right, drawn around a cluster of elements (a FigJam-style section). Its body is rendered fill-less so the elements inside show through.

**Frames behave as sections**, not decorations:

- **Always renders behind its contents** via the shared `framesFirst` helper (`apps/editor/lib/canvas.ts`), which both the canvas render layer and the PNG / SVG exporters route element lists through — so a frame is a backdrop regardless of its array position, with no special-casing at create time. Its contents therefore paint on top and stay individually selectable / draggable; clicking an _element_ inside hits that element (it's above the frame), while clicking _empty space_ inside the frame — or its border / title — grabs the frame itself.
- **Dragging the frame moves everything inside it.** An element is inside a frame when the frame is the **smallest frame or lane holding the element's centre** (edges inclusive, the earlier in the elements array on a tie): the one membership rule the outline, the Mermaid export and an agent's edits read too ([Edit operations](../024-agents/edit-operations.md#selectors)), so a person's drag and an agent's `move` carry the same elements. The move set is that membership at grab time (`containerContents` in the shared containment helper in `@liveplanner/project`): every element whose centre the frame holds, directly or through a frame or lane nested in it, plus every loose arrow whose free ends all lie inside. Pinned arrows between members follow their elements, and arrows crossing the frame edge run the auto-rebind ([Arrow anchors and auto-rebind](arrow-anchors.md)). An element straddling the edge travels when its centre is inside and stays when it is outside. Membership is recomputed on each grab, so an element is "in" the section simply by sitting inside it; there's no explicit parenting to manage. Overlapping frames stay sane by the same rule: **(1) a frame travels with another only when it is nested in it** (its centre inside, its area smaller); a frame that merely overlaps or touches stays where it is; **(2) an element inside more than one frame belongs to the smallest**, so it travels only when that frame, or one it is nested in, is dragged. This replaces the full-containment rule people's drags followed for a while (an element travelled only with its whole box inside, and overlapping frames went to the backmost): that rule was chosen because the centre rule took half-out neighbours along, but it gave people and agents different answers to "what is in this frame", so the outline, an agent's `move` and a person's drag disagreed about the same board. One rule wins: an element whose centre sits inside is in the frame everywhere, and one that should stay behind is moved out until its centre is.
- **Resizing the frame leaves its contents in place** — only the outline grows / shrinks, so you size the section around the elements rather than scaling them.
- The frame **does** show the quick-connect **+** buttons. It was excluded as "a backdrop, not a node to chain from", but a Lane is the same shape of thing and always showed its own, which made the rule look arbitrary rather than considered: both are containers people chain from about as often as they chain from a box. It is still not a morph target.
- **A background colour, if you set one.** A frame defaults to transparent so its contents show through, and it paints below them (see above), so a fill is a backdrop rather than a lid. The canvas fix then left the headless renderer drawing a hardcoded `fill="none"` frame, so a filled frame exported empty; both now draw the frame (and every other silhouette) from the one geometry table, `packages/project/src/shape-geometry.ts`, so the fill reaches exports too.

**Devices** (UI-device frames for wireframing). Each renders as the device's silhouette, a container for the interface elements inside it:

- **Web Browser**: a 240×160 browser window (tab strip + URL bar + viewport).
- **Computer Monitor**: a 220×170 desktop monitor with stand.
- **Laptop**: a 240×150 laptop (screen + keyboard base).
- **Phone**: a 90×170 phone (tall portrait with rounded corners).
- **Tablet**: a 140×180 tablet (medium portrait with rounded corners).
- **Foldable**: a 190×170 book-style foldable phone shown UNFOLDED: a near-square inner screen with the hinge crease down the middle. Folded, a foldable is just the Phone frame, so only the open state earns its own kind; the crease is what stops it reading as a tablet.
- **Smartwatch**: a 110×150 smartwatch (rounded face with straps above + below and a crown button).

**Icons** (curated single-colour glyphs): an `icon` shape carrying an `iconId` from the line-art catalogue (tech / cloud / UI / people: server, database, cloud, user, lock, globe, ...), 88×88 and aspect-locked. Icons are line art tinted by the element's **stroke colour** (Colours category in the context menu), with a constant on-screen line weight (non-scaling stroke) so they stay crisp at any size; the weight is Thin, Regular (default) or Bold, picked in the icon menu's **Weight** section ([Iconography](../004-interface-design/iconography.md)); the label sits in a band beneath the glyph. The glyph catalogue (id + label + keywords + SVG primitives) is fronted by `apps/editor/lib/icons.ts`, with the data itself in `../packages/icons` (`icon-catalog-1/2.ts`, async-loaded, see "Catalogue loading" below); `iconId` is a plain string in the model (not a closed enum), so adding an icon is a one-file change and an unknown id renders a placeholder glyph. The **Shape** controls (morph grid / aspect / padding) and the **Border** category (strength / pattern / radius) are both hidden for a selected icon: an icon is a glyph you pick from the Icons picker, not a box you morph or border. Icons keep the Text + Colours categories, but the latter shows only the **stroke** (glyph tint) and **text** (label) swatches, the **fill / background** swatch is hidden (`supportsFillColor` in `packages/project/src/colors.ts`) because an icon is `fill="none"` line art with no fill to colour: the `icon` shape is self-painting, so its wrapper draws no background and neither renderer reads `fillColor`. The glyph keeps its aspect inside whatever box the element has. The line-art glyphs fall into categories (Animated, Tech, People, Security, Files, Charts, Arrows, Furniture, UI), and a test asserts every line-art glyph sits in exactly one. The colour emoji share this catalogue but are stickers ([Stickers](../010-palette/stickers.md)). The **Furniture** category carries top-down floor-plan symbols (bed, sofa, armchair, chair, dining + coffee tables, TV, desk, wardrobe, bathtub, toilet, sink, stove, fridge, plant, door, stairs), drawn as if looking straight down on each piece, with the side that stands against a wall at the top of the box, no two sharing a silhouette; each fits the 2–22 box, is centred, and spans at least 14 units so it reads at 18px. The door's closed leaf lies on y = 20. The catalogue grows by appending to `../packages/icons/src/icon-catalog-1/2.ts` (and the relevant category's id-list): single-stroke, 0–24 viewBox, centred. Where Lucide has a fitting glyph the entry references the vendored `lucide<Name>` data ([Iconography](../004-interface-design/iconography.md)) instead of copying paths; the rest is drawn in-house on the same grid. No two line-art ids draw identical prims, except aliases listed with their reason in `icon-catalog.test.ts`.

**Stickers** ([Stickers](../010-palette/stickers.md)). ~193 colour emoji plus 32 word badges (APPROVED / BLOCKED / WIP / NEEDS REVIEW / P0 / OUT OF SCOPE ...), the informal half of a canvas: reacting to somebody's work, showing how you feel, marking status, pointing at things, celebrating, decorating, meeting props, work objects, people, and a bit of fun. A sticker is its **own shape kind** (`sticker`, carrying a `stickerId`), NOT an icon: it paints a die-cut white plate with a soft shadow, lands square to the canvas (see [Stickers](../010-palette/stickers.md)), is never tinted by the theme, carries no caption and refuses text by every route (toolbar button, double-click, type-to-edit, all via `isSelfDrawingShape`), and never folds into another shape as an inline glyph. The artwork is built ONCE by `stickerArt` in `@liveworkspace/icons` and shared by the canvas, the palette tile, the export, the share thumbnail and the MCP render, so a sticker can't look different in two places. Its catalogue is eleven disjoint groups (Badges, Reactions, Feelings, Status, Direction, Celebrate, Decorate, Meeting, Work, People, Fun, `STICKER_CATEGORIES` in lib/stickers.ts). An emoji held as an ICON ([Emoji section in the Icons tab](../010-palette/emoji-icons.md)) renders as the bare tinted glyph, from entries derived off the sticker catalogue.

**Technology** (full-colour brand icons, [Technology icons](../010-palette/technology-icons.md)): the AWS / Azure / Cloudflare / Firebase / generic-infrastructure marks used on system-architecture diagrams (S3, Lambda, EC2, Azure Functions, Kubernetes, Postgres, ...), kept apart from Icons because they are fixed multi-colour brand marks (a brand-coloured tile + white glyph) rather than stroke-tinted line art. A mark is a **standalone** `icon` shape carrying its id; it never folds into a shape as an inline icon. The mark reuses the `icon` shape kind, same aspect-lock + label-beneath-glyph layout, but the id resolves in `../packages/workbench/src/lib/tech-icons.ts` (`isTechIconId`) so it renders coloured rather than tinted, and the Colours category's stroke/fill swatches don't recolour it. The catalogue grows by appending `TechIconDef` entries; an unknown id still falls back to the line-art placeholder.

**Catalogue loading (async).** Both icon catalogues are pure data (~60 kB source: the line-art glyph geometry in `../packages/icons/src/icon-catalog-1/2.ts`, the Technology colour + markup in `../packages/icons/src/tech-icon-catalog.ts`: the `@liveworkspace/icons` package, shared with the Workers' headless renders) that most first paints never need, so they load as **one async chunk** via `../packages/workbench/src/lib/icon-registry.ts` instead of riding the editor's first-load JS. The editor page prefetches the chunk on mount (overlapping the project fetch), and every surface that renders catalogue data, `IconGlyph`/`IconPrims`, `TechIconArt`, the element menus' icon pickers, subscribes through the `useIconCatalogs` hook (`useSyncExternalStore`) and re-renders once when the data lands. Until then the UI **degrades gracefully, never blanks**: a line-art icon renders the framed question-mark `PLACEHOLDER_ICON`, a Technology icon renders a muted skeleton tile in the mark's silhouette, the pickers show a brief "Loading icons…" note instead of a false "no matches", and search shows no catalogue results. The synchronous API surfaces (`lib/icons.ts`, `../packages/workbench/src/lib/tech-icons.ts`: types, `isTechIconId` and its first-load `TECH_ICON_IDS` id set) stay in the main bundle so drag/drop, render dispatch, and telemetry answer exactly from the first frame; a parity test pins `TECH_ICON_IDS` to the data catalogue. A failed chunk fetch logs, keeps the placeholders, and retries on the next consumer mount.

**Icons inside shapes.** An `iconId` is also meaningful on a NON-`icon` shape (rectangle, circle, …): it renders an inline icon beside that shape's text label, tinted by the shape's stroke colour. It arrives with the element, or by **dragging a standalone icon element** already on the canvas onto a shape: on release it folds into the shape, on the side of the text nearest where it was released (left / right / above / below, stored as `iconPosition`), and the standalone element is removed, in one undo. The icon + label are laid out as a flex group whose direction / order follow `iconPosition`; the group honours the element's **text alignment and padding** (the Text category), the alignment drives the flex justify/align so the icon + label sit top-left / centred / bottom-right etc. as set, and the padding preset is the inset. The editor opens on double-click and, crucially, **the icon stays visible beside the editor while typing** (the editor renders as a flex child via the `RichTextEditor` `inline` prop rather than a full-box fill), so you can see the icon + text together as you type, laid out per the same alignment. The inline label honours both whole-element text styling **and** per-range rich-text runs (`richText`, [Canvas and palette](canvas-and-palette.md) rich text), it renders one styled `<span>` per run via `effectiveRunStyle`, so bold / italic / colour / per-run size applied in the edit-text toolbar survive once the shape also has an icon. Both paths are history-aware (undoable) and blocked for read-only / locked tabs. The dedicated `icon` shape is excluded from this (it already IS a glyph) and keeps its glyph-above-caption layout. **Frames are also excluded**: a frame is a section container, so an icon dropped on a frame (or added while a frame is selected) becomes a **standalone `icon` element** placed inside it, not an inline decoration on the frame. **Behaviour and Collaborate elements are excluded too** (every kind that draws its own face, `hasOwnFace`: the collaboration cards, the buttons, the picker, the reveal cover, the chair, and the rest): their face never renders an inline icon, so the drop target does not light up over them and an icon dropped there stands alone. All three fold paths share the `acceptsInlineIcon` predicate (`packages/project/src/colors.ts`). While dragging an icon over a shape, a brand ring + a translucent band on the target side preview where it'll land. To **move** an icon: right-click the shape, open the **Icon** section, and pick a side in the Icon position grid, or drag a fresh palette icon onto a different side (both overwrite `iconPosition`). The context menu's Icon section, directly above Markers in the element menu, is the single way to move an icon; the glyph itself does not drag. To **remove** it, right-click the shape, open **Icon**, then "Remove Icon". **Every export draws it too** (SVG, PNG, PDF, the MCP and CLI previews and project snapshots): the shared renderer lays the glyph and label out as one group with the canvas's own sizes (`inlineIconMetrics`, `inlineIconGap`, shared with the canvas), in the label's colour, honouring `iconPosition` and the text alignment, so a shape's icon is never on the canvas and missing from its picture.

**Table**: a `table` element, 3×3 at its default 360×150. The grid divides the element box evenly; double-click a cell to edit its text (Enter / blur / Escape commit, Tab / Shift+Tab walk cells). `cells` is the row-major source of truth (`cells[r][c]`), kept rectangular by the helpers in `packages/project/src/table.ts` (addTableRow / removeTableRow / addTableColumn / removeTableColumn / setTableCell). **Row / column edits** happen in-component: when the table is selected, a `⋯` trigger sits just OUTSIDE the top of each column / the left of each row (off the grid, so it never crowds the first row / column; a short hover grace keeps it mounted while the pointer crosses the gap, and the one trigger whose centre would land under the table's edge-midpoint quick-connect plus, the track centred nearest it, steps aside: a column's sideways, a row's further out past the plus, level with its row. Only that one moves, so short rows on a phone keep each trigger on its own row). The trigger is one of the **floating canvas controls** (`FLOATING_CONTROL_SIZE` / `_GAP` / `_CLASS`), so it is the same 24px circle as the quick-connect plus and its centre lands on the same line beyond that edge, so it never reads as a stray beside the plus; tapping it (click, not hover) opens a portalled menu, Insert-before / Insert-after · Move · Delete, the three groups separated by thin rules (delete disabled at the last row / column) (arrow-anchor dots are suppressed for tables). The **Table** category in the context menu toggles `headerRow`, `headerColumn` and `zebra` (header row/column combinable; the corner cell is then both, a tinted band + bold text). The default header band is an **opaque** tint: 18% of the grid stroke over the table's own cell fill, or, when the cells have none, over the paper the table is drawn on (white on light paper, the dark-ink shape fill `#141b26` on dark paper: a dark canvas, or a page with a dark fill). The band therefore follows the same surface as the cell text, so a dark page gets a dark band under light ink rather than a light band under white ink. The header ink is the header text colour (else the cell text colour) lifted or deepened until it meets **4.5:1** (WCAG AA) against the band, or against the cells or paper when the band is `transparent`; an ink that already reads is kept as it is. One pure helper (`tableHeaderColours`) resolves the band and its ink for the canvas and for every export (SVG / PNG / PDF, the live image), so they cannot drift. The header band's fill (`headerFill`) is set from the Colours category apart from the body cells; `headerTextColor` is on the model. Reset-to-theme clears the cell fill + header overrides and reapplies the theme grid / text colours. Cell and structural changes commit through `onCommitTable`, one combined patch. **Editing**: a cell edits via a contentEditable flex child that respects the table's horizontal + vertical alignment and inherits the cell font; Enter commits and moves down, Tab / arrow keys navigate cells, **Tab off the last cell appends a fresh row and keeps typing** (the Word / Docs convention), and pasting TSV / spreadsheet data fills + grows the grid (`pasteIntoTable` / `parseClipboardTableText`). **Selected-cell keyboard layer** (a cell selected but not editing, spreadsheet-style): **arrow keys move the cell selection** (not the whole table), **Tab / Shift+Tab** walk cells (Tab off the end appends a row), **Escape** steps back to the plain table selection (one press peels one layer), Backspace / Delete clears the cell, Enter / F2 edits, and a printable key type-to-edits. Every handled key stops propagation and the editor's window-level shortcuts bail on `e.defaultPrevented`, so a keystroke aimed at a cell can never double-act on the element. **Paste lands in the selected cell** without entering the editor: tabular text fills + grows the grid from that cell, a single value replaces the cell (registered capture-phase so the canvas element-clipboard paste never fires). **One-click append**: the table's quick-connect pluses (see "Quick add + connect") carry **Add Row** (bottom plus) and **Add Column** (right plus) in their ring, alongside Arrow, no hover-⋯-menu dance for the most common structural edit. **Sizing**: drag a column's right / a row's bottom divider to pin its width / height (`colWidths` / `rowHeights`; un-pinned tracks share the rest as `1fr`), double-click a divider to auto-fit. A divider **arms only after the pointer rests on it (~400ms)**: instantly-interactive strips on every cell border would swallow clicks and flash resize cursors mid-edit; until armed it shows nothing and starts nothing. **Styling**: a `zebra` toggle tints alternate rows; **right-clicking a cell (long-press on touch) opens the cell CONTEXT MENU at the pointer**: the same accordion-category menu language as the element/tab menus (Text with bold/italic/underline + the Text Size slider, Colours, Alignment, then Link / Clear tiles). It portals out of the transformed canvas so its fixed positioning resolves against the viewport, and opens **beside the selected cells** (at the right edge of their screen rect, or the left when the right would spill off the viewport) so it never covers them, matching the element menus. The **column / row ⋯ menus portal the same way**, so nothing inside the canvas stacking context can paint over them. The selected-cell outline uses the **table's accent** (its stroke, which tracks the theme), not a fixed blue. A plain click only selects the cell (see the selected-cell keyboard layer above). **Shift-click builds a multi-cell selection**: extra cells toggle in and out of the set around the anchor cell, every selected cell shows the selection outline, and the context menu's styling, the Clear action, and the keyboard Backspace/Delete apply to ALL selected cells in one commit (display values read off the anchor; the per-cell Link action shows only for a single cell). Right-clicking a cell already in the set keeps the set; keyboard navigation, plain clicks, and editing collapse it back to the anchor. Per-cell styles live in `cellStyles`, a per-cell override grid aligned with `cells`. The `scale` text size tracks the row height. The Colours category tints grid lines (stroke), cell background (fill) and text; new tables derive their text colour from the canvas background so they stay readable on dark backdrops. The whole table resizes via the normal element handles; individual **columns** can be pinned to an explicit width by dragging the divider on their right edge (`colWidths`), with un-pinned columns sharing the remaining space as `1fr` tracks. Cell padding follows the element's padding preset (the Text category). Per-row pixel sizing is a follow-up.

**Other element kinds**:

- **Text**: a free-floating text element (see [Text element](#text-element)).
- **Arrow**: a straight connector **with a pointer at its end** (see [Adding an arrow](#adding-an-arrow)).
- **Line**: an arrow without heads (`arrowEnds: 'none'`), the same element, so a plain line and an arrow differ only in their ends. Its pointers are added in the Pointer accordion like any arrow's. Telemetry: `Element·Added·Line`.
- **Sticky note**: a sticky-note element (see [Sticky note element](#sticky-note-element)).
- **Annotation**: a note marker (a fixed-size themed circle + note glyph): hover to read its note above everything, click to edit it. See [Annotations](../009-elements/annotations.md).
- **Link Card**: a rectangular bookmark; double-click to set its URL (the normal link picker). liveplanner fetches no preview for it. See [Link cards](../009-elements/link-cards.md).

### Web components

Ready-made **web components** that beautify a diagram: **Banner**, **Callout**, **Stat Row**, **Process Steps**, **Hero** and **Header**. Each is **one element** ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)): the first five are their own shape kinds (`banner`, `callout`, `stat-row`, `process`, `site-header`) that lay themselves out from their size, and the Hero is an image carrying a caption card (`ImageElement.heroCaption`). The catalogue is unified by `ComponentKind` + `createComponent` + a `COMPONENT_SIZE` map in the project package (`component-factories.ts`), so every component flows through one code path, and the layouts live in `web-components.ts`, shared by the canvas faces and the headless SVG renderer.

All follow the **active tab theme**. Two looks, both legible by construction: solid-accent bars with white text (**Banner / Header**, which paint in `fillColor` falling back to the stroke, and retheme only their stroke), and light cards using the theme's `elementFill` (surface) + `elementText` (ink) pair with the accent for emphasis (**Callout / Stat row / Process**). The Hero's caption card is the image's `fillColor`. The diagram factories (`component-factories.ts`) stay theme-agnostic, taking colours.

**Editing.** The main text (banner title, callout body, header brand) is the element's `label`, edited by double-click like any label. Every other line (a banner's subtitle, a callout's heading, each stat's value and caption, each step, each link, a hero's title and line) is edited in place once the element is selected. Rows are added from the quick-connect ring (**Add stat / Add step / Add link**) and added, removed and reordered from the context menu's **Stats / Steps / Links** section under Tools. See [Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md) for the resize behaviour of each.

**Swapping an icon.** In every mode, an icon dropped onto a standalone `icon` element **replaces its glyph**: the target keeps its id, box, position, rotation, style and label and takes the dropped icon's id. Two ways in: (1) **drag an icon tile** from the Icons or Technology tab onto it (the whole icon rings and fills faintly while it is the target, with no side band); (2) **drag an icon element** already on the canvas onto it: on release the dragged icon is used up (removed) and the target takes its glyph, in one undo with the move. Any icon swaps with any other, a Technology mark included. Telemetry: `Element · Changed · IconSwapped` (a palette drop; a canvas drag reports nothing new, as the inline fold does not).

**No images.** liveplanner takes no image uploads, so nothing makes an Image, Avatar or Hero. The Header's logo is its inline icon (drop an icon on it) or the brand's initial, so it needs no image.

### Screens inside an element

A screen an element shows in place of its body (a Sheet loading) zooms with the canvas,
so zoomed out it shrinks with its element and never blocks the view. Zoomed in it grows only to **its own size** (100%,
`SCREEN_SCALE_MAX`, `ScaleCapped`), then holds there, centred in the element, so it never reads as
comically large. The scale is measured as drawn, so a maximised element (drawn at screen size) is unaffected.
Setup Board and Setup Sheet are not such screens: they are dialogs over the editor, and a board or Sheet not set up
yet shows only a small placeholder ([plan-board.md](../026-plan/plan-board.md) "Setup Board").

### Placement on add

**Nothing is added from a palette** (Plan shows none, [Plan mode](../026-plan/plan-mode.md#no-palette)): there is no
tap-to-drop or drag-to-size gesture, no armed tool, no Polygon tool, and nothing dragged in from a tile. What Plan
places, it places from its own surfaces: Start Planning's boards and Sheets land centred in the view
(`useElementCreation`), a dashboard's slots fill from Add to Slot, and a double-click on empty canvas drops a Text
box ([Quick text drop](#quick-text-drop)). A file dropped on the canvas is still handed to the editor at its drop
point (`usePaletteDrop`).

If a boxed element is currently selected, a size-inheriting add takes its width and height (`inheritedSizeFor`,
`apps/editor/lib/canvas.ts`), with the exceptions listed there.

## Animated elements

Some elements can carry an **animation** to convey flow, signal status, or draw the room's eye during a presentation: an arrow's flow, an icon's glyph motion, and the progress, rating, chart, Sankey, concept-graphic and sequence-diagram animations each owned by their element's spec. The element context menu's **Animation** row shows one category per set present (`AnimationSections`), each a closed accordion section named by its set, applying to the members of its set in the **single-element AND the multi-select** menus. Every animation is **pure CSS** (keyframes in `canvas-motion.css`): **deterministic** (nothing broadcast — collaborators see the same loop), **reduced-motion-safe** (the sheet's `@media (prefers-reduced-motion: reduce)` blocks disable its animations, showing the rest frame), and they **freeze to a static frame on PNG / SVG export**. Animation fields are cosmetic, so the **format painter copies them**.

Each option is a **live miniature tile** running the option's real class (a short curved arrow for a flow, `ArrowFlowPreview`), frozen on a telling frame until hovered (`AnimationPreviewTile`, `useFrozenAnimations`). Once an animation is picked, a **Speed** row appears (Slowest / Slow / Normal / Fast; Slow is the default) plus a **Repeat** toggle row (the shared iOS-style switch, on by default): repeat off plays the animation a single cycle and holds (`flowRepeat` / `iconAnimationRepeat`, stored only when false; the renderers feed an iteration-count CSS var — `--lvd-flow-iter` / `--lvd-icon-anim-iter` — that every keyframe class reads in place of a literal `infinite`, the same mechanism the progress / rating / pie anims already used). A play-once arrow flow skips the phase-sync startTime pinning (pinned to timeline origin 0, a single iteration would land already-finished).

**Hover-to-preview (desktop).** Hovering an Animation / Flow / Icon-animation tile with a **desktop mouse** (`pointerenter` whose `pointerType === 'mouse'`) **plays that motion live on the currently selected element(s)** without committing it, so the canvas shows exactly what picking it would look like. **Clicking commits** the value; **moving the mouse off a tile reverts** to the saved value, and the preview also reverts if the menu closes / the section collapses while the pointer is still over a tile (`useRevertOnUnmount`). This reuses the **same `useStylePreview` machinery as the style presets** ([Style presets](../010-palette/style-presets.md)): the preview + revert go through `tickTabs` (present-only — no undo snapshot, nothing broadcast), and the click commit restores the original first so undo snapshots the true pre-hover value. So a preview a collaborator never commits is invisible to everyone else, and a hovered-then-committed animation undoes cleanly. Touch / pen taps skip the preview (the tap IS the commit), avoiding a preview-then-revert flicker. The shared `onMouseHover` + `useRevertOnUnmount` helpers live in `../packages/workbench/src/components/primitives/hover-preview.ts`.

- **Flowing arrows** (`flow?: ArrowFlow` — `'dashes' | 'dots' | 'beads' | 'pulse' | 'grow' | 'glow' | 'heartbeat' | 'breathe' | 'shimmer' | 'signal' | 'draw' | 'comet' | 'rainbow' | 'strobe' | 'wind'`). **Dashes** marches a fixed dash pattern along the path (animated `stroke-dashoffset`, overriding the static stroke style); **Dots** sends a dot travelling the path (CSS `offset-path` following the arrow's `d`); **Beads** marches a row of round dots (a dotted dasharray marched the same way); **Pulse** breathes the line's opacity; **Grow** breathes its thickness (relative to the user's stroke width via `--lvd-flow-w`); **Glow** pulses a soft halo (a `drop-shadow` tinted by `--lvd-flow-color`); **Draw** repeatedly draws the line on from start to end (a `pathLength="1"`-normalised `stroke-dashoffset` reveal); **Comet** sends a glowing dot with a fading trailing tail along the path (a small fleet of staggered `offset-path` dots, like Dots with a tail); **Rainbow** cycles the stroke colour through the spectrum (a `stroke` keyframe, so it reads on any base colour); **Strobe** blinks the whole line hard on/off (stepped `stroke-opacity`, vs Pulse's smooth breathe); **Wind** marches fast, sparse long dashes like motion / speed lines; **Heartbeat** double-pumps the thickness in a lub-dub rhythm (via `--lvd-flow-w`, vs Grow's smooth breathe); **Breathe** is a slow gentle width + opacity swell; **Shimmer** an occasional quick glint of brightness + a tinted halo (`--lvd-flow-color`); **Signal** sends one discrete packet (a single long dash, pattern `14 66` on an 80-unit period) travelling the path. All show / emphasise flow direction in data / process diagrams.
- **Speed** (`flowSpeed?` / `iconAnimationSpeed?: AnimationSpeed` — `'slowest' | 'slow' | 'normal' | 'fast'`, default **slow**: animations should whisper, not shout, so a fresh animation starts gentle and the user opts _up_ into normal / fast; the shared fallback lives in `DEFAULT_ANIMATION_SPEED` so renderers can't drift). A **duration multiplier** (`ANIMATION_SPEED_FACTOR`: slowest 4×, slow 2×, normal 1×, fast 0.5×) fed to CSS via `--lvd-flow-speed` / `--lvd-icon-anim-speed`, which each keyframe class multiplies into its own tuned base duration with `calc()` — so every animation keeps its character and speed just scales it.
- **Animated icons**: **any** `icon` shape can loop a glyph animation chosen from the icon context menu, stored on the element as `iconAnimation` (`IconAnimation` in `packages/project`: `'spin' | 'beat' | 'pulse' | 'glow' | 'ping' | 'breathe' | 'shimmer' | 'bounce' | 'wiggle' | 'flash' | 'tada' | 'flip' | 'jump' | 'swing' | 'float'`, None = unset). Its **Icon** category shows `IconAnimationTiles` (this glyph-motion set), since a spinning gear / beating heart wants glyph-level motion. **Spin** rotates, **Beat** is the heart double-pump (scale), **Pulse** breathes opacity, **Bounce** bobs, **Wiggle** tilts, **Flash** blinks, **Tada** is a celebratory scale + rotate, **Flip** is a coin flip (`rotateY`), **Jump** a squash-and-stretch hop, **Swing** a pendulum from the top, **Float** a slow circular drift; the emphasis set: **Glow** breathes a soft halo hugging the glyph's silhouette (`drop-shadow` in `currentColor`), **Ping** emits an expanding fading ring, **Breathe** is a slow gentle swell (calmer than Beat), **Shimmer** an occasional quick brightness glint. `iconAnimationClass` (`apps/editor/lib/icons.ts`) maps the value to a `lvd-icon-*` class which `IconGlyph` / `IconPrims` (and `TechIconGlyph` for brand marks) wrap the glyph in. Catalogue glyphs are **static by default**, with one exception: the four in the picker's **Animated** category arrive carrying the motion they were drawn for (`DEFAULT_ICON_ANIMATION` in `packages/project/src/animation.ts`: spinner and gear spin, heartbeat beats, signal pings). The default is a starting value on the element like any other, so the menu changes or clears it. A test holds that every icon in the Animated category has one and no other icon does. The glyph prims double as the still frame, so they read fine frozen on export / reduced-motion. Once a motion is picked, `IconAnimationTiles` shows the same **Speed** row (Slowest / Slow / Normal / Fast) the arrow Flow controls use; the choice stores as `iconAnimationSpeed` and feeds the `lvd-icon-*` keyframes a `--lvd-icon-anim-speed` duration multiplier (the shared `ANIMATION_SPEED_FACTOR`).

## Arrows

Arrows are a second element kind. They link two points on the canvas.

### Endpoints

Each arrow has a **from** and a **to** endpoint. An endpoint is either:

- **Free** — an `(x, y)` position on the canvas.
- **Pinned** — attached to an **anchor** of a shape. A pinned endpoint follows its shape as the shape moves/resizes.

A pinned endpoint sits on one of the anchors its shape offers (sixteen on a box: corners, edge midpoints and the quarter points between them; fewer on some shapes). The anchor vocabulary, anchor geometry, the converging-fan rendering and the auto-rebind that changes anchors as elements move are specified in [Arrow anchors and auto-rebind](arrow-anchors.md).

### Adding an arrow

There is one way to create an arrow, **the Arrow option of a quick-connect ring** (there is no Arrow tile and no
click-to-connect gesture):

1. **The Arrow option of a quick-connect ring** on a selected element (the direct, contextual way, see [Quick add + connect](#quick-add--connect)):
   - The four edge midpoints (N, E, S, W) of a selected element carry **edge resize handles**, not arrow anchors (see [Resize](#resize)); arrows start from the quick-connect pluses around the element instead.
   - **Press-and-drag** from the ring's Arrow option to start creating an arrow: the `from` endpoint is immediately pinned to that anchor, and the `to` endpoint follows the cursor. An arrow drawn this way takes the **tab theme's** element stroke (so it matches the theme, not black, and not the source shape, so connectors read as one system).
   - Release on **another element's anchor** (within snap distance, ~24 px) → that endpoint becomes pinned. Release **over another shape's body**, away from its anchors → pinned too, to the anchor facing the arrow's other end ("Dropped on a shape" below). Release on **empty canvas** → that endpoint stays free.
   - Releasing without any drag movement creates a tiny "stub" arrow at that anchor.

Snapping during the drag considers every anchor each shape offers (sixteen on a box), so an arrow drag from a midpoint can still snap to and pin at a corner or a quarter point ([Arrow anchors and auto-rebind](arrow-anchors.md)).

**Snap-target markers (dragging an endpoint).** While an arrow endpoint is being dragged, the connection points of every nearby shape (the cursor is over its bounding box, expanded ~44 px) are revealed as small brand-coloured dots, so the user can see exactly where the endpoint can land. The anchor the endpoint is currently snapped to is drawn larger and filled. The markers sit on the shape's **actual drawn outline** ([Arrow anchors and auto-rebind](arrow-anchors.md) "Anchor geometry"), so on an outlined shape (circle, diamond, star, actor, ...) they hug the slanted or curved edge rather than the empty bounding-box corner. Cleared on release. Produced by `useEditorDrag` (coalesced through the same rAF as the alignment guides) and rendered by `CanvasChrome`.

### Manipulating arrows

- **Click an arrow** to select it. Selection treatment: thicker brand-tinted stroke, and visible endpoint handles (small circles at each end).
- **Drag an endpoint handle** to move that endpoint. While dragging:
  - If the cursor is within **~24 px** of any shape's anchor, the endpoint **snaps** to that anchor (becomes pinned). The anchor pin wins over the snaps below.
  - **Dropped on a shape.** Otherwise, unless it is on another arrow's line ([Arrow-to-arrow](arrow-to-arrow.md)), a cursor inside a shape's outline pins the endpoint to that shape's anchor facing the arrow's other end (`bestAnchorTowards`, the side click-to-connect picks; `bodyDropAnchor`). It pins live, the chosen anchor drawn as the active snap marker, so what the drag shows is what the release keeps. The topmost shape under the cursor is taken, passing over what an end is drawn across rather than onto: a container (frame, lane, boundary, stack), a badge or step chip, a picture or drawing (image, freehand, path: an arrow released inside one points at something in it), the shape the other end is already on (so a new arrow does not loop back while it leaves its source), and anything on another page. Holding **Cmd / Ctrl** leaves the end free over the shape ([Snap override](snap-override.md)). Before, the end stayed free inside the shape, its head hidden under it, and nothing connected.
  - Otherwise the endpoint stays free, with two layers of snapping to make straight / aligned arrows easy (same machinery the move/draw flows use, gated by the same "alignment guides" preference):
    - **45° angle lock** — within ~5° of a 45° increment from the _other_ endpoint, the line locks to that angle (horizontal / vertical / diagonal).
    - **Alignment guides** — when not angle-locked, the free endpoint nudges to line up with nearby boxed elements' edges / centres (via `snapToAlignment`) **and** with the arrow's other endpoint (so a near-straight arrow latches truly horizontal / vertical), drawing the same faint guide lines a boxed-element move shows. The same applies while drawing a new arrow (the draw is just an endpoint drag). Guides clear on release.
- **Drag the middle control handle** to bend the arrow:
  - **Curved arrows** show a small white square (the `CurveHandle`) on the Bezier control point. Drag it to change the bow direction and magnitude; the stored `curveOffset` is a delta from the chord midpoint so the curve survives endpoint moves (the midpoint shifts with the endpoints, the user's chosen offset stays).
  - **Angled arrows** show the same handle on the elbow vertex. Drag it to move the right-angle bend somewhere other than the default auto-corner. The stored `elbowOffset` is a delta from the auto-elbow (`(to.x, from.y)` or `(from.x, to.y)` depending on the direction heuristic) so the bend survives endpoint moves the same way the curve does.
  - Straight arrows have no middle handle; drag the line itself to bow one ([Bending arrows and the double-press rule](arrow-bending.md)).
- **Drag the line** to bend the arrow where you grabbed it, and use the move frame to move a free arrow: see [Bending arrows and the double-press rule](arrow-bending.md).
- **Add / remove bend points.** Curved and angled arrows can carry multiple bend points (`curvePoints`, deltas from the chord midpoint like `curveOffset`). Dragging the line inserts a point where it was grabbed, a single-bow curve's bow becoming the first point ([Bending arrows and the double-press rule](arrow-bending.md)); there is no "+" handle. Each point shows its own draggable `CurveHandle`; **right-clicking a point deletes it**. Deleting the **last** bend point leaves nothing to curve through, so the arrow reverts to a **plain straight line** (the `curvePoints`, `curveOffset`, `elbowOffset` and the curved/angled `arrowStyle` are all dropped) rather than snapping back to a single-handle bow the user didn't ask for.
- **Touch targets.** The endpoint handles and the bend-point / elbow `CurveHandle`s are small fixed-size SVG marks — fine for a mouse, fiddly for a fingertip. On coarse-pointer (touch) devices each one carries an invisible larger hit circle (~44px diameter, the iOS HIG target) so it's reliably tappable, without enlarging the visible grip on desktop. The box resize handles do the same via a `pointer-coarse` hit pad (corner + N/S/E/W edge handles, `element-parts.tsx`).
- **Click the empty canvas** deselects.
- The selection popover applies to arrows the same way it does to shapes (lock + delete). It floats clear of the arrow's label as well as its line ([Arrow labels](arrow-labels.md) "Selection").

### Cascading delete

When a boxed element is deleted, **any arrow whose endpoint is pinned to it is also deleted** in the same operation (counts as one undo step). Stale arrows pointing to a removed element would have nothing to anchor to; cascading delete keeps the canvas clean and the data model consistent.

Arrows with one pinned endpoint and one free endpoint are deleted in the same way — if the pinned side's element goes, the whole arrow goes. Arrows with both endpoints free are unaffected by other deletions.

### Locking arrows

A locked arrow's endpoint handles are not draggable. Same semantics as a locked shape — it can't be moved or deleted (including via another element's [cascade](#cascading-delete)); unlock it first.

### Data model

Lives in `packages/project`:

```ts
// The sixteen anchors: see arrow-anchors.md.
type Anchor =
  | 'n'
  | 'nne'
  | 'ne'
  | 'ene'
  | 'e'
  | 'ese'
  | 'se'
  | 'sse'
  | 's'
  | 'ssw'
  | 'sw'
  | 'wsw'
  | 'w'
  | 'wnw'
  | 'nw'
  | 'nnw';

type Endpoint =
  { kind: 'free'; x: number; y: number } | { kind: 'pinned'; elementId: ElementId; anchor: Anchor };

type ArrowElement = {
  id: ElementId;
  type: 'arrow';
  from: Endpoint;
  to: Endpoint;
  locked?: boolean;
  // Visual overrides. `strokeWidth` controls the line thickness, snapped
  // to one of the four ArrowThickness presets (1 / 2 / 4 / 7 px) for
  // the UI but stored as a raw number so legacy values survive.
  // `arrowheadSize` is independent so users can pair a thin line with
  // a chunky head (or vice versa).
  strokeWidth?: number;
  arrowheadSize?: 'small' | 'medium' | 'large' | 'extra-large';
  // Head SHAPE preset, independent of size + ends. Defaults to the
  // filled triangle; hollow / open / dot / diamond variants exist for
  // UML + architecture notation (inheritance, dependency, aggregation,
  // composition).
  arrowheadShape?:
    | 'triangle'
    | 'triangle-hollow'
    | 'line'
    | 'circle'
    | 'circle-hollow'
    | 'diamond'
    | 'diamond-hollow'
    | 'one'
    | 'zero-or-one'
    | 'many'
    | 'zero-or-many'
    | 'one-or-many';
  // The start's head when it differs from the end's (an ER relationship's two cardinalities). Absent = the same.
  arrowheadStartShape?: ArrowheadShape;
  // Path geometry. 'straight' is a single line; 'curved' renders a
  // quadratic bezier whose DEFAULT control point depends on the ends:
  // a PINNED end gets the elbow-corner control — the endpoints'
  // bounding-box corner that strikes the pinned face straight-on (the
  // head's face wins), so a fan from a hub's bottom hugs the hub's
  // edge, drops vertically into each child's top, keeps an aligned
  // pair straight, and can never balloon past its endpoints; free
  // ends keep the ¼-chord perpendicular bow on a screen-consistent
  // side (up; right for vertical chords) so mirrored chords match.
  // 'angled' draws an axis-aligned L-connector with a single
  // right-angle bend. Pinned-endpoint anchors decide which leg of
  // the elbow runs first so the line leaves the element along its
  // anchor direction.
  arrowStyle?: 'straight' | 'curved' | 'angled';
  // Optional user-dragged overrides for the middle control point.
  // `curveOffset` is consulted only when arrowStyle === 'curved',
  // `elbowOffset` only when arrowStyle === 'angled'. Both are
  // stored as deltas from the auto-position (chord midpoint for
  // the curve control point, auto-elbow corner for the angled
  // bend) so the user's chosen shape survives endpoint moves: the
  // auto-position shifts with the endpoints, the delta stays the
  // same. Setting either back to undefined "resets" the arrow to
  // its default shape. See `arrowPathD` + `angledElbow` in
  // packages/project for the geometry.
  curveOffset?: { dx: number; dy: number };
  elbowOffset?: { dx: number; dy: number };
  // Optional label rendered next to the arrow's geometric midpoint.
  // Double-click on the arrow body opens an inline editor for this
  // field. The renderer picks one of four cardinal slots (right →
  // below → left → above of midpoint) so the label dodges nearby
  // boxed elements; falls back to "right" if every slot collides.
  label?: string;
};

type Element = ShapeElement | ArrowElement;
```

### Out of scope (next iterations)

- Multi-point / waypoint paths (just two endpoints for now).
- Multi-point / waypoint paths on angled arrows (one bend only for now).
- Anchors at element centres or at free positions along an edge.

## Shape primitives

Twenty-one general-purpose and device shape kinds are covered here, all rendered as absolutely positioned elements on the canvas. `ShapeKind` itself is larger (71 members today) because every later family of element reused the shape type rather than inventing its own: the structural elements (`page`, `mind-node`, `lane`, `entity`), the web components (`banner`, `callout` (read-only, migrated to `card`), `stat-row`, `process`, `site-header`, [The Action Panel](../009-elements/web-components-and-no-groups.md)), the Behaviour and Collaborate controls (`portal`, `session-button`, `picker`, `temperature`, `decision`, `comment-pin`, `action-card`), the self-drawing data shapes (`progress-bar`, `progress-ring`, `timeline-rail`, `rating`, the three charts, `code-block`, `checklist`, `legend`), the [Sankey diagram](../009-elements/sankey.md) (`sankey`), the [Card](../009-elements/card.md) (`card`), the [Badge](../009-elements/badge.md) and [Step number](../009-elements/step-number.md) (`badge`, `step`), the [Pointer note](../009-elements/pointer-note.md) (`pointer-note`), the [Diagram key](../009-elements/diagram-key.md) (`diagram-key`), the [Stack](../009-elements/stack.md) (`stack`), the [Sequence diagram](../009-elements/sequence-diagram.md) (`sequence`), the [Boundary](../009-elements/boundary.md) (`boundary`), the [Tab window](../009-elements/tab-window.md) (`tab-window`), the [concept graphics](../009-elements/concept-graphics.md) (`layer-stack`, `pyramid`, `cycle`, `hub`, `onion`, `chevrons`), `icon` / `sticker`, the [Plan board and Plan card](../026-plan/plan-board.md) (`plan-board`, `plan-card`), the [plan view](../026-plan/plan-views.md) (`plan-view`), and the [Sheet](../029-sheets/sheet.md) (`plan-sheet`). Each of those has its own spec; this section is the general-purpose set. The table below covers the seven general-purpose primitives the spec originally shipped with; the rest (general shapes (`stadium`, `actor`, the UML final state `final-state` (a ring round a solid dot, one element, made by graph input and Mermaid for a state machine's end, no palette tile), `cloud`, `triangle`, `trapezoid`, `star`, `speech-bubble`), the `frame` container, and seven UI device frames (`browser`, `monitor`, `laptop`, `phone`, `tablet`, `foldable`, `smartwatch`)) landed alongside / after the wireframe templates and are documented under **Devices tab** in the Palette section above. The canonical list is `ShapeKind` in `@liveplanner/project` (declared in `src/shape-kind.ts`); the test in `apps/editor/lib/templates.test.ts` pins shape coverage indirectly via the template catalogue.

| Kind            | Rendering                                                                                                                                                                                                                          | Aspect lock |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `square`        | Rectangle with slight rounded corners (CSS border + background on the wrapper).                                                                                                                                                    | Free        |
| `circle`        | Square frame with `border-radius: 50%`.                                                                                                                                                                                            | Forced 1:1  |
| `diamond`       | Wrapper carries no visible style; inner `<svg viewBox="0 0 100 100" preserveAspectRatio="none">` draws a four-point polygon, inset by half the stroke so its tips stay inside the box like a square's CSS border (`strokeInside`). | Forced 1:1  |
| `cylinder`      | SVG overlay drawing a rectangle body with a curved bottom (`A 50,12` arc) and a top ellipse (`rx=50 ry=12`). Database / storage.                                                                                                   | Free        |
| `parallelogram` | SVG overlay drawing `polygon points="20,0 100,0 80,100 0,100"`. Input / output in flowcharts.                                                                                                                                      | Free        |
| `hexagon`       | SVG overlay drawing `polygon points="25,0 75,0 100,50 75,100 25,100 0,50"` (flat-top). Preparation / labelled milestone.                                                                                                           | Free        |
| `document`      | SVG overlay drawing a rectangle with a wavy bottom edge (two cubic curves). Output document in flowcharts.                                                                                                                         | Free        |

A cylinder's label sits on the front of its body, from under the lid (27% down the box) to over the base (97%), so more lines grow down the body, never up over the lid: on the canvas, while editing and in every export (`labelBodyInset`).

Styling: a `brand-500` outline over a faint `brand-50` fill, with a subtle drop shadow. Same colours for every kind — only the geometry differs. Fill / stroke colours can be overridden per element via the element's right-click context menu (Colours category).

Square and circle render purely via CSS (`border-radius` + `background-color` on the wrapper `div`). Every other kind renders its geometry through an **inner SVG overlay** with `viewBox="0 0 100 100"` and `preserveAspectRatio="none"`, so it stretches with the element's box. A silhouette whose outline touches the box edge (diamond, parallelogram, hexagon, project, cylinder, cloud) is marked `strokeInside` in the shared geometry table: its svg is inset by half the stroke, so the outline stays inside the box like a square's CSS border. The wrapper carries no border or background for those — only the selection ring. Resize handles attach to the wrapper's bounding box, not to the geometry. Arrow anchors on an outlined kind are projected onto its drawn outline ([Arrow anchors and auto-rebind](arrow-anchors.md)).

## Data model

Shapes are **elements** on a tab, per [Project structure](../006-project/project-structure.md). The element type lives in `packages/project` and is consumed by the canvas and (later) the store and API code:

```ts
type ShapeKind =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'document'
  | 'stadium'
  | 'actor'
  | 'cloud'
  // UI device frames (wireframing). See docs/specs/008-canvas/canvas-and-palette.md "Devices" accordion.
  | 'browser'
  | 'monitor'
  | 'laptop'
  | 'phone'
  | 'tablet'
  // Curated single-colour glyph; the chosen glyph is carried by
  // `iconId`. See docs/specs/008-canvas/canvas-and-palette.md "Icons" accordion.
  | 'icon';

type Element = {
  id: ElementId;
  type: 'shape'; // discriminator: future 'edge', 'group', etc.
  shape: ShapeKind;
  // Catalogue key when shape === 'icon' (e.g. 'server'); ignored
  // otherwise. A plain string, not a closed enum, so the icon set
  // grows without a model migration (apps/editor/lib/icons.ts).
  iconId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
```

## Behavior (first version)

- The palette is always rendered on top of the canvas, regardless of which tab is active.
- Each tab owns its own array of elements. Adding a shape adds it to the **active tab** only.
- Switching tabs swaps the canvas content; each tab's shapes persist while the page is loaded.
- Reloads restore the project from the api worker (D1), keyed by the project id in the URL. The active tab id is encoded in the URL fragment (`#t=<tabId>`) so refreshing keeps you on the same tab.
- When the active tab has zero elements (and the template picker isn't open), an **empty-state card** is centred on the canvas. It contains, top to bottom: a brand-coloured icon (square + circle, evoking diagram primitives), the tab name in bold, an `EMPTY CANVAS` subtitle, a one-paragraph hint explaining the three ways to start ("Open the palette on the left to add shapes, double-click anywhere to drop text, or connect elements by dragging from their anchor dots"), and a **Browse templates** button that opens the template picker. The card sits on top of any background pattern so it stays legible on coloured / patterned canvases.
- The empty-state card disappears once the active tab has at least one element.

## The canvas never scrolls

The canvas box (`<main>` in `Canvas.tsx`) is `overflow: clip`, not `overflow: hidden`. It clips
the same, but cannot scroll: a hidden box still scrolled when the browser revealed something
focused past its edge (a label editor on a box at the bottom of the view) or a `scrollIntoView`
reached it, and everything positioned in it (the bottom-right cluster, the Map, the corner
panels) rode up the screen by that much and stayed there, edit after edit. Panning and zooming
move the canvas's own transform, never a scroll. Pinned by `e2e/chrome-drift.spec.ts`.

## Templates

A template is picked where the work begins: on an empty tab's **Start Planning** ([Start panel](../007-editor/start-panel.md), [Start Planning](../026-plan/plan-mode.md)), on `/new?template=<kind>` ([New project route](../007-editor/new-project-route.md)), and by an agent (`list_templates`, `GET /api/templates`). What each Plan template holds is [Plan templates](../026-plan/plan-templates.md); this section covers the catalogue they share.

### The catalogue

`TEMPLATES` (`packages/templates/src/templates.ts`, pinned by `templates.test.ts`) lists every `TemplateKind`: **Blank Tab** (`blank`), the 24 Plan templates (`PLAN_TEMPLATE_KINDS` in `plan-template-catalogue.ts`: Blank Plan, Blank Spreadsheet, the boards and the sheets) and the form templates (`FORM_TEMPLATES` in `form-templates.ts`: Blank Form and one per form starter). A form template makes an empty tab and the editor starts its form on it ([Forms](../030-forms/forms.md) "Starting a form"), so it is `editorOnly` and left out of the agents' catalogue, whose creates are built on the api.

- `TemplateDescriptor.extra?: boolean` is catalogue metadata only (it marks templates beyond the first starters); no surface gates on it.
- `TemplateDescriptor.hidden?: boolean` keeps a template out of every listing while `buildTemplate` still builds it. No template sets it; `templates.test.ts` asserts the set is empty.

**Per-template canvas backdrop.** `templateCanvasOverrides(kind)` (`packages/templates/src/template-canvas-overrides.ts`) puts every template but Blank Tab on the quiet `grid` pattern, explicit so it survives a theme whose own pattern is blank: the board is the structure. A template picked on a start is painted in the **tab's theme** and otherwise leaves the tab's backdrop as it is ([Start panel](../007-editor/start-panel.md) "The panel"), so the canvas styling a fresh tab inherited from its source tab (see [Tabs → Selecting & adding](#selecting--adding)) survives it.

All template elements are inserted via the history hook (commit), so they're undoable in one step.

#### Template categories

The catalogue is browsed by **what a person is trying to get done**, not by what kind of artefact a template is: five categories, declared once in `packages/templates/src/template-categories.ts` and read by Start Planning, `/new`, the marketing gallery and the agents' catalogue. Descriptions are kept to a similar length (40 to 50 characters), so the folded tiles read as an even set.

**Order.** The categories run **alphabetically by label** everywhere they are listed: `TEMPLATE_CATEGORIES` is derived by sorting the declared categories by label (`localeCompare`, English, case ignored), never hand-ordered, so a new category lands in its place. Popular is not a category and stays the shelf above them.

| Category     | Id             | Description                                      | Templates (primary)                                                                                                               | Also shown                                                                                        |
| ------------ | -------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Finance      | `finance`      | Budgets, invoices, loans and sales forecasts.    | Budget Planner, Timesheet, Invoice, Expense Report, Loan Calculator, Sales Pipeline                                               |                                                                                                   |
| Forms        | `forms`        | Forms to share by link, answers kept for you.    | the form templates but Blank Form                                                                                                 |                                                                                                   |
| Meetings     | `meetings`     | Retros and feedback boards a team runs together. | Team Retro, Feedback Board                                                                                                        |                                                                                                   |
| Planning     | `planning`     | Boards and trackers for plans and teams.         | Project Planner, Kanban Board, Task Tracker, Bug Tracker, Weekly Planner, Content Calendar, Product Launch, Hiring Pipeline, OKRs | Team Retro, Feedback Board                                                                        |
| Spreadsheets | `spreadsheets` | Ready-made sheets with formulas and charts.      | Contact List, Inventory, Guest List, Grade Book, Habit Tracker                                                                    | Task Tracker, Budget Planner, Timesheet, Invoice, Expense Report, Loan Calculator, Sales Pipeline |

- **One primary category each.** Every template but the blanks has exactly one primary category (`templateCategory(kind)`, `TEMPLATE_CATEGORY`, a record over every non-blank kind, so a new template cannot ship without one). The primary is the one the agents' catalogue names and the one a search result groups under.
- **Cross-listing.** A template may also be shown in other categories where someone would genuinely look for it (`TEMPLATE_ALSO_IN`, the "Also shown" column). `templateCategories(kind)` is the primary followed by these. A cross-listed template appears on each of its categories' shelves and counts in each tile's badge; never twice on one shelf.
- **The blanks are in no category.** Blank Tab, Blank Plan, Blank Spreadsheet and Blank Form have no primary (`templateCategory` answers `null`) and are reached from Popular or by search. The agents' catalogue lists them under a `blanks` entry so an agent still finds them.
- **Ids.** No category id is stored in a project, a URL or a telemetry event; the ids are read by the pickers, links and the agents' catalogue.

**Popular** is the open shelf on load, "Where most people start.", above the categories and not one of them. Its cards are a short curated list (`POPULAR_TEMPLATE_KINDS` in `packages/templates/src/popular.ts`): Blank Plan, Project Planner, Kanban Board, Budget Planner, Team Retro, Bug Tracker, Invoice ([Templates](../007-editor/templates-by-mode.md)).

**Search** (a start's search box; also the marketing gallery's) matches a template when **every word typed** is found, case ignored, in its title, description, kind id, the labels of every category it is shown in, or its **search words**, punctuation and hyphens no part of a word on either side ("to-do" finds "to do" and "todo") (`templateKeywords(kind)` in `packages/templates/src/template-keywords.ts`: what people call it and the job it does, "sprint" for the Project Planner, "excel" and "cells" for Blank Spreadsheet, plus a sheet template's own words). A sheet template's words are its sheet's own (`SheetTemplateInfo.keywords` in `@liveplanner/sheets`, which Start Planning's Spreadsheets search too), so the two pickers find a sheet by the same words. One function, `templateMatchesQuery`, decides a match for the editor and the marketing gallery alike.

### Theme section

A new project starts on the **Default** theme (the `brand` id, whose light and dark halves the viewer's appearance chooses between, [Editor app](../007-editor/editor-app.md)), and a new tab on its source tab's theme; no template step picks one. Themes are changed afterwards from the Tab Style dialog ([Canvas and theme dialog](../011-theme/canvas-and-theme-dialog.md)).

## Modifier hint banner

Shift is the editor's "power modifier" — it chains quick-connect arrows, forks a branch off an arrowhead, locks proportions while resizing or drawing-to-size, and grows multi-selections (elements and table cells). Those behaviours are invisible until tried, so while **Shift is held** a floating **hint pill** appears at the top of the canvas (the same `TopCenterBanner` chrome as the format-painter banner, but passive — no Cancel button) naming what Shift is doing right now. One concise message, picked by context, most specific first:

1. Drawing a **new arrow's endpoint** (quick-connect drag or follow mode) → "Click places it and starts another arrow".
2. **Resizing** an element → "Proportions locked".
3. No drag, an **arrow selected** → "Drag an arrowhead to split it into a branch".
4. No drag, a **table selected** → "Click cells to select several".
5. Otherwise (editable session with elements) → "Click elements to select several".

The pill leads with a `⇧ Shift` key chip so the message reads as "while this key is down". It never shows while typing (a Shift press inside an input / contentEditable is just capitalisation), while another mode banner owns the top slot (format painter / draw), in read-only sessions, or on an empty canvas with nothing to act on. It renders from a shared `useShiftHeld` key-state subscription so holding Shift re-renders only the pill. That and `useModKeyHeld` are now the same store — `../packages/workbench/src/hooks/ui/held-key-store.ts` owns the one window listener, the subscriber set and the SSR-safe snapshot; each hook supplies only its key policy.

The component is `ModifierHintBanner`: its job is to name what a modifier does right now.

## Keyboard shortcuts

The editor's global shortcuts are bound centrally in `useEditorKeyboardShortcuts` (wired from `useEditorState`) and catalogued for the user in the Settings dialog's **Keyboard** category ([User preferences](../007-editor/user-preferences.md)), which also carries a per-device on/off switch (localStorage) so a screen-reader user can hand every key back to the system. The bindings track the conventions shared by Excalidraw, tldraw, Figma / FigJam, and Miro so muscle memory carries over; where we diverge it is called out below. `⌘` = Cmd on macOS, Ctrl on Windows / Linux.

**Tools** (plain key, no modifier — non-mutating tools work for view-role visitors too):

| Key       | Tool                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| `V` / `S` | Select (`S` is a legacy alias; with the Toolbar strip's Search, `S` opens it) |
| `H`       | Hand (pan)                                                                    |
| `F`       | Frame                                                                         |
| `Z`       | Zen mode (focus)                                                              |

**Add elements**: no key adds an element; there is no palette to place from ([Plan mode](../026-plan/plan-mode.md#no-palette)).

**Edit** (with `⌘`):

| Combo            | Action                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `⌘Z`             | Undo                                                                                                         |
| `⌘⇧Z` / `Ctrl Y` | Redo                                                                                                         |
| `⌘X`             | Cut                                                                                                          |
| `⌘C`             | Copy                                                                                                         |
| `⌘V`             | Paste (offset copy, from the OS clipboard; a pasted image is ignored)                                        |
| `⌘D`             | Duplicate                                                                                                    |
| `⌘⇧L`            | Lock / Unlock selection (on `⌘⇧L`, not `⌘L`, so it never fights the browser's focus-the-address-bar binding) |
| `⌘A`             | Select all (on the active tab)                                                                               |
| `⌘⇧]`            | Bring to front                                                                                               |
| `⌘⇧[`            | Send to back                                                                                                 |

**View / zoom** (allowed for view-role — none of these mutate):

| Combo       | Action                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- |
| `⌘=` / `⌘+` | Zoom in                                                                                      |
| `⌘-`        | Zoom out                                                                                     |
| `⌘0`        | Reset zoom to 100%                                                                           |
| `⇧1`        | Zoom to fit (detected via `code === 'Digit1'` so it survives the `⇧`-shifts-the-key problem) |
| `⌘.`        | Open the global search panel (`.`, not `T`, because browsers reserve `⌘T` for a new tab)     |

**Navigate & select** (plain keys):

- **Delete** / **Backspace** removes the current selection (the cascading-delete rules in the Marquee section apply).
- **Arrow keys** nudge the selection 1 px (10 px with `⇧`).
- **`Escape`** aborts an **in-flight drag first**: pressing it mid move / resize / rotate / arrow-handle gesture snaps the element back to its pre-drag state and leaves **no undo step** behind (the gesture's checkpoint is restored and discarded; mid-draw of a quick-connect arrow it removes the half-drawn arrow). With no drag active it cancels whichever transient mode is active — or Zen — and, when none of those apply, **clears the current selection**. One press does exactly one of these.
- **Space-tap** on a single selected element edits its label; **Space-drag** pans the canvas (the tap-vs-drag split lives in the hook).
- **Type-to-edit**: a printable key on a single selected, label-bearing element (a character composed with AltGr, such as a German layout's `€`, included: its Ctrl is not a shortcut's, `../packages/workbench/src/lib/composed-key.ts`) opens its label editor seeded with that character, instead of firing the tool / add / number shortcuts (so selecting a shape and typing never accidentally drops new elements). The seed replaces the label at once (everyone in the room sees it), so **Escape takes it back**: the label and its formatting are as they were before the first key, for everyone, with no redo step left behind. Leaving the editor any other way keeps what was typed, as **one step**: the commit takes the seed's place in the undo history, so one Cmd/Ctrl+Z puts back the label from before the first key rather than the lone seed character.
- **`⇧`-Click** toggles an element in the multi-selection.

Mutating shortcuts (delete, cut, duplicate, the element adds, z-order, lock) are suppressed for view-only (`view` share-role) sessions so a visitor can't desync state and the browser's defaults stay intact; the non-mutating tools, zoom, search, and zen stay available to them.

## Search panel

A global search modal (`apps/editor/components/panels/SearchPanel.tsx`; matching logic in `apps/editor/lib/search.ts`, unit-tested in `search.test.ts`). The sections that carry search words (Actions, Add to Canvas, Settings, Help) match when **every word typed** is found, case ignored, across the name and its search words, as a template search does: "export png" finds Export…, named Export with png among its words. Opened from the Search button in the bottom bar's shared control cluster (`ChromeControls`) in the TabBar footer, or with Cmd/Ctrl+K or Cmd/Ctrl+. ([Command palette](../007-editor/command-palette.md)). Case-insensitive substring matching; the empty query lists everything (browse-first, narrow by typing). Esc and outside-click close (the close button shows the Esc key cap, a plain × on a touch screen); arrows + Enter drive keyboard selection. It is a modal dialog named Search that keeps Tab inside it and hands focus back to the Search button on close; its field is a combobox over a listbox of results grouped by section, the highlighted result its active option, so a screen reader follows the arrows, and a polite live region says how many results there are.

Result sections, in order, each capped (8 per section, 12 for elements, 10 for Add to canvas and Actions, 6 for Settings and Help). Opening the panel runs `openSearchWithPrefetch`, which loads every tab first (below):

1. **Projects**: the owner's project names. Picking one opens it.
2. **Teams**: the teams the signed-in user belongs to ([Teams](../013-workspace/teams.md)), matched by name. Picking one
   opens that team on the Explorer page (`explorerPath({ kind: 'team', id })`). Guests have none. Folders, share links
   and team plans are the Explorer's (the index's) and are searched there, so the editor passes the matcher's
   Shared, My Work, team-folder and team-project lists empty (`EditorSearchPanel`, `search-panel-sources.ts`).
3. **Tabs**: the open project's tab names.
   - **Boards**: the open project's boards by title (non-empty query; `apps/editor/lib/search-plan.ts`), each with an "on `<tab>`" suffix; a board titled as its own tab is left to Tabs. Picking one switches to its tab.
   - **Cards**: the open project's cards, neither archived nor in the Trash (non-empty query; `apps/editor/lib/search-plan.ts`), matched as the Cards panel's Find matches them ([Items](../026-plan/items.md) "Finding a card"): by number (`12` or `#12`), title or description. Best first: the card whose number it is, then titles holding the words, then descriptions, the most recently changed first within each; capped at 8. Each row shows `#<number>`, the title and "on `<tab>`", the tab whose board shows the card: the first tab in tab order with a board holding a column for its status that shows its type, else the first with an All Cards board that shows its type, else none. Picking one opens the card in its panel (the item panel, as Find opens it) on that tab, switching to it when it is not the open tab; a card on no board opens where the person is. Telemetry: `Search · Selected · Card` or `Board`. Cost: a keystroke walks each card once over the lowercased text Find caches per card version, keeping the best 8 by insertion (never sorting every match), and works the tab out for those 8 alone; at the project limit of 2,000 cards that is about 1 ms a keystroke (`search-plan.test.ts` holds it inside a frame).
4. **Elements**: the open project's element text. Matches element labels; **tables match by cell text** (tables have no single label), surfacing the matching cell as the row label. Blank-labelled elements are unmatchable. Opening the panel triggers a **load-all-tabs prefetch**: per-tab lazy loading ([Per-tab storage](../006-project/per-tab-storage.md)) means unvisited tabs are empty placeholders locally, so search pulls every remaining tab's content in one parallel best-effort sweep, without it, element search silently misses tabs the user hasn't opened this session.
5. **Actions**: synthetic, do-something results rather than navigation: a contextual **command palette** for power users (non-empty query). The matcher (name + keywords, capped) lives in `lib/search.ts` as a generic `command` result kind; the editor supplies the applicable command list and a dispatcher via `useEditorCommands` (catalogue + applicability logic in `lib/editor-commands.ts`, unit-tested in `editor-commands.test.ts`). The group ranks **below** the navigation + element groups so picking an existing tab or element by name keeps the default Enter; commands are reached by typing their verb (e.g. "delete", "share", "theme", "rename"). Each command reuses the exact same handler (and telemetry) as its menu/toolbar entry point, so behaviour can't drift. Commands never surface on an empty query (no catalogue dump); view-only (`view`-role) sessions keep only the view-safe subset.

   **No canvas verbs.** A Plan tab's content covers the canvas, so the catalogue offers no selection, tool, Fit to
   Screen, canvas option, layout or step-number command: each would do nothing.

   The catalogue (`buildEditorCommands`) is gated on the session:
   - **Always**: **Enter / Exit zen mode**, **Export…**, **Collaborators** (the view-safe subset, all a view-only
     session gets), and, while there is something to undo or redo, **Undo** / **Redo**.
   - **To an editor**: **Create New Tab**, **Rename Tab**, **Rename Plan**, **Delete Plan** (not in a workbench),
     **Open Theme** (the `CanvasThemeDialog`'s Theme tab), **Share Plan** (to the owner or a joined team member,
     never offline or in a workbench), **Import…**, **Open Settings** and **Keyboard Shortcuts** (Settings on its
     Keyboard category). Rename commands drive the inline renames through a request nonce on `useEditorDialogs`.

6. **Add to canvas**: the matcher takes an optional list of tiles to place (`paletteItems`, ranked exact name, then prefix, then substring, then keyword-only, capped at 10). The editor passes none, so the group never shows.
7. **Settings**: rows from the settings catalogue (`lib/settings-search-items.ts`), matched on title and keywords (non-empty query only). Picking one opens the Settings dialog on that row.
8. **Help**: help-centre articles (`lib/help-search.ts`), matched on title and keywords (non-empty query only), listed last so navigation and edit results keep the default Enter.

Out of scope (deliberate): element text in **other** projects (issue #13 — needs a server-side index), a board's column names, a sheet's cells, a form's questions, comments, notes, element links, and participant names.

## Comments

Every boxed element can carry a **comment thread**. Stored as `commentThread?: { comments: Comment[]; resolved: boolean }` on the element. Each `Comment` carries the text, `createdAt` ms timestamp, and a denormalised copy of the author's `name` + `color` taken from the current [participant](#welcome--identity-section). Author is recorded at write-time so renaming yourself later doesn't rewrite historical comments.

### Opening the thread

Two entry points open the same `CommentThreadPopover`:

- **Selection popover → comments button** (speech-bubble icon), for **read-only sessions only** (a Participant or a Viewer), who have no element menu. A Participant's reads **Add Comment** and posts; a Viewer's reads **Show Comments**, opens the thread read-only, and is there only on an element that already has comments ([Share roles](../013-workspace/share-roles.md): a Viewer writes no comment). Editors open the thread from the element menu's quick bar **Add Comment** instead (the toolbar button would duplicate it). Absent where the reader has no comments to open (an embed's viewer).
- **Comment indicator** on the element itself. Shown only when the thread has unresolved comments (resolved threads hide it): a comment glyph with the count beside it, among the element's other indicators (link, note, action), drawn in the style the person picked: along the inside of the element's top by default, in a footer row, or not at all. Where they sit on every shape, the fallback pip for elements too small to hold them, and the zoom rules are in [Element indicators](element-indicators.md).

The popover is portal-rendered (it escapes the canvas transform), anchored to the right edge of the element, and flips to the left edge if it would overflow the viewport. It closes on outside click and on Escape.

### Inside the popover

- Header: "Comments (n)" + a **Resolve / Resolved** toggle + close button.
- Scrolling list of comments (oldest first). Each row shows the author's circular initial badge (in their colour), their name, a relative timestamp ("3m ago"), and the text. Hovering a row reveals a delete button (disabled when the thread is resolved).
- Reply box at the bottom with a textarea + Comment button. **Cmd/Ctrl + Enter** submits.

### Resolve semantics

`resolved: true` is sticky — the comments are kept, the badge is hidden, and the reply box is hidden. The user can **Resolve** anytime there's at least one comment, and **Unresolve** to bring it back. Posting a new comment on a resolved thread auto-unresolves it.

### Persistence and undo

Comment mutations bypass the [undo/redo history](#undo--redo) (so typing a comment then Ctrl+Z doesn't unexpectedly wipe it). They update the present tab list directly via the history hook's `tick` setter. Deleting the last comment removes the `commentThread` field entirely so the element type stays slim.

### On Sheet cells

A Sheet element also carries a thread per cell (`cellComments`, [Cell comments](../029-sheets/sheet.md#cell-comments)): the same comment values, popover, who-may rules, author redaction, deltas (naming the cell) and undo rules, opened from the cell rather than the element.

### On Plan cards

A Plan card's item carries the same `CommentThread` in its `comments` field ([Items](../026-plan/items.md#comments)): the same comment values, the same who-may rules and author redaction, and the same thread list, composer and resolve control, which the popover and the item panel share (`CommentThreadList`, `CommentComposer`, `CommentResolveToggle`). The popover draws them `compact`; the item panel `comfortable` (larger text, a feed with your avatar beside the composer). Either way the composer grows with its text, waits for text before **Comment**, and shows the send shortcut (**⌘ Enter to send**, or **Ctrl Enter to send** off Apple devices) only while focused; the time on a comment carries its full date in a tooltip; an empty thread reads **No comments yet. Start the conversation.**; and a resolved thread shows a green **Resolved** badge with **Reopen** beside it. The thread ops themselves (append, remove, resolve) are one set of pure functions in `@liveplanner/project` that element deltas and item comment writes both apply.

## Motion and animations

The editor uses subtle, purposeful motion to feel fluid and modern. Chrome motion (menus, panels, dialogs, the entrances below) follows [Motion](../004-interface-design/motion.md): it settles within 250ms, and hovers within 150ms. Canvas motion is content and lives in `apps/editor/app/canvas-motion.css`. The keyframes are exposed as Tailwind utility classes via `@theme`:

- **`element-pop-in`**: `scale(0) → scale(1.06) → scale(1)` over 360 ms with a spring-easing curve. It's canvas motion, applied to `BoxedElementView` so shapes, text and stickies **added while the tab is showing** pop into existence (yours, a collaborator's, an undo bringing one back). It carries the element's own rotation through every frame.
- **`pop-in`**: the same keyframe at the chrome `micro` token (150 ms), for small chrome surfaces entering (cluster bars, the zoom menu, toolbar-strip tiles). It's transform-based, so it must only be used on elements that don't carry their own inline `transform` style.
- **`fade-in`**: pure `opacity` 0 → 1 at `micro` (150 ms). It's used wherever the element already has an inline `transform` (the selection popover, plus buttons, mode banner, portal menus, tab-link picker, tooltips and hover cards), so the animation doesn't fight positioning.
- **`fly-up-in`**: combined `translateY(16px) scale(0.96) → 0 / 1` at `long` (250 ms). It's applied to modal-style surfaces (dialogs, template picker, empty-state card).

Animations only fire on mount, so they trigger once per element. **The board a tab opens with appears at once**: the elements that are there when a project opens or a tab is switched to arrive with the board and do not pop in; only an element added after that does.

Opening and tab switches pop nothing in. On the 1,000-element reference board a pop would be a thousand animations starting at once and a thousand timers re-rendering every element view 400 ms later; with the board's fade ([Motion](../004-interface-design/motion.md) "Editor arrival") it would push the open over its 3 s time-to-interactive budget ([Canvas performance](canvas-performance.md)). Without them, the median open on the reference board is 2.2 s (whiteboard) and 1.7 s (diagram), against 2.9 s and 3.0 s with them.

## Selection

- **Click a shape** to select it. Selection is visible as a thicker brand-tinted outline plus four corner handles.
  In dark mode a single selection is a `blue-500/80` ring with a soft glow (`0 0 20px rgba(37,99,235,0.15)`), and
  the corner handles are `#60a5fa` squares with a `#1e3a8a` border and a 1px radius, so they read as handles on dark
  paper rather than holes in it. A selected text element's ring stands off its glyphs; in dark mode that gap shows the
  paper rather than a white frame. Light mode keeps the brand ring and the round white handles.
- **Click the empty canvas background** (anywhere not on a shape, palette, or popover) to deselect.
- **Right-clicking the empty canvas deselects too**, then opens the canvas menu (long-press on touch does the same). A right-click on an element keeps the selection rules of the element menu.
- **Click the selected element again** (a press and release without a drag, when it is the only element selected) to deselect it. A press that drags still moves it. A double-click still edits: its first click deselects, its second selects again, and the double-click opens the editor as before. On a touch screen a tap is a click; a touch held into a long-press opens the context menu instead. A click inside a selected table picks a cell, so it keeps the table selected.
- Single-element selection coexists with **multi-select** (the [Marquee box-select](#marquee-box-select) section below) and **group select** (the Group action in the selection toolbar / context menu). The single-element popover is suppressed for multi-selections, where the `MultiSelectionToolbar` takes over. Its buttons are **More** (not on desktop in power user mode, see [Selection popover](#selection-popover)), **Filter Selection**, Duplicate, Lock / Unlock, **Export**, and Delete. **Filter Selection** (funnel icon, no label) opens a dropdown listing the kinds of element present in the current selection — Arrows, Squares, Circles, Text, … each with a count, plus an **All shapes** entry when the selection spans 2+ distinct shape kinds. Picking one **narrows the selection** to just those members (everything else is dropped), so a mixed marquee can be reduced to a single kind in one click; narrowing to a single element transitions back to single-selection. Shapes split by their kind (so a user can grab just the Squares); every other element type is its own bucket. The button is **hidden when the selection is already a single kind** (nothing to narrow) and in view-role. The narrowing is pure selection state (no element mutation), so it is not undoable. The selection's right-click (or toolbar-ellipsis) context menu holds **only** the type-aware formatting categories (full parity with the single-element menu's formatting bands — see "Category order" above); it does not repeat those toolbar action buttons. **Export** opens the same Export dialog as the tab-level export, but scoped to just the selected elements (a derived tab whose `elements` are the multi-selection); the heading reads "Export Selection" and every format (Markdown / PDF / PNG / SVG / File) renders only those elements. Pinned arrow endpoints that reference an element outside the selection keep their reference but render from the origin in the visual exports.
- Clicking the palette never affects selection.

### Selection popover

When a shape is selected, a small **popover menu** appears next to it with action buttons (icon-only).

- **Position:** above the shape if there is room between the shape and the canvas top edge, and it would not sit on the floating chrome over the canvas (the palette toolbar, a panel: any `data-floating-panel`); otherwise below it, as at the header. Horizontally centred on the shape.
- **Layout:** small rounded panel with the same styling language as the palette (border, shadow).
- **Overflow:** the buttons sit in a strip at most **95vw** wide. When they outgrow it (a flowchart step's full set
  on a phone) the strip scrolls sideways under a finger or trackpad, with no visible scrollbar, and the card and its
  caption stay put. A dropdown in the strip (a flowchart step's Step Type and Lane) hangs its menu from the card, so
  the strip's clip never cuts it off; it opens under its trigger however far the strip is scrolled, and closes if the
  strip scrolls while it is open.
- The popover follows the shape during drag/resize — its position is derived from the shape's current bounds.
- Clicking inside the popover never deselects.

The popover surface itself is kept compact. The fuller action set below is reached via the element's **right-click context menu** (`EditorContextMenu`) — "Link Element" in particular lives in the right-click menu, not as a primary popover button.

- **More button.** The toolbar's `⋯` **More** ("More actions") button, first on the toolbar, opens the element menu from the same anchor as a right-click. It shows on **every device**: right-click is not something a desktop user finds, so the button is the visible way in. **[Power user mode](../007-editor/power-user-mode.md) drops it on desktop**, where a right-click is the way in; **touch devices** (`(hover: none)`) keep it whatever the mode, since they cannot right-click. The multi-selection toolbar follows the same rule.
- **Caption.** A small caption names what is selected ("Selected Square", "Selected Elements (3)"); the toolbar carries the same words as its accessible name (`role="toolbar"`). [Minimal chrome](../007-editor/power-user-mode.md#minimal-chrome) hides the caption, and hides the **Delete** button on desktop, where the Delete and Backspace keys do the same.
- **Delete and Backspace** both delete the selection (single or multi), for everyone who can edit, whenever no text is being edited.

Action set (grouped by a thin divider):

Text + duplication:

- **Edit Text / Add Text** — enters inline text-edit mode on the selected element (the same path as a double-click). A serif-`T` icon. **Shown on every text-CAPABLE element** (`elementSupportsText` in `packages/project`: shapes minus the self-drawing data shapes, text / sticky / freehand / link-cards / arrows) — including elements with no label yet, where it reads **Add Text** so the affordance teaches that text can be added; with a label it reads **Edit Text**. Absent for kinds with no `label` (tables, images, annotation markers, data shapes).
- **Add child / Add sibling** — on a **mind node** only, grow the map from it: the same actions as Tab and Enter ([The mind node](../009-elements/mind-node.md)). Hidden on a locked node and in view-role.

There is **no paintbrush** on the popover, and no format painter ([Format painter](#format-painter)).

Relationships:

- **Link Element** (or **Edit link**) — opens the shared `LinkPickerDialog` (Tab / Project / External URL modes, plus Remove). Picking writes `link: { kind: 'tab', tabId }`, `{ kind: 'project', projectId, name }`, or `{ kind: 'url', url }` onto the element; the target opens on a follow-link click. See [Element links](#element-links).
- **Add Comment** for a Participant, **Show Comments** for a Viewer on an element with comments (read-only sessions only; editors use the element menu's Collaborate section): opens the `CommentThreadPopover` for the element's comment thread, read-only for a Viewer. See [Comments](#comments).

State + destructive:

- **Lock / Unlock** — toggles the element's locked state. Icon flips between an open and closed padlock.
- **Delete** — removes the selected element from the active tab and clears selection. Trash icon. Disabled when the element (or its tab) is locked.

Bring to Front, Send to Back, **Lock Aspect Ratio**, and the colour swatches all live in the element's right-click context menu (Layer + Colours categories) — they were in the popover at one point and got moved out so the floating widget stays compact.

For **boxed elements** (shapes, text, sticky notes), a separate **plus button** appears just outside the element's right edge while it's selected — see [Quick add + connect](#quick-add--connect).

## Panning the canvas

The canvas can be **panned** to bring off-screen content into view.

- **Drag the empty canvas background** (anywhere that isn't an element or popover) to pan: Hand is the editor's tool. **Holding Space** pans under Select too, the same vocabulary as Figma / Excalidraw.
- Drag offsets the entire canvas content (shapes, arrows, plus buttons, selection popover, dot-grid background) as a unit. The palette and mode banners stay fixed.
- The cursor switches to `grabbing` while a pan is in progress.
- A press and release without movement counts as a **click** and deselects.
- Double-click still drops a text element at the click position (now in the panned canvas-coordinate space).

**Fit-to-screen** centres the viewport on the active tab's content and picks the largest zoom level that fits every element with a small margin. Empty tabs reset to (0, 0) at zoom 1. Same gesture as Figma / Excalidraw's "Zoom to fit". Also fires automatically **once per tab entry, when the tab's content has loaded** (on project open and again on each tab switch into a non-empty tab) so a saved tab loads framed rather than at the previous session's pan / zoom. An entry onto an empty tab is spent without fitting, so what the user then adds, the **first element included, stays exactly where it was placed**: the view never jumps to recentre it. Replacing a tab's content wholesale, by picking a template or importing, frames the new content (`requestFit` in `useTabEntryEffects`); the Blank template leaves the view alone.

The bottom-right `ZoomControls` dock is deliberately minimal — three controls: **−10% / current % / +10%**. **Clicking the percentage readout fires Fit-to-screen** (there is no separate Fit button on desktop), and **hovering it opens a popover above** (`ZoomMenu`) with the preset levels **25% / 50% / 75% / 100% / 125% / 150%** plus a **Fit** entry; the active preset is highlighted. The popover is hover-and-focus driven (mouse enter or keyboard focus opens it, with a short close grace so the pointer can travel into it); on touch there is no hover and below `sm` the percentage readout is hidden anyway, so a plain **Fit** button stands in on mobile. Resetting to exactly 100% goes through the popover's 100% entry (or `⌘0`).

On **mobile**, adding a new element smoothly brings the **whole** element into view (`scrollIntoView` in `useEditorViewport.ts`, gated to the freshly added + selected element so moves / remote changes don't trigger it). If it already fits the visible band — the canvas minus margins for the selection toolbar above and the tab bar / dock below — it just pans the minimum to pull any off-screen edge in; if it's too big to fit at the current zoom (e.g. a wide table or large image at the 60% mobile zoom), it zooms **out** just enough that the entire element shows (floored at `MIN_FIT_ZOOM`) and centres it. Desktop never auto-scrolls on add.

On desktop the viewport also zooms on **Ctrl- or Cmd-scroll** (mouse wheel) and on a **trackpad pinch**, focused on the cursor (`useCanvasPinchZoom`). The handler runs in the capture phase and only acts while the pointer is over the canvas, so it pre-empts the browser's own page zoom there while leaving Ctrl/Cmd-scroll elsewhere (address bar, DevTools) untouched.

A **plain wheel with no modifier pans** the canvas (same `useCanvasPinchZoom` handler): a laptop **two-finger trackpad drag** arrives as modifier-free wheel events, so it scrolls the canvas in both axes (content follows the fingers), matching Figma / Excalidraw. Offset commits are coalesced to one per animation frame and accumulate across the events within a frame (mirroring the pointer-pan flush in `useCanvasPanAndMarquee`), so a fast drag stays smooth and loses no delta. It only acts while the pointer is over the canvas, so a wheel elsewhere keeps normal browser scrolling.

### Touch (iOS / iPad)

On a touch device, the canvas surface declares `touch-action: none` and `user-select: none` (plus the iOS-specific `-webkit-touch-callout: none` and `-webkit-tap-highlight-color: transparent`). Without those, mobile Safari intercepts a one-finger drag for native scrolling, treats a long-press as the system text-selection callout, and shows a tap highlight ring on every element press. Pointer events are then dispatched normally so the same handlers (pan in Hand mode, marquee in Select mode, move / resize on elements) work from a finger or a stylus the same way they work from a mouse. `touch-action` does not carry through a scroll container, so an element face with a scrolling body (the collab panels such as the Q&A board, the Comment Panel, the Action Panel) sets `touch-none` on that body too; otherwise the browser claims a finger on it as a scroll and the element can't be dragged on a phone. Finger scrolling is put back by hand (`useTouchScrollBody`): a finger that lands on the **content** (the cards inside, a Q&A note, a comment) scrolls the body, with a short fling on release; a finger on the body's own padding or the gaps between cards, or on the header or footer, drags the element; and when the content fits (nothing to scroll) every finger drags. A tap on a card inside therefore doesn't select the element, the header does. Mouse and pen are unaffected: a wheel or trackpad scrolls the body as before. The browser's own pinch-to-zoom is off because the canvas owns its zoom: a **two-finger pinch zooms the canvas** about the fingers (`useCanvasPinchZoom`), keeping the canvas point that was between them there and following them as they move together, so one pinch zooms and pans at once, as a phone's maps and photos do. It changes the view at most once a frame, however fast the touch events come.

**A finger moves only an element that fits on the screen.** A finger pressed on an element that runs off the canvas surface on any side (its on-screen box, so zoom and rotation count, with 1px of slack) pans the canvas instead of dragging the element, whatever the tool: on a phone a drag across a big frame, table or image is far more often "show me the rest" than "move this", and the way to move it is to zoom out until it fits, then drag. The press still behaves as a press on that element otherwise: a **tap** selects it (or settles the click on it as a mouse click would, [Selection](#selection)), an armed action (an arrow waiting to connect) still takes the tap, the **long-press** still opens its menu (and its release is not also a tap), and a double-tap still edits. A mouse or pen always drags. (`../packages/workbench/src/lib/fits-on-screen.ts` measures the element against the `data-canvas-root` surface; `useBoxedElementGestures` marks the press as panning through, `../packages/workbench/src/hooks/canvas/pan-through.ts`, with the tap it runs.)

## Marquee box-select

Under the **Select** tool (not offered by the editor, [Canvas tools](#canvas-tools)), **press-and-drag the empty canvas background** (without holding Space) to draw a translucent selection rectangle. On release, every boxed element whose bounding box is **fully enclosed** by the rectangle is multi-selected (containment, not intersection, you must drag a box right around an element to catch it). A rotated element is judged by the box it is **drawn** in: its four corners turned by its rotation (`drawnBounds`, `packages/project`), so a turned element is caught when the rectangle holds what the person sees, never by its unrotated footprint. Releasing inside a sub-4-pixel area is treated as a click and deselects. The rectangle is outlined in the tab theme's accent over a faint wash of it. On light paper that is the accent at full strength (a 12% wash; the app's own `brand-500` when the theme sets no stroke). On dark paper the same saturated accent glares, so the border drops to 80% and the wash to 10%, and a theme with no stroke falls back to `blue-500` (`#3b82f6`), the blue of the dark selection ring, rather than the brand's own. The paper decides, not the viewer's Appearance: a Midnight-schemed tab in light chrome gets the dark treatment. The Map's current-view window uses the same colours ([Map](minimap.md)).

A multi-selection is mutually exclusive with the single-element selection:

- 0 hits → both cleared.
- 1 hit → single-select that element (the selection popover + right-click context menu still apply).
- 2 + hits → enter **multi-select** mode. The single-element popover is suppressed (a per-element toolbar doesn't make sense for many at once). Each multi-selected element still shows its selection ring via `BoxedElementView`'s `isSelected` prop.

While multi-selected:

- **Press-and-drag any member** moves the whole selection in lockstep. The drag handler reads `multiSelectedIds` and pre-populates `startBounds` with every member.
- **Delete / Backspace** removes every multi-selected element and any arrows that reference one of them. **Locked members are kept** (and a locked arrow survives its endpoint going); if every member is locked it's a no-op. Single-element delete falls back to the same logic when there's no multi-selection. The keyboard handler is suppressed while a label is being edited or focus is inside any text input.
- **Only Shift adds to or takes from a selection.** There is no sticky add mode: a **plain click on a non-member** selects that element alone, replacing the multi-selection. This applies to arrows as well as boxed elements.
- **A plain click on a member** (a press and release without a drag) selects that member alone; a press that drags moves the whole selection.
- **Shift-click any element** toggles its membership — adds if absent, removes if present. Folds the current single selection in first so "I had A selected, now also B and C" works without losing A.
- **Click empty canvas** or **switch tabs** clears the multi-selection.

Marquee hits include both boxed elements (shape, text, sticky) and arrows whose segment AABB is fully enclosed by the rectangle. Duplicating a marquee that contains both carries the connectors across with their endpoints remapped to the duplicated targets.

The floating `MultiSelectionToolbar` appears for **any** 2 + selection, **including an arrow-only one**: it floats over the union bounds of every selected element (arrows contribute their selection extent, the endpoint AABB together with their label, see [Arrow labels](arrow-labels.md) "Selection"), anchored independently of the union **resize** box. The resize box and its handles stay **boxed-only** (there's no box to drag-resize an arrow by), so an arrow-only selection shows the toolbar but no resize handles. This is what makes "select five arrows → toolbar → **More** → **Flow** → animate them all in one action" reachable; the selection-wide setters (`setArrowFlowSelected` et al.) then apply to every matching member.

## Quick add + connect

When a **boxed element** (shape, text, sticky note) is selected and not in edit/paint mode, **four plus buttons** float around its bounding box — one centred on each edge (right, bottom, left, top).

Each plus is a **click trigger** for a **radial quick-action ring**, not an instant action. **Clicking / tapping** a plus animates a ring of four options in around the button: each option grows **out of the plus** (slides from the plus centre to its slot + scales up), staggered for a fan effect, fanning **outward** from the element so it never overlaps the shape; closing reverses the same motion back into the plus. The open menu is **kept on screen**: beside an element that reaches the edge of the viewport (a phone, where most elements do) it would fan past the edge, so it is nudged back inside, a viewport margin from the edge, even where that sets it over the element. While open the plus becomes an **×**. The ring closes when the plus (×) is clicked again, when another plus is opened (only one ring is open at a time), or on any pointer-down outside a ring. There is **no hover-to-open**: the trigger is a deliberate click so it doesn't fire while the pointer just passes over the element.; every action is chosen from the ring. Each option carries a tooltip.

A ring open on the **same side as the selection toolbar** would collide with it (the toolbar sits above the element on desktop, below on mobile), so while a top **or** bottom ring is open the toolbar is forced to the **opposite** side.

All three options act on the **clicked side** (the side's anchor is `e` / `s` / `w` / `n`):

1. **Duplicate**: clones the selected element to that side (same size, content, style, locked state; fresh id). It does **not** draw a connector arrow: most duplicates don't need one, so auto-connecting was usually just noise to delete. Use the ring's Arrow action to connect them on the occasions you do want an edge.
2. **Arrow** — starts a new arrow pinned at that side's anchor. It begins on **pointer-down** so it's a single press-drag gesture. **Desktop:** press-and-drag the free endpoint to its target (snaps to an element anchor, or drops free on empty canvas) — the existing anchor-drag flow. **Mobile:** the press arms a "pick target" mode; the next tap on an element (or empty canvas) sets the endpoint, and a tap elsewhere cancels. **Shift chains arrows**: holding Shift while the placing click lands the endpoint immediately starts ANOTHER arrow from the same source anchor, endpoint following the cursor — so a hub can fan out to several targets in one flow (click plus → shift-click target → shift-click target → … → plain click for the last one), without re-opening the ring for every edge. Works in both the click-to-place flow and a Shift-release of the press-drag.
3. **Text** — drops a text element to that side and opens it for editing. **No connector arrow** — a caption next to a node isn't a flow edge, so an arrow would be noise.

Placement (for Duplicate) matches the gap to the nearest in-line neighbour so a duplicated chain keeps the same spacing as existing siblings instead of a fixed gap the user then has to nudge into line: the gap is the edge-to-edge distance to the nearest element that shares the source's row (left / right) or column (above / below), falling back to a 40px default when the source stands alone in that direction. It then reuses overlap-avoidance stepping (step further in the chosen direction until the new box clears existing elements), so each step lands on the same rhythm. The newly added element is selected afterward so the user can keep building outward; the Arrow option selects the new arrow instead. Open ring state is owned by the Canvas (not the individual plus) so the single-open rule and the toolbar dodge can be coordinated. When the `quickAddOnHover` preference is on ([User preferences](../007-editor/user-preferences.md), off by default), the menu also opens on **hover** of the `+`: pointer-enter opens it and it closes a beat after the pointer leaves both the `+` and the menu, so a run of connected elements doesn't need a click each time. A click still toggles it open in either mode. The `+` buttons themselves still appear only on the selected element.

Each chosen option emits telemetry: Duplicate → `track('Element', 'Duplicated', <kind>)`; Text → `track('Element', 'Added', 'Text')`; Arrow fires its existing creation event (`'Arrow'`).

The plus buttons are hidden while the element is being edited. A marquee multi-selection hides them (a transient selection isn't a unit you chain from). The pluses are not shown for arrows or annotation markers (a marker is a note, not a node). A **stat row, process or header** ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)) adds one more option while it has room: **Add stat / Add step / Add link** appends a row, the way a concept graphic's ring offers Add Milestone or Add Stage. **Tables get the pluses with a slimmed table ring**: Duplicate / Text don't apply to a grid, so the ring holds **Arrow** plus that side's structural add — **Add Row** on the bottom plus, **Add Column** on the right one (top/left are Arrow-only) — so a table can grow and connect without the hover ⋯ menus.

## Layer order

Boxed elements paint in **array order** — earlier in the tab's `elements` array means rendered earlier (further back); later means rendered on top. Arrows always render in a single SVG layer on top of all boxed elements (this is a current rendering limitation, not a long-term design).

New elements always land at the **front** of the z-order:

- **Adds** (a Start Planning board or Sheet, the double-click Text box, a quick-connect arrow) **append** to `elements`, so the new element lands on **top** of existing content. Surfacing a freshly added element where the user can see and immediately work with it is the expected default; the context menu's Layer category **Send to Back** covers the rarer case where it should sit behind. (An earlier iteration prepended palette adds to drop them at the back, but landing new content on top matches how every other editor behaves and is what users reach for.)
- **Paste and duplicate** likewise **append**, so the freshly minted copies land at the **front**: the user just copied them, surfacing them on top of the source is the expected behaviour.

The selection popover exposes:

- **Bring to Front** — moves the selected element to the end of the elements array.
- **Send to Back** — moves the selected element to the start.

These apply to any element type (including arrows, where they re-order among arrows).

## Rotation

Any boxed element (shape / text / sticky / image / freehand) except an **annotation marker** can be rotated about its centre (`supportsRotation` in `packages/project`, which gates the Rotation category, the Rotate commands and the write itself, so a multi-selection's Rotation leaves a marker upright). The angle is stored as `rotation?: number` — clockwise **degrees**, normalised into `[0, 360)`; absent or `0` means unrotated. It rides in the element JSON, so copy / paste / duplicate / persistence round-trip it for free.

- **Setting the angle**: there is **no free-drag rotate handle** — the angle is picked from fixed **45° presets**, the eight steps `0 / 45 / 90 / 135 / 180 / 225 / 270 / 315`. They're offered as a tile grid in the **Rotation category** of the element right-click menu (`EditorContextMenu`), and as **Rotate 90° / 180° / 270°** + **Reset rotation** actions in the search command palette (see [Search panel](#search-panel)). Both route through `setRotationSelected(deg)` (boxed selections only), which writes `rotation` (storing `undefined` when `deg === 0`) and emits `track('Element', 'Changed', 'Rotation')`. `0°` doubles as reset-to-upright. Fixed steps keep a row of tilted elements consistent and make any angle trivially reproducible / undoable, at the cost of arbitrary free angles.
- **Pivot**: rotation is about the element's centre (`transform: rotate()` with `transform-origin: center`). Selection handles + arrow anchors are children of the wrapper, so they rotate with the box.
- **Resize while rotated**: the corner and edge resize handles stay on a rotated element and turn with it (their cursors follow the angle). The drag is projected into the element's own unrotated frame, so the box grows along its own axes, and the corner or edge opposite the handle stays visually fixed. Alignment snapping does not apply to a rotated box. Shift and the aspect lock keep the ratio exactly as they do unrotated.
- **Arrow anchoring is rotation-aware and outline-aware**: anchors rotate with the element and sit on its drawn outline; see [Arrow anchors and auto-rebind](arrow-anchors.md) "Anchor geometry", which also owns the anchor chosen at creation and the auto-rebind.

- **Known limitations (current iteration)**: the marquee bounding box is still computed from the element's **unrotated** axis-aligned box. Free-angle rotation (a drag handle) is deferred.
- **Telemetry**: choosing a Rotation preset (right-click menu or search palette) emits `track('Element', 'Changed', 'Rotation')`.

## Text element

A free-floating text element. The text **is** the element — there is no border or fill.

- Added from the **Text** palette button.
- Default content: `"Text"`. Default size: 220 × 64.
- **Drag** to move; **resize** via the same four corner handles as shapes. Text auto-scales to fit the box (same SVG-based fit-to-bounds technique as shape labels).
- **Double-click** to edit content; **Enter** and **Escape** commit (see [Labels](#labels) "Escape keeps what you typed").
- A faint dashed outline appears when selected so the bounds are visible.
- **Colour.** The text takes the theme's label colour, and can be recoloured like any other element:
  the context menu's **Colours** category (a single **Text** row and Reset to Theme; no Background or
  Border, since a text element has neither) and the [Quick style panel](quick-style-panel.md)'s
  **Text colour** row. A multi-selection's Colours category recolours the text elements in it too.
  `supportsColours` in `packages/project/src/colors.ts` is the one gate for both menus.
- All other behaviour (selection, popover, lock, layer order, plus button) matches shapes.

Data:

```ts
type TextElement = {
  id: ElementId;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  textColor?: string;
  // The Quick style swatch slot (1-6) the colour came from; it follows a theme change.
  textSwatch?: QuickSwatchSlot;
  // ...plus the text formatting fields (size, alignment, bold / italic / underline, font).
};
```

## Sticky note element

A yellow sticky-note element for short notes / annotations on the canvas.

- Added from the **Sticky** palette button.
- Default content: empty (placeholder "Note"). Default size: 200 × 200.
- Visual: amber-100 background, amber-200 border, soft drop shadow, slightly rounded corners.
- **Multi-line** text (unlike shapes / text elements). Wraps naturally; long text is clipped (resize to see more).
- **Double-click** to edit. While editing, **Enter** inserts a newline; **Escape** and blur commit.
- All other behaviour (drag, resize, lock, layer order, plus button) matches shapes.

Data:

```ts
type StickyElement = {
  id: ElementId;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
};
```

## Groups

There are no groups ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)): no `groupId`, no Group / Ungroup, no group mode, no drill-in, no `pinned-group` arrow ends. A multi-selection moves, styles, locks and deletes many elements at once, and a frame keeps a region's contents travelling together. An element stored with a `groupId` loads with it ignored.

## Format painter

liveplanner has **no format painter**: no tool copies one element's style onto another. Restyling is the element
menu's ([Selection popover](#selection-popover)) and Clear Styles ([Element menu quick bar](element-menu-quick-bar.md)).

## Text size

Each boxed element carries a `textSize` setting controlling how its label renders:

| Value                | Behaviour                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `'scale'`            | Label auto-scales to fit the box (current SVG fit-to-bounds for shapes / text; multi-line wrap at a small default font for sticky). |
| a number, 6 to 48    | An exact px from the Text Size slider, the same px on every surface.                                                                |
| `'sm'` `'md'` `'lg'` | The named presets earlier projects and templates carry: fixed small / medium / large, each on its surface's own scale.              |

Set from the element context menu's Text flyout on the one Text Size control ([Fonts](../004-interface-design/fonts.md#text-size)). When set to a fixed size (a px or a preset), content is centered and wraps on its newlines (and, for stickies, soft-wraps). Resizing the element does not change the font — only `scale` reacts to box size.

```ts
type TextSizePreset = 'scale' | 'sm' | 'md' | 'lg';
type TextSize = TextSizePreset | number; // a number is a whole px, TEXT_PX_MIN to TEXT_PX_MAX
type BoxedElement = ... & { textSize?: TextSize };  // defaults to 'scale'
```

## Rich text labels (per-range formatting)

The Text accordion + Colours swatch above format the **whole** label. On top of that, a label can carry **per-range** formatting, bold / italic / underline / strikethrough / colour applied to a **selection** of the text rather than the whole element (`size` also exists per-run in the model and renders, but no control sets it, see below). Scope: **shape / text / sticky** labels (the in-place editor). Arrow captions + table cells keep whole-element formatting only.

**Editor + toolbar.** Editing a label (double-click, Space, type-to-edit) opens a `contentEditable` editor (`RichTextEditor`) with a **floating toolbar** above the element. The toolbar is a single row of plain icon buttons: **Bold / Italic / Underline / Strikethrough** toggles, then **Bullet list / Numbered list / Remove list**, then an **alignment dropdown** (a 3×3 grid; its trigger is the familiar word-processor stacked-lines glyph whose ends follow the horizontal alignment, the same grid also appears as a **Text Alignment** category in the element/multi context menus, for discovery in both places), and a colour swatch. There is deliberately **no ⋯ overflow menu**: the element context menu's **Text** flyout carries Typography + Alignment, so Font / Size / Padding behind an overflow would be pure duplication, and Format sits inline as toolbar icons. Whole-element Font / Size / Padding are set from the element context menu instead; the toolbar holds only the live-selection verbs. The B/I/U/Strikethrough/colour controls apply per-range (the current selection, or, on a collapsed caret, the whole text); lists apply to the selected lines, and alignment is whole-element (the shared `onSetTextAlign` setter, operating on the editing element). The alignment dropdown is kept inline (not portalled) so the editor's focus + canvas-propagation guards apply to its menu too. The toolbar counter-scales `1/zoom` so it stays a constant on-screen size, and flips below the element near the top edge. Controls `preventDefault` on mousedown so clicking one never drops the editor's text selection; the native colour input is the one control that takes focus, and the editor re-focuses + restores the selection after the colour applies.

**The menu beside an edit clears the toolbar.** Entering text edit opens the element menu beside the element (`useEditModeContextMenu`); it anchors beside the element and its floating text toolbar together (`editMenuAnchor`), since the toolbar is wider than a small element (an icon, a short pill) and the menu would otherwise cover its alignment and colour controls.

**Popover vs menu, one gesture, one answer.** A left click asks “what is this?” (the selection popover) and a right click asks “what can I do with it?” (the element context menu). They never show together: while an element menu is open the popover and its quick-connect pluses stand down (`elementMenuOpen` in `deriveCanvasSelection`), and they return when it closes. Two toolbars ringing one element repeated half their verbs and left the user picking between identical buttons. Right-click opens the menu on RELEASE, not on press (`useRightClickRelease`, shared by elements, arrows AND the empty canvas / tab menu): X11 and macOS fire `contextmenu` on mouse-down where Windows fires it on up, so opening from that event dropped the menu under a still-held button; a right-press that travels more than 8px is a drag and opens nothing. **Every platform's event order must open the menu on the first click** (a two-finger trackpad tap included): the `contextmenu` handler reads `buttons`: a button still held means the release is still to come, so it arms and the matching button's pointerup opens; nothing held means the release already happened (Windows) or there was no pointer (the keyboard Menu key / Shift+F10), so it opens at once. An arm-then-wait design would never open on Windows' first click and would leave the arm set, so the NEXT click opened a stale menu. An arm never outlives its press (a window pointerup clears one the target never saw). A macOS Ctrl+click is a context click on the PRIMARY button: it opens on that button's release, and the marquee / pan its pointerdown armed is dropped, because that gesture's release deselects and deselecting closes the menu. The same rule covers **touch long-press on the empty canvas** (iPhone / iPad): the hold claims the press, so the marquee / pan the finger's pointerdown started is dropped when the menu opens, otherwise lifting the finger would read as a sub-4px click, deselect, and close the menu it had just opened. A render fault inside the tab / canvas menu closes the menu, not the editor (`MenuErrorBoundary`): the editor has no app-level error boundary, so a throwing menu would otherwise unmount the whole page. The secondary button does NOTHING else: it never selects, never starts a drag, and never dismisses an open menu (nothing listens for the `contextmenu` EVENT any more, it fires on press on X11, and an element’s `stopPropagation` cannot stop a document-level listener because Next’s App Router hydrates on `document`, making React’s own listeners siblings of it). Right-clicking a DIFFERENT element re-opens the menu properly, it is keyed on its target, so it remounts and animates in at the new anchor instead of sliding across fully-formed (and because the target only changes on the RELEASE, that entrance never plays under a held button). Right-clicking the element that already owns the menu, at the same anchor, is a no-op: the same state object is returned so nothing re-renders and the menu simply stays. The anchor must be part of that comparison, `selectElement` retargets an open menu’s `elementId` in place (keeping the old x / y) and runs first, so an id-only check strands the menu at the previous element’s position, selection (and so the popover) is a LEFT click’s job, and a right press whose release will re-open the same menu must not tear it down in between. The release deliberately keeps propagating: gestures end on a window pointerup, and React dispatches from the root container, so stopping it there strands the drag and the element follows a cursor with no button down. A left click also CLOSES an open menu (the click that selects is the click that dismisses), so the popover comes straight back, the menu’s long-press grace window is measured from mount, not from each effect run, or a re-render would keep renewing its immunity to the very click meant to dismiss it. That window guards ONE gesture, a touch long-press, which opens the menu under a finger that is still down, so dismissal listens on `pointerdown` (which carries `pointerType`) in the CAPTURE phase: a mouse dismisses instantly even mid-animation, touch keeps its grace, and an element’s own `stopPropagation` can’t swallow the event first.

**Canvas menu: Paste.** Right-clicking empty canvas puts **Paste** at the top of the menu, above the accordions, that right-click is overwhelmingly “put the thing I copied HERE”, so it should not be folded inside a category. With an empty buffer the row stays PUT and greys out (`aria-disabled`): a menu that changes shape with state the user can’t see is a menu they have to relearn each time. It reports the in-app buffer; a copy from another window still pastes with Cmd+V. The tab's ⋯ menu, which is otherwise the same menu, carries Paste as an icon in its quick-action toolbar instead: there it is one tab verb among several, while on the canvas it is the reason for the click. (As an unlabelled icon on the canvas it would read as missing.)

**Context menu while editing.** Entering text-edit mode on a boxed element (shape / text) also **auto-opens the element's context menu beside the element** (the standard `elementMenuAnchor` top-right position, desktop viewports only — on mobile the keyboard + menu would fight for space), so whole-element styling — Style presets, Colours, Font / Size / Padding, Animation — stays one click away **without leaving the editor**. The pieces that make this survivable: the editing session `preventDefault`s mousedown on menu controls (a project-level capture listener scoped to `[data-context-menu]` / `[data-menu-flyout]`, excluding form inputs) so clicking them never blurs the editor or drops the text selection; the editor's blur guard also ignores focus landing inside the menu (the colour input and opacity slider legitimately take focus); and the menu's outside-click dismiss ignores clicks inside the editing session (`[data-rich-text-session]` — the editor + its floating toolbar), so clicking back into the text to move the caret doesn't close the menu. The menu closes automatically when editing ends (commit or Escape — Escape also closes it via its own listener). While the target is in edit mode its label is still uncommitted (text commits on blur), so the label-gated **Text** categories (Typography / Alignment / Markers) treat "being edited" as having text — a fresh shape's menu must offer the text options for the words being typed, not hide them because the committed label is still empty. Arrow labels and table cells keep their plain editors and don't auto-open a menu.

**Saved trimmed.** A label is saved without whitespace at either end: leading and trailing newlines, blank lines and spaces are dropped on commit (`trimLabel`), its formatting runs sliced to match, so neither the label nor its editor shows a dangling line. Blank lines and spaces inside stay. An arrow label left blank has no label.

**Runs-as-delta model.** Per-range formatting is stored as `richText?: TextRun[]` on the element — each run is a slice of text plus only the attributes that **differ** from the whole-element `text*` fields:

```ts
type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg'; // per-run size; no 'scale'. Renders but has no setter UI today.
  color?: string; // hex
};
```

**Right-click while editing:** with the label editor open, right-clicking the element surfaces the browser's **native text context menu** (cut / copy / paste / select all) so it acts on the text being edited. The handler stops propagation so the canvas's own right-click doesn't hijack it into the tab / element menu, but deliberately does not `preventDefault`, so the native menu still opens.

**Extra-small runs.** A run's `size` has one step below the element presets: `xs`, drawn at 10 px on every
label scale (`RUN_XS_PX` in `../packages/model-core/src/label-font.ts`), where `sm` is 14 px on a
single-line label, 12 px on a multi-line one and 11 px in a note. It exists for text that
reads smaller than any preset (a subtitle at 8 px); no control sets it today, and the element-level text size (Quick Style Panel, the Text category) stays
`sm` / `md` / `lg` / `scale`. An `xs` run keeps the label's own text colour, so it meets the same
contrast as the rest of the label (4.5:1 against its fill, the normal-text bar, which applies at every
size below large text). The canvas, the SVG export and the PNG and PDF exports drawn from it render it
at the same 10 px.

An unset run attribute **inherits** the element field (`run.bold ?? el.textBold`, `run.color ?? el.textColor`, `run.size ?? el.textSize`), so the existing whole-element controls keep working as the base layer untouched, and an explicit per-range override wins over a later whole-element toggle (same precedence as table `cellStyles`). `element.label` is always kept equal to the runs' concatenated plain text, so search, auto-rename, markdown export, and every legacy reader work unchanged. When `richText` is absent (or a single override-free run) the label renders via the legacy whole-element path; applying any per-run override opts the label out of `scale` SVG auto-fit into fixed-px rendering (mixing per-run sizes with whole-element auto-fit is contradictory). The pure runs algebra (`runsPlainText` / `normalizeRuns` / `applyFormatToRange` / `toggleFormatInRange`) lives in `../packages/model-core/src/rich-text.ts`; the DOM ↔ offset mapping in `apps/editor/components/rich-text/rich-text-dom.ts`. The field is additive + optional, so it syncs to peers + persists with no backend change, and visual exports (PNG / SVG) render the runs span-by-span on one baseline.

## Quick text drop

**Double-clicking the empty canvas** (anywhere not on an element, palette, or popover) with a **mouse, trackpad or pen** drops a new **text element** at the click point and **immediately enters edit mode** on it. The text is centred on the cursor position. Press Enter to commit or Escape to cancel — Escape will leave an empty text element in place, which the user can then delete.

## Double-tap to zoom

**A finger's double-tap on the empty canvas zooms in on the tapped spot** instead of dropping text, and the next one fits the whole tab back into view: on a phone or an iPad the canvas is usually shown small, a stray text box was rarely what a double-tap meant, and a finger has no wheel to zoom with.

- **What decides it is the pointer that pressed**, not the device: a finger (`pointerType` `touch`) zooms; a mouse, a trackpad or a pen drops text, so an iPad with a trackpad or a Pencil keeps the quick text drop, and a touch-screen laptop's finger zooms.
- **Anywhere on the empty canvas**: the content layer is scaled with the zoom, so on a zoomed-out phone most of the empty canvas is the surface around it (`<main>`), and a double-tap there zooms too. Off a page, where a double-click makes nothing, a double-tap still zooms. In Spotlight and Avatar, which give every press on the surface its own meaning, the surface does not zoom.
- **The view glides** (`glideViewport`, eased over `VIEW_GLIDE_MS`; at once under reduced motion) so the tapped point lands in the **middle of the canvas** at the new zoom.
- **The new zoom** is twice the current one, and never less than **100%**, so one double-tap on a phone's zoomed-out view lands at a readable size; capped at `ZOOM_MAX` (500%). At the cap, the double-tap only centres the spot.
- **In, then out to the whole tab**: a double-tap never zooms in twice running. After a double-tap has zoomed in (on the canvas or on a small element, below), the next double-tap on the empty canvas **fits the whole tab** into view instead, the same view as Fit to Screen, gliding there; the one after zooms in again on its spot. So a person can double-tap out to the overview, then double-tap where they want to go. If they have pinched back out to the whole-tab view or wider since, there is nothing to fit, and the double-tap zooms in. A new tab starts afresh.
- **A small element is shown first, then edited**: a double-tap on an element that is too small on the screen to work on **frames it** instead of opening its editor (or its picker or dialog), gliding so the element sits in the middle of the canvas at a zoom that shows it whole. A second double-tap on it then edits it as usual. An element is too small when the canvas is below **100%** and the element's on-screen box is under **44 px** (a fingertip, [Touch targets](../004-interface-design/touch-targets.md)) on its shorter side. The framing zoom fits the element with the Fit to Screen padding, no less than **100%** (so the next double-tap always edits) and no more than **200%** (a tiny sticker does not fill the screen); never below the zoom already on screen. It counts as a double-tap zoom-in for the rule above. A mouse, a trackpad and a pen edit at once, as before. The canvas catches the double-tap's second press ahead of the element's own handling, so it holds for every element and every part of one (its selection handles, an arrow's line), and a double-tap inside an editor that is already open stays the editor's, to select a word (`../packages/workbench/src/lib/double-tap-zoom.ts`, `../packages/workbench/src/hooks/canvas/useSmallElementDoubleTap.ts`).
- **Everything else that already owns a double-tap keeps it**: a double-tap on an element big enough to work on edits it, a polygon or path being drawn finishes, and on a whiteboard a double-tap inside a shape writes in it. Only a double-tap that would have dropped text zooms.
- **Every share role zooms**: it only moves this person's view, so a Viewer and a Participant (who could never drop text) zoom as an Editor does.
- Counted as `Canvas` `Zoomed` in telemetry, beside the zoom buttons' `In` and `Out`: `DoubleTap` for a zoom in on the canvas, `DoubleTapElement` for framing a small element, `DoubleTapFit` for the whole-tab fit.

## Auto-select on add

Every palette `Add ...` button auto-selects the newly created element. The selection popover and the plus buttons appear immediately, and the element's right-click context menu is one click away, ready for the next action.

## Editor header

The editor header carries three things:

- The `liveplanner` brand mark (left), accent-coloured from the active tab's theme stroke.
- The **project title** (centre). Defaults to `Untitled project`. Click to rename in place — the title becomes a text input with the current name pre-selected. **Enter** commits, **Escape** cancels, **blur** commits. Empty value reverts to the previous name. A small **Private** or **Shared** badge sits immediately to the right of the title and surfaces the current sharing state.
- The **Share button** (right). Visible only to the project owner — visitors arriving via a share link can't toggle sharing on their host's project. Opens the share dialog (manage links, roles).

The project title persists via the api worker (`apiSaveProjectMeta`). Per-tab names live on each `Tab` and are edited from the tab bar (see [Tabs](#tabs)).

Rename and Delete for the **current** project live in the Explorer panel's "Current Project" row, not in the header — the header stays a thin chrome strip. Other participants render as cursors + selection rings on the canvas itself (see [11-api.md → Durable Object room](../015-api/api.md)), not in the header.

## Tabs

The tab bar sits at the bottom of the editor. Each tab represents one canvas with its own elements and background pattern.

### Selecting & adding

- Click a tab to switch to it. Switching clears element selection, edit mode, and any active picker, AND **fit-to-screens** the new tab's content on load (so the user lands centred on whatever's there, not wherever the previous tab left the viewport). A fit pads the content by at least the Palette strip's reach into the canvas on every side (`topChromeInset`, a whole even number of px), so nothing lands under the strip or the bottom chrome and the content stays centred on whole pixels. Subsequent edits on the same tab don't re-fit, the first element on an empty tab included — the gate is per tab id.
- The **+** button at the right of the bar adds a fresh empty tab and switches to it. The new tab is **seeded from the active tab's visual context**: theme id, canvas backdrop (`backgroundColor`, `backgroundPattern`, `backgroundOpacity`, `patternColor`), font, and default text size all carry over, so a user mid-diagram doesn't land on a brand-default canvas. It opens in the active tab's mode too (a Plan tab's + makes a Plan tab), on that mode's own start ([Editor modes](../007-editor/editor-modes.md) "A new tab opens in the mode it was made from"). Each tab stays independently styleable after creation (restyling the new tab never affects the source). The seed survives the new tab's template picker too: picking a template under the unchanged theme keeps the inherited backdrop (see [Per-template canvas backdrop](#templates-section)), and Skip leaves it untouched.

### Tab pill styling

Each tab pill colours itself from its tab's theme:

- Pill text colour uses `getTheme(tab.theme).elementStroke` (falls through to the brand sky for themes that don't override the stroke).
- The active pill additionally tints its background to a 10% alpha of the same accent.
- A small **padlock icon** sits to the left of the name when `tab.locked === true`.
- Per-tab **participant avatars** stack to the right of the name — one circle per remote participant whose `tab-focus` op points at this tab. Lets the user see at a glance who's working where.

### Renaming

A tab can be renamed in two ways:

- **Double-click the active tab's name** → inline input (Enter commits, Escape cancels, blur commits).
- **Tab menu → Rename** (see below).

### Tab menu (ellipsis)

The active tab carries a **`⋯` ellipsis button** to the right of its name. Clicking opens a small floating menu (right-clicking any tab opens the same menu, suppressing the browser's default context menu and switching to that tab first if it isn't active so the menu's actions operate on the tab the user pointed at). A **quick-action toolbar** (Rename / Duplicate / Paste / Lock / Delete) sits at the top, with a `MenuGroupSeparator` directly beneath it (Paste is greyed, not hidden, when the buffer is empty; opened from an empty-canvas right-click, the toolbar drops its Paste icon and the menu leads with a labelled Paste row instead, see "Canvas menu: Paste"); below it **no categories**: the rest are full-width rows (`MenuActionRow`), with a `MenuGroupSeparator` between related groups: **Organise in Tab Folder** / **Add to Project** (where the tab lives), then **Import** / **Export** / **Clear** (what is on it), then the **mode rows** (Diagram, Draw, Plan with their descriptions, the current one marked; where a mode choice is offered, [Editor modes](../007-editor/editor-modes.md)). The menu is short enough to show everything: it once grouped these into Organise, Content, Mode and Cleanup categories, and later carried the session tools; the Cleanup tidiers moved to the command palette ([Layout cleanup](layout-cleanup.md)) and the session tools to the bottom bar's [Session strip](../012-collaboration/session-tools.md#the-session-strip). There is no Look & Feel or Font category: the theme, canvas background and font live in the Tab Style dialog ([Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)), reached from the Theme & canvas dock button. The same menu, scoped to the active tab, is what the **empty-canvas right-click** opens, so the tab and canvas menus are identical. Actions:

- **Rename** — enters inline rename mode.
- **Duplicate** — creates a copy of the tab (same elements, same pattern, name suffixed with " copy") inserted directly after the source, and switches to it.
- **Clear content** — wipes every element from the tab in one undoable commit. Disabled when the tab is already empty or when the tab is locked.
- **Lock / Unlock** — toggles `tab.locked`. While locked, every element on the tab is read-only (matches per-element lock semantics), the palette's Add buttons stop firing, theme / canvas changes are blocked, **the tab itself can't be deleted** (the Delete row is disabled — unlock first), and the tab pill shows the padlock icon (see above).
- **Add to Plan** — a modal of the person's other plans. Picking one shares the tab into that plan via `POST /api/projects/:id/tabs/:tabId/link` (the source tab stays put; both plans then hold the same tab, kept in step, so edits reach both; see [Tab ↔ project many-to-many](../006-project/tab-project-many-to-many.md)).
- **Delete** — removes the tab and falls back to a neighbouring tab. Disabled when only one tab remains.

The menu renders through a **portal** to `document.body` so it isn't clipped by the tab bar's horizontal scroll. It positions itself from the ellipsis button's bounding rect (tab surface) or at the cursor / footer-button point (canvas surface), clamping back on-screen at every viewport edge.

### Reordering

Tabs are **draggable** via the native HTML5 drag API. Dragging a tab over another shows a ring around the drop target; releasing reorders the source to the target's position.

## Element links

Any element can carry a **link**: to another **tab**, another **project**, or an **external URL** (`ElementLink` kinds `tab` / `project` / `element` / `url`). Clicking the link jumps to the tab, opens the project, or opens the URL in a new tab (`noopener`).

### Setting a link

- Right-click an element → **Link Element** (or **Edit link** when one exists) opens the shared **LinkPickerDialog** — a centred modal styled like the import / export dialogs.
- The dialog has three modes: **Tab** (lists every tab), **Project** (lists the user's other projects), and **External URL** (a text field; a bare host gets `https://` prepended). A **Remove link** action shows when a link is already set.
- The same dialog sets **per-cell table links**: a **Link cell** button in the in-cell toolbar opens it for that cell, storing the link on `cellStyles[r][c].link` (so it rides the cellStyles splice on row / column edits). The dialog and follow behaviour are identical; only the commit target differs (element `link` vs cell style `link`).

The Link button is brand-tinted when the selected element has a link.

### Visual indicator

A linked boxed element shows a chain glyph among its [element indicators](element-indicators.md) (inside its top-right corner by default). The glyph:

- Scales with the canvas zoom and hides below 40% zoom, like every indicator.
- **On click**, follows the link: a tab/element link switches tab (`setActiveId`, clearing selection + edit/mode state), a project link opens that project, a url link opens the address in a new tab.
- Stops propagation so it doesn't trigger element select / drag.

A **linked table cell** shows the same chain glyph in the cell's top-right corner; clicking it follows the link (in view and edit sessions) without selecting / editing the cell.

Arrows can also carry a link but don't show a visible badge yet (no obvious place to put one); future iteration may put a badge at the arrow's midpoint.

### Data model

```ts
type ElementLink =
  { kind: 'tab'; tabId: TabId } | { kind: 'element'; tabId: TabId; elementId: ElementId };
```

The UI exposes the `'tab'`, `'project'`, and `'url'` kinds (via the LinkPickerDialog's Tab / Project / External URL modes). The `'element'` kind is in the model so future iterations can "jump and focus a specific element" without a schema change.

### Multi-selection behaviour

Setting or clearing a link applies to **all members of the current selection** (consistent with other per-element ops). Each linked member shows its own badge.

## Tooltips and hover cards

Every palette tile and selection-popover button carries a hint, as defined in
[Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md):

- A tile with a **caption** carries a **Tooltip** with its full name, after a 500 ms hover or at once on
  keyboard focus. The caption may be shortened; the tooltip never is.
- A caption-less tile or icon button that needs explaining carries a **hover card**: the bold name
  over one sentence saying what the action does.
- The icon and technology pickers' glyph galleries carry a **Tooltip** only: a hover card on each of
  ~60 glyphs is noise, and the name is all a glyph needs.

```tsx
<HoverCard title="Add Square" description="Drop a new square shape on the canvas.">
  <button aria-label="Add Square">…</button>
</HoverCard>

<Tooltip label="Rectangle">
  <button aria-label="Rectangle">…</button>
</Tooltip>
```

`aria-label` continues to serve screen readers, and a tooltip says the same words.

## Labels

A shape can carry an inline **text label**.

- **Double-click a shape** to enter label-edit mode. The shape's centre becomes an editable input.
- With a single element selected, **press Space** for the same effect (keyboard equivalent of the double-click). Multi-selection Space falls through to the canvas pan modifier (see Move) since there's no obvious single label to edit; held Space + drag stays the pan modifier in every selection state.
- **Type-to-edit:** with a single label-bearing element selected (not yet editing), pressing any **printable character** (a letter, digit, or punctuation; Space is excluded so it stays the pan/edit modifier) opens the label editor seeded with that character, **replacing** the existing label. This intentionally wins over the single-key tool / add shortcuts (`R`/`O`/`D`/`T`/`N`/`A`/`I`/`F`, `S`/`P`/`L`) when an element is selected: a user who selects a shape and starts typing expects to edit its text, not to drop a new element. The shortcuts still fire when nothing (or a multi-selection) is selected. Read-only (view-role) sessions never type-to-edit, so viewers keep the tool shortcuts. Non-labelable selections (image, freehand) fall through to the shortcuts unchanged.
- Type to set or change the label.
- **Enter** inserts a newline (labels are multi-line). **Commit** by clicking outside / blurring, or with **Escape**.
- **Escape keeps what you typed.** Escape is how people finish typing on a canvas, so it commits and leaves, as a
  click away does, on every canvas text editor: shape, text and sticky labels, connector labels, table cells and
  entity fields (as a mind node already did, [Mind node](../009-elements/mind-node.md#escape-keeps-what-you-typed)).
  Undo takes the text back. An empty text box that hugs its text still goes, as on a click away. Inputs outside the
  canvas (the project title, tab renames, dialogs) keep Escape as cancel.
- The label's size is its **Text Size** ([Fonts](../004-interface-design/fonts.md#text-size)): an exact px, seeded from the tab's default size (Small on a new project), or **Scale**. At a px the label wraps at the shape's width and keeps its size, so a label longer than the shape has room for runs past its edges and is clipped there (a word too long for one line breaks between letters). **Scale** fits it instead: the text is rendered inside an SVG whose `viewBox` is set to the text's measured bounds, with `preserveAspectRatio="xMidYMid meet"`, so it scales uniformly to fill the shape: bigger shapes get bigger text, longer labels shrink to fit.
- During edit, selection handles and the popover are hidden so they don't get in the way.
- **Locked** shapes can still be labelled — locking protects position, not content.
- Empty labels are valid (nothing is rendered).
- Labels are **multi-line** for shapes, text, and sticky notes: Enter inserts a newline and the renderers (auto-fit SVG `tspan`s / wrapping div) lay the lines out.
- Label data lives on the element: `label?: string`.
- **Right-to-left text reads right to left.** Each line of a label takes its direction from its own first letter
  (`unicode-bidi: plaintext` on the label's text, `dir="auto"` on its editors), so Arabic or Hebrew keeps its
  closing punctuation at the end it belongs: "مرحبا بالعالم!" ends with "!" at its left, not stranded on the right as
  under the page's left-to-right default. A line in English beside it stays left to right. Alignment is unchanged
  (a label's Left, Centre and Right are where the user put them). This holds in shapes, text, sticky notes, tables,
  arrow labels and the inline line editors, and while editing. Exports do the same: an SVG `<text>` has one
  direction, so an exported line holding right-to-left letters is wrapped in a First Strong Isolate (U+2068 … U+2069,
  `svg-bidi.ts` in `@liveplanner/project`), and any other line is written exactly as before.

### Edit vs modes

## Locking

A shape can be **locked** to prevent accidental movement or resizing.

- Toggled from the **Lock button** in the selection popover.
- A locked shape:
  - Can still be **selected** (so the user can unlock it).
  - **Cannot be moved** — dragging the shape body does nothing.
  - **Cannot be resized** — the corner and edge resize handles **are hidden entirely** while locked, so they can't be grabbed.
  - **Cannot be deleted** — the popover's Delete button is disabled while locked, the keyboard Delete / Backspace skips it, and a multi-select Delete keeps locked members while removing the rest. The arrow cascade also leaves a locked arrow in place. Unlock first to delete.
  - Can still be **labelled** (double-click) — locking protects position and existence, not content.
  - Holds wherever the change comes from: a multi-selection (Select All included) dragged, resized or nudged with
    the arrow keys moves its other members and leaves a locked one where it is, a frame or lane carries none, and a
    typed size or rotation leaves it unchanged.
- A small **lock indicator** badge sits in the shape's top-left corner whenever it's locked, so the state is visible even when the shape is not selected.
- Locked state lives on the element: `locked?: boolean` (defaults to `false` / `undefined`).

## Move

- **Press-and-drag a shape** to move it.
- The press both selects the shape and starts the move in one gesture; on release, the shape stays at its new position.
- The shape follows the cursor delta from where the drag began. During the drag, **edge-alignment snap** nudges the candidate position so its left / centre-x / right edges line up with any other element's left / centre-x / right edges within `ALIGN_SNAP_THRESHOLD` (6 canvas px); same for top / centre-y / bottom on the Y axis. The smallest available delta on each axis wins; the elements being dragged are excluded as snap targets so a group drag doesn't snap to itself. See `snapToAlignment` in `packages/project` for the helper.
- **Equal-spacing (distribution) snap** runs alongside edge-alignment: when the dragged element would sit at an equal distance _between_ two neighbours, or one gap _beyond_ a pair that already share a gap (so three elements end up evenly spread), it snaps so the gaps are exactly equal — fixing the "close but never exact" spacing problem. Each axis only considers neighbours that overlap the dragged element on the perpendicular axis (a horizontal row for X-spacing, a vertical column for Y), and edge-alignment wins an axis when both fall in range. Spacing is also **consistent across axes**: when the dragged element sits directly below / above a neighbour (or beside it), the gap to that neighbour also snaps to the gap the neighbour already keeps with its nearest neighbour on the _other_ axis. So with two boxes side by side 100px apart, a third dragged under either one snaps 100px below it. Only the neighbour the dragged element faces lends its gaps (not every gap on the canvas), which keeps the snap predictable on a busy board. See `distributionSnap` in `packages/project`.
- Shapes can be placed anywhere on the canvas, including overlapping each other. No bounds.
- **Keyboard nudging** — with a selection (single or multi), the **arrow keys** move it by **1 px** per press, or **10 px** with **Shift** held. Boxed elements shift their `x`/`y`; free arrow endpoints shift their `from`/`to`; pinned arrow ends follow their anchored element and (when the `autoRebindArrows` preference is on, see [User preferences](../007-editor/user-preferences.md)) run the auto-rebind (`rebindArrowAnchorsAfterMove`, [Arrow anchors and auto-rebind](arrow-anchors.md)), exactly as a drag-move does. A run of nudges coalesces into a **single undo step**: the first press takes a history checkpoint, subsequent presses `tick` the present without pushing history, and the burst closes after a short idle. Suppressed while editing a label or with focus in a text input; view-role sessions don't nudge. Telemetry: `track('Element', 'Changed', 'Nudge')` once per burst.

## Resize

When a shape is selected, **four corner handles** (NW, NE, SW, SE) appear as small white squares with a brand-600 border, and **four edge handles** (N, E, S, W) as short bars on the edge midpoints. A multi-selection shows the four corner handles on its union box, no edge handles. Fixed-size elements show none, and a table shows no edge handles.

- **The handles are always on top.** Corner and edge handles (single and union), and the rest of a
  selection's grips, draw above every element on the board, whatever the selected element's place in
  the stacking order, its layer, rotation, opacity or animation, so no handle is ever hidden or
  unreachable behind another element. The element's own content stays where it is in the stacking
  order: only the handles rise.
- **Press-and-drag a handle** to resize the shape.
- The corner opposite a corner handle stays anchored; the dragged corner follows the cursor. An edge handle moves its own edge and, unconstrained, resizes that axis only.
- **Minimum size is 20×20** to keep shapes pickable. A constrained resize stops where the shorter side reaches 20, so the ratio survives; a side that began thinner than 20 (a straight pen stroke) never shrinks further under the constraint.
- Free-form by default; the element's **Lock Aspect Ratio** toggle ([Aspect ratio lock](#aspect-ratio-lock)) constrains the W:H ratio from every handle while a resize is in progress. Circles and diamonds are not locked by default: dragging one freely makes an ellipse or a rhombus, and Shift keeps it round. **Holding Shift during the drag** is the standard one-off constrain modifier (Figma / Photoshop convention): the active drag honours the shape's start ratio without flipping the persistent toggle. Locked shapes stay locked regardless of Shift; the modifier is additive, not a toggle.
- **Shift keeps the aspect ratio everywhere.** It is one rule, with no exceptions by element or tab: every resize of a boxed element (shapes, notes, text boxes, images, tables, freehand strokes, web components, every other boxed kind) and of a multi-selection (the union box scales uniformly, every member with it), on every tab kind, rotated or not, from every resize handle, keeps the width-to-height ratio the element or selection had when the drag began. Pressing or releasing Shift mid-drag takes effect on the next pointer move, without letting go. The anchored corner stays where it is, and snapping still applies, on the axis that leads the constrained size. The same Shift constrains **draw-to-size**, the other way a box is sized by a drag: a square box, a perfect circle, square or diamond.
- Constrained, a corner is led by the axis the pointer has moved further along (in canvas pixels) and an edge handle by its own axis; the other side follows from the ratio. An edge handle keeps the opposite edge where it is and grows the other axis evenly about its centre line.
- **Snap during resize** nudges the active edge to align with neighbour elements' edges / centres AND to match their width or height. Dimension-match means dragging a shape that's 215 px wide near another at 220 px snaps the width to exactly 220, so the user can size siblings to a shared width without pixel-fiddling. Edge-align and dimension-match compete on each axis; the smaller absolute delta wins (so a near-edge alignment beats a near-match dimension when both fall inside the threshold). Degenerate (zero-width / zero-height) elements are excluded as dimension targets. A constrained resize snaps its leading axis only and re-derives the other side from the ratio; a multi-selection resize and a rotated element's resize do not snap. See `snapResizeBounds`.

## Alignment guides

When a move or resize snap lands an element's edge or centre onto a neighbour's, the canvas draws a **faint guide line** along the shared edge / centre line so the user can see _why_ the element snapped where it did. This makes lining shapes up on a busy canvas much easier: the guide visibly connects the (dragged or being-drawn) element to the neighbour(s) it aligned with. The move / resize guides are derived in `useEditorDrag`; the draw-to-size guides are derived in `CanvasChrome` from the in-progress draw box (whose corners are already snapped) and rendered through the same overlay.

- **Derivation is post-snap and decoupled from the snap math.** After the snapped bounds are computed (move or single-element resize), `alignmentGuides` in `packages/project` re-scans the other elements and reports every candidate line (left / centre-x / right on the X axis, top / centre-y / bottom on the Y axis) that now coincides with a neighbour's line within a tight epsilon (0.5 px). Because it keys off the _already-snapped_ position, a guide only appears when there is a genuine alignment, i.e. exactly when a snap is in effect; free dragging away from everything shows nothing. The dragged elements are excluded as targets so a group drag never guides against itself.
- **One line per coincident axis-line.** A guide is vertical (constant x) when an X-axis line matches, horizontal (constant y) when a Y-axis line matches; more than one of each can show at once (e.g. left edges aligned with one neighbour and centres with another). Guides at the same axis + position are merged.
- **Each guide spans the elements it relates.** The line runs from the minimum to the maximum extent (on the perpendicular axis) across the dragged element plus every neighbour sharing that line, so it bridges the aligned shapes rather than crossing the whole canvas.
- **Theme-suitable + faint.** The guide colour contrasts with the tab's background (dark slate on light themes, light slate on dark themes, via `deriveTextColorForBg`) and renders as a thin, semi-transparent line, so it reads as helper chrome rather than content. It paints on the same fixed overlay layer as the marquee / draw-to-size previews, converting canvas coords to screen coords via the wrapper rect + zoom.
- Guides are transient: they live only for the duration of the drag and clear on release. Multi-element resize doesn't snap (see above), so it shows no guides.
- **Equal-spacing guides** accompany the distribution snap: the matched gap segments render as **pink, tick-capped lines** (distinct from the faint slate alignment lines) so the equal distances read at a glance. A cross-axis match draws both gaps: the new one on the axis being snapped and the neighbour's existing gap on the other axis, so the user sees which spacing it copied. They are reported by `distributionSnap` for the axis it drove (only when edge-alignment didn't already claim it), flow through the same per-drag rAF + value-equality bail-out as the alignment guides (`distGuides` / `sameDistGuides`), respect the same `alignmentGuides` opt-out, and clear on release.
- **while Alt is held**, a drag of a NOTE can instead resolve an **insertion slot** — the gap between two notes, which the board opens live to make room. Without the modifier nothing of the sort happens, on any board; and the same Alt gesture is offered for a note ALREADY on the board, which resolves its slot in the element drag machine rather than here. While a slot is on offer the alignment snap **yields** to it: the slot publishes the drop point through the same one snap channel, and two placement rules bidding for one drop point is how a preview starts lying. The insertion marker is drawn as an ordinary vertical guide line, spanning the board rather than the aligned pair, because the whole board is what splits there.
- **Opt-out.** The guides are gated on the `alignmentGuides` user preference (defaults to on; see [User preferences](../007-editor/user-preferences.md)), toggled from the Settings dialog's Canvas group. Turning it off suppresses the guide lines only; the snap itself is unchanged. The flag is read through a ref during the drag so flipping it takes effect on the next pointer move.
- **Performance.** Guides are recomputed every pointer move, but the state update is coalesced into a single `requestAnimationFrame` (off the synchronous move/`tick` path) and only lands when the guide set actually changes (`sameGuides` / `sameDistGuides` bail-out), so the dominant no-snap frames cost nothing beyond the move itself.

## Adding elements

There is no palette, so nothing arms a tap-to-drop or drag-to-draw gesture: no intent, no mode banner, no
draw-over-an-element intercept. See [Placement on add](#placement-on-add) for what Plan places and where.

## Freehand elements

A `FreehandElement` (see [Project structure](../006-project/project-structure.md)) is a stroke of points rendered as an inline SVG path inside its bounding box. Templates, imports and the MCP make them too, and their points are stored packed ([Stroke points](../006-project/stroke-points.md)).

- Stroke colour follows the tab's theme (`elementStroke`) so a freehand stroke reads as part of the diagram, not as an annotation layer. Closed strokes fill with the theme's `elementFill`. Both colours are overridable per element via the Colours accordion, same as any other boxed element.
- The element is a regular boxed element: drag to move, resize handles, lock / format-paint / themes / comments all apply. Points are stored normalised within the bounding box so resize scales the stroke proportionally.

## Out of scope (next iterations)

Items still genuinely out of scope today (most of the original list has shipped — see the Editor section above):

- **Free-angle rotation** — the 45-degree presets ship (see the rotation section above); an arbitrary angle does not.

## Clipboard

`⌘C` puts the selection on the **OS clipboard**, serialised (`apps/editor/lib/clipboard-payload.ts`); `⌘V` reads it back, re-mints it through `duplicateElements` so ids are remapped and pinned arrows re-wired, and drops the copies 24px offset on the active tab. **A paste lands where the person is looking**: when the copies' usual spot would put their centre outside the view (copied on one tab and pasted on another, or copied on the first slide of a deck and pasted while on the twelfth), they land centred in the middle of the view instead, on whole pixels (`pasteTranslation` in `apps/editor/lib/paste-placement.ts`). A paste at the pointer is unaffected. `⌘X` is the same copy followed by a delete. So a selection crosses a browser tab, a second window, and a reload — copy from one project, paste into another.

It was in-app only before: the snapshot lived in React state and the system
clipboard got a sentinel string, written purely to displace a lingering image
that would otherwise shadow every later element paste. That works inside one
editor instance and nowhere else, which is not where "copy this and put it in
that project" happens.

**The payload** is a JSON envelope mirroring the tab export's — a
`liveplanner.elements` `kind` discriminator so we never try to paste another
app's JSON, and a numeric `schemaVersion` so a future break is refused rather
than pasted as nonsense. Text, not a custom MIME type: `writeText` is the one
clipboard write that works from a keydown handler in every browser we support.

**Reading is defensive**, because this is the only place the editor parses a
string it did not write, on every `⌘V`. `parseElementsPayload` never throws and
returns null for anything that isn't ours; it caps bytes before parsing and
element count after (a payload past either cap is refused whole, never pasted
in part), runs every element through `isValidElement` (dropping failures
individually rather than refusing the whole paste), and de-duplicates ids.

**A copy too large for the system clipboard stays in its window.** A selection
past either cap (`MAX_CLIPBOARD_ELEMENTS`, `MAX_CLIPBOARD_BYTES`) would paste cut
short, dropping elements and leaving arrows without ends, so it is never
written. The clipboard gets a small marker naming the copy instead
(`clipboardWriteFor`), and the copy says so: "Copied N elements: too many for
the clipboard, so paste in this window." In that
window a paste of the marker lands the whole in-app buffer, every element and
arrow (a cut of it too, since the buffer is filled before the delete). In
another window the marker pastes nothing and says: "That copy was too big to
leave its window. Paste it there, or copy less." The
marker still displaces a stale image, and anything copied after it replaces it
as usual.

**Identity does not travel.** `commentThread`, `responses` ([Per-participant responses](../012-collaboration/participant-responses.md)) and an
assigned `action` ([Assigned actions](../012-collaboration/assigned-actions.md)) are stripped on the way out, on the OS clipboard and
the in-app buffer alike: a thread is a conversation about the original element,
a vote is cast in a session, and an action is work handed to a person, so
re-attaching any of them to a copy misrepresents it — and a copy can cross
accounts.

**Two sources compete on paste, in order:** our own serialised elements, then
the in-app buffer (an image on the system clipboard is ignored: liveplanner
takes no image uploads). The buffer is kept as a fallback
rather than deleted because clipboard writes are best-effort — `writeText`
rejects when the project isn't focused or permission is denied — and a copy
that silently did nothing is worse than one that still pastes in this window.
Whether that write **landed** is remembered, and it settles the ambiguous case:
foreign text on the clipboard after a successful write means the user copied
something else afterwards, so the stale buffer must NOT paste; after a refused
write, the buffer is the only record of the copy and still does.

**Copied elements pasted into a label being typed in land on the canvas.** Every
label editor pastes plain text, and our payload IS plain text, so without a rule
the JSON envelope would be typed into the element. While a label on the canvas
is open for typing, a capture-phase listener in `useClipboard` recognises the
envelope before the editor sees the paste: typing ends and the elements paste
exactly as if no label were open. Ordinary text still pastes into the label, and
a text field outside the canvas is left alone.

**A middle-click never pastes on the canvas.** Linux browsers paste the primary
selection when the middle button is released, as a `paste` event that looks
exactly like `⌘V`. On the canvas that button pans, so the paste would drop the
in-app buffer (or selected element JSON) at the end of a pan. `useClipboard`
ignores any paste fired in the same task as a middle-button `pointerup`
(`../packages/workbench/src/lib/primary-selection-paste.ts`), for the canvas and label handlers
alike; a text field still takes its primary-selection paste from the browser.

Pasting foreign text as a text element is the obvious next step and is
deliberately not built: it needs the viewport centre in canvas coordinates,
which lives in `Canvas` rather than in the clipboard hook.

## Retired features

What liveplanner does not carry, and how data that names it reads.

**Isometric.** liveplanner has no isometric view and no Isometric background pattern: every image export is flat and top-down,
and the shared `BackgroundPattern` (`@liveworkspace/model-core/basics`, also the api's OpenAPI enum) does not list
`isometric`. `packages/project/src/retired-patterns.ts` names the value (`RETIRED_PATTERNS`, `isometric` to
`crosshatch`) and binds it with the generic `bindRetiredPatterns` (`@liveworkspace/model-core/retired-patterns`),
which knows no pattern by name, so the product's `isBackgroundPattern` refuses it.

- **A tab stored wearing Isometric opens in Crosshatch.** It moves onto Crosshatch on read (`migrateRetiredPattern`,
  run by `migrateStoredTab` and so by every stored and incoming tab), its pattern colour, opacity and size kept, with
  a `[tab-migrate] retired-pattern` log. Crosshatch is the nearest pattern: a lattice of diagonal lines in the same
  colour, so the tab keeps the look of line paper rather than turning to dots. The next save writes Crosshatch. A
  pattern that reached the canvas without that read would draw as the default dot grid, as any unknown pattern does.
- The **Studio** look wears Crosshatch.
