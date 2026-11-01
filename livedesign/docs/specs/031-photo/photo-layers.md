# Photo layers

A [photo](photo-pages.md) is a **layer stack**: layers drawn bottom to top, each blended onto what is under it.
This spec is what a layer is, how the stack composites, and every operation on layers.

## Domain language

| Term                 | Means                                                                                                               | Never called              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **layer**            | One entry of the stack: a `PhotoLayer`, with a `layerKind`.                                                         | element, level            |
| **pixel layer**      | A layer of pixels (`layerKind: 'pixel'`).                                                                           | raster, bitmap layer      |
| **adjustment layer** | A layer that changes the look of everything under it, by an adjustment ([Photo adjustments](photo-adjustments.md)). | filter layer              |
| **fill layer**       | A layer painted with a solid colour or a gradient across the photo.                                                 | colour layer              |
| **text layer**       | A layer of live text, drawn into pixels when composited.                                                            | type layer                |
| **group**            | A layer holding other layers, composited together then blended as one.                                              | folder                    |
| **blend mode**       | How a layer's colours combine with the colours under it (`blend`).                                                  | mix mode, composite op    |
| **opacity**          | How much of the layer shows, 0 to 100%.                                                                             | alpha (that is a pixel's) |
| **layer mask**       | A grey mask over a layer: white shows the layer, black hides it, greys between.                                     | alpha mask                |
| **clipping**         | A layer clipped to the layer under it shows only where that layer has pixels.                                       | clip mask                 |
| **offset**           | Where a pixel layer's pixels sit in the photo, whole pixels from its top-left.                                      | position                  |
| **effects**          | A layer's drop shadow, outer glow, stroke and colour overlay, drawn from its shape.                                 | styles, fx                |
| **lock**             | What of a layer may not change: its transparency, its pixels, its position, or all.                                 | freeze                    |

## A layer

`PhotoLayer = { id, name, layerKind, visible?, opacity?, blend?, locks?, clip?, mask?, effects?, parent?, ... }`,
with the fields of its kind:

- `id`: `ly-` and eight hex digits, unique in its photo.
- `name`: 1 to 60 characters. A new layer is named by kind and number: **Layer 1**, **Levels 1**, **Colour Fill
  1**, **Group 1**, a text layer by its first words (up to 30 characters).
- `visible`: absent is visible; `false` hides it (and a group hides everything in it).
- `opacity`: 0 to 1 in steps of 0.01; absent is 1.
- `blend`: one of the blend modes below; absent is **Normal** (**Pass Through** for a group).
- `locks`: any of `transparency` (painting keeps each pixel's alpha), `pixels` (no tool or operation changes its
  pixels), `position` (no move or transform); `all` is all three plus no setting change but visibility.
- `clip`: `true` clips it to the nearest unclipped layer under it in the same group (its **base**).
- `parent`: the id of the group it is in; absent is the photo's top level. Groups nest up to five deep.
- `mask`: `{ pixels, enabled?, linked? }`: the mask's pixels (a grey layer the photo's size,
  [Photo store](photo-store.md) "Tiles"), `enabled: false` turns it off without removing it, `linked: false` keeps
  it still while the layer moves.
- `effects` (pixel and text layers): any of `shadow` (colour, opacity, angle, distance, size, spread), `glow`
  (colour, opacity, size, spread), `stroke` (colour, size, position **Outside**, **Inside** or **Centre**) and
  `overlay` (colour, opacity, blend), each with `enabled`.

By kind:

- **Pixel** (`layerKind: 'pixel'`): `pixels` (its tiles, [Photo store](photo-store.md)) and `offset` (`{ x, y }`,
  whole pixels, absent is 0, 0). Its pixels may reach past the photo's edges (a moved layer keeps what is off the
  photo until it is cropped or flattened); anything past the edges is not drawn.
- **Adjustment** (`layerKind: 'adjustment'`): `adjustment`, the adjustment and its settings ([Photo
  adjustments](photo-adjustments.md)). It changes the composite of everything under it in its group (or the photo
  for a top-level one; only its base when clipped), shown through its mask.
- **Fill** (`layerKind: 'fill'`): `fill`, a `solid` colour, or a `gradient` (its stops, style, angle, scale and
  centre, as the Gradient tool's, [Photo tools](photo-tools.md) "Gradient").
- **Text** (`layerKind: 'text'`): `text`: the words (up to 2000 characters, line breaks kept), `font` (the font
  catalogue's), `size` (px, 4 to 2000), `weight` (400, 500, 700), `italic`, `colour`, `align` (**Left**, **Centre**,
  **Right**), `lineHeight` (0.8 to 3, absent 1.2), `tracking` (-0.2 to 1 em), `at` (its box's top-left, whole
  pixels) and `boxWidth` (absent is one line, wrapping at line breaks only; set by a dragged-out box). Drawn
  anti-aliased into pixels when composited; edited as text with the Text tool.
- **Group** (`layerKind: 'group'`): `collapsed` (the Layers tab shows its layers folded away). Its children are the
  layers whose `parent` is its id, in stack order.

A stored layer is read defensively: a malformed field is dropped, a layer with no valid `id` or `layerKind` is
skipped, a `parent` naming no group is cleared, and the stack is cut to 100 layers.

## The stack and the composite

The photo's `layers` are in **stack order, bottom first**. The composite is made bottom to top, in sRGB with
straight (not premultiplied) alpha at the boundaries and premultiplied inside, 8 bits a channel at rest:

1. Start from transparent.
2. For each visible layer, its **colour** (a pixel layer's pixels at its offset; a fill layer's fill; a text layer's
   drawn text), with its effects drawn under (shadow, glow) and over (stroke, overlay) it, times its mask, times
   its opacity, is blended onto what is under it by its blend mode.
3. An adjustment layer replaces what is under it with the adjustment of it, mixed back by its mask and opacity.
4. A group composites its children onto transparent, then blends the result as one layer (by its blend mode,
   opacity and mask); a **Pass Through** group composites its children straight onto what is under it, its opacity
   and mask mixing the result back.
5. A clipped layer is blended only where its base has alpha: its contribution times the base's alpha.

The composite is exact and the same everywhere it is made (the editor, the exports, the preview): one formula per
blend mode and adjustment, held to by tests that compare each against reference values.

### Blend modes

Twenty-seven, in the Photoshop order and grouping (a separator between groups in the picker):

- **Normal**, **Dissolve** (shows a random share of the layer's pixels, opacity as the share, the pattern fixed per
  layer)
- **Darken**, **Multiply**, **Colour Burn**, **Linear Burn**, **Darker Colour**
- **Lighten**, **Screen**, **Colour Dodge**, **Linear Dodge (Add)**, **Lighter Colour**
- **Overlay**, **Soft Light**, **Hard Light**, **Vivid Light**, **Linear Light**, **Pin Light**, **Hard Mix**
- **Difference**, **Exclusion**, **Subtract**, **Divide**
- **Hue**, **Saturation**, **Colour**, **Luminosity**

Groups add **Pass Through**. Each mode's formula is the W3C Compositing and Blending Level 1 one where it defines
it, and the published Photoshop formulas for the rest (Linear Burn `a + b - 1`, Linear Dodge `a + b`, Vivid Light,
Linear Light, Pin Light, Hard Mix, Subtract, Divide, Darker and Lighter Colour by luminosity), each clamped to 0 to 1.
Hovering a mode in the picker previews it on the photo.

## The Layers tab

The Photo panel's **Layers** tab ([Photo pages](photo-pages.md) "The Photo panel"):

- **Over the list**, a card for the active layer: **Blend** (a button showing the mode as a swatch the engine draws,
  opening the modes in their families, each with its swatch; pointing at one previews it on the photo), **Opacity**
  (the shared slider row: its value typed straight in, the track filled to it; the number keys 1 to 0 set 10% to
  100% while a non-painting tool is in hand), and **Lock** (a segmented group of four icon toggles: Transparency,
  Pixels, Position, All).
- **The list**, top layer first, each row 48 px with rounded corners, the active one tinted with a brand bar at its
  left, a hidden one dimmed: the eye (visibility; Alt+press shows only this layer, again restores), a thumbnail (40 px,
  over the checkerboard, updated a moment after each commit), the mask's thumbnail
  where it has one (a press on it makes the mask the target of painting, ringed; on the layer's, the layer), the
  name over a line saying what it is (its kind, its blend mode and opacity when not Normal and 100%, Hidden)
  (double-click the name to rename; Enter or leaving keeps it, Escape drops it), and icons for clipping (a bent arrow,
  the row indented), locks, effects (`fx`, a press opens them) and a group's fold. Others' avatars on the right.
- **Selecting**: a press makes the layer active; Shift and Ctrl/Cmd extend to several (for Group, Merge, Delete,
  Duplicate, Link-free moves together); Alt+[ and Alt+] step the active layer down and up.
- **Reordering**: dragging a row moves the layer (a line shows where it lands; onto the middle of a group's row puts
  it in the group), by the same pointer drag as the canvas's [Layers](../006-design/layers.md) panel, so it works by
  touch too (on a touch screen from a grip at the row's left, since a finger on the row scrolls the list); Ctrl/Cmd+[ and Ctrl/Cmd+] move it down and up one; with Shift, to the bottom and top.
- **Under the list**: **New Layer** (a labelled button, Ctrl/Cmd+Shift+N), then icon buttons with tooltips: **New
  Group**, **Add Mask** (from the selection when there is one: reveal it; otherwise reveal all; Alt for hide all),
  **New Fill or Adjustment** (a menu: Solid Colour, Gradient, then the adjustments in the Adjust tab's sections),
  **Effects** (a menu of the four), and, apart at the end, **Delete** (Delete/Backspace while the list has focus).
  Both menus are the app's verb menus: a header, a row per verb with its icon on the left, groups between
  separators, opening beside the panel.
- **A row's context menu** (its ⋯ or a right-click), as the canvas's [Layers](../006-design/layers.md) row menu
  reads: a header with the layer's thumbnail, name and line, then a row per verb with its icon on the left, in groups
  (arrange, merge, mask and clipping, pixels) between separators, Delete Layer last on its own, opening beside the
  panel; only the verbs that fit the layer are listed: Duplicate (Ctrl/Cmd+J), Delete, Rename, Group (Ctrl/Cmd+G), Ungroup
  (Ctrl/Cmd+Shift+G), Merge Down (Ctrl/Cmd+E), Merge Visible (Ctrl/Cmd+Shift+E), Flatten Image, Create Clipping
  Mask / Release Clipping Mask (Ctrl/Cmd+Alt+G), Add Mask / Apply Mask / Delete Mask / Disable Mask / Invert Mask,
  Rasterize (text, fill), Layer Via Copy (Ctrl/Cmd+J with a selection), Layer Via Cut (Ctrl/Cmd+Shift+J), Select
  Pixels (the layer's alpha as the selection; also Ctrl/Cmd+press on its thumbnail), Export Layer (PNG).
- **With several chosen**, Group puts them in one group, Duplicate and Delete take them all, Merge Down becomes
  **Merge Layers** (one pixel layer at the top-most one's place, named after it) and the Move tool moves them
  together. A press on a layer outside them (Auto-Select included) lets them go.
- **Arranging** (the command palette's Photo items, and their keys): Bring Forward, Send Backward, Bring to Front
  and Send to Back move the active layer among its siblings; Select Layer Above and Select Layer Below are Alt+]
  and Alt+[. With a row focused, the arrow keys step the active layer and Delete or Backspace deletes it.
- **Rasterize Effects** (a row's menu, for a pixel layer with effects): the effects drawn into its pixels, gone
  as settings.
- An empty stack (every layer deleted) shows the empty state: "No layers yet. Add one, or paint to make one." with
  **New Layer**. Painting with no layer, or with a non-pixel layer active, makes a pixel layer above it first.

## Layer operations

Each is one edit (one undo step), named in History by its name:

- **New Layer**: a transparent pixel layer above the active one (in its group), active.
- **Duplicate**: a copy above, named "<name> Copy", its pixels shared until either changes.
- **Delete**: the layer (a group with its layers). The last layer may be deleted.
- **Merge Down**: the active layer drawn into the layer under it (which must be a visible pixel layer, or it is
  rasterized first), by its blend mode, mask, opacity and effects, keeping the lower layer's name and settings.
- **Merge Visible**: every visible layer into one pixel layer at the bottom-most visible one's place; hidden ones
  stay. **Flatten Image**: the composite as the one layer, **Background**, hidden layers discarded (a confirmation
  when any are hidden: "Flatten discards hidden layers.").
- **Group** / **Ungroup**: the selected layers into a new group at the top one's place / a group's layers out to
  its place, the group gone.
- **Rasterize**: a text or fill layer, or a layer's effects (**Rasterize Effects**), into its pixels.
- **Layer Via Copy / Cut**: the selection's pixels of the active layer into a new layer above (Cut leaves them
  transparent).
- **Masks**: Add (reveal all, hide all, from the selection, or from the layer's own transparency), Apply (into the
  pixels), Delete, Disable/Enable, Invert, and **Select Mask** (the mask as the selection).
- **Clipping**: Create (the active layer clipped to the one under it) and Release.
- **New Layer from a picture**: a picture dropped, pasted or **Placed** (the Image menu's **Place Picture…**,
  opening the image picker) lands as a new pixel layer above the active one, centred, scaled down to fit the photo
  when larger, and Free Transform starts on it ([Photo tools](photo-tools.md) "Transform").

## The pixels of a layer

A pixel layer's and a mask's pixels are stored as tiles ([Photo store](photo-store.md)): only the tiles that hold
anything, so an empty layer costs nothing and a small sticker on a large photo costs its own size. Every tool edits
the tiles it touches; a commit saves those.

## Non-goals

- Linked layers, layer comps, smart filters, vector masks, blend-if, knockout, fill opacity apart from opacity.
- More effects than the four (bevel, satin, pattern overlay, inner shadow and glow).
- Text on a path, per-character formatting within one text layer.
