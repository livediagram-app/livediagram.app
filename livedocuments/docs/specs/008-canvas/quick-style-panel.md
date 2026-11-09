# Quick Style bar

While one or more shapes, arrows and / or text elements are selected, a small toolbar beside the
page's title bar offers the handful of style choices people reach for most: stroke colour, fill,
text colour (for text elements), stroke width, stroke style, text alignment and icon alignment. Each
is one button that opens a popover with its choices. What you choose there (or in the context menu)
is remembered for the next shape of the same kind you draw.

(It was a floating panel on the canvas's right edge, the Quick style panel. The file keeps its name
so links to it still work.)

## Why

Styling a shape through the context menu is complete but slow: right-click, open a category, find
the row, pick, close. For the five or six choices made on almost every diagram, that round trip is
most of the work. A surface that is already open when something is selected turns each of them into
one click.

The second half is memory. A diagram usually has a notation: decisions are amber diamonds, services
are blue boxes, async calls are dashed arrows. Today every new shape arrives in the theme default and
has to be restyled by hand, the same way, every time. Remembering the last style per kind lets the
notation carry itself.

## What it is not

There is no right-hand **Editor panel** holding every per-element setting: it would duplicate the
context menu, grow with every feature, and cover the canvas it is meant to serve. Per-element
formatting lives in the right-click context menus ([Editor app](../007-editor/editor-app.md),
[Canvas and palette](canvas-and-palette.md)).

The Quick Style bar is deliberately not that panel coming back:

- **The context menu stays the complete home of every setting.** Everything the bar offers is also
  in the menu. The bar never gets a setting the menu does not have.
- **The bar holds only the most-used choices, in their most-used values.** A row offers three
  options (seven for colours), not the full set; the rest stay one right-click away.
- **A new row must earn its place** by being among the most-used style choices across kinds, and
  must fit the row rhythm below. A setting that is used on one kind, or rarely, belongs in the menu.

The boundary keeps the bar to a handful of buttons, small enough to sit beside the title bar
whenever something is selected.

## Where it sits

The bar is **its own toolbar card, just left of the page's title bar** (the Style, Layout, Background,
Notes, lock and cog card above the page's top-right corner, [Pages mode](../007-editor/pages-mode.md)
"Beside the cog"), on one line with it and a 6 px gap between the two. It wears the title bar's
card and button look (`PageTitleBar`), held at one screen size whatever the zoom, so the two read as
one row of page chrome: what the selection looks like, then what the page looks like.

- **On the selection's page.** It sits on the page under the centre of most of the styled elements;
  a selection off every page puts it on the nearest page. Only one page shows it at a time.
- **One button per row**, in the row order below, each shown only while its row applies to the
  selection (a text element alone shows Text and nothing else). Short names: **Stroke**, **Fill**,
  **Text**, **Width**, **Line**, **Align** and **Icon**.
- **Each button shows its value**: a colour button draws the colour in force as a small chip (the
  no-colour chip for a transparent fill, a split chip when the selection disagrees); the others draw
  the glyph of the option in force (the line weight, the dash, the alignment), or their first option's
  glyph, muted, when mixed.
- **Named while the title bar is.** The bar names its buttons beside their icons exactly when the
  title bar does (a desktop with the page wide enough on screen), and drops to icons when it does, so
  the row never mixes named and bare buttons.
- **A popover per button**, anchored under it: the row's own choices as the panel had them (the
  colour rows' seven swatches, Ink or Transparent, and More colours; the three glyph options), with
  the row's full name as its heading ("Stroke colour", "Fill", "Text colour", "Stroke width",
  "Stroke style", "Text alignment", "Icon alignment"). A pick applies at once and the popover stays
  open for another; an outside press, Escape or the button closes it, and Escape returns focus to
  the button. One popover at a time.
- **The page's label makes room.** The label above the page's top-left corner truncates to what the
  title bar and the bar leave it, and hides under 40 px, as it does for the title bar alone.
- It never moves while you work: the bar follows its page through a pan or a zoom, and only changes
  page with the selection.
- **No Clear Styles button** (see "No Clear Styles").

- **On a phone, in Appearance.** A phone's title bar holds three buttons at most, so there is no bar:
  the selection's rows join the page's **Appearance** sheet instead ([Pages mode](../007-editor/pages-mode.md)
  "On a phone, three buttons at most"), under a hairline and a **Selected Element** heading after the page's own
  rows. Each row is its button: its short name, a line saying what it changes, and its value as its icon. A press
  closes Appearance and opens the row's choices in a bottom sheet named by the row's full name ("Stroke width"),
  the same row the desktop popover holds; a pick applies and the sheet stays for another, a swipe down or an outside
  press closes it. The long-press menu still has every choice too.
- **It stands down** while an element or multi-selection context menu is open (two style surfaces at
  once repeat each other), in split view, in zen mode, in embeds, while presenting, and when edits
  are blocked (a view-only visitor, a locked page or tab). A popover open on it closes as it goes.

### Turning it off

**Settings › Panels › Quick Style › Enable Quick Style Bar** (`quickStylePanelEnabled`, its stored
name kept, [User preferences](../007-editor/user-preferences.md)) stops the bar appearing. Style memory keeps
working from the context menu.

## Sections

Left to right on the bar, each a button whose popover holds one row of options (the spec calls
each a section, the bar a button):

| Section (button)       | Applies to                                            | Options                            |
| ---------------------- | ----------------------------------------------------- | ---------------------------------- |
| Stroke (Stroke)        | Shapes + arrows                                       | 7 colours, then Ink                |
| Background (Fill)      | Shapes                                                | 7 colours, then Transparent        |
| Text colour (Text)     | Text elements                                         | 7 colours, then Ink                |
| Stroke width (Width)   | Shapes + arrows                                       | Thin / Medium / Thick              |
| Stroke style (Line)    | Shapes                                                | Solid / Dashed / Dotted            |
|                        | Arrows                                                | Solid / Dashed / Flowing           |
| Text alignment (Align) | Shapes with a label it moves (`supportsQuickSection`) | Left / Centre / Right (horizontal) |
| Icon alignment (Icon)  | Shapes with icon                                      | Before / Above / After the label   |

The Background row's button is **Fill** on the bar: the page's own **Background** sits a few
buttons along, and two buttons of one name would read as one.

**Transparent** ends the Background row, after its seven colours: the shared no-colour chip (white
crossed by a diagonal), named "Transparent". A press clears the shape's fill to `transparent`
(and its theme binding and colour preset), so what is behind it shows through; it is marked when
every selected shape's fill is transparent. It has no colour to edit, so a right-click on it
opens nothing.

- **Flowing** is a dashed line with the marching-dashes flow animation (`strokeStyle: 'dashed'`,
  `flow: 'dashes'`). So the plain arrow and the animated dashed arrow are each one click, the two
  arrow looks people build most. Solid and Dashed clear any flow.
- **Icon alignment** shows only when a selected shape carries an inline icon. Before / Above / After
  map to `iconPosition` left / above / right. "Below" stays in the context menu: it is the rarest
  arrangement, and a fourth option would break the row rhythm.
- **Text alignment** is the horizontal axis only. Vertical alignment is the less-used half and stays
  in the menu's 3×3 grid. It shows only where it moves something: not on self-drawing kinds (no
  label) and not on kinds with their own face, whose label is a fixed
  title, and not on icons or stickers (a glyph, at most a short caption). The bar's gate is `supportsQuickSection(el, 'textAlign')` (`apps/editor/lib/quick-style.ts`); the
  context menu's Text Alignment section follows the same rule (no self-drawing kind, words to align). The bar also waits for words:
  a shape whose label is empty (or only whitespace) shows no Text alignment row, since there is
  nothing to align yet, and the row appears as soon as the shape is given text.
- **Text colour** is the colour row a text element gets. A text element is its words, with no
  border or fill, so its colour is the one choice it has in common with the other rows, and without
  it a text element was the one kind the bar could not dress. The row is for text elements only:
  a shape's label colour travels with its background (see Style memory) and stays in the context
  menu, and offering both would put two rows of colour on every shape.
- A section shows when at least one selected element supports it (a background for a shape that has
  one, a border for a shape that draws one, a label slot for alignment, text colour for a text
  element). Sticky notes, tables, images and the other non-shape elements are not styled by the
  bar; a selection holding only those shows no bar, and a selection mixing them with styled
  elements styles the rest (see Multi-selection).

### Option counts and rhythm

Colours offer seven; every other row offers three. So every popover is one of two sizes (a colour
row, a row of three) rather than an irregular 3-4-5-3-4 set the eye has to re-measure each time.
Three is the natural size of each row:

- **Width** drops "none" (removing the border is a different decision from how heavy it is) and
  "extra thick" (rare).
- **Style** drops the niche dash variants (dash-dot, long dash, dash-dot-dot).
- **Horizontal text alignment** is naturally three.
- **Icon alignment** drops "below", the rarest arrangement; a lone row of four would break the rhythm.

A future row may use four or five options only in pairs of equal length.

## Colours

The seven colours are **theme-relative**:

- **First, the theme default**: the colour the theme gives a new shape (or the unpainted ink, on the
  Default scheme, which paints nothing). Picking it writes the theme's own value, exactly like the
  context menu's reset to theme.
- **Then six from the theme's own palette.** A multi-colour theme has six branch colours, and they are
  used as they are: branch strokes for the Stroke row, the matching branch fills for Background. A
  single-accent theme has one hue, so it is spun into six: red, orange, yellow, green, blue and violet,
  each in the accent's own saturation and lightness (clamped so a grey accent still yields colour and
  a near-black one still yields visible strokes). That keeps every row genuinely on-theme (a Sand
  diagram's green is a muted green) while still offering six distinct colours, and it puts the six in
  the same order a multi-colour palette runs, so slot 4 means green everywhere.
- **Then Ink**, on the Stroke and Text colour rows only, the eighth swatch: the same drawing colour on every theme,
  stored by name (`ink`) and drawn in its version for the canvas, named "Ink" (its accessible name
  and tooltip). It is not a theme colour, so it takes no custom colour in its place, and a fill
  has none. Ink is marked when every styled element stores it.
- **Text colours are readable on the canvas.** The Text colour row's first swatch is the theme's
  label colour. Its six are the same hues as the Stroke row (the palette's branch strokes, or the
  six toned hues), each stepped darker (or lighter, on dark paper) until it reads at 4.5:1 against
  the canvas: text is read, not just seen, so it gets the text contrast rather than the 3:1 a
  stroke needs.
- **Backgrounds keep labels readable.** A derived background is a wash of its hue (over white on
  light paper, over the theme's fill on dark paper), thinned until the theme's label colour reads at
  4.5:1 on it. A derived stroke is stepped darker (or lighter, on dark paper) until it reads at 3:1
  against the canvas.
- **Colours follow the theme**, the way [Style presets](../010-palette/style-presets.md) do. Picking
  one of the six stores its **slot** beside the colour (`strokeSwatch` / `fillSwatch` /
  `textSwatch`, 1 to 6). A
  theme change re-derives a bound colour from the new theme's same slot, so a shape on "green" stays
  green in the new theme's tone. Arrows, which otherwise always snap back to the theme stroke on a
  theme change, keep a bound colour the same way. The binding is dropped the moment the colour is set
  any other way (the context menu's pickers, a preset, reset to theme), because the slot no longer
  describes it.
- **Then More colours**, every colour row's last target: a swatch button opening the full colour
  picker ([Colour picker](../004-interface-design/colour-picker.md#quick-style)) with the row's own
  colours as its Theme Palette, the standard colours (strong on Stroke and Text colour, by name; soft
  on Background), the document's Custom colours and **Add a custom colour** (four coloured dots). A pick there styles the selection like any
  hand-picked colour: it binds no slot.
- Every swatch is named by a colour word ("Theme default", "Green", "Deep orange"), never a hex, for
  its tooltip and its accessible name.

## Custom swatches

A theme's six colours are a good start and never the whole story: a brand colour, a status colour
a team already uses, the exact blue of last quarter's deck. Any of the six can be replaced with a
colour of your own.

- **Right-click a swatch** (slots 1 to 6, in any colour row) to open a small popover: the custom
  colour editor ([Colour picker](../004-interface-design/colour-picker.md#picking-a-colour-of-your-own))
  and **Clear override**. **Use** (or Enter in its hex field) saves the colour **into that swatch** and
  closes the popover,
  replacing that slot's theme colour; the swatch is then used like any other. The popover styles
  nothing by itself: choosing the swatch (a left click) is what applies it, so editing the palette
  and styling the selection stay two separate acts.
- **Clear override** puts the slot's theme colour back. Elements already painted with the custom
  colour keep it; the override only ever changed what the swatch offers.
- **Keyboard**: on a focused swatch, **Shift+F10** or the **context-menu key** opens the same
  popover, focus moves into it, and Escape closes it and returns focus to the swatch. (Touch
  long-press does the same where the browser raises a context menu for it.)
- **Slot 0, the theme default, cannot be overridden.** It is the one-click way back to the theme;
  replacing it would remove that.
- **An overridden swatch is marked**: a small dot in its corner, drawn to contrast with the colour
  underneath. It is **named accurately** for assistive technology and in its tooltip:
  "Custom orange, in place of Green", the custom colour's hue word first, then the theme colour
  it replaces.
- **A custom colour does not follow the theme.** It is yours, so picking it writes the colour
  itself and binds no slot; a theme change leaves it where it is, like any hand-picked colour.
  The slot's theme colour comes back only through Clear override.
- **Style memory** remembers a custom colour like any other colour.

### Where overrides live

An override is **yours, synced, and keyed by theme**: it means "in this theme, this slot is this
colour". It is kept in the synced user preferences ([User preferences](../007-editor/user-preferences.md))
and travels the same way as every synced preference: to your account when signed in, to your guest
identity otherwise, and into this browser's cache either way.

- **Keyed by theme, because the slots are.** Each theme derives its own six colours, so "slot 4" is
  a different colour in Forest than in Ocean. An override is recorded against the theme it was made
  in, and switching theme shows that theme's own slots with whatever overrides you set for it,
  and none from other themes.
- **Per user, not per document.** A palette you build is a working habit that follows you between
  documents and devices. Colours a document should share with everyone who
  opens it come from its [theme](../011-theme/README.md). Keeping overrides per document and per user
  would fragment them further, so the same person would rebuild the same palette in every document.
- **Multi-colour themes** work the same way: their six slots are the branch colours, and an
  override replaces one of them in the bar only. The theme's branch colouring of the diagram is
  untouched.
- **Clear override** removes the entry for that slot in that theme; the swatch shows the colour
  the theme derives for the slot again, and a theme left with no overrides is removed from the
  store. Elements already painted with the custom colour keep it.
- **Limits**, because the whole preferences blob shares the api's 4 KB cap: at most 18 overrides
  per theme (six slots in each of the three colour rows, by construction), at most 8 themes, and at most
  800 bytes in all. Past either limit, the theme edited least recently is dropped first. Colours
  are validated as hex (`#rgb` or `#rrggbb`, stored as lower-case `#rrggbb`); anything else, a slot
  outside 1 to 6, or a theme id over 64 characters is dropped when read, never failing the rest.
- **The Default scheme** is one theme with a light and a dark half; an override set on it applies
  in both appearances.

## Multi-selection

The bar styles every selected shape, arrow, polygon and text element at once, including mixed
kinds: select three arrows, two rectangles and a circle, press green, and all six turn green. Add a
text element to that selection and a Text colour row appears beside the others, styling only it.

**Any mix works.** A selection may hold every kind at once (a whole pasted page:
shapes, lines, arrows, polygons, text boxes, stickies, images, stacks). Each row
styles the selected elements it is meaningful for and leaves the rest exactly as they are; the
elements no row fits (stickies, images, tables and the other non-shape kinds) are passed
over, never refused, so they never hide the bar from the rest.

- A section shows when **at least one** selected element supports it, and a choice applies only to
  the elements that do.
- An option is **highlighted** when every supporting element has that value. When they disagree,
  nothing is highlighted: a mixed row claiming one value would be a lie.
- **A colour stored by name** matches no theme swatch, so it marks none; choosing a swatch replaces
  the name with the swatch's colour. It is drawn in its version for the canvas.
- **Stroke style on a mixed selection** of shapes and arrows offers the shape row (Solid / Dashed /
  Dotted): each of those means something for both kinds (arrows draw dotted lines too), whereas
  Flowing means nothing for a shape. Flowing is offered when every style-supporting element is an
  arrow.
- **One undo step** per choice, however many elements it touched.
- Locked elements are left alone; a selection of only locked elements shows no bar.

## Style memory

Changing a quick-style field, through the bar **or** the context menu, remembers it for the next
element of the same kind you draw.

- **Per kind.** Colours, width, style, text alignment and icon alignment are remembered per element
  kind: a circle's carry to the next circle, not to a square. A diagram's notation is per kind (a
  diamond is a decision, a cylinder a store), so remembering across kinds would restyle shapes that
  mean something else. One rule for every field is also the one people can predict.
- **Arrows separately.** Arrows have their own memory, one bucket for all arrows: an arrow has no
  kinds.
- **Text elements separately.** Text elements have one bucket too, holding their text colour.
- **Field by field.** Each field is remembered on its own, as the last value chosen for it on that
  kind. Choosing a background never carries a width you did not choose.
- **The label colour travels with the background.** A context-menu preset can pair a dark background
  with a white label; carrying the background without its label would land unreadable text on the
  next shape. So the label colour is remembered too, and a preset's binding with it, so a remembered
  preset look follows the theme like the preset does.
- **Theme defaults are not memories.** Setting a field back to the theme default forgets it, so a
  remembered "default" never pins one theme's colour onto a tab with another.
- **User-drawn elements only**: a shape or text element placed from the palette (tap, drag-to-size, drag and drop), an
  arrow drawn with the arrow tool, by click-to-connect, from a
  quick-connect plus, or chained with Shift. Paste, duplicate (including quick-connect Duplicate and
  Shift-drag), a forked arrow branch (it takes its trunk's look), templates, import, the MCP server
  and AI never read memory: they carry styles of their own, and applying memory to them would
  silently restyle content the user did not draw.
- **Per document, on this device.** Memory is kept in the browser (`localStorage`), keyed by document. It
  is not synced, not in the document, and not part of [User preferences](../007-editor/user-preferences.md):
  it is a working habit for one document's notation, like the panel placements are a habit for one screen.

## No Clear Styles

livedocuments has no Clear Styles (owner, 2026-11-09: none on the bar; the element menu retired it on 2026-11-04,
[Element menu quick bar](element-menu-quick-bar.md)). Picking the theme's own choice in a row (its first colour,
Medium, Solid) puts that style back, and the next shape of the kind looks plain again (a theme colour is forgotten,
"Theme defaults are not memories").

## Accessibility

WCAG 2.2 AA.

- The bar is a `toolbar` named "Quick Style"; each button is named by its short name ("Fill"), has a
  Tooltip with the same name, says it opens a dialog (`aria-haspopup`, `aria-expanded`) and is
  28 px tall. Its popover is a dialog named by the row's full name ("Fill colour" reads as "Fill"),
  focus moving into its row as it opens.

- A row of glyph options (width, style, alignment) is a **radio group** named by its
  section title; each option is a radio with its own accessible name. The arrow keys move between
  options and choose, per the radio-group pattern; Tab moves between rows.
- A **colour row** follows the colour picker's keyboard
  ([Colour picker](../004-interface-design/colour-picker.md#keyboard)): a group named by its section
  title, each swatch a toggle button (`aria-pressed`), one Tab stop, the arrow keys move focus
  (wrapping, More colours included) without choosing, and Enter or Space picks.
- Every icon-only option has an accessible name and a **Tooltip** that repeats it (the name after a
  500 ms hover, at once on keyboard focus, see
  [Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md)).
- Focus is always visible. Every option is a target of at least 24 × 24 px, including the
  compact swatches whose colour draws smaller inside it.
- An overridden swatch says so in its name and tooltip ("Custom orange, in place of Green"), not
  only through its marker. Its popover is a labelled dialog ("Custom colour for Green, Stroke"),
  reached by right-click, Shift+F10 or the context-menu key, and Escape returns focus to the swatch.
- **Section titles are separate from the names**: a row's accessible name does not depend on its
  visible title.
- **Each popover shows its row's title** above it, naming what it changes.
- **Scrolling is in-theme**: when the docked body scrolls, its scrollbar is the app's slim themed
  one (`scrollbar-slim`), light and dark, not the operating system's.
- **No layout shift.** Showing or hiding the bar moves nothing on the canvas; only the page's label
  truncates to make room.
- **Reduced motion**: the bar and its popovers fade in within the `micro` budget
  ([Motion](../004-interface-design/motion.md)), and not at all under reduce motion.
- **Dark and light** both render correctly. The light look of every existing surface is unchanged.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md), each bar choice emits
`Element·Changed` with its own token, distinct from the context menu's, so bar use can be read
against menu use: `QuickStroke`,
`QuickBackground`, `QuickTextColour`, `QuickStrokeWidth`, `QuickStrokeStyle`, `QuickTextAlign`, and `QuickIconAlign` (`QuickCorners` and `QuickClearStyles` are retired with their controls). Editing the palette is a setting, not a style change: `UI·Changed·QuickSwatchCustom`
when a swatch is overridden, `UI·Changed·QuickSwatchReset` when an override is cleared, both
counted as Custom Swatches in the dashboard's Look & Feel stack.

## Out of scope

- **Icon pinned to an edge.** A mode where the icon hugs the shape's left, top or right edge while the
  text aligns independently is attractive for cards. It needs an inscribed box per curved and slanted
  outline (circle, diamond, hexagon, cloud) so the icon stays inside the silhouette, which is real
  geometry work per kind. Today the icon and label form one group that text alignment moves together
  (`shape-inline-icon-layout.tsx`); pinning waits until that geometry exists.
- **A selection off every page with no pages on the tab.** Every tab has a page, so there is always
  one to sit on.
- **Styling other non-shape elements** (stickies, tables). They have their own looks and their own menus.
- **A shape's label colour.** It stays in the context menu's Colours category (see Text colour above).

## Help

[Quick Style Bar](/help/canvas/quick-style-panel/) (Canvas).
