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
  visitor sees no switch.
- **Zero layout shift:** the switch has a fixed size, and nothing next to it
  moves when the mode changes.
- **Accessible:** reachable by keyboard, its state exposed to assistive
  technology, its text and focus ring at least WCAG 2.2 AA.

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
