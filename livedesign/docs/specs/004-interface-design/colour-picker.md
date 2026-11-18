# Colour picker

Status: shipped

## What

Every place in the apps where you choose a colour uses **one colour picker**. It looks the same, offers the
same colours, lets you pick a colour of your own, and works the same with a mouse, a finger and a keyboard,
whether it sits in a context menu, a toolbar flyout, a dialog or a page panel.

Surfaces may **reskin** it (where it opens, whether it has a field-sized trigger, which extra options lead
it), but never re-implement it: there is one swatch, one layout, one keyboard model and one custom colour
editor.

### The rule for new work

Any new feature that lets someone choose a colour **uses this picker**, through one of its skins (inline, row,
swatch button). It never builds its own swatch grid, its own custom colour editor, or a system colour
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

1. **Theme Palette**, in every picker in the editor, whatever the surface (an element, a page background, the laser): the active tab's theme colours, as the
   theme derives them ([Canvas and palette](../008-canvas/canvas-and-palette.md#colours)), each named by a
   colour word, never two alike ("Blue", "Light blue", "Deep blue"). A Quick Style row's More colours shows the
   row's own colours here instead ([Quick Style bar](../008-canvas/quick-style-panel.md#colours)). Outside
   the editor (the Explorer) there is no active tab, so no group.
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
   - The **strong tone** is for lines, text, accents, the laser and chart slices. It is the stock set of named
     colours (`penColour`) plus Grey: each colour is tuned for the surface it is drawn on, darker on light paper and lighter on dark, so
     it is at least 4.5:1 on that surface.
   - The **soft tone** is for backgrounds, fills and highlights: the same hues as washes, pale on light paper
     and deep on dark, with White in Ink's place.
   - A surface that offers free colours shows a soft row headed "Light", then a strong row headed "Dark": an
     Page's background and the canvas colour.

3. **Custom Colours**: the colours picked with **Add a custom colour** in this design, newest first, at most twelve, then **Add a custom colour** (four coloured dots).

**Leading options** go first in the first group: **no colour** where a surface can have none (No ... colour,
None, No colour, Paper), and the surface's own named defaults (the laser's Your colour).

## Custom colours

Custom colours are **the colours someone picked with +** in this design. Pressing **Use** in the custom
colour editor keeps the colour with the tab it was picked on (newest first, at most twelve a tab), so:

- It appears in Custom Colours in every picker of the design, for every collaborator, as soon as it is
  picked, the current tab's first, then the other tabs' in tab order.
- Nothing else adds to them. A template's or a theme's colours written onto elements, a colour pasted in: none is anyone's pick, so none shows here. A colour picked again moves to the front.
- They are kept, not derived: a colour stays a custom colour after the element that used it is gone. Picking
  more pushes the oldest off the end.
- Recording one is not a step of its own: the pick it applies is the undoable edit.
- A colour already offered (the Theme Palette's, a standard colour) is not shown again as a custom colour.
- The custom colour in force always shows, as the first of Custom Colours, picked, even when no one picked it
  with **Add a custom colour** (a page's earlier preset, a template's colour).
- While a picker is open, Custom Colours hold their order. Hovering a swatch previews it on the design, which
  must not slide the swatches under the pointer, so a colour already shown keeps its place and only a colour
  new to the list, such as one just picked with **Add a custom colour**, joins at the front. The order is worked out afresh each
  time the picker opens.

Quick Style's per-theme
slot overrides are unchanged: they replace a theme colour, they are not Custom colours.

## Picking a colour of your own

Every picker ends Custom colours with **Add a custom colour** (four coloured dots). It opens the **custom colour editor** in place, under the
swatches: a saturation and brightness square, a hue slider, a hex field, an eyedropper where the browser has
one, and **Use**. Use (or Enter in the hex field) applies the colour and keeps it as a custom colour.

- Where a line or text has to read on both appearances (the element menu's line and text rows), the editor warns
  when a colour is under 3:1 on either and offers a readable version beside the warning. Elsewhere it does not.
  A picker that colours text also judges the swatches against what the text sits on ("Reading on its ground").
- Quick Style's custom swatch popover holds the same editor
  ([Quick Style bar](../008-canvas/quick-style-panel.md#custom-swatches)).
- There is **no system colour well** anywhere in the editor; the custom colour editor is the only one.

## Reading on its ground

Text is made to be read: a banner, a social image or a wireframe's screen goes out into the world. So every
picker that colours text says when a colour would be hard to read where that text sits, and offers one that
reads. It is a **hint, never a block**: any colour can still be picked.

- **Where it shows**: the element menu's **Text** row (one element or several), the Quick Style bar's Text
  colour **More colours**, and the rich-text toolbar's **Text colour** (the selected words, judged where their
  element sits).
- **What it is judged against**: what the words sit on. A box's own fill (a shape, a sticky note); else the
  topmost filled box under the text; else the page's background: a solid colour, every colour a gradient runs
  through under the text (the worst counts), or the plain white paper.
- **The page as exported**: a page is judged as it exports. On a dark canvas the plain paper is drawn dark but
  exports white, so there the hint says **"Hard to read on the exported page"**, and its **Aa** tile shows the
  white page the words are judged on.
- **Several grounds at once**: for several elements, the colour is judged on every one's ground and the
  **worst counts**: the hint shows while any of them falls short, says how many ("Hard to read for 2 of 3"),
  shows the worst ratio and its ground in the **Aa** tile, and **Use** offers one shade that passes on all of
  them (judged as normal text unless every one is large). Elements whose ground can't be judged are left out.
- **What passes**: [WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum): **4.5:1**, or **3:1**
  for large text (24px and over, or 18.66px and over in bold, at the size it draws, scale included).
- **Its row**: under the swatches, a row kept for it for as long as the picker is open, so the swatches never
  move under the pointer and the picker opens tall enough to show it however low in the window it opens. The
  colour judged is the swatch the pointer or focus last rested on in this picker, else the colour in force.
  The swatches focus lands on as the picker opens are not judged (with no swatch the colour in force, that is
  the first one): the hint opens on the colour in force, and judges focus once a key moves it (see Previews).
  While it falls short the row names the ground ("on this page", "on its fill"), the ratio and the target
  ("1.9:1, aim for 4.5:1"), with the colour on its ground as a small **Aa** tile, and screen readers hear it
  arrive. While it reads, the row says so quietly ("Easy to read on this page", the ratio), and with no colour
  to judge (No colour) it is empty.
- **The fix, in one click**: beside it, **Use** with the nearest shade of the same hue that passes (the least
  change toward lighter or darker, whichever is smaller), shown as an **Aa** tile on the ground. Pressing it
  applies that shade as the text colour (one undoable edit) and closes the picker. It is not added to Custom
  colours: no one picked it with **Add a custom colour**. When no shade of that hue passes (a gradient from
  black to white), the hint shows without **Use**.
- **Nothing is shown**, and no row is kept, where the ground can't be judged, rather than a wrong ratio: text on
  a picture (a page's picture background, an image or video under it) and text off every page.

## What a picker stores

The picker changes how a colour is chosen, not the shape of what is saved, so every existing design looks
exactly as it did:

- On the canvas, a strong standard colour on a line or text is stored **by name** (`penColour`,
  `penTextColour`), as Ink already is, and drawn in its version for the canvas. An
  element with no name field (a table, a note's border) stores the colour's light-paper hex. A fill stores
  its `#rrggbb`; a theme colour stores what it stored before.
- The laser stores a standard colour by name, Your colour as `presence`, or a custom `#rrggbb`.
- Off the canvas (pages, charts, themes), a standard colour stores its
  `#rrggbb` for light paper.

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

Where the surface previews (the element menu, page backgrounds and gradient ends), hovering a swatch, or moving focus to one with a key, shows the colour live and leaving the picker puts the colour back. The swatches the picker focuses as it opens are not previewed, so opening it changes nothing. A
pick commits it, once, for undo.

## Skins

| Skin              | What it is                                                                                  | Used by                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Inline**        | The picker drawn in place, inside a flyout, panel or popover                                | Page background                                                                                                                          |
| **Row**           | A labelled row (the colour in force on its right) opening the picker in a popover beside it | Element, selection and table cell menu colour rows (the menu is 224px, narrower than the picker), the Laser Panel's Colour               |
| **Swatch button** | A small swatch-only trigger opening the picker in a popover                                 | Rich-text label colour, gradient From and To, chart slice and legend colours, canvas and pattern colours, Quick Style's **More colours** |

## Quick Style

The [Quick Style bar](../008-canvas/quick-style-panel.md) keeps its compact rows: a theme row's seven and
Ink. Each row draws the one swatch, follows the
one keyboard model, and ends with **More colours**, a swatch button opening the full picker (the row's own
colours as its Theme Palette, the standard colours, Custom colours). Its glyph is four dots of the standard
colours (Red, Orange, Green, Blue) in a dashed square (`MoreColoursGlyph`): every trigger that opens the full
picker from a quick row wears it, as does the picker's own **Add a custom colour**; none is a +.

## Not colour pickers

Preset tiles that set several things at once (sticky presets, chart palettes, theme cards, gradient presets),
and colours that are assigned rather than chosen (presence colours) stay as they are.
