# Back bar

The **back bar** is the one way back out of a level, and the one breadcrumb, in every app: a full-width row naming
where it goes back to, with the level that is open as a chip on the right. The tab's Import and Export screens set
the shape (**All formats** then **PNG**). Every other drill-in and breadcrumb draws the same component, `BackBar` from
`@liveworkspace/ui` (`../packages/ui/src/BackBar.tsx`), so they all read the same; none hand-rolls a "Back" link,
a chevron button or a chain of crumbs. With nowhere to go back to, it stands as a static heading in the same shape
("Choose a Space").

## Where it is

- The Import and Export format panels, the Logo Kit's and the Photo's among them: **All formats** then the format
  (**Logo Kit**, **Photo**).
- The Tab Style panels: **Tab Style** then **Colours**.
- The palette's category browse: **Icons** then **People**.
- The first page's Choose a Device: **All kinds** then **Wireframe**.
- A photo page's adjustment layer settings: **All Adjustments** then the adjustment (**Levels**).
- Folder placement (Save to, Move): **Choose a Space** as the heading of the spaces; inside one, **Choose a Space**
  then **My Work**; inside a folder, the level above then the folder.
- The Explorer: the side panel's folders, the full Explorer's breadcrumb (**My Work** then the folder, **Home** then
  **Recent**), and the Inbox's pane where it stands in for the list (**Inbox**).
- Settings on a phone: the pushed pane opens under **Settings** then the category; a sub-category's goes back to its
  parent.
- liveworkspace's telemetry dashboard: the Search view's event levels (**All events** then a category, then an
  action) and its metric picker's list.

## How it reads

- **One step back.** However deep the level, the label names only the level above it and Back steps up to that one;
  a deeper trail is walked one press at a time.
- The label is cut to fit with an ellipsis; the chip keeps its width.
- A host whose step is mid-flight (an export or import running) greys the bar out; it stays a button rather than
  turning into the heading, so the row does not swap shape for the second the work takes.
- In a combobox's list (the telemetry dashboard's metric picker) the bar leaves focus in the search box, so the list
  stays open.
- The bar changes how the way back looks, never where it goes: each host keeps its own Back target, its Escape, its
  history entry and where focus lands.

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

## Not the back bar

- The help centre's and marketing pages' site breadcrumb (home, then the section, then the page), a page trail with
  its structured data (`BreadcrumbTrail`, [Help app](../018-help/help-app.md)).
- The editor chrome's **Back**, which leaves the document for the page that opened it: a toolbar button.
- Step controls: a setup wizard's footer **Back**, a tour's **Back**, a presentation's previous slide.

## Share roles

The bar is navigation only. Editor, Participant and Viewer see and use it alike wherever the surface it sits in is
open to them; it never changes the design.
