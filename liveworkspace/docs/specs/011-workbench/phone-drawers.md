# Tool panels are drawers on a phone

Every editor opens a set of **tool panels** from the canvas's own chrome: a button in the bottom-right cluster, the
Session strip or the footer, a panel hanging over it with a pointer. On a desktop that popover sits beside the work. On
a phone (`PHONE_MEDIA_QUERY`: narrower than 640 px, or a touch screen under 500 px tall, a phone held sideways) the same
popover crowded the canvas, ran off the screen's edge and was hard to reach and dismiss with a thumb. Owner, 2026-11-24:
"layers, tidy up etc should be drawer modals on mobile, same with timer, vote and poll."

## The rule

On a phone, **a tool panel opens as a drawer**: a bottom sheet across the screen's foot over a dim scrim, the same one
Tools and Get Started already open as ([footer-tools-menu.md "On a phone"](../004-index/footer-tools-menu.md#on-a-phone)).

- **Shape.** The full width of a portrait phone (centred, at most 32 rem, on a phone held sideways), rounded at the top,
  at most 85% of the screen's height, its body scrolling inside it. A panel wearing the dialog hero
  ([dialog-hero-header.md](../004-index/dialog-hero-header.md)) runs its band up under the grab handle.
- **Grab handle.** A full-width strip across its top (`SheetHandle`): dragged up it fills the screen below the top bar,
  dragged down past the threshold or flicked it closes, anything less springs back.
- **Closing.** A tap on the scrim, Escape, the panel's own close, or its button pressed again from the keyboard. The tap
  ends on the scrim: nothing under it (the canvas, an element being voted on) takes it.
- **Focus.** Focus moves into the drawer as it opens (the drawer itself on a touch screen, so no keyboard rises
  unasked; its first control with a keyboard) and is kept inside it: Tab and Shift+Tab wrap at its ends. Closing hands
  focus back to what opened it. A menu, confirm or dialog the panel opens draws over the drawer and keeps its own keys.
- **Safe area.** Its foot pads by the home indicator's inset (`safeInset('bottom')`), so its last row clears it.
- **The canvas underneath.** The drawer is portalled out of the canvas, and a press inside it or on the scrim never
  starts a canvas gesture (no pan, draw, marquee or deselect).
- **Desktop is unchanged.** From the phone breakpoint up every panel is the popover it was, hung from its button.

## Which panels

Every popover off a button built on the shared `MovablePanel` (`asPopover`), in every editor, unless it is already a
sheet of its own on a phone:

| Editor        | Drawers on a phone                                                      |
| ------------- | ----------------------------------------------------------------------- |
| livediagram   | Layers, Tidy Up, Collaborate, Timer, Vote and Poll (set-up and running) |
| liveplanner   | Collaborate, Timer and Vote (set-up and running), Card Types, Trash     |
| livedesign    | Collaborate                                                             |
| livedocuments | Collaborate                                                             |
| liveknowledge | Collaborate                                                             |
| livehuddle    | The Timer's length (on the Timer piece, through `PopoverOrSheet`)       |

Already sheets on a phone, and left as they are: the Explorer (a sheet down from its button), Contents (its own bottom
sheet), livedesign's Photo panel (a sheet off the rail's Layers button), the title-bar popovers (Guides, Mirror,
Background, Layouts: `TitlePopoverButton`'s sheet), Tools and Get Started.

Not tool panels, and left as they are: the corner tool panels that stay up while their tool is in use (Laser,
Spotlight, Eraser, Format, Slide Deck), which a scrim would stop the tool working under; livedocuments' and
liveknowledge's page Tidy, a single press with no panel; livehuddle's Calendar Wall, Notice Board and Suggestion Box,
which open from a piece in the room rather than from the editor's chrome.

## Share roles

Unchanged. A drawer shows what the popover showed to the same person: an Editor's set-up panes, a Participant's
running vote and poll, a Viewer's running timer.

## Performance

The drawer is the shared primitive already in every editor's bundle (`PopoverOrSheet`'s), so no new code loads on
first paint. It renders only while a panel is open, reads the phone query the panel already subscribes to, and adds
one keydown listener and the focus trap's while open.
