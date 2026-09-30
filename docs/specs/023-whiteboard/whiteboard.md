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
  layout's strip), the quick style panel beside a selection, the format
  painter, the highlighter (a whiteboard's pens are its markers), the Theme &
  canvas brush and the theme-mode banner, the tool panels (the eraser's
  settings live in the dock's flyout instead) and the empty-canvas banner (the dock is the hint). The header,
  tab bar, Explorer (its menu button keeps its corner on a phone),
  collaboration, comments, layers, activity and zoom controls stay, because
  they are about the document, not about drawing.
- **Read-only:** a view-role visitor sees the board without the dock; there
  is nothing on it they could use.
- **The dock holds, left to right:**
  1. **Select** (marquee and move; the ordinary select tool).
  2. **Pens**: the preset pens, one button each (see [Pens](#pens)).
  3. **Eraser**, with its mode (see [Eraser](#eraser)).
  4. **Sticky note**.
  5. **Text**.
  6. **Shapes**: a small flyout of rectangle, ellipse, diamond, line
     and arrow, drawn with the pen in hand (see [Shapes](#shapes)).
  7. **Shape recognition** toggle (see [Shape recognition](#shape-recognition)).
  8. **Undo** / **Redo**.
  9. **More**: board background and, when the operator asks for it, the full
     palette as an escape hatch.
- **No highlighter.** A whiteboard's pens are its markers, so the dock has
  none, search does not offer it (nor the format painter), and one held on a
  diagram tab is put down on arriving at a whiteboard.
- The dock never moves when a tool is picked: flyouts open **above** it, and
  the dock's own width is fixed per breakpoint, so nothing shifts under the
  pointer (zero layout shift).
- On narrow screens the dock scrolls horizontally rather than wrapping.
- A sticky or a text box placed from the dock opens for typing at once.
- Selecting an element shows the ordinary on-canvas selection handles; its
  styling is reached through right-click, as on any tab, but the menu offers
  only what a whiteboard element uses (colour, width, delete, bring forward /
  send back, duplicate, comment).

## Pens

- A whiteboard offers **three pens**, left to right: the **main pen**, the
  **second pen** and the **third pen**, all Medium width. Picking a pen
  button selects it; picking the active pen again opens its flyout. The pens
  are named by their place, never by a colour, because the second and third
  pens can be any colour.
- **The main pen always draws in the default colour**: the adaptive ink of
  the board (see [Appearance](#appearance)); its width is adjustable like any
  pen's, so its flyout offers the width only.
- **The second and third pens are adjustable**: their flyouts change both
  colour and width. They start as **blue** (second) and **red** (third), and
  keep their place and name whatever colour they are given.
- **Widths**, on every pen including the main pen: **Fine** (1 px),
  **Medium** (1.5 px, the default) and **Bold** (2.5 px),
  `WHITEBOARD_PEN_WIDTHS`: a subtle line at 100%, not a felt tip. (Tuned with
  the operator: Medium is what Fine was, each step one notch thinner.) The width is recorded as the stroke's `penWidth`, which every
  freehand renderer honours; choosing a border width from an element's menu
  afterwards replaces it. A pen stores its width as the preset's name, not its
  px, so retuning the px never reinterprets a stored choice.
- **Colours** in an adjustable pen's flyout: a small set of named colours,
  each at least 3:1 against both boards (WCAG 1.4.11), `WHITEBOARD_PEN_COLOURS`.
  The ink is not among them: it is the main pen's.
- **A pen stays in hand.** After a stroke the pen is still armed, as the
  highlighter is ([Highlighter](../008-canvas/highlighter.md)): the next drag
  draws again, and the stroke just drawn is not selected. Select, Escape or
  another tool puts it down.
- **What you draw is what lands.** While a stroke is being drawn it already
  shows in the pen's colour and **exact thickness** (the main pen in the
  board's ink); on release only the smoothing of the line may change.
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
  drawn. The **main pen** records no explicit colour, so its strokes follow the
  appearance; every other pen records its colour, which stays as drawn.

## Shapes

- A shape or line from the dock's Shapes flyout is drawn **with the pen in
  hand**: its outline in the pen's colour (none for Ink, so it follows the
  board), at the pen's weight (the exact width on a line or arrow, the
  nearest border width on a shape), with no fill.
- It previews that way while it is dragged out: solid, in the pen's colour
  and weight, unfilled.

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
- Palm rejection beyond this is the browser's; no timing heuristics.

## Eraser

The eraser offers **both** modes, switched in its flyout:

- **Stroke** (default): touching a stroke removes the whole stroke. It is the
  existing eraser in Sweep mode, with one difference: a stroke counts as
  touched only where its ink is (within the brush of the drawn line), not
  anywhere in its bounding box, so erasing beside a long stroke leaves it
  alone. Other elements are touched as on any tab.
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

- A **toggle** in the dock, **off by default**, remembered device-locally with
  the pens.
- When on, a pen stroke that reads as a shape on release is replaced by the
  clean shape, using the Shape Pen's recogniser
  ([Two pens instead of a pen and a mode](../008-canvas/two-pens.md)). The clean
  shape keeps the stroke's colour and width (the nearest border width) and has
  no fill. Undo removes it; recognition happens on release, so there is no
  intermediate stroke to bring back.
- When off, strokes stay as drawn.

## Board background

- **Plain**, **Dots** or **Grid**, chosen per whiteboard from the dock's
  **More** flyout and stored on the tab as its `backgroundPattern` (`blank`,
  `grid` and `graph`: the canvas's own dot grid and graph paper), so every
  participant sees the same board and older readers render it too. Default
  **Plain**.
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
- Only colours change. Pens behave identically in both; the **main pen** and
  any unpainted element simply render in the appearance's ink colour. The
  second and third pens keep the colour they drew with.
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

| Key    | Tool                              |
| ------ | --------------------------------- |
| V      | Select                            |
| Escape | Put the tool down: back to Select |
| 1      | Main pen                          |
| 2      | Second pen                        |
| 3      | Third pen                         |
| E      | Eraser                            |
| N      | Sticky note                       |
| T      | Text box                          |
| R      | Rectangle                         |
| O      | Ellipse (circle / oval)           |
| D      | Diamond                           |
| L      | Line                              |
| A      | Arrow                             |

The shape keys draw with the pen in hand, as the Shapes flyout does.
Escape first closes whatever is open (a flyout, a text edit); with nothing
open it puts down a pen, the eraser or an armed shape, and only with Select
already in hand does it clear the selection.

H (hand) and Z (zen) keep working as on any tab, and every modifier shortcut
(undo, copy, delete and the rest) is unchanged. With a single note or text
box selected, typing a character still edits it rather than switching tool.
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

| Event                     | Action     | Type                                                  |
| ------------------------- | ---------- | ----------------------------------------------------- |
| A whiteboard created      | `Created`  | `Template` (wizard), `NewTab`, `Import`               |
| A pen picked              | `Selected` | `Main`, `Second`, `Third`                             |
| A pen changed             | `Changed`  | `PenColour`, `PenWidth` (a width on any pen)          |
| Eraser mode switched      | `Changed`  | `EraserStroke`, `EraserPartial`                       |
| Shape recognition toggled | `Toggled`  | `RecognitionOn`, `RecognitionOff`                     |
| Background changed        | `Changed`  | `BackgroundPlain`, `BackgroundDots`, `BackgroundGrid` |

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
- Pressure-sensitive stroke width; strokes have one width.

## References

[Event storming](../021-event-storming/event-storming.md) (the tab-kind
precedent), [Two pens instead of a pen and a mode](../008-canvas/two-pens.md)
(shape recogniser),
[Eraser panel](../008-canvas/eraser-panel.md),
[Appearance](../004-interface-design/appearance.md),
[Microsoft Whiteboard import](../020-import-export/whiteboard-import.md),
[Google Drive mirror](../022-drive-mirror/drive-mirror.md).
