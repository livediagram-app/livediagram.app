# Editor modes

A general tab is drawn on in one of two **editor modes**: **Diagram** and
**Draw**. A mode decides which tools and rules are in focus; it never decides
what the tab is. Like a drawing tool that switches between a pixel mode and a
vector mode over the same picture, switching mode keeps every element exactly
where it is and changes only how the next mark is made.

## Domain language

| Term             | Means                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **tab kind**     | What a tab **is** ([Document](../006-document/document.md)). Reserved for specific uses.                                 |
| **editor mode**  | How a general tab is **worked on** right now: `diagram` or `draw` (`EditorMode`).                                        |
| **Diagram mode** | Structured drawing: the palette, shapes, arrows, icons, templates, snapping and guides.                                  |
| **Draw mode**    | Freehand whiteboarding: the dock, preset pens, eraser, shape recognition ([Draw mode](../023-whiteboard/whiteboard.md)). |
| **mode switch**  | The control beside the page switcher that changes the editor mode.                                                       |

- "Whiteboard" names the activity and Draw mode's look, never a tab kind and
  never a type of document.
- "Mode" on its own is ambiguous here (Zen mode, Presentation mode, Power user
  mode); in specs and code say **editor mode**. The interface says **Diagram**
  and **Draw**.

## Kinds versus modes

- **A tab kind is for a very specific use** whose notation, rules and data are
  its own: the [event-storming board](../021-event-storming/event-storming.md)
  is one. A new kind is added only when a use cannot be served by a mode.
- **Everything else is the general tab** (`kind: 'diagram'`, the default). It
  carries every element type; both modes work on it.
- **Whiteboarding is a mode, not a kind.** `TabKind` is `'diagram' |
'event-storming'`; there is no `'whiteboard'` kind.
- **Content is shared between modes.** A stroke drawn in Draw mode is a
  `freehand` element in Diagram mode too, and a shape placed in Diagram mode
  is there in Draw mode. Nothing is hidden, converted or locked by a switch.

## The mode switch

- **Placement:** directly beside the page switcher (the tab bar,
  `components/chrome/TabBar.tsx`), so the two controls that answer "where am
  I and how am I working" sit together.
- **Two options, one chosen:** Diagram and Draw. Exactly one is active.
- **Switching is instant and lossless:** no dialog, no reload, no change to the
  document; the selection is kept, an in-progress gesture or text edit is
  finished first, and the canvas viewport does not move.
- **Where it is offered:** on general tabs, to anyone who can edit. A view-role
  visitor sees no switch and sees the tab in its opening mode.
- **Not on event-storming boards:** the tab kind keeps its own tools and
  notation, and shows no switch.
- **Zero layout shift:** the switch has a fixed size, and nothing next to it
  moves when the mode changes.
- **Accessible:** reachable by keyboard, its state exposed to assistive
  technology, its text and focus ring at least WCAG 2.2 AA.

## Where the mode lives

- **Per person, per tab.** Each person chooses their own editor mode on each
  tab; switching changes nothing for anyone else. Two collaborators may work
  on the same tab in different modes at once.
- **The tab says what it opens in.** A general tab stores the mode it
  **opens in** (`Tab.opensIn`, `diagram` when absent). A person who has not
  switched on that tab sees it in that mode; the Whiteboard template, Quick
  Start entry and whiteboard imports set it to `draw`.
- **A switch is remembered** for that person and tab, in this browser, and
  wins over the tab's opening mode from then on.
- **Switching never changes the opening mode.**

## One look

There is one look, the diagram look, with the whiteboard's best parts merged
into it. **A mode chooses the defaults written into new content and the
backdrop behind it; it never re-colours what is already there.** Every colour
is stored on the element, so collaborators in different modes see the same
element in the same colour.

- **Off-white light canvas.** The Default theme's light canvas is the board's
  off-white (`#fbfaf7`); its dark canvas stays `#0d121a`.
- **Ink is a theme colour.** The Default theme gains **Ink**, its drawing
  colour (`#1c1917` light, `#e2e8f0` dark), stored by name and drawn in the
  version for each viewer's appearance. Ink is in the palette's colours, so
  any element can take it.
  - Pen strokes and text with no colour of their own are drawn in Ink, in
    both modes.
  - Shapes keep their theme defaults: a shape added in Diagram mode is filled
    and outlined as today.
- **Draw mode writes Ink, unfilled.** A shape, line or arrow made in Draw mode
  is written with an Ink outline and no fill, so it looks the same in Diagram
  mode and to every collaborator.
- **Marker colours are first-class.** The stock colours (Ink, Blue, Red,
  Orange, Green, Teal, Violet, Pink) are stored by name on any element and
  drawn in the version tuned for each viewer's appearance, on every tab, in
  every export, thumbnail and image the api or MCP renders.
- **Draw mode's backdrop ignores the custom background colour.** A tab's
  custom background colour stays stored and shows in Diagram mode; in Draw
  mode the canvas is the board colour for the viewer's appearance.
- **The background pattern is the person's, per mode.** Plain, Dots or Grid
  is taken from what that person last chose in that mode, not from the
  document.

## What a mode brings into focus

- **Diagram mode** is the editor as described by
  [Canvas and palette](../008-canvas/canvas-and-palette.md),
  [Toolbar layout](toolbar-layout.md) and the canvas specs.
- **Draw mode** is what the whiteboard was: the dock with its pens, shapes,
  history and settings; the whiteboard's keyboard shortcuts; pen versus touch;
  picking by the drawn line; strokes that stay open; text boxes that hug;
  nothing animating in; no guides for pens; shape recognition and the two
  erasers ([Draw mode](../023-whiteboard/whiteboard.md)).
- **Leaving a mode puts its tool down**, as leaving a whiteboard did: a pen,
  the eraser or an armed shape never carries over into the other mode.

## Existing whiteboards

- A stored tab with `kind: 'whiteboard'` reads as a general tab that opens in
  Draw mode. Its elements, background and layers are unchanged.
- Imports that landed on a whiteboard (Excalidraw, Microsoft Whiteboard) land
  on a general tab in Draw mode.
- The **Whiteboard** template and Quick Start entry create a general tab that
  opens in Draw mode.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Editor` · `Changed` · `ModeDiagram` / `ModeDraw`, fired by the switch
  before the mode applies.

## Non-goals

- More than two editor modes until use asks for one.
- A mode per element or per layer.
- Converting content between modes (a stroke into a shape on switching).

## References

[Document](../006-document/document.md), [Draw mode](../023-whiteboard/whiteboard.md),
[Event storming](../021-event-storming/event-storming.md),
[Toolbar layout](toolbar-layout.md), [Zen mode](zen-mode.md).
