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
  painter, the Theme & canvas brush and the theme-mode banner, the tool panels
  (the eraser's and the highlighter's settings live in the dock's flyouts
  instead) and the empty-canvas banner (the dock is the hint). The header,
  tab bar, Explorer (its menu button keeps its corner on a phone),
  collaboration, comments, layers, activity and zoom controls stay, because
  they are about the document, not about drawing.
- **Read-only:** a view-role visitor sees the board without the dock; there
  is nothing on it they could use.
- **The dock holds, left to right:**
  1. **Select** (marquee and move; the ordinary select tool).
  2. **Pens**: the preset pens, one button each (see [Pens](#pens)).
  3. **Highlighter** ([Highlighter](../008-canvas/highlighter.md)).
  4. **Eraser**, with its mode (see [Eraser](#eraser)).
  5. **Sticky note**.
  6. **Text**.
  7. **Shapes**: a small flyout of rectangle, ellipse, triangle, diamond, line
     and arrow.
  8. **Shape recognition** toggle (see [Shape recognition](#shape-recognition)).
  9. **Undo** / **Redo**.
  10. **More**: board background and, when the operator asks for it, the full
      palette as an escape hatch.
- The dock never moves when a tool is picked: flyouts open **above** it, and
  the dock's own width is fixed per breakpoint, so nothing shifts under the
  pointer (zero layout shift).
- On narrow screens the dock scrolls horizontally rather than wrapping.
- Selecting an element shows the ordinary on-canvas selection handles; its
  styling is reached through right-click, as on any tab, but the menu offers
  only what a whiteboard element uses (colour, width, delete, bring forward /
  send back, duplicate, comment).

## Pens

- A whiteboard offers **a few preset pens** (default four), each with its own
  **colour** and **width**. Picking a pen button selects it; picking the active
  pen again opens its flyout to change its colour and width.
- **Default pens:** **Ink** (the adaptive ink colour, see
  [Appearance](#appearance)), **Red**, **Blue**, **Green**, all medium width.
  Colours come from the Default theme's palette so they read on both halves.
- **Widths:** **Fine** (2 px), **Medium** (4 px, the default) and **Bold**
  (8 px), `WHITEBOARD_PEN_WIDTHS`. The width is recorded as the stroke's
  `penWidth`, which every freehand renderer honours; choosing a border width
  from an element's menu afterwards replaces it.
- **Colours** in the flyout: Ink plus a small set of named colours, each at
  least 3:1 against both boards (WCAG 1.4.11), `WHITEBOARD_PEN_COLOURS`.
- **A pen stays in hand.** After a stroke the pen is still armed, as the
  highlighter is ([Highlighter](../008-canvas/highlighter.md)): the next drag
  draws again, and the stroke just drawn is not selected. Select, Escape or
  another tool puts it down.
- **Strokes stay open.** A whiteboard stroke that ends near its start is not
  closed and filled, as a pencil sketch on a diagram tab is: an "o" written on
  a board is ink, not a shape.
- Pens are the user's, not the board's: they persist **device-locally** in
  `localStorage` (`livediagram:v2:whiteboard-pens`), like the other tool
  panels, and never travel with the document.
- A stroke records the pen's colour and width on its `freehand` element when
  drawn. The **Ink** pen records no explicit colour, so its strokes follow the
  appearance; every other pen records its colour, which stays as drawn.

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
- **Dark:** a **chalkboard**: a dark board with **chalk** (a soft off-white)
  as the ink colour.
- Only colours change. Pens behave identically in both; the **Ink** pen and
  any unpainted element simply render in the appearance's ink colour. Explicit
  pen colours (Red, Blue, Green, or a chosen one) are kept as drawn.
- The board and ink colours are two named tokens of the Default theme's
  whiteboard variant (`WHITEBOARD_BOARD`, `WHITEBOARD_INK`, one value per
  appearance), tuned with the operator; the light and dark pairs must meet
  WCAG 2.2 AA contrast for ink on board (at least 4.5:1). A third token,
  `WHITEBOARD_PATTERN`, paints the dots and grid lines, faint against the
  board.
- **Starting values:** light board `#fbfaf7` with ink `#1c1917`; dark board
  `#1f2724` with chalk `#ece8dc`.
- Nothing is written onto elements: the ink is a **display projection**. An
  unpainted stroke, text, shape or line is drawn in the ink colour while it
  sits on a whiteboard, and in the ordinary default colours anywhere else.
  Unpainted shapes are drawn without a fill, as marker on a board.
- A document's theme applies to its diagram tabs only; a whiteboard tab in a
  themed document still shows the whiteboard look.

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
| A pen picked              | `Selected` | `Ink`, `Red`, `Blue`, `Green`, `Custom`               |
| Eraser mode switched      | `Changed`  | `EraserStroke`, `EraserPartial`                       |
| Shape recognition toggled | `Toggled`  | `RecognitionOn`, `RecognitionOff`                     |
| Background changed        | `Changed`  | `BackgroundPlain`, `BackgroundDots`, `BackgroundGrid` |

A pen reports its default name while it keeps its default colour, and
`Custom` once its colour has been changed. Strokes, stickies and text report
through the ordinary `Element` / `Added` events.

## Help centre ([Help app](../018-help/help-app.md))

One article, **Whiteboards**: creating one, the dock, pens, pen versus touch,
the two erasers, shape recognition and backgrounds. Registered per
[Register a help article](../../instructions/register-a-help-article.md).

## Rounds

The whiteboard is built in rounds and tuned with the operator between them.

- **Round one** (shipped): the kind, the template and Quick Start entry, the
  dock with every tool above, pen versus touch, the whiteboard and chalkboard
  look, the backgrounds, telemetry and the help article.
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
(shape recogniser), [Highlighter](../008-canvas/highlighter.md),
[Eraser panel](../008-canvas/eraser-panel.md),
[Appearance](../004-interface-design/appearance.md),
[Microsoft Whiteboard import](../020-import-export/whiteboard-import.md),
[Google Drive mirror](../022-drive-mirror/drive-mirror.md).
