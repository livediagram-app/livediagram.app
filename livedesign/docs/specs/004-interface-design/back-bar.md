# Back bar

The **back bar** is the one way back out of a two-level browse: a full-width row naming where it goes back to, with
the level that is open as a chip on the right (**Tab Style** then **Colours**; **All formats** then **PNG**). Every
drill-in uses it (`apps/live/components/primitives/BackBar.tsx`), so they all read the same: the Tab Style panels,
the Import and Export format panels, the palette's category browse, the page layouts, the custom theme
builder, folder placement and the Explorer side panel's folders. With nowhere to go back to, it stands as a static
heading in the same shape ("Choose a Space").

## Always in view

The back bar is **sticky**: however far the rows below it scroll (a long list of colours on a phone), it stays pinned
to the top of the scroll area, so the way back never leaves the screen.

- It sits **flush** with the scroll area's top edge once stuck. Sticky positioning stops below the scroller's top
  padding, which would leave a strip the rows show through above the bar, so the bar lifts itself by that padding,
  read once as it mounts. No host needs to set anything.
- The rows pass **beneath** it (it stacks above them, on its own opaque face).
- A host must not put an `overflow: hidden` box between the bar and its scroller: that makes a scroll box of its own
  and pins the bar inside it. A box that only clips uses `overflow: clip` instead (the Tab Style dialog's easing
  height box, `AnimatedHeightBox`, does).
- Before the content scrolls, nothing changes: the bar sits where it always did.

## Share roles

The bar is navigation only. Editor, Participant and Viewer see and use it alike wherever the surface it sits in is
open to them; it never changes the design.
