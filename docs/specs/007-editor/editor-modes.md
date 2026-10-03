# Editor modes

A general tab is drawn on in one of two **editor modes**: **Diagram** and
**Draw**. A mode decides which tools and rules are in focus; it never decides
what the tab is. Like a drawing tool that switches between a pixel mode and a
vector mode over the same picture, switching mode keeps every element exactly
where it is and changes only how the next mark is made.

## Domain language

| Term             | Means                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **tab kind**     | What a tab **is** ([Document](../006-document/document.md)). Reserved for specific uses.                               |
| **editor mode**  | How a general tab is **worked on** right now: `diagram` or `draw` (`EditorMode`).                                      |
| **Diagram mode** | Structured drawing: the palette, shapes, arrows, icons, templates, snapping and guides.                                |
| **Draw mode**    | Freehand whiteboarding: the dock, preset pens, eraser, shape recognition ([Draw mode](../023-draw-mode/draw-mode.md)). |
| **mode switch**  | The control beside the page switcher that changes the editor mode.                                                     |

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

- **Placement:** with the Explorer, the control for where you are, so it
  sits apart from the tools it changes and stays put when they change.
  - **Toolbar layout:** directly beside the menu (hamburger) button, in its
    card at the top left, or inline at the strip's left end where a phone
    puts the button ([Toolbar layout](toolbar-layout.md)).
  - **Floating layout:** in the Explorer panel's header, before its ⋯ menu.
    The Toolbar layout's Explorer popover leaves it out, since the switch
    already sits beside the button that opened it.
  - Both stay up in Draw mode, which hides the palette but keeps the
    Explorer, so the switch is in the same place in either mode.
  - Not in the tab bar or the palette.
- **An icon-only dropdown** (`EditorModeSwitch`): a fixed-width chip showing
  the current mode's icon and a chevron, no words, on the faint tint the
  editor's menu-like controls use. A press opens a menu **below** it, hanging
  from the edge with room (left beside the menu button, right in the Explorer
  header), with one compact row per mode at the palette dropdowns' size: its
  icon and name, a check on the current mode and **Shift+D** on the row the
  key leads to. Choosing a row switches and closes the menu; Escape or a
  press outside closes it.
  - **No hover card:** it would cover the menu the chip opens.
  - Semantics: a menu button (`aria-haspopup="menu"`, `aria-expanded`) named
    "Editor mode: Diagram", over a `menu` of `menuitemradio` rows; arrow keys
    open it and move within it, wrapping, Home and End jump.
  - The same for everyone, power user mode or not.
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
- **Shift+D** toggles between the two modes (with more modes, it moves to
  the next), shown in the switch's menu, `aria-keyshortcuts` and Settings ›
  Keyboard; a switch by key is announced politely ("Draw mode"). It obeys
  the character-key shortcuts setting.
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
- **New documents and new tabs open in Diagram.** Whatever mode its creator
  is in, a new document or a tab added from the tab bar (or Quick Start)
  opens in Diagram. Only the template chosen for it changes that: the
  **Whiteboard** opens in Draw (switching its maker there too), an
  **Event Storming** board is always Diagram, and every other template,
  Blank included, opens in Diagram. An import that sets its own opening
  mode wins.
- **Opens in:** the tab menu holds an **Opens in** submenu for editors,
  listing every editor mode (Diagram, Draw) as a radio choice with the
  current one checked. Choosing one sets `Tab.opensIn` for everyone and
  switches the chooser's own mode on that tab to it (remembered like any
  switch), so the choice visibly lands; nobody else's current mode changes.
  Choosing the already-checked mode still switches the chooser to it. The
  submenu lists modes from one catalogue, so a further mode joins it as one
  entry. Not offered on event-storming boards; greyed out on a locked tab.
- **The tab pill shows your mode on it.** Each tab pill leads with the icon
  of the mode this person works in on that tab (the same glyph the mode
  switch and the Opens in choices use), resolved as the canvas resolves it:
  their remembered switch, else the tab's opening mode. It is tinted with the
  tab's theme accent. The switch, Shift+D and Opens in all update it at
  once; a visitor who cannot edit sees the opening mode. An event-storming
  board is always Diagram, so it shows the Diagram icon.

## One look

There is one look, the diagram look, with the whiteboard's best parts merged
into it. **A mode chooses the defaults written into new content and the
backdrop behind it; it never re-colours what is already there.** Every colour
is stored on the element, so collaborators in different modes see the same
element in the same colour.

- **Off-white light canvas.** The Default theme's light canvas is the board's
  off-white (`#fbfaf7`); its dark canvas stays `#0d121a`.
- **Ink is one colour everywhere.** **Ink**, the drawing colour (`#1c1917`
  on a light canvas, `#e2e8f0` on a dark one), is the same on every theme and
  stored by name. Any element can take it: in Draw mode from the pen and
  quick style rows, in Diagram mode as the **eighth swatch, after the theme's
  colours**, in the quick style panel's colour rows and the element menu's
  colour rows.
  - Pen strokes and text with no colour of their own are drawn in Ink, in
    both modes.
  - Shapes keep their theme defaults: a shape added in Diagram mode is filled
    and outlined as today.
- **Draw mode writes Ink, unfilled.** A shape, line or arrow made in Draw mode
  is written with an Ink outline and no fill, so it looks the same in Diagram
  mode and to every collaborator.
- **Marker colours are first-class.** The stock colours (Ink, Blue, Red,
  Orange, Green, Teal, Violet, Pink) are stored by name on any element and
  drawn in the version tuned for **the canvas behind them**, light or dark,
  on every tab, in every export, thumbnail and image the api or MCP renders.
  On the Default theme that canvas follows the viewer's appearance; a theme
  with a fixed canvas keeps its ink readable whichever appearance is on.
- **One backdrop colour in both modes.** The canvas colour is the tab's
  own: its theme's canvas, or the custom background colour when one is set;
  on the Default theme, the off-white or dark canvas.
- **The pattern:** in Diagram mode, the tab's stored pattern, shared by
  everyone. In Draw mode, the person's own: Plain, Dots or Grid as they last
  chose it in Draw mode (synced preferences, Grid until chosen), not stored
  on the tab, so choosing it changes nothing for anyone else.
- **Exports, thumbnails and api or MCP images** use the tab's Diagram
  backdrop: its colour and stored pattern, whoever exports and in whichever
  mode.

## What a mode brings into focus

- **Diagram mode** is the editor as described by
  [Canvas and palette](../008-canvas/canvas-and-palette.md),
  [Toolbar layout](toolbar-layout.md) and the canvas specs.
- **Draw mode** is what the whiteboard was: the dock with its pens, shapes,
  history and settings; the whiteboard's keyboard shortcuts; pen versus touch;
  picking by the drawn line; strokes that stay open; nothing animating in; no guides for pens; shape recognition and the two
  erasers ([Draw mode](../023-draw-mode/draw-mode.md)).
- **What a mode writes, stays.** A rule that shapes content is stored on the
  element when it is made, never read from the mode: a text box made in Draw
  mode **hugs its text** in both modes and for everyone; one made in Diagram
  mode does not. A rule about input (what a click picks, which keys do what)
  follows the person's current mode.
- **A text box's sizing** is one field, `TextElement.sizing`:
  - `'fit'`: the width follows the words up to the wrap width, and the height
    hugs the lines (a text box clicked into place in Draw mode);
  - `'wrap'`: the width is set, and the height hugs the lines (dragged out or
    resized in Draw mode);
  - absent: a fixed box, its text wrapping inside it (Diagram mode).
  - It replaces `autoWidth`: `autoWidth: true` becomes `'fit'`; text on a
    migrated whiteboard without it becomes `'wrap'`, as it hugged there.
- **Entering Draw mode**, by opening a tab or by switching, puts the active
  pen in hand on an empty tab and Select on a tab with content.
- **No further cue:** the dock (in place of the palette) and the switch's
  own label say which mode is on; no tint, accent or notice is added.
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
- `Tab` · `Changed` · `OpensInDiagram` / `OpensInDraw`, fired by Opens in.
- Draw mode's own events are the **`Draw`** category (pens, shapes, eraser,
  recognition, background, snap colours,
  [Draw mode](../023-draw-mode/draw-mode.md#telemetry-telemetry--public-transparency-dashboard)).
  It was named `Whiteboard`; the stored history is rewritten to `Draw` so the
  dashboard's lines continue.

## Naming in the interface

- The mode is **Draw** on the switch and in Settings, where it names the
  **Editor › Draw** sub-category (Dock Position) as the switch names it, and
  **Draw mode** in prose: the help article (**Draw mode**, at a new address,
  the old one redirecting) and the command palette.
- The template and Quick Start card stays **Whiteboard**: it names the
  activity a person comes for, and creates a tab that opens in Draw mode.

## Non-goals

- More than two editor modes until use asks for one.
- A mode per element or per layer.
- Converting content between modes (a stroke into a shape on switching).

## References

[Document](../006-document/document.md), [Draw mode](../023-draw-mode/draw-mode.md),
[Event storming](../021-event-storming/event-storming.md),
[Toolbar layout](toolbar-layout.md), [Zen mode](zen-mode.md).
