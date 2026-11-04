# The whiteboard tools (Draw mode's engine)

**Draw mode is gone** ([Editor modes](../007-editor/editor-modes.md)): every board is a Workshop, with no mode switch
and no whiteboard dock. What Draw mode was built on stays for now, because Workshop still reaches it: its marker pens
are picked up from the palette's Search (each `draw:marker-…` tile), and the path tool, the fill tool, text boxes that
hug their text, the eraser and shape recognition are the same code. This spec keeps describing those tools. Where it
speaks of "a whiteboard" or "the dock", it describes behaviour that no board offers any more; taking the rest of the
engine out is its own follow-up.

The tools tune **rules**, never the document model: strokes are `freehand` elements, notes are stickies, text is
`text` and shapes are shapes, so realtime, comments, layers, export and share links need nothing of their own.

## Pens

- **With a pen in hand, the cursor never changes** over a shape, note, line
  or handle: the pen draws wherever it presses, so nothing under it offers
  another action.
- **Two cursor looks**, chosen under **Cursor** in the dock's Settings flyout and
  remembered device-locally with the pens: **Crosshair + nib** (the default:
  a crosshair at the tip, a nib and a dot of the pen's colour beside it) and
  **Dot** (a dot of the pen's colour at the tip, rimmed in the board's colour).
  The dot is **as wide as the stroke on screen** (the pen's width times the
  zoom), so it shows exactly what the pen will lay down, but never under 6 px
  across, so it stays visible zoomed far out (and never over 128 px, the most
  a browser shows as a cursor).
  On the light board the crosshair and nib are black with a white outline; on
  the dark board they are the exact inverse, white, with no outline.

- A whiteboard offers **three pens**, left to right: **Marker 1**,
  **Marker 2** and **Marker 3** (the interface's names for the pens), all Medium width. Picking a pen
  button selects it; picking the active pen again opens its flyout. The pens
  are named by their place, never by a colour, because the second and third
  pens can be any colour.
- **Marker 1 always draws in the default colour**: the adaptive ink of
  the board (see [Appearance](#appearance)); its width is adjustable like any
  pen's, so its flyout offers the width only.
- **Markers 2 and 3 are adjustable**: their flyouts change both
  colour and width. They start as **blue** (second) and **red** (third), and
  keep their place and name whatever colour they are given.
- **Widths**, on every pen including Marker 1, six in all (`WHITEBOARD_PEN_WIDTHS`, the width at
  medium pressure): **Fine** (1 px), **Medium** (1.5 px, the default) and **Bold** (2.5 px), a
  subtle line at 100%, not a felt tip (tuned with the operator: Medium is what Fine was, each step
  one notch thinner); then three progressively stronger, each about half again the last, for
  felt-tip and poster marks: **Thick** (4 px), **Heavy** (6 px) and **Broad** (9 px). The width is recorded as the stroke's `penWidth`, which every
  freehand renderer honours; choosing a border width from an element's menu
  afterwards replaces it. A pen stores its width as the preset's name, not its
  px, so retuning the px never reinterprets a stored choice.
  - **Each width is pictured the same wherever it is chosen** (the marker's popover and the quick
    style panel's Marker width row, `PenWidthIcon`): as a line in six even steps, thinnest first,
    not to scale. Drawn to scale, 1 and 1.5 px looked identical in the popover.
- **The markers in Workshop:** the palette's Tools group offers Marker 1, 2 and 3 as tiles, and the Toolbar
  strip's Search finds them ([Toolbar layout](../007-editor/toolbar-layout.md#search-every-element-type)), each
  as this browser last set it. Picking one picks the pen up exactly as the dock did (the same pen
  intent, colour, width and recognition), held until another tool or Escape puts it
  down. Its colour and width are changed in the quick style panel (Marker colour, Marker width), not from the
  search.
- **Right-clicking a pen resets it** to how it started (its starting colour
  and Medium), without picking it up; a pen already as it started is left
  alone. The context-menu key and Shift+F10 on the focused button do the same.
- **Picking a marker, and its colour:** a press on a marker picks it up; a
  press on the marker already in hand opens its **colour picker** (a flyout
  on the board side of it, like the others). For Marker 1 it holds the width only.
- **The colour picker** (Markers 2 and 3) is the one colour picker
  ([Colour picker](../004-interface-design/colour-picker.md)), top to bottom:
  - **Ten stock colours** in one row, the strong standard colours: **Ink, Grey,
    Red, Orange, Yellow, Green, Teal, Blue, Violet, Pink**.
    **Ink comes first: it is the default colour**, and Markers 2 and 3 can
    take it too (the same ink at another width, say), not only Marker 1.
  - **Every stock colour adapts to the board.** It is stored by name, not as
    a hex value, and drawn in the version tuned for the board it is shown on
    (darker on the light board, lighter on the dark one), at least 4.5:1
    against its board (WCAG 1.4.11 with room to spare). So none is ever too
    close to either board, and two people in different appearances both see
    every stroke clearly.
  - **Yellow is the lightest hue**, so on the dark board it is a golden
    yellow, far over the others' contrast (12:1, `YELLOW_DARK_CONTRAST`):
    at their 6:1 it would read as mustard. On the light board no yellow is
    both light and readable, so it is a deep gold there, like the others at
    6:1.
  - **Custom Colours:** the colours picked with + in this document, up to
    twelve, newest first, the marker's own custom colour in force first among
    them ([Custom colours](../004-interface-design/colour-picker.md#custom-colours)).
    A custom colour is one exact hex value on both boards.
  - **Add a custom colour** (four coloured dots) at the end of that row opens the custom picker in place: a
    saturation and brightness square, a hue slider, a hex field and, where
    the browser has one, an **eyedropper**; **Use** applies it. When the
    colour is under 3:1 on either board, a **warning** in the warning colour
    (amber, with its icon, at least 4.5:1 on the panel) says which ("Hard
    to see on the dark board") and offers a nearby version that is not, as
    a swatch to press. **The warning's line is always reserved**, empty
    until needed, so it never shifts the picker.
  - **Width:** Fine, Medium, Bold, Thick, Heavy, Broad.
  - Each swatch has its name as its tooltip and accessible name ("Blue",
    "#ff6b00"); arrow keys move focus through every swatch and +
    (wrapping), Enter picks, Escape closes.
- Markers 2 and 3 start as **Blue** and **Red**. **Existing strokes
  stay as drawn**: a stroke keeps the exact colour it was drawn in; only
  strokes drawn after this record a named colour.
- **A pen stays in hand.** After a stroke the pen is still armed (unlike the
  palette's one-shot pens, [Highlighter](../008-canvas/highlighter.md)
  among them): the next drag draws again, and the stroke just drawn is not selected. Select, Escape or
  another tool puts it down.
- **Ink like Excalidraw's, with pressure.** A pen stroke is drawn the way
  [Excalidraw](https://excalidraw.com) draws freehand, with
  [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT):
  from the stroke's raw samples, streamlined (a little behind the pointer, so
  the hand's tremor irons out), as a filled outline with round ends.
  - **Pressure.** With a pen (stylus) the line swells as it is pressed harder
    and thins as it lightens: at medium pressure it is exactly the preset
    width, from under half of it at the lightest touch to about 1.35 times it
    at the firmest.
  - **Without pressure** (a mouse, or a finger without force sensing) a stroke
    keeps exactly the preset width all along; so do pen strokes drawn before
    pressure was recorded.
  - **Streamline** follows the pointer: a mouse is streamlined more (0.5) than
    a pen or a finger (0.2), whose samples are steadier. A stroke keeps the
    streamline it was drawn with.
- **What you draw is what lands.** While a stroke is being drawn it already
  shows in the pen's colour, width and pressure (Marker 1 in the board's
  ink), finished at every moment: its end is always where the pointer is. One
  function draws the stroke being drawn and the stroke that lands, on the
  canvas and in every export, so release changes nothing.
  - **Ink the smoothing has settled never moves while drawing.** The
    streamline eases each point towards the pointer, so the stroke has a
    **tip** that is still catching up: the stretch from the last settled
    point to the pointer, with its end cap. That tip reshapes as it should,
    by however much the streamline and the pointer's speed make it; its
    length is the smoothing's, not a fixed number. Everything behind it is
    settled and stays pixel-still as new samples arrive, at any zoom, in any
    direction, with or without pressure. What must never happen is the
    settled part shimmering, jittering or re-antialiasing because the
    stroke's box or frame is laid out again as it grows.
  - **Release moves no pixel.** The stroke being drawn is drawn in the canvas
    itself, beside the elements, laid out exactly as the stroke it becomes, so
    the browser rasterises both alike. (Drawn in a separate overlay, a line
    shifted by up to a device pixel or two on release, differently per engine
    and zoom.) The shape recognition preview is drawn in the canvas too.
    The stroke being drawn keeps its raw samples; the stroke that lands
    stores them packed ([Stroke points](../006-document/stroke-points.md)),
    each within 1 / 131,070 of the stroke's size of where it was drawn
    (under a hundredth of a pixel on a stroke 1,000 px across), so release
    moves the ink by no more than that, which no eye can see. Quantising the
    stroke being drawn instead would move settled ink each time its box grows.
- **A pen's width is ink on the board.** It is in canvas px, so a stroke
  zooms with the board like everything drawn on it, the same in every
  browser, and the in-flight stroke is drawn at that width times the zoom.
  (Strokes are not drawn with a non-scaling stroke: browsers disagree about
  whether that undoes a zoomed canvas, which made a finished stroke thinner
  than the one being drawn in Safari.)
- **A tap is a dot.** A press lifted where it went down leaves a round dot
  of the pen's colour, as wide as the pen's line, centred where it touched:
  a one-point stroke, drawn like any other, never read as a shape. The pen
  stays in hand, so taps in a row leave a row of dots.
- **No guides for pens.** A pen draws freely: no alignment guides while it
  is drawn, and no snapping of the first point to a neighbour. Guides and
  snapping stay for shapes and lines from the Shapes flyout.
- **Strokes stay open.** A whiteboard stroke that ends near its start is not
  closed and filled when it lands, as a pencil sketch is: an
  "o" written on a board is ink, not a shape. Only the **Fill** tool closes
  one, on purpose: a press inside a loop whose ends meet closes and fills it,
  keeping its ink as the outline ([Fill tool](fill-tool.md)).
- Pens are the user's, not the board's: they persist **device-locally** in
  `localStorage` (`livehuddle:v2:whiteboard-pens`), like the other tool
  panels, and never travel with the document.
- A stroke records the pen's colour and width on its `freehand` element when
  drawn, with its raw samples, a pressure per sample when a pen drew it (both
  packed into one block, [Stroke points](../006-document/stroke-points.md)), and its streamline. A stroke in the **Ink** (Marker 1's, or any marker's) records
  no explicit colour, so it follows the appearance; a stock colour is recorded
  by name, so it adapts to each viewer's board, and a custom colour as its
  hex, which stays as drawn. A recognised shape or line keeps its pen's colour
  the same way, and so does imported content ([Imported and pasted
  content](#imported-and-pasted-content)).

## Shapes

- **A pen is a separate tool: pens do not set the colour of the other
  tools.** A shape, line or arrow from the Shapes flyout (or its key), a
  sticky and a text box are drawn in Ink at their default width, whichever
  pen was last in hand: a shape, line, arrow or path is written with an Ink
  outline by name and no fill ([Appearance](#appearance)); a text box has no
  colour of its own, which is Ink.
- It previews that way while it is dragged out: solid, in the ink, unfilled.
  **A line or an arrow previews as exactly the one that lands**, from the
  first pixel of the drag: its real stroke width, colour and dash (its
  tool style), its ends, and its arrowhead at its real shape and size, drawn
  by the same arrow renderer in the canvas layer, so release changes nothing.
  No stand-in line, no placeholder head scaled for the preview.
- Another colour or width is the quick style panel's job: **with the tool in
  hand** (nothing selected) the panel styles what it draws next, captioned
  "Next rectangle", "Next arrow", "Next text box"; a choice there changes
  nothing on the board and dresses every later mark of that kind. Restyling
  a drawn shape teaches its kind the same way. Clear
  styles with a tool in hand puts its kind back to plain ink. Line and arrow
  share one remembered style, as all arrows do.
- The whiteboard tools keep **their own style memory** (the `board:` keys of `style-memory.ts`), apart from the
  palette's: styles chosen for a whiteboard tool never dress a shape from the palette, nor the palette's a
  whiteboard tool's, for any shape kind, tool style or restyle, in the same document or another. livehuddle
  has no whiteboard dock (`useEditorState` holds `drawMode = false`), so the `board:` memory is not written today.
- A **recognised** shape (see [Shape recognition](#shape-recognition)) is
  different: it is a pen stroke tidied up, so it keeps that pen's colour and
  weight.

## Selecting

- **A pen stroke is picked by its drawn line**, not its box: a click within
  6 screen px of the line (either side, at any zoom) selects it, and a click
  elsewhere in its box passes through to whatever is beneath, or the board.
  Once selected, its box drags and resizes it as any element's, and its line
  still catches pointers outside the box, so a press on the line's outer half
  stays on the stroke.
- **A shape is picked by its drawn outline too** (rectangle, ellipse,
  diamond, cylinder, a recognised triangle or star, and every other shape
  kind): a click within 6 screen px of the outline selects it, and a click in
  its empty inside passes through to whatever is beneath, or the board. A
  shape with a **visible fill** is also picked anywhere on its fill. Once
  selected, its box catches pointers too and its outline still does, outside
  the box as well: a double-click on a selected shape's line, either half of
  it, opens its label, never deselecting and reselecting it. Lines and
  arrows are picked by their line, paths by their line or fill
  ([Path tool](path-tool.md)), and a filled marker loop by its line or its
  fill ([Fill tool](fill-tool.md)). **Notes and text boxes** keep their whole box:
  they are filled or hold text. So does a kind that paints its own face (a
  chart, a panel, an icon, a web component).
- **A double-click anywhere inside a shape writes in it**, selected or not,
  though a single click there passes through: on the bare board, a
  double-click inside the topmost outline-picked shape there (by its drawn
  outline, following its rotation) opens that shape's label editor, unless
  the shape is locked, on a hidden or locked layer, or has no label to edit.
  Beside every shape, a double-click makes a text box as on any canvas (a finger's
  double-tap zooms instead, [Double-tap to zoom](../008-canvas/canvas-and-palette.md#double-tap-to-zoom)). (A
  selected shape's first click puts it down, so its second reaches the board:
  the same rule edits it.)
- The **outline is the one drawn**, not the box: an ellipse by its curve, a
  diamond by its four edges, a cylinder by its body and rim, following the
  shape's rotation.
- **Shift with Select always drags a selection box**, even when the press
  starts on an element, and the box **adds** what it encloses to the
  selection. A **Shift-click** on an element adds it to the selection or
  removes it; a Shift-click on the empty board keeps the selection. A
  resize handle keeps its own Shift behaviour.

## Text boxes

A text box made with the whiteboard tools **hugs its text**: its box, and so its selection
ring and handles, sit just around the words, with only enough padding to grab
and read it comfortably. Hugging is stored on the text box as its **sizing**
([A text box's sizing](../007-editor/editor-modes.md#what-a-tab-written-elsewhere-keeps)), so the box hugs
for everyone; a text box made from the palette is a fixed box and does not.

- **Padding:** 4 canvas px left and right, 2 px top and bottom, around the
  text's own line box. Nothing else is added: no default width or height.
- **Click to place** (sizing `fit`): the box starts as the width of the caret
  plus its padding, one line tall, and **grows as you type**, widening with the
  text on one line (Enter starts a new line; the box grows down), and shrinks
  back as text is deleted. It wraps only once it reaches 480 canvas px wide.
- **Drag to size** (sizing `wrap`): dragging out a text box sets its
  **width**; the text wraps inside it and the **height always hugs** the lines.
- **Resizing** a hugging text box with a side or corner handle sets its width
  the same way, so it wraps from then on; its height stays hugging the text.
  The top and bottom handles leave its sizing alone. With Shift (the aspect
  ratio rule) the text size scales with the box instead (`textScale`). This
  holds wherever the box is edited: a hugging box keeps hugging.
- An empty hugging text box is removed when it is left, by clicking away or by Escape.
- A text box on a whiteboard saved with a hugging size hugs as it did: one
  placed with a click fits its words, any other wraps at its width.
- Existing text boxes keep their size until edited or resized; then they hug.
- Notes (stickies) keep their fixed note size.

## Imported and pasted content

Boards brought in from elsewhere land as if drawn here, through one shared
landing ([Board scene](../020-import-export/board-scene.md)): Excalidraw pasted
or dropped onto a whiteboard, an Excalidraw file imported into one, and every
Microsoft Whiteboard board ([Microsoft Whiteboard import](../020-import-export/whiteboard-import.md)).

- **What arrives as what:** pen and freedraw ink becomes **marker strokes**,
  with their pressure where the source recorded it (else a constant width) at
  the nearest marker width; highlighter ink stays highlighter; shapes become
  **shapes** (rectangle, ellipse, diamond, triangle) with their border, fill and
  label; a two-point line becomes a **line**, a longer line or polygon a
  **path** (corners kept, curves smooth, closed with its fill); arrows become
  **arrows** attached to the shapes they were bound to; text becomes **text
  boxes**; notes become **sticky notes** in the nearest sticky colour; images
  arrive through the image gallery; frames stay **frames**. Groups are dropped.
- **Adaptive colours:** colour comes across the way the pens store it. A
  near-black line is the board's **ink** (no colour of its own), so it shows
  dark on the light board and light on the dark one, whatever board it was
  drawn on. A colour close to a **stock colour** (Blue, Red, Orange, Yellow,
  Green, Teal, Violet, Pink) lands by its name and is drawn in the version for each
  viewer's board. Anything else keeps its exact hex, a custom colour.
- **Named colours on every mark:** a stock colour is stored by name on a
  stroke, shape, line, arrow and path (its line colour) and on a text box, a
  shape's label, a sticky note's text and an arrow's label (its text colour),
  each drawn in its board's version when no explicit colour overrides it. Text
  on a fill (a filled shape's label, a sticky note's own text colour) keeps its
  exact colour instead, since the fill does not adapt.
- **Text hugs:** every landed text box hugs its text in our fonts, at the size
  it had (the nearest size times a text scale); hand-drawn fonts land in Caveat.
- **A paste selects its result**, lands at the pointer (or the middle of the
  view), and is **one undo step**, images included. A paste that changed or
  dropped anything says so in a small notice; a lossless paste says nothing.

## Nothing animates in

A whiteboard is still: a stroke, shape, sticky or text box appears exactly as
drawn, with none of the pop-in a new element gets from the palette. It is
still an element, selectable and movable like any other. An animation the
author sets on an element on purpose still plays.

## Touch and pen input

- **Pen** (`pointerType: 'pen'`) always draws with the active pen.
- **Mouse** draws with the active pen on primary drag; middle drag and space
  drag pan, as on every tab.
- **Touch** draws **until a pen has been seen**; once a `pen` pointer has been
  used on this device in this session, a single finger **pans** instead, so a
  resting palm or a guiding finger never draws. This is Microsoft Whiteboard's
  behaviour, and it resets on reload.
- **Two-finger** gestures always pan and pinch-zoom, whatever the tool; a
  stroke the second finger interrupts is discarded rather than committed as a
  fragment.
- A stroke the browser cancels (`pointercancel`, for example when the system
  takes the touch over) is discarded.
- Putting the pen down mid-stroke (Escape, another tool) discards it.
- Only the pointer that started a stroke draws it; another finger landing
  meanwhile is a pinch or pan, never part of the stroke.
- Palm rejection beyond this is the browser's; no timing heuristics.

## Eraser

The eraser offers **both** modes (Stroke and Partial, not editor modes), switched in its flyout:

- **Stroke** (default): touching a stroke removes the whole stroke. It is the
  existing eraser in Sweep mode, with one difference: a stroke counts as
  touched only where its ink is (within the brush of the drawn line), not
  anywhere in its bounding box, so erasing beside a long stroke leaves it
  alone. **The same holds for every element the whiteboard picks by its
  drawn path** (see [Selecting](#selecting)): a shape is touched only where
  its outline is (or its visible fill), a line or arrow only along its line, a
  path along its line or fill, and a filled marker loop ([Fill tool](fill-tool.md))
  along its line or fill. Brushing through a shape's empty inside erases
  nothing. Notes and text boxes are touched anywhere in their box.
- **Partial**: removes only the part of a stroke under the brush, splitting
  the stroke into the pieces either side. Pieces are new `freehand` elements
  with the original's colour, width and layer; one gesture is one undo, as
  for every eraser gesture ([Eraser panel](../008-canvas/eraser-panel.md)).
  **The ink a piece keeps stays where it was drawn**: a piece holds the
  original stroke's own samples plus the point where the brush's edge cut it,
  never a resampled copy (the ink's smoothing reads the sample spacing, so
  resampled ink would shift), and a stroke erased again and again never gains
  points.
  **Arrows pinned to a stroke follow the cut** in the same undo step: a stroke
  erased whole takes the arrows pinned to it, as Stroke mode does; a stroke
  split into pieces leaves each arrow end pinned to it as a free end where it
  was drawn, so no arrow is left pointing at a stroke that is gone.
  Partial applies to strokes only; a sticky, text or shape under a partial
  brush is untouched.
- The brush is a fixed size per mode (`WHITEBOARD_ERASER_RADIUS_PX`), shown
  as the eraser's ring; a whiteboard eraser has no size, target or Tap
  setting, and always sweeps: the Diagram eraser's panel settings never reach
  it.
- The brush stays under the pointer through a pan or zoom mid-sweep (a wheel
  or a pinch while erasing).
- Locked elements and locked or hidden layers stay protected, as everywhere.

## Shape recognition

- The **Drawing** section of the dock's **Settings** (cog) flyout: **Basic**
  (strokes stay as drawn, the default) or **Shape recognition**, remembered
  device-locally with the pens.
- When on, a pen stroke that reads as a shape on release is replaced by the
  clean shape, using the Shape Pen's recogniser
  ([Two pens instead of a pen and a mode](../008-canvas/two-pens.md)). The clean
  shape keeps the stroke's colour and width (the nearest border width) and has
  no fill. Undo removes it; recognition happens on release, so there is no
  intermediate stroke to bring back.
- **A preview while the pen holds still**: with recognition on, keeping the
  pen pressed and still (within 4 screen px) for **half a second** swaps the
  stroke being drawn for the shape it reads as, in the pen's colour and
  weight, exactly where it will land. **From then on the stroke is that
  shape**: it never goes back to the drawing. Dragging on without lifting
  **reshapes it**: a line's end nearer the pen follows the pen, its other end
  stays; a shape's corner nearer the pen follows the pen, the opposite corner
  stays, and dragging past it flips the box. **Shift** held while reshaping
  makes the shape perfect: a circle stays a true circle, and a diamond,
  triangle or star stays as wide as it is tall (the dragged corner follows the
  larger of the two distances). A **rectangle** snaps to whichever of three
  ratios is nearest its own when Shift is pressed: **1:1** (a square),
  **5:3** (landscape) or **3:5** (portrait), nearest by the logarithm of
  width over height, so a drawn square becomes a perfect square and a drawn
  rectangle a clean 5:3 or 3:5; a line snaps to 45° steps about
  its fixed end. Releasing Shift lets it free again on the next move. Lifting
  lands the shape exactly as shown.
- **Shift keeps the aspect ratio** whenever a placed element is resized on a
  whiteboard, as on every tab ([Canvas and palette](../008-canvas/canvas-and-palette.md), resize). A stroke that reads as no shape shows no preview. Half a
  second is long enough that a pause mid-letter does not trigger it and short
  enough to feel like an answer (Procreate's QuickShape and GoodNotes sit
  around the same). The preview and the commit run the same test
  (`recogniseBoardStroke`) on the same stroke's streamlined centre line (see
  [Pens](#pens)), so what shows is what lands.
- When off, strokes stay as drawn.
- **Alt (Option) flips it for the stroke being drawn**, whichever way the
  setting is, while the pen is still down; it never changes the setting.
  - **Detection off:** pressing Alt recognises the stroke drawn so far at
    once, as if the pen had held still: the shape shows, locks, and dragging
    on reshapes it (Shift still makes it perfect). A stroke that reads as no
    shape stays ink, and the next Alt press tries again.
  - **Detection on, a shape shown:** pressing Alt breaks out of it: the
    stroke is ink again, exactly as drawn so far, and carries on under the
    pen; while Alt is held, holding still does not snap it again.
  - Each press flips the state; releasing Alt changes nothing. Lifting the
    pen lands whatever shows. Alt pressed on its own while drawing never
    moves the focus to the browser's menu.
  - Only while drawing: a stroke already landed is not converted.
- **The same on a touch screen, without a keyboard:** when a pen or finger
  stroke holds still for the recognition pause, a small **chip** appears
  just above and before the tip (clear of the hand, 44 x 44 px target):
  **Make shape** when detection is off and the stroke reads as a shape,
  **Keep drawing** when a shape has snapped. A tap with the other hand does
  what Alt does; the pen stays down and the stroke carries on. The chip
  leaves when the pen moves on or lifts. A mouse stroke has Alt and shows no
  chip.
- **Telemetry:** `Draw` · `Toggled` · `RecogniseOnceKey`,
  `RecogniseOnceChip`, `BreakShapeKey` or `BreakShapeChip`.

## Board background

- **Plain**, **Dots** or **Grid** (the canvas's `blank`, `grid` and `graph`
  patterns: a plain canvas, its dot grid and graph paper), chosen from the
  dock's **Settings** flyout. The choice is **the person's own**, kept in the
  synced preferences as `drawPattern`
  ([User preferences](../007-editor/user-preferences.md)) and **Grid** until
  chosen. It is never stored on the tab, so choosing it changes nothing for
  anyone else, and it is the pattern of every tab that person works on with a whiteboard
  dock. Without a dock, the tab's own stored pattern shows, shared by
  everyone. Exports, thumbnails and api or MCP images always use the tab's
  stored pattern.
- The pattern is painted in the canvas's pattern colour and scales with zoom,
  as the canvas grid does.

## Appearance

The whiteboard tools have **one look with the rest of the board**
([Editor modes](../007-editor/editor-modes.md#what-a-tab-written-elsewhere-keeps)): the tab's theme, its
canvas colour and its elements look the same to every collaborator, whichever tool drew them. A tool
changes what is written into new content, never the colour of what is already there.

- **The canvas** is the tab's own: its theme's canvas, or the custom
  background colour when one is set. On the Default theme, which follows the
  reader's light or dark appearance
  ([Appearance](../004-interface-design/appearance.md)), that is an
  **off-white** board (`#fbfaf7`) in light and the editor's own **dark
  canvas** (`#0d121a`, `DARK_CANVAS_BACKGROUND_COLOR`) in dark: the board
  belongs to the app it sits in, not a literal green chalkboard.
- **Ink** is the drawing colour, the same on every theme: `#1c1917` on a
  light canvas, `#e2e8f0` on a dark one (`PEN_INK`), at least 4.5:1 against
  either Default canvas (WCAG 2.2 AA). It is stored by name (`ink`) like Grey and the
  eight hued stock colours.
- **Marker 1** draws in Ink, and so does any pen stroke or text box with no
  colour of its own. Markers 2 and 3 keep the colour they drew
  with.
- **What the whiteboard tools make is written in Ink.** A shape, line, arrow or path
  from the dock (and a shape or line a stroke is recognised as) is stored
  with an Ink outline by name and no fill (a shape's label in Ink too), so it
  looks the same wherever it is opened.
- **Stock colours are drawn for the canvas.** Every colour stored by name is
  drawn in its version for the canvas it sits on: the light version on a
  light canvas, the dark version on a dark one. On the Default theme that is
  the reader's appearance; on a theme with a fixed canvas, that canvas. The
  dock's and the quick style panel's swatches show the same versions.
- **The accent** of the editor's chrome follows the tab's theme.

## Snap colours

A board keeps every custom colour exactly as it was drawn, pasted or
imported. One option converts them all at once into the board's stock
colours, so a board brought in from elsewhere (or coloured by hand) adapts to
light and dark boards like everything drawn with the stock colours.

- **Where:** a **Colours** section, the last of the dock's Settings
  flyout, after Drawing (the flyout opens on the board side of the dock,
  wherever the dock sits), shown **only while the board has custom colours it
  can snap**. It names how many ("3 custom colours"), shows them as small
  swatches (at most eight, most recently drawn first, as the quick style
  panel's custom section does), and offers one button: **Snap to stock
  colours**.
- **What it converts:** every custom (`#rrggbb`) colour held in a field that
  has a stock counterpart: a marker stroke's colour, a shape's outline, a
  line's, arrow's or path's colour, a text box's text, and the label of an
  unfilled shape or of an arrow. Further kinds join as they gain a stock
  colour field.
- **The rule:** each colour is read in OKLCH.
  - A **neutral** colour (chroma under 0.05: black, grey, white, slate)
    becomes **Ink**, the board's own.
  - Any other colour becomes the stock colour **nearest in hue** (Blue, Red,
    Orange, Yellow, Green, Teal, Violet, Pink); a tie goes to the earlier in the
    picker's order. Lightness and chroma are not compared: each stock colour
    takes its lightness from the board it is shown on. So a magenta lands on
    Pink, a brown on Orange, a yellow on Yellow.
- **Never touched:** elements already in a stock colour or the ink,
  highlighter strokes (their recipe owns their colour), fills (a whiteboard
  has no stock fills), text on a fill (a filled shape's label, a sticky
  note's text: the fill does not adapt, so the text keeps its exact colour to
  stay readable on it), an arrow's separate head colour, images, locked elements and elements on locked or hidden layers.
- **One undo step**; collaborators receive it as any edit. Snapping is
  unavailable (the button disabled) while the board cannot be edited.
- **Confirmation:** the section then says "3 custom colours snapped to stock
  colours" as a polite status, in place of the button, until the flyout
  closes. Undo brings the colours back, and with them the section.

## Keyboard shortcuts

With the whiteboard dock, the plain-key shortcuts are the dock's, and only these
(the other element keys, the laser on K and so on, do not apply: a whiteboard has no
palette to mirror). livehuddle shows no dock, so these keys are not bound there today:

| Key    | Tool                                                    |
| ------ | ------------------------------------------------------- |
| V      | Select                                                  |
| Escape | Put the tool down: back to Select                       |
| 1      | Marker 1                                                |
| 2      | Marker 2                                                |
| 3      | Marker 3                                                |
| E      | Eraser                                                  |
| N      | Sticky note                                             |
| T      | Text box                                                |
| R      | Rectangle                                               |
| O      | Ellipse (circle / oval)                                 |
| D      | Diamond                                                 |
| C      | Cylinder                                                |
| L      | Line                                                    |
| A      | Arrow                                                   |
| P      | Path tool                                               |
| F      | Fill (the paint bucket)                                 |
| S      | Shapes: opens the Shapes flyout with its search focused |

**S** opens the Shapes flyout as a hover would, with its search field focused, so
the next letters search at once (S then "cyl" finds the cylinder); since S then types into
the search, **Escape** closes it and gives the focus back to the board. The shape keys
above still pick their shape directly.

Escape first closes whatever is open (a flyout, a text edit); with nothing
open it puts down a pen, the eraser, the Fill tool or an armed shape, and only with Select
already in hand does it clear the selection.

H (hand) and Z (zen) keep working as on any tab, and every modifier shortcut
(undo, copy, delete and the rest) is unchanged. With a single note or text
box selected, typing a character still edits it rather than switching tool;
any other selection (a shape just drawn, a line, a stroke) leaves the key to
the dock, so R then O draws a rectangle and then an ellipse.
View-role visitors get V and Escape only. A Participant also keeps its palette's keys (N, T and 9,
[Share roles](../013-workspace/share-roles.md)), which arm its tiles here as on any
tab, never the dock's tools. Each dock button and Shapes option
with a key shows it small in its bottom-right corner, as the Toolbar strip does (a tool bar is
where people learn the keys), and carries it in `aria-keyshortcuts`.

## Accessibility

- The dock is a `role="toolbar"` with an accessible name, arrow-key movement
  between buttons, and each button labelled (pens by colour name and width).
  Flyouts are reachable and dismissible by keyboard (Escape returns focus to
  the dock button).
- The active tool and pen are announced (`aria-pressed`).
- Drawing itself is pointer-only; everything else on a whiteboard (select,
  move, delete, sticky, text, shapes) works from the keyboard as on any tab.
- Reduced motion ([User preferences](../007-editor/user-preferences.md)) removes
  the flyout and dock animations.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Preset-enum events only, never content, under a `Draw` category (named `Whiteboard` until its stored history was rewritten):

| Event                     | Action                                    | Type                                                     |
| ------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| A whiteboard imported     | `Created`                                 | `Import`                                                 |
| A pen picked              | `Selected`                                | `Main`, `Second`, `Third`                                |
| A shape picked in search  | `Selected`                                | `ShapeSearch` (never the kind)                           |
| A shape pinned / unpinned | `Changed`                                 | `ShapePinned`, `ShapeUnpinned` (never the kind)          |
| A pen changed             | `Changed`                                 | `PenColour`, `PenWidth` (a width on any pen), `PenReset` |
| The pen cursor chosen     | `Changed`                                 | `CursorDot`, `CursorCrosshair`                           |
| Eraser mode switched      | `Changed`                                 | `EraserStroke`, `EraserPartial`                          |
| The Fill tool             | see [Fill tool](fill-tool.md) "Telemetry" |                                                          |
| Shape recognition toggled | `Toggled`                                 | `RecognitionOn`, `RecognitionOff`                        |
| Background changed        | `Changed`                                 | `BackgroundPlain`, `BackgroundDots`, `BackgroundGrid`    |
| Custom colours snapped    | `Changed`                                 | `SnapColours` (never a colour or a count)                |

A pen reports its place, never its colour. Strokes, stickies and text report
through the ordinary `Element` / `Added` events.

## Help centre ([Help app](../018-help/help-app.md))

No article of its own: Draw mode's article went with the mode. The Eraser key is in
[Keyboard shortcuts](/help/tips-and-tricks/keyboard-shortcuts/); pens, the path tool, the fill tool and the two erasers have no
help text yet. A new article registers per
[Register a help article](../../instructions/register-a-help-article.md).

## Non-goals

- Themes on whiteboards beyond the Default theme's two halves.
- Microsoft Whiteboard extras (reactions, ruler, templates gallery, ink
  beautification) until use asks for them.

## References

[Editor modes](../007-editor/editor-modes.md), [Two pens instead of a pen and a mode](../008-canvas/two-pens.md)
(shape recogniser),
[Eraser panel](../008-canvas/eraser-panel.md),
[Appearance](../004-interface-design/appearance.md),
[Microsoft Whiteboard import](../020-import-export/whiteboard-import.md),
[Google Drive sync](../../../../liveworkspace/docs/specs/005-drive/drive.md).
