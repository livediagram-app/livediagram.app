# Text effects

Two ways to make a few words of a headline stand out, picked from the label toolbar while the text is
being edited: a **highlight**, a marker-pen band behind the words, and a **gradient**, the words
filled with a two-colour blend. They are per-range formatting on the label's runs
([Canvas and palette](canvas-and-palette.md) "rich text"), like bold or a text colour, so "We grew
**40%**" can highlight only the number. A soft shadow behind the whole text is the element's own
**Shadow** ([Element shadows](element-shadows.md)), not a text effect.

## The control

- The label toolbar ([Canvas and palette](canvas-and-palette.md)) carries a **Text Effects** button
  after Text Colour, its hover card "Text Effects: Highlight or fill the selected words with a
  gradient." It opens a panel of two parts, titled like the article's colour panel:
  - **Highlight**: the one colour picker
    ([Colour picker](../004-interface-design/colour-picker.md)) leading with **No Highlight**, then
    the soft standard colours under a "Highlights" heading, then the document's own colours.
  - **Gradient**: a row of tiles, **None** and the six presets, each tile showing "Aa" filled with
    its gradient and named in its tooltip.
- A pick applies to the selected text, or to the whole label when the caret is collapsed (the
  label's usual scope). The control shows the selection's highlight and gradient when they are
  uniform across it.
- The button sits in the same toolbar on every element whose label edits through it (text, shapes,
  stickies), so effects work on a shape's label as well as a free text headline.
- Like every label edit, it is an Editor's; a Participant gets it only on their own content, where
  they may edit the label at all; a Viewer never sees the toolbar.

## The presets

`TEXT_GRADIENTS` in `@livedocuments/document`, left to right across the run:

| Id         | Name     | From      | To        |
| ---------- | -------- | --------- | --------- |
| `sunset`   | Sunset   | `#f97316` | `#db2777` |
| `ocean`    | Ocean    | `#0ea5e9` | `#6366f1` |
| `aurora`   | Aurora   | `#10b981` | `#0ea5e9` |
| `berry`    | Berry    | `#8b5cf6` | `#ec4899` |
| `ember`    | Ember    | `#f59e0b` | `#dc2626` |
| `midnight` | Midnight | `#1e3a8a` | `#7c3aed` |

Fixed colours rather than theme-derived ones: a gradient headline is a deliberate look. They run
from bright (Aurora, Ember: for dark slides) to deep (Midnight: for light ones), and the author
picks for the paper, as with a text colour; the tiles are drawn on the current paper so the choice
is visible before it is made.

## Model

Two optional attributes on `TextRun` (`@liveworkspace/model-core` `rich-text.ts`), deltas like the
others:

- `highlight?: string`: a hex colour, the marker band's.
- `gradient?: TextGradientId`: one of the preset ids.

A run may carry both: the marker sits behind the gradient-filled words. A gradient wins over the
run's colour while it is set (the colour stays stored, so removing the gradient brings it back). A
value a renderer does not recognise (not a hex, an unknown id) draws as no effect; nothing rejects
it, as with every cosmetic run attribute.

## Rendering

- **Canvas** (one style function for the label and its editor, so editing never shifts a glyph):
  - highlight: a band from 38% to 94% of the line box in the colour, as a background image on the
    run's span, with an eighth of an em of padding either side, rounded ends and
    `box-decoration-break: clone`, so a highlight that wraps draws a band on each line.
  - gradient: the preset as a background image clipped to the glyphs (`background-clip: text`,
    transparent fill), left to right across the run, again cloned per line.
  - both: two background layers, the gradient clipped to the text over the band.
- **SVG export** (snapshots, embeds, MCP renders): a highlighted fragment draws a `rect` behind its
  words, measured with the same text metrics that wrap the label; a gradient fragment fills with a
  `linearGradient` in user space across the fragment's measured width. One def per fragment, ids
  derived from the element id, so two exports of a page are identical.
- **PNG and PDF**: the same bands and gradients drawn on the canvas context (`fillRect`,
  `createLinearGradient`) at the same measured positions.
- **PowerPoint**: a highlighted run writes DrawingML's `highlight`; a gradient run writes a
  two-stop `gradFill` on the run. The text stays editable text.
- Right-to-left lines place bands and gradients by the logical run order: close, not exact, on a
  mixed-direction line.

## Telemetry

`track('Element', 'Changed', 'TextHighlight' | 'TextGradient')` on each pick (not on hover).
