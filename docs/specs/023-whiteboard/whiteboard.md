# Whiteboard

A **whiteboard** is a kind of tab built for plain, freehand whiteboarding:
pick up a pen and draw, with the simplicity of Microsoft Whiteboard. It sits
beside diagram tabs in the same document, and it is where imported Microsoft
Whiteboard boards open ([Microsoft Whiteboard import](../020-import-export/whiteboard-import.md)).

A whiteboard is an ordinary tab carrying `kind: 'whiteboard'` (`TabKind`,
`packages/document/src/tab-kind.ts`), in the same way an event-storming board
carries `kind: 'event-storming'` ([Event storming](../021-event-storming/event-storming.md)).
The kind tunes **presentation**; it does not fork the document model. Strokes
are `freehand` elements, notes are stickies, text is `text`, shapes are shapes.
So realtime, comments, layers, export, share links, Offline Mode and the
[Google Drive mirror](../022-drive-mirror/drive-mirror.md) work on a
whiteboard without whiteboard-specific code.

The feature is built and then tuned in rounds with the operator. This spec
states what a whiteboard is; values that only use can settle (exact colours,
pen widths, dock spacing) are named constants, tuned in place.

## Why a tab kind

- **Mixable.** A workshop often needs a free sketch next to a tidy diagram.
  Making the whiteboard a tab, not a whole-document type, lets one document hold
  both, and a tab can be added, reordered, grouped into tab folders and shared
  like any other.
- **No second editor.** Every editor feature reads the same elements, so a
  whiteboard inherits fixes and features for free and nothing drifts.
- **Total union.** `TabKind` becomes `'diagram' | 'event-storming' |
'whiteboard'`; `tabKindOf` reads `'whiteboard'` explicitly and everything else
  keeps reading as before, so tabs written before the kind existed are unchanged.

## Creating one

- **New Document wizard:** a **Whiteboard** template (a `TemplateKind` with a
  blank builder and a preview tile, `packages/templates`), producing a document
  with one whiteboard tab.
- **New tab:** the tab bar's new-tab action opens Quick Start as on any
  document, and Quick Start offers **Whiteboard** as a quick-pick beside
  **Blank**, so a whiteboard can be added to any document in the same two
  clicks as an ordinary tab.
- **No theme step.** A whiteboard has no theme, so picking Whiteboard skips
  the wizard's theme step: in the New Document wizard it goes straight to the
  settings step, in Quick Start it lands at once.
- **Import:** a Microsoft Whiteboard import lands on a whiteboard tab.
- A tab's kind is fixed at creation. Converting a diagram tab into a
  whiteboard (or back) is not offered: the two present the same elements very
  differently, and a silent switch would surprise.

## What a whiteboard shows

A whiteboard trades the editor's full chrome for one **floating dock** at the
bottom centre of the canvas, like Microsoft Whiteboard's.

- **Hidden on a whiteboard tab:** the palette (floating and the Toolbar
  layout's strip), the format painter, the highlighter (a whiteboard's pens are its markers), the Theme &
  canvas brush and the theme-mode banner, the tool panels (the eraser's
  settings live in the dock's flyout instead) and the empty-canvas banner (the dock is the hint). The header,
  tab bar, Explorer (its menu button keeps its corner on a phone),
  collaboration, comments, layers, activity and zoom controls stay, because
  they are about the document, not about drawing.
- **The quick style panel stays** ([Quick style panel](../008-canvas/quick-style-panel.md)):
  it is how a shape, line or text box gets another colour or width once
  drawn, since the pens colour only their own strokes. Its "theme default"
  swatches show the board's ink (and no fill for a background), and a
  restyle on a whiteboard never feeds the style memory diagram tabs use.
  Selected pen strokes get **Marker colour** and **Marker width** (Fine / Medium /
  Bold). The quick style panel is **quick choices only**: no colour picker in
  it. **Marker colour** is the same **eight stock colours** as the marker's
  picker, adaptive like them. Below them, **a second section of custom
  colours appears only when custom colours are used on this whiteboard
  tab**: the custom (hex) colours of the tab's marker strokes and shapes, up
  to eight, most recently drawn first; with none on the tab, the section is
  not there. A custom colour is added with the marker picker's **+**. With nothing selected
  and a pen in hand, the panel styles **that pen**: picking up a pen already
  offers its colour and width, the same settings its dock flyout holds.
  **Every pen shows the same rows**, so Marker width stays at the same height
  whichever pen is in hand: Marker 1's colour row holds its one colour,
  the ink. A caption above the rows names whose style it is ("Marker 2",
  "Marker stroke", "3 marker strokes"); power user mode leaves it out.
- **Read-only:** a view-role visitor sees the board without the dock; there
  is nothing on it they could use.
- **One dock, no modes.** Every user sees the same four groups; the shapes
  bar stays small by starting with just two pinned shapes, so there is no
  simpler mode to switch to.
- **The dock is four groups side by side**, centred together at the bottom
  of the canvas with a clear gap between them, left to right: **drawing
  tools**, **shapes**, **history** (Undo, Redo) and **settings** (the cog on
  its own). Each group is its own pill, and its own toolbar for assistive
  technology ("Drawing tools", "Shapes", "History", "Settings"), each one Tab
  stop with arrow keys moving within it.
- **Drawing tools, left to right:**
  1. **Select** (marquee and move; the ordinary select tool).
  2. **Markers 1, 2 and 3**: the preset pens, one button each (see [Pens](#pens)).
  3. **Text**.
  4. **Path tool** (see [Path tool](path-tool.md)).
  5. **Eraser**, with its mode (see [Eraser](#eraser)).
- **Shapes, left to right:**
  1. **Pinned shapes**, the left side of the bar: up to seven shape kinds
     the user keeps there (see [Shape slots](#shape-slots)); by default
     **Arrow, Rectangle**, in that order. A pinned shape with a shape key
     shows that key on its button, as every dock tool does (A, R, O, D, C,
     L; see [Keyboard shortcuts](#keyboard-shortcuts)).
  2. A **separator**.
  3. **Shapes**: one button for every shape. It opens its flyout on hover
     (a mouse or a pen, never a finger) as well as on a press, and closes a
     moment after the pointer leaves both it and the button; a press on a
     hover-opened flyout keeps it open. The flyout is small and sweet:
     - **six slots** in two unlabelled rows of three: the top row the
       shapes picked **most recently**, the bottom row the shapes picked **most
       often**; see [Shape slots](#shape-slots);
     - a **search field**, **focused as soon as the flyout opens**, hover
       included, so typing at once finds any shape of the palette's shape
       catalogue by name or keyword (flowchart, basic, block and every other
       shape kind the palette offers; not icons, templates or components).
       Opening it on hover is the one place hover takes the keyboard focus:
       while the field holds it, letters type there rather than picking dock
       tools, and Escape or the flyout closing gives the focus back to the
       board.
     - **No full list**: with the field empty only the six slots show;
       typing replaces them with **at most six results**, the best matches
       first, as the shapes' own previews in the board's ink. No match says
       "No shapes match".
     - Arrow keys move through the slots or the results, **Enter** or a press
       picks one, which arms it like a dock shape (plain ink, the tool style
       of its kind, drawn with a drag or dropped with a click) and closes the
       flyout; **Escape** closes it without picking.
- **History:** **Undo** and **Redo**, the same actions as the bottom-right
  cluster and the keyboard; disabled when there is nothing to undo or redo.
- **The sticky note is a shape here, not a drawing tool.** It has no button
  in the drawing tools bar; it is one of the shapes: found in the Shapes
  flyout's search ("sticky", "note", "post-it"), shown in its slots once
  picked, and pinnable to the shapes bar like any shape. Its key **N** still
  places one, from anywhere, and counts as a pick.
- **Settings**, the last group: a **cog** that opens **on a press only**, never on hover; a
  flyout with no title of its own and three sections, each headed in the
  flyouts' small capitals and a row of the same switch buttons, top to
  bottom: **Background** (Plain / Dots / Grid), **Cursor** (Crosshair + nib,
  the default / Dot) and **Drawing** (Basic / Shape recognition). Text and
  the Path tool are always in the drawing tools bar; nothing hides them.
- **No highlighter.** A whiteboard's pens are its markers, so the dock has
  none, search does not offer it (nor the format painter), and one held on a
  diagram tab is put down on arriving at a whiteboard.
- The dock never moves when a tool is picked: flyouts open **above** it, and
  each group's own width is fixed per breakpoint, so nothing shifts under the
  pointer (zero layout shift).
- On narrow screens the dock scrolls horizontally rather than wrapping.
- A sticky or a text box placed from the dock opens for typing at once.
- Selecting an element shows the ordinary on-canvas selection handles; its
  styling is reached through right-click, as on any tab, but the menu offers
  only what a whiteboard element uses (colour, width, delete, bring forward /
  send back, duplicate, comment).

## Shape slots

The shapes group learns and keeps the shapes a user reaches for.

- **The six slots** live in the **Shapes** flyout, not on the bar, in two
  rows of three with **no labels**: they are meant to become obvious after a
  few picks. The **top row is recent**, the **bottom row most used**. Each arms its shape kind like a dock
  shape (plain ink, its kind's tool style), with the kind's own preview as its
  icon and **no name under it**: the name is its tooltip on hover and focus
  and its accessible name, like every dock button. Search results show the
  same way. Picks count from a slot, a
  search result, a pinned shape or a shape key, on whiteboards only.
  - **Most used** (bottom row): the three kinds with the most picks that are
    not pinned, most picked first; ties go to the one picked most recently.
    Worked out first.
  - **Recent** (top row): the three kinds picked most recently, newest first,
    that are neither pinned nor among the most used. A kind that is both
    recent and among the most used shows **in the most-used row only**, so
    the most-used icons stay put while the recent row changes.
  - **No kind shows twice** across the pinned shapes and the six slots. With
    too little history, an empty slot takes the next kind of this order that
    is not already showing: rectangle, ellipse, diamond, cylinder, line,
    arrow, then the palette catalogue. With the default pins, the most-used
    row starts as **Ellipse, Diamond, Cylinder** and the recent row as
    **Line** and the next two.
  - The slots update after a pick, never while the flyout is open, so a slot
    never changes under the pointer.
- **Pinned side:** the left of the shapes bar, up to the separator. A user who has
  never changed it has two pins, in this order: **Arrow**, **Rectangle**. Up
  to **seven** kinds can be pinned. Every pinned shape that has a shape key
  shows it on its button (bottom right, as on every dock tool) and in
  `aria-keyshortcuts`, wherever it is pinned.
- **Pinning:** dragging a slot (or a search result) **from the Shapes
  flyout onto the pinned side** pins its kind at the drop position; while
  dragging, a drop marker shows where it will land, and the flyout stays open
  until the drop. With seven pinned, dropping onto a pinned shape replaces
  that one; dropping elsewhere is refused, and the dragged shape settles back
  with the hint "Seven shapes are pinned. Drag one out to swap." Dragging a
  pinned shape to another place on the pinned side reorders it. A drag starts
  after 6 screen px, so a press still picks.
- **Unpinning only moves a shape off the pinned side**: dragging it off the
  pinned side (past the separator or off the bar), or **Unpin** in its menu.
  It is not removed or forgotten: its picks stay, so it can show at once in
  either row of the Shapes flyout; otherwise it is still in the
  Shapes flyout, or its search. Unpinning every shape leaves the pinned side
  empty, and that is kept: the defaults never come back on their own.
- **Pinning without a drag:** a right-click or long-press on a slot, or
  Shift+F10 / the context-menu key on a focused slot, offers **Pin to dock**
  (a slot or a search result) or **Unpin** (a pinned shape), with the same limit and refusal.
- **Stored per user:** the pick counts and the pinned kinds (stored only once
  the user changes them, so "never changed" still means the defaults) live in the
  user's synced preferences ([User preferences](../007-editor/user-preferences.md)),
  so they follow the user across devices; a guest keeps them in this
  browser. Only kinds from the palette's shape catalogue are stored; unknown
  kinds are dropped on read.
- **Telemetry:** `Whiteboard` · `Changed` · `ShapePinned` / `ShapeUnpinned`
  (never the kind).

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
- **Widths**, on every pen including Marker 1: **Fine** (1 px),
  **Medium** (1.5 px, the default) and **Bold** (2.5 px),
  `WHITEBOARD_PEN_WIDTHS`: a subtle line at 100%, not a felt tip (the width at
  medium pressure). (Tuned with
  the operator: Medium is what Fine was, each step one notch thinner.) The width is recorded as the stroke's `penWidth`, which every
  freehand renderer honours; choosing a border width from an element's menu
  afterwards replaces it. A pen stores its width as the preset's name, not its
  px, so retuning the px never reinterprets a stored choice.
- **Right-clicking a pen resets it** to how it started (its starting colour
  and Medium), without picking it up; a pen already as it started is left
  alone. The context-menu key and Shift+F10 on the focused button do the same.
- **Picking a marker, and its colour:** a press on a marker picks it up; a
  press on the marker already in hand opens its **colour picker** (a flyout
  above it, like the others). For Marker 1 it holds the width only.
- **The colour picker** (Markers 2 and 3), top to bottom:
  - **Eight stock colours** in one row: **Ink, Blue, Red, Orange, Green,
    Teal, Violet, Pink**, the same eight as the quick style panel's.
    **Ink comes first: it is the default colour**, and Markers 2 and 3 can
    take it too (the same ink at another width, say), not only Marker 1.
  - **Every stock colour adapts to the board.** It is stored by name, not as
    a hex value, and drawn in the version tuned for the board it is shown on
    (darker on the light board, lighter on the dark one), at least 4.5:1
    against its board (WCAG 1.4.11 with room to spare). So none is ever too
    close to either board, and two people in different appearances both see
    every stroke clearly.
  - **Your colours:** up to **eight** custom colours, most recently used
    first, kept in the user's synced preferences; using a custom colour puts
    it at the front, so picking it again is one press. A custom colour is one
    exact hex value on both boards.
    **Removing one:** a right-click (a long-press on touch, Shift+F10 or the
    context-menu key on a focused swatch) on a custom colour opens a small
    menu with **Remove**, which takes it out of Your colours. Strokes already
    drawn in it keep it, and a marker set to it keeps it until changed.
  - **+** at the end of that row opens the custom picker in place: a
    saturation and brightness square, a hue slider, a hex field and, where
    the browser has one, an **eyedropper**; **Use** applies it. When the
    colour is under 3:1 on either board, a **warning** in the warning colour
    (amber, with its icon, at least 4.5:1 on the panel) says which ("Hard
    to see on the dark board") and offers a nearby version that is not, as
    a swatch to press. **The warning's line is always reserved**, empty
    until needed, so it never shifts the picker.
  - **Width:** Fine, Medium, Bold.
  - Each swatch has its name as its tooltip and accessible name ("Blue",
    "Custom #ff6b00"); arrow keys move through a row, Enter picks, Escape
    closes.
- Markers 2 and 3 start as **Blue** and **Red**. **Existing strokes
  stay as drawn**: a stroke keeps the exact colour it was drawn in; only
  strokes drawn after this record a named colour.
- **A pen stays in hand.** After a stroke the pen is still armed, as the
  highlighter is ([Highlighter](../008-canvas/highlighter.md)): the next drag
  draws again, and the stroke just drawn is not selected. Select, Escape or
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
- **A pen's width is ink on the board.** It is in canvas px, so a stroke
  zooms with the board like everything drawn on it, the same in every
  browser, and the in-flight stroke is drawn at that width times the zoom.
  (Strokes are not drawn with a non-scaling stroke: browsers disagree about
  whether that undoes a zoomed canvas, which made a finished stroke thinner
  than the one being drawn in Safari.)
- **No guides for pens.** A pen draws freely: no alignment guides while it
  is drawn, and no snapping of the first point to a neighbour. Guides and
  snapping stay for shapes and lines from the Shapes flyout.
- **Strokes stay open.** A whiteboard stroke that ends near its start is not
  closed and filled, as a pencil sketch on a diagram tab is: an "o" written on
  a board is ink, not a shape.
- Pens are the user's, not the board's: they persist **device-locally** in
  `localStorage` (`livediagram:v2:whiteboard-pens`), like the other tool
  panels, and never travel with the document.
- A stroke records the pen's colour and width on its `freehand` element when
  drawn, with its raw samples, a pressure per sample when a pen drew it, and
  its streamline. A stroke in the **Ink** (Marker 1's, or any marker's) records
  no explicit colour, so it follows the appearance; a stock colour is recorded
  by name, so it adapts to each viewer's board, and a custom colour as its
  hex, which stays as drawn. A recognised shape or line keeps its pen's colour
  the same way.

## Shapes

- **A pen is a separate tool: pens do not set the colour of the other
  tools.** A shape, line or arrow from the Shapes flyout (or its key), a
  sticky and a text box are drawn in the board's ink at their default width,
  whichever pen was last in hand. A shape has no fill.
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
  a drawn shape teaches its kind the same way, as on a diagram tab. Clear
  styles with a tool in hand puts its kind back to plain ink. Line and arrow
  share one remembered style, as all arrows do.
- A whiteboard keeps **its own style memory**, apart from its document's
  diagram tabs: whiteboarding is a different activity, so a board's styles
  never dress a diagram's next shape, nor a diagram's a board's, for any
  shape kind, tool style or restyle, in the same document or another.
  Leaving a whiteboard puts its shape, line or arrow tool down, as it puts a
  pen down, so a diagram tab never previews or names its next shape the
  board's way; the panel's "Next rectangle" always shows the style of the
  board in front of you.
- A **recognised** shape (see [Shape recognition](#shape-recognition)) is
  different: it is a pen stroke tidied up, so it keeps that pen's colour and
  weight.

## Selecting

- **A pen stroke is picked by its drawn line**, not its box: a click within
  6 screen px of the line (either side, at any zoom) selects it, and a click
  elsewhere in its box passes through to whatever is beneath, or the board.
  Once selected, its box drags and resizes it as any element's.
- **A shape is picked by its drawn outline too** (rectangle, ellipse,
  diamond, cylinder, a recognised triangle or star, and every other shape
  kind): a click within 6 screen px of the outline selects it, and a click in
  its empty inside passes through to whatever is beneath, or the board. A
  shape with a **visible fill** is also picked anywhere on its fill. Lines and
  arrows are picked by their line, and paths by their line or fill
  ([Path tool](path-tool.md)). **Notes and text boxes** keep their whole box:
  they are filled or hold text. So does a kind that paints its own face (a
  chart, a panel, an icon, a web component).
- The **outline is the one drawn**, not the box: an ellipse by its curve, a
  diamond by its four edges, a cylinder by its body and rim, following the
  shape's rotation.
- **Shift with Select always drags a selection box**, even when the press
  starts on an element, and the box **adds** what it encloses to the
  selection. A **Shift-click** on an element adds it to the selection or
  removes it; a Shift-click on the empty board keeps the selection. A
  resize handle keeps its own Shift behaviour.

## Text boxes

A text box on a whiteboard **hugs its text**: its box, and so its selection
ring and handles, sit just around the words, with only enough padding to grab
and read it comfortably.

- **Padding:** 4 canvas px left and right, 2 px top and bottom, around the
  text's own line box. Nothing else is added: no default width or height.
- **Click to place:** the box starts as the width of the caret plus its
  padding, one line tall, and **grows as you type**, widening with the text
  on one line (Enter starts a new line; the box grows down), and shrinks back
  as text is deleted. It wraps only once it reaches 480 canvas px wide.
- **Drag to size:** dragging out a text box sets its **width**; the text
  wraps inside it and the **height always hugs** the lines.
- **Resizing** a text box with a side or corner handle sets its width the
  same way; its height stays hugging the text. With Shift (the aspect ratio
  rule) the box keeps its ratio by scaling the text size with it instead.
- An empty text box left by clicking away is removed, as today.
- Existing text boxes keep their size until edited or resized; then they hug.
- Notes (stickies) keep their fixed note size.

## Nothing animates in

A whiteboard is still: a stroke, shape, sticky or text box appears exactly as
drawn, with none of the pop-in a new element gets on a diagram tab. It is
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
- Only the pointer that started a stroke draws it; another finger landing
  meanwhile is a pinch or pan, never part of the stroke.
- Palm rejection beyond this is the browser's; no timing heuristics.

## Eraser

The eraser offers **both** modes, switched in its flyout:

- **Stroke** (default): touching a stroke removes the whole stroke. It is the
  existing eraser in Sweep mode, with one difference: a stroke counts as
  touched only where its ink is (within the brush of the drawn line), not
  anywhere in its bounding box, so erasing beside a long stroke leaves it
  alone. **The same holds for every element the whiteboard picks by its
  drawn path** (see [Selecting](#selecting)): a shape is touched only where
  its outline is (or its visible fill), a line or arrow only along its line, a
  path along its line or fill. Brushing through a shape's empty inside erases
  nothing. Notes and text boxes are touched anywhere in their box.
- **Partial**: removes only the part of a stroke under the brush, splitting
  the stroke into the pieces either side. Pieces are new `freehand` elements
  with the original's colour, width and layer; one gesture is one undo, as
  for every eraser gesture ([Eraser panel](../008-canvas/eraser-panel.md)).
  Partial applies to strokes only; a sticky, text or shape under a partial
  brush is untouched.
- The brush is a fixed size per mode (`WHITEBOARD_ERASER_RADIUS_PX`), shown
  as the eraser's ring; a whiteboard eraser has no size or target setting.
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
- **Telemetry:** `Whiteboard` · `Toggled` · `RecogniseOnceKey`,
  `RecogniseOnceChip`, `BreakShapeKey` or `BreakShapeChip`.

## Board background

- **Plain**, **Dots** or **Grid**, chosen per whiteboard from the dock's
  **Settings** flyout and stored on the tab as its `backgroundPattern` (`blank`,
  `grid` and `graph`: the canvas's own dot grid and graph paper), so every
  participant sees the same board and older readers render it too. A new
  whiteboard starts on **Grid** (`graph`), from the template, a new tab or
  Quick Start; a whiteboard that already has a background keeps it.
- The pattern follows the appearance's board colours and scales with zoom, as
  the canvas grid does on diagram tabs.

## Appearance

A whiteboard has **no theme picker**. It always uses the **Default theme**,
which already follows the reader's light or dark appearance
([Appearance](../004-interface-design/appearance.md)):

- **Light:** a **whiteboard**: an off-white board with a **black marker** as
  the ink colour.
- **Dark:** the editor's own **dark canvas** (the Default theme's dark
  half, the blue-slate the dark chrome is made of) with a soft off-white ink.
  Not a literal green chalkboard: the board belongs to the app it sits in.
- Only colours change. Pens behave identically in both; **Marker 1** and
  any unpainted element simply render in the appearance's ink colour. The
  Markers 2 and 3 keep the colour they drew with.
- The board and ink colours are two named tokens of the Default theme's
  whiteboard variant (`WHITEBOARD_BOARD`, `WHITEBOARD_INK`, one value per
  appearance), tuned with the operator; the light and dark pairs must meet
  WCAG 2.2 AA contrast for ink on board (at least 4.5:1). A third token,
  `WHITEBOARD_PATTERN`, paints the dots and grid lines, faint against the
  board.
- **Values:** light board `#fbfaf7` with ink `#1c1917`; dark board `#0d121a`
  (`DARK_CANVAS_BACKGROUND_COLOR`) with ink `#e2e8f0`, its dots and grid the
  dark canvas's own pattern colour (`DARK_CANVAS_PATTERN_COLOR`).
- Nothing is written onto elements: the ink is a **display projection**. An
  unpainted stroke, text, shape or line is drawn in the ink colour while it
  sits on a whiteboard, and in the ordinary default colours anywhere else.
  Unpainted shapes are drawn without a fill, as marker on a board.
- A document's theme applies to its diagram tabs only; a whiteboard tab in a
  themed document still shows the whiteboard look.

## Keyboard shortcuts

On a whiteboard the plain-key shortcuts are the dock's, and only these
(the diagram tab's other element and mode keys, the laser on K and so on, do
not apply: a whiteboard has no palette to mirror):

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
| S      | Shapes: opens the Shapes flyout with its search focused |

**S** opens the Shapes flyout as a hover would, with its search field focused, so
the next letters search at once (S then "cyl" finds the cylinder); since S then types into
the search, **Escape** closes it and gives the focus back to the board. The shape keys
above still pick their shape directly.

Escape first closes whatever is open (a flyout, a text edit); with nothing
open it puts down a pen, the eraser or an armed shape, and only with Select
already in hand does it clear the selection.

H (hand) and Z (zen) keep working as on any tab, and every modifier shortcut
(undo, copy, delete and the rest) is unchanged. With a single note or text
box selected, typing a character still edits it rather than switching tool;
any other selection (a shape just drawn, a line, a stroke) leaves the key to
the dock, so R then O draws a rectangle and then an ellipse.
View-role visitors get V and Escape only. Each dock button and Shapes option
with a key shows it small in its bottom-right corner, as the Toolbar layout's strip does (a tool bar is
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

Preset-enum events only, never content, under a `Whiteboard` category:

| Event                     | Action     | Type                                                     |
| ------------------------- | ---------- | -------------------------------------------------------- |
| A whiteboard created      | `Created`  | `Template` (wizard), `NewTab`, `Import`                  |
| A pen picked              | `Selected` | `Main`, `Second`, `Third`                                |
| A shape picked in search  | `Selected` | `ShapeSearch` (never the kind)                           |
| A shape pinned / unpinned | `Changed`  | `ShapePinned`, `ShapeUnpinned` (never the kind)          |
| A pen changed             | `Changed`  | `PenColour`, `PenWidth` (a width on any pen), `PenReset` |
| The pen cursor chosen     | `Changed`  | `CursorDot`, `CursorCrosshair`                           |
| Eraser mode switched      | `Changed`  | `EraserStroke`, `EraserPartial`                          |
| Shape recognition toggled | `Toggled`  | `RecognitionOn`, `RecognitionOff`                        |
| Background changed        | `Changed`  | `BackgroundPlain`, `BackgroundDots`, `BackgroundGrid`    |

A pen reports its place, never its colour. Strokes, stickies and text report
through the ordinary `Element` / `Added` events.

## Help centre ([Help app](../018-help/help-app.md))

One article, **Whiteboards**: creating one, the dock, pens, pen versus touch,
the two erasers, shape recognition and backgrounds. Registered per
[Register a help article](../../instructions/register-a-help-article.md).

## Rounds

The whiteboard is built in rounds and tuned with the operator between them.

- **Round one** (built, being tuned): the kind, the template and Quick Start
  entry, the dock with every tool above, pen versus touch, the light and dark
  board looks, the backgrounds, telemetry and the help article. Opening a
  whiteboard, or turning a fresh tab into one, puts the active pen in hand.
  The dock sits above the bottom-right controls until the window is wide
  enough for both on one line.
- **Still ahead:** the trimmed element menu (colour, width, delete, stacking,
  duplicate, comment); until then a whiteboard element opens the ordinary
  menu. The Microsoft Whiteboard import lands with its own spec.

## Non-goals

- Themes on whiteboards beyond the Default theme's two halves.
- Converting an existing tab between kinds.
- Microsoft Whiteboard extras (reactions, ruler, templates gallery, ink
  beautification) until use asks for them.

## References

[Event storming](../021-event-storming/event-storming.md) (the tab-kind
precedent), [Two pens instead of a pen and a mode](../008-canvas/two-pens.md)
(shape recogniser),
[Eraser panel](../008-canvas/eraser-panel.md),
[Appearance](../004-interface-design/appearance.md),
[Microsoft Whiteboard import](../020-import-export/whiteboard-import.md),
[Google Drive mirror](../022-drive-mirror/drive-mirror.md).
