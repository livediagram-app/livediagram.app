# Colour picker

Status: shipped

## What

Every place in the apps where you choose a colour uses **one colour picker**. It looks the same, offers the
same colours, lets you pick a colour of your own, and works the same with a mouse, a finger and a keyboard,
whether it sits in a context menu, a toolbar flyout, a dialog or a Plan card.

Surfaces may **reskin** it (where it opens, whether it has a field-sized trigger, which extra options lead
it), but never re-implement it: there is one swatch, one layout, one keyboard model and one custom colour
editor.

### The rule for new work

Any new feature that lets someone choose a colour **uses this picker**, through one of its skins (inline, row,
field, swatch button). It never builds its own swatch grid, its own custom colour editor, or a system colour
well (`<input type="color">`). If no skin fits, add a skin here, in `apps/live/components/colour/`, and to the
Skins table, rather than a picker in the feature. Offering different colours is a change to this spec (a
leading option, a tone), not a separate palette. A test (`components/colour/one-picker.test.ts`) fails the
build on a system colour well or a custom colour editor used outside the picker.

## Why

The editor grew about twenty colour pickers, one per feature. They offered different colours (five copies of
the same Tailwind set, a pastel set, a laser set, the theme's ramps), drew swatches at five sizes and four
selection styles, showed "no colour" five different ways, and let you pick a colour of your own in some
places but not others (a bare system colour well, an in-app editor, or nothing at all). Moving between them
felt inconsistent and janky.

## The colours

A picker shows up to three groups, always in this order, each under a small heading:

1. **Theme Palette**, in every picker in the editor, whatever the mode or surface (an element, a Plan card, card type
   or column, a Draw marker, a page background, an article, the laser): the active tab's theme colours, as the
   theme derives them ([Canvas and palette](../008-canvas/canvas-and-palette.md#colours)), each named by a
   colour word, never two alike ("Blue", "Light blue", "Deep blue"). A Quick Style row's More colours shows the
   row's own colours here instead ([Quick Style Panel](../008-canvas/quick-style-panel.md#colours)). Outside
   the editor (the Explorer's theme builder) there is no active tab, so no group.
2. **Standard Colours**: the **standard colours**, the same ten everywhere, in this order:

   | Strong tone | Soft tone |
   | ----------- | --------- |
   | Ink         | White     |
   | Grey        | Grey      |
   | Red         | Red       |
   | Orange      | Orange    |
   | Yellow      | Yellow    |
   | Green       | Green     |
   | Teal        | Teal      |
   | Blue        | Blue      |
   | Violet      | Violet    |
   | Pink        | Pink      |
   - The **strong tone** is for lines, text, markers, accents, card types, columns, the laser and chart
     slices. It is the marker stock set ([Draw mode](../023-draw-mode/draw-mode.md#the-colour-picker)) plus
     Grey: each colour is tuned for the surface it is drawn on, darker on light paper and lighter on dark, so
     it is at least 4.5:1 on that surface.
   - The **soft tone** is for backgrounds, fills and highlights: the same hues as washes, pale on light paper
     and deep on dark, with White in Ink's place.
   - A surface that offers free colours shows a soft row headed "Light", then a strong row headed "Dark": an
     Illustrate page's background, the canvas colour and the custom theme builder.

3. **Custom Colours**: the colours picked with **Add a custom colour** in this document, newest first, at most twelve, then **Add a custom colour** (four coloured dots).

**Leading options** go first in the first group: **no colour** where a surface can have none (No ... colour,
None, No colour, Default colour, No highlight, Paper), and the surface's own named defaults (the article's
Accent, the article style's Theme, the laser's Your colour).

## Custom colours

Custom colours are **the colours someone picked with +** in this document. Pressing **Use** in the custom
colour editor keeps the colour with the tab it was picked on (newest first, at most twelve a tab), so:

- It appears in Custom Colours in every picker of the document, for every collaborator, as soon as it is
  picked, the current tab's first, then the other tabs' in tab order.
- Nothing else adds to them. A template's or a theme's colours written onto elements, a Plan column's colour,
  a colour pasted in: none is anyone's pick, so none shows here. A colour picked again moves to the front.
- They are kept, not derived: a colour stays a custom colour after the element that used it is gone. Picking
  more pushes the oldest off the end.
- Recording one is not a step of its own: the pick it applies is the undoable edit.
- A colour already offered (the Theme Palette's, a standard colour) is not shown again as a custom colour.
- The custom colour in force always shows, as the first of Custom Colours, picked, even when no one picked it
  with **Add a custom colour** (an older Plan colour, a page's earlier preset, a template's colour).
- While a picker is open, Custom Colours hold their order. Hovering a swatch previews it on the document, which
  must not slide the swatches under the pointer, so a colour already shown keeps its place and only a colour
  new to the list, such as one just picked with **Add a custom colour**, joins at the front. The order is worked out afresh each
  time the picker opens.

The per-user `customSwatches` and `whiteboardYourColours` lists are retired
([User preferences](../007-editor/user-preferences.md)): nothing reads or writes them. Quick Style's per-theme
slot overrides are unchanged: they replace a theme colour, they are not Custom colours.

## Picking a colour of your own

Every picker ends Custom colours with **Add a custom colour** (four coloured dots). It opens the **custom colour editor** in place, under the
swatches: a saturation and brightness square, a hue slider, a hex field, an eyedropper where the browser has
one, and **Use**. Use (or Enter in the hex field) applies the colour and keeps it as a custom colour.

- Where a line or text has to read on both appearances (a marker, the element menu's line and text rows),
  the editor warns when a colour is under 3:1 on either and offers a readable version beside the warning
  ([Draw mode](../023-draw-mode/draw-mode.md#the-colour-picker)). Elsewhere it does not.
- Quick Style's custom swatch popover holds the same editor
  ([Quick Style Panel](../008-canvas/quick-style-panel.md#custom-swatches)).
- There is **no system colour well** anywhere in the editor; the custom colour editor is the only one.

## What a picker stores

The picker changes how a colour is chosen, not the shape of what is saved, so every existing document looks
exactly as it did:

- On the canvas, a strong standard colour on a line or text is stored **by name** (`penColour`,
  `penTextColour`), as Ink and the marker colours already are, and drawn in its version for the canvas. An
  element with no name field (a table, a note's border) stores the colour's light-paper hex. A fill stores
  its `#rrggbb`; a theme colour stores what it stored before.
- The laser stores a standard colour by name, Your colour as `presence`, or a custom `#rrggbb`.
- Off the canvas (Plan, Illustrate pages, articles, charts, themes), a standard colour stores its
  `#rrggbb` for light paper. A Plan card type and a card's own Colour accept any `#rrggbb`.

## How it looks

- **One swatch**: a 24px target holding a 20px rounded square (5px corners) with a hairline border, so white
  and pale colours read on a white panel.
- **Touch**: each swatch meets the 24px floor ([Touch targets](touch-targets.md)); the grid is packed 4px apart in
  both directions, so swatches take no 44px pad, which would overlap their neighbours.
- **Picked**: a 2px brand ring, offset by 1px. **Hover**: the swatch grows a little (none under reduced
  motion).
- **No colour**: a white swatch with a diagonal slash, whatever it is called on that surface.
- **Layout**: ten to a row, 4px apart, so the standard colours are exactly one row and the picker is always
  276px wide. A group wraps onto further rows; it never scrolls sideways.
- Every swatch has a **tooltip and an accessible name**: a standard or theme colour's word ("Blue",
  "Theme"), and a custom colour's hex itself ("#1a2b3c"). The same name labels a field or row showing that
  colour.

## Keyboard

- The picker is **one Tab stop**: the picked swatch, else the first.
- **Arrow keys move focus** through every swatch and **Add a custom colour** in reading order, wrapping at the ends; **Home**
  and **End** jump to the first and last. Moving focus never changes the colour.
- **Enter** or **Space** picks the focused swatch. **Escape** closes a picker that opened in a popover and
  returns focus to its trigger.
- Each swatch is a toggle button (`aria-pressed`) inside a labelled group per heading.

## Previews

Where the surface previews (the element menu, Illustrate page backgrounds and gradient ends, article
accents), hovering or focusing a swatch shows the colour live and leaving the picker puts the colour back. A
pick commits it, once, for undo.

## Skins

| Skin              | What it is                                                                                  | Used by                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Inline**        | The picker drawn in place, inside a flyout, panel or popover                                | Draw pen flyout, Plan column, Illustrate page background, article toolbar Colour, article Accent                                                                                                             |
| **Row**           | A labelled row (the colour in force on its right) opening the picker in a popover beside it | Element, selection and table cell menu colour rows (the menu is 224px, narrower than the picker), the Laser Panel's Colour                                                                                   |
| **Field**         | A field-sized trigger (swatch, name, chevron) opening the picker in a popover               | Plan card Colour                                                                                                                                                                                             |
| **Swatch button** | A small swatch-only trigger opening the picker in a popover                                 | Rich-text label colour, gradient From and To, chart slice and legend colours, canvas and pattern colours, custom theme builder tiles, Quick Style's **More colours**, Plan card type (end of its Name field) |

## Quick Style

The [Quick Style Panel](../008-canvas/quick-style-panel.md) keeps its compact rows: a theme row's seven and
Ink, Draw mode's Ink and eight hued stock colours in the standard order (Red to Pink; Grey is in More
colours), the highlighter's five tints. Each row draws the one swatch, follows the
one keyboard model, and ends with **More colours**, a swatch button opening the full picker (the row's own
colours as its Theme Palette, the standard colours, Custom colours). Its glyph is four dots of the standard
colours (Red, Orange, Green, Blue) in a dashed square (`MoreColoursGlyph`): every trigger that opens the full
picker from a quick row wears it, as does the picker's own **Add a custom colour**; none is a +. The highlighter's More colours offers the
soft tone.

A Sheet's toolbar **Text Colour** and **Fill Colour** are quick rows too ([Sheet](../029-sheets/sheet.md)): the
Theme Palette's first five colours with the one swatch and keyboard, then **More Text Colours** / **More Fill
Colours** (the four-dot glyph), which opens the full picker.

## Not colour pickers

Preset tiles that set several things at once (sticky presets, chart palettes, theme cards, gradient presets),
and colours that are assigned rather than chosen (Plan labels, presence colours) stay as they are.
