# Photo tools

The tools of a [photo page](photo-pages.md)'s photo tools (in the palette strip): what each does, its options (the options flyout), its
gestures and keys. Every tool acts on the **active layer** (or its mask, when the mask is the target) within the
**selection** when there is one, and every stroke or use is one edit, committed when it ends.

## Domain language

| Term                | Means                                                                                  | Never called  |
| ------------------- | -------------------------------------------------------------------------------------- | ------------- |
| **stroke**          | One press-drag-release of a painting tool: a chain of dabs.                            | line, path    |
| **dab**             | One stamp of the brush tip along a stroke.                                             | stamp, splat  |
| **tip**             | A brush's shape: a round with a **hardness**, or a square for the Pencil.              | nib           |
| **spacing**         | The distance between dabs, as a share of the tip's size.                               | step          |
| **flow**            | How much each dab lays down; **opacity** caps what one stroke can reach.               | strength      |
| **selection**       | A soft mask (0 to 255 a pixel) limiting what changes; each person's own.               | marquee, mask |
| **marching ants**   | The selection's edge, drawn as a moving dashed line (held still under reduced motion). | outline       |
| **floating pixels** | Pixels lifted by Move from a selection, moved before they are put down.                | float         |
| **source point**    | Where Clone Stamp and Heal copy from.                                                  | origin        |
| **tolerance**       | How different a colour may be (0 to 255) and still count as the same.                  | threshold     |

## Shared gestures and options

- **Painting tools** (Brush, Pencil, Eraser, Clone Stamp, Heal, Blur, Sharpen, Smudge, Dodge, Burn, Sponge,
  Background Eraser, Quick Select): the pointer shows the tip's outline at its size and the photo's zoom (a
  crosshair once it is under 4 screen px, or with Caps Lock). **Shift**+press draws a straight line from the last
  stroke's end. `[` / `]` make the tip smaller / larger (by 10% or at least 1 px), Shift+`[` / `]` softer / harder
  (by 25%). A pen's **pressure** changes size and/or opacity where the options say so (absent, a mouse, reads as
  full pressure). **Smoothing** (0 to 100%) follows the pointer with a lag that evens out a shaky hand.
- **Brush options**: **Size** (1 to 2500 px), **Hardness** (0 to 100%), **Opacity** (1 to 100%), **Flow** (1 to
  100%), **Spacing** (1 to 200%, 10% by default), **Smoothing**, **Mode** (the blend modes but Dissolve's, plus
  **Behind** and **Clear** for the Brush), **Pressure** (Size, Opacity, both, off), and **Brush Presets**: a row of
  saved tips (Soft Round, Hard Round, Airbrush, Chalk, Ink, Marker, Spray, each a size, hardness, flow and
  spacing), plus **Save Preset**.
- **Selection modifiers** (the marquee, lasso and smart tools): **New**, **Add** (Shift), **Subtract** (Alt),
  **Intersect** (Shift+Alt), as four tiles in the options flyout and as held keys at the press; **Feather** (0 to 250
  px) and **Anti-alias** (on by default).
- **Within the selection**: a tool's change is mixed by the selection, so a soft edge softens the change. With no
  selection the whole layer is open.
- **Locked layers**: a tool that would change a layer locked against it does nothing and shakes the lock icon,
  with a toast: "<name> is locked."
- **Hidden layers**: painting on a hidden layer is refused with a toast: "<name> is hidden. Show it to paint on it."

## Selecting

- **Rectangle Select / Ellipse Select** (M): drag out the shape; Shift after pressing keeps it square or round,
  Alt draws from the centre, Space held moves it while drawing. Options: the modifiers, Feather, **Style**
  (**Normal**, **Fixed Ratio** with width and height, **Fixed Size** in px).
- **Lasso** (L): draws the selection freehand, closing at release. **Polygon Lasso**: a press per corner; a
  double-press, Enter or a press on the first corner closes it, Backspace removes the last corner, Escape cancels.
  **Magnetic Lasso**: the edge snaps to the strongest nearby edge as the pointer moves (an edge-following path
  between anchors laid every 64 px or on a press), options **Width** (the search radius, 10 px), **Contrast** (10%)
  and **Frequency** (anchors, 57).
- **Magic Wand** (W): a press selects the pixels of a like colour to the one pressed, within **Tolerance** (32),
  **Contiguous** (only touching pixels; on by default), **Sample All Layers** (the composite, not the active layer).
- **Quick Select** (W): painting grows the selection over areas like the ones painted (by colour and edges);
  Alt-painting shrinks it. It changes only what joins the stroke: a look-alike area apart from it is never
  selected (or taken out) on its own, and every dab of a fast stroke counts. Options: Size, **Sample All Layers**,
  **Auto-Enhance** (smooth the edge once the stroke's last change lands; on).
- **The Select menu** ([Photo pages](photo-pages.md) "The title bar"): All, Deselect, Reselect (the last
  selection back), Inverse, **Colour Range…** (a dialog: pick colours with the eyedropper, **Fuzziness** 0 to 200,
  a live preview of the selection as greys), **Modify** (Grow: the like-coloured neighbours of the selection, by the
  wand's Tolerance; Expand and Contract by px; Border: a band of width px; Smooth: radius px; Feather: radius px).
- **Moving a selection**: a selection tool dragged inside the selection moves the selection itself (not pixels);
  the arrow keys nudge it 1 px (Shift: 10 px).

## Smart selections

Classical, in the browser, with no model to download:

- **Subject** (Select menu): selects the photo's main subject: a foreground and background colour model seeded
  from the photo's centre and its border, refined by a graph cut over the pixels (GrabCut), then the edge smoothed
  and feathered by 1 px. Works on the composite at up to 1024 px on its longer side, the result scaled up and
  refined at full size on the boundary.
- **Remove Background** (Select menu, and the Layers row menu for a pixel layer): Subject on the active layer, then
  a mask from it (hide the rest), so nothing is lost and the mask can be painted to fix it. One edit.
- **Refining**: with a selection made by Subject or Quick Select, **Select and Mask…** (Select menu) opens a dialog
  showing the selection over black, white or the checkerboard, with **Smooth** (0 to 100), **Feather** (0 to 250
  px), **Contrast** (0 to 100%), **Shift Edge** (-100 to 100%) and a **Refine Edge** brush that re-decides pixels
  under it by colour (hair and fur), then **OK** applies it as the selection, or as a mask with **Output to Mask**.

## Moving and transforming

- **Move** (V): drags the active layer (its offset; with a selection, lifts the selected pixels as **floating
  pixels** and moves them, put down at the release onto the same layer, one edit). Arrow keys nudge 1 px (Shift
  10). **Auto-Select** (option, on by default): a press picks the top visible layer with a pixel (or text) there, so a press
  on anything drags it. Alt-drag duplicates.
  Options also hold the **Align** buttons (left, centre, right, top, middle, bottom, to the selection or the photo)
  for the selected layers.
- **Transform** (Ctrl/Cmd+T, and the Image menu's **Free Transform**): a box with eight handles and a centre point
  over the active layer (or the selection's pixels): drag inside to move, a handle to scale (Shift keeps the shape;
  Alt about the centre), outside a corner to rotate (Shift in 15° steps), Ctrl/Cmd+handle to distort freely
  (**Perspective** and **Skew** in the options), the options flyout showing **X**, **Y**, **W**, **H** (px or %),
  **Angle** and **Interpolation** (Bicubic, Bilinear, Nearest). Enter or **Commit** resamples once from the
  original pixels; Escape or **Cancel** drops it. Flip Horizontal and Vertical in its options.

## Crop

**Crop** (C) puts a crop box over the photo (the whole photo at first). While it is still that first box, a drag on
the photo draws a new box from the press (held to the Ratio; a click leaves the box whole). After that, drag its edges
or corners, inside to move, outside to straighten (rotate), with a rule-of-thirds grid inside and the cropped-away part dimmed. Options:
**Ratio** (**Free**, **Original**, **1:1**, **4:5**, **3:2**, **16:9**, **9:16**, or width x height), **Delete
Cropped Pixels** (on: pixels outside are dropped; off: layers keep them off the photo's edges), and **Straighten**
(draw a line that should be level). Enter crops (one edit; the page takes the new size); Escape leaves it.

## Painting and erasing

The tools never add, merge or remove a layer by themselves: that is the person's to do (the Layers tab, the Layer
menu). A tool that changes pixels works on the active pixel layer; with a text, adjustment or fill layer or a group
active it refuses, naming the layer ("Text 1 is a text layer. Choose a pixel layer, or add one."), and offers **New
Layer**, which adds one above it for the next press. Only the Text tool makes a layer of its own (a text layer, so the
words stay editable), and the Adjust tab its adjustment layers.

- **Brush** (B): paints the foreground colour with the round tip. Alt held picks a colour (the Eyedropper).
- **Pencil**: hard-edged, never anti-aliased, a square or round tip, for pixel art; **Auto Erase** paints the
  background colour where a stroke starts on the foreground colour.
- **Eraser** (E): makes pixels transparent (on a layer with locked transparency, paints the background colour).
  Options as the Brush's, and **Mode** (**Brush**, **Pencil**, **Block**).
- **Background Eraser**: erases pixels like the colour under the tip's centre at the press (**Sampling**: Once,
  Continuous), within **Tolerance** (50), **Limits** (Contiguous, Discontiguous), **Protect Foreground Colour**.
- On a **mask** target, every painting tool paints grey: the foreground's luminosity (black hides, white shows),
  and the Eraser the background's (white by default, so erasing a mask shows the layer again).

## Retouching

- **Spot Heal** (J): paint over a blemish; on release, the painted area is filled from its surroundings by a
  content-aware fill (a patch search across the layer that matches texture and colour, PatchMatch) and its edge
  blended so tones match. Option **Type**: **Content-Aware** (the default), **Proximity Match** (the nearest ring
  only).
- **Heal**: Alt+press sets the source point; painting copies texture from the source, offset as the stroke moves,
  and blends its colour and tone to the destination's surroundings (a Poisson blend over the stroke's area).
  **Aligned** (on: the offset holds for every stroke; off: each stroke starts from the source again). **Sample**:
  **Current Layer**, **All Layers**.
- **Red Eye**: a press on a red pupil darkens the red of the pupil around it (**Pupil Size** 50%, **Darken** 50%).
- **Clone Stamp** (S): Alt+press sets the source point; painting copies pixels from it with the brush's tip,
  opacity and flow, unblended. Options: brush options, **Aligned**, **Sample** (Current Layer, All Layers). The
  source shows as a crosshair while painting.
- **Content-Aware Fill** (the Edit item of the Image menu: **Fill…** with **Contents: Content-Aware**, and Shift+
  Backspace): fills the selection from the rest of the layer, as Spot Heal does. **Fill…** also offers the
  Foreground, Background, a colour, black, 50% grey and white, with a blend mode and opacity.

## Fills and gradients

- **Paint Bucket** (G): fills the area of like colour around the press with the foreground colour. Options:
  **Tolerance** (32), **Contiguous** (on), **Anti-alias** (on), **Sample All Layers**, Mode, Opacity.
- **Gradient** (G): drag a line: the gradient runs from its start to its end across the selection or layer.
  Options: **Style** (**Linear**, **Radial**, **Angle**, **Reflected**, **Diamond**), the **gradient** (a strip
  showing it; a press opens the gradient editor: stops of colour and of opacity, each draggable along the strip,
  added by a press under it and removed by dragging off; **Presets**: Foreground to Background, Foreground to
  Transparent, Black to White, and six colour ones), **Reverse**, **Dither** (on), Mode and Opacity. Shift keeps the
  line to 45° steps.

## Focus and tone

Brushes with the brush options (but colour):

- **Blur**: softens under the tip, **Strength** (50%). **Sharpen**: sharpens under it, **Strength**, **Protect
  Detail** (on). **Smudge**: drags colour along the stroke, **Strength**, **Finger Painting** (starts each stroke
  with the foreground colour).
- **Dodge** (lightens) and **Burn** (darkens): **Range** (**Shadows**, **Midtones**, **Highlights**), **Exposure**
  (50%), **Protect Tones** (on: only the lightness moves, the hue and saturation kept). Levels move along a curve
  that keeps black and white, never toward grey; one stroke moves a pixel at most by its exposure however often it
  passes over it (from the pixel as it was before the stroke), and a new stroke builds on the last. **Sponge**: **Mode** (**Saturate**, **Desaturate**), **Flow**, **Vibrance** (on:
  protects already saturated colours and skin).

## Sampling

- **Eyedropper** (I): a press takes the colour under it as the foreground (Alt: the background). **Sample Size**
  (Point, 3 x 3 Average, 5 x 5, 11 x 11, 31 x 31), **Sample** (Current Layer, All Layers). While held, a ring around
  the pointer shows the new colour over the current one.

## Text

**Text** (T): a press makes a text layer at the press, its caret ready; a drag makes one with a box (wrapping at its
width). A press on an existing text layer edits it; a drag on it moves it (one edit). Typing writes it live on the photo, in the options flyout's
**Font** (the font catalogue), **Size**, **Weight**, **Italic**, **Colour**, **Align**, **Line Height**, **Tracking**
changing the whole layer. Escape or a press outside ends the edit (one edit for the whole typing); Ctrl/Cmd+Enter
too. An empty text layer is removed as the edit ends.

## Shapes

**Rectangle**, **Ellipse** and **Line** (U): drag to draw into the active pixel layer (**Draw Into Active Layer**,
on by default; off, each shape gets a new pixel layer of its own), Shift keeping the shape and Alt from the centre. Options: **Fill** (the foreground colour,
none), **Stroke** (the background colour, none) and its **Width** (1 to 200 px), **Corner Radius** (the rectangle,
0 to 1000 px), **Arrowheads** (the line: start, end), Anti-alias.

## The clipboard

- **Copy** (Ctrl/Cmd+C): the selection's pixels of the active layer (the whole layer with no selection); **Copy
  Merged** (Ctrl/Cmd+Shift+C): of the composite; **Cut** (Ctrl/Cmd+X): copy, then the pixels made transparent. The
  copy goes to the system clipboard as a PNG too, so it pastes into other apps.
- **Paste** (Ctrl/Cmd+V): photo pixels, or a picture from the system clipboard, as a new layer, centred on the view
  or, from this photo, **in place** (Ctrl/Cmd+Shift+V) where it was copied.
- With a photo tool in hand these act on the photo; with the select pointer they keep acting on elements, as
  elsewhere.

## Keyboard summary

The tool shortcuts above, and: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+Alt+Z step back through History,
Ctrl/Cmd+A / D / Shift+I selections, Ctrl/Cmd+J duplicate, Ctrl/Cmd+E merge down, Ctrl/Cmd+T transform, Ctrl/Cmd+0
fit, Ctrl/Cmd+1 actual pixels, X swap colours, D reset colours, `[` `]` size, Ctrl/Cmd+Backspace fill with the
background colour (Alt+Backspace the foreground), Shift+Backspace Fill…, Delete or Backspace (a Mac's delete key)
clears the selection's pixels, or with no selection deletes the layers in hand (never the last one: "A photo keeps
at least one layer: add another first."), Enter commits,
Escape cancels what is under way, else deselects, else puts the tool down. With a marquee, a click with no drag
deselects, inside the selection or outside it. Each is listed in the help article and the keyboard shortcuts dialog's Photo section. The shortcuts
act only while a photo page is in focus and no text is being typed.

## Accessibility

- Every photo tool button, option and Layers row is reachable by keyboard and named for a screen reader (a tool by its
  name and shortcut; a layer row as "<name>, <kind>, <visible or hidden>, <opacity>%").
- Changes announce themselves through the canvas's live region ("Brush stroke on Layer 2", "Selection: 640 by 480").
- The marching ants and the cursor ring meet 3:1 against both light and dark pixels (a black and white dash pair).
- Under reduced motion the ants hold still and the photo tools open their groups without sliding.
