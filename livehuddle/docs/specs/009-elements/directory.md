# Directory

A **Directory**: a stand in a Space that lists every room in it, on every tab, with who is in each right now. Click
it and pick a room: **Walk There** walks your [Avatar-mode](../008-canvas/avatar-mode.md) character to it, **Go**
takes you there at once, the way a [Portal](portal-element.md) does.

## Why

A Space with a handful of rooms on two or three tabs is already a building, and the first question anyone asks in
a building is "where is everyone?". The tab bar says who is on which tab, and the canvas shows the characters you
can see, but nothing answers "who is in the Design Room, and how do I get there?" without scrolling round every tab.
A real office answers it with the board in the lobby. The Directory is that board: one place to look, one click to
go.

## The element

- A **shape kind**, `directory`, in the palette's **Travel** category
  ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)) after the Avatar Pad.
  The tile reads **Directory**. Search adds one in any mode.
- **A placed piece** at a fixed default size (72x124), drawn like the [office pieces](office.md): a freestanding
  stand on a post and plinth, a blue sign across its head with an "i" and a title, and a board of rooms, each a
  coloured dot and a line. One drawing for the canvas, the placement preview and an export (`office-wayfinding.ts`,
  painted by FurnitureView and svg-render-faces). Outlines follow the theme's stroke on light and dark paper; the
  sign and the dots keep their colours.
- **No label and no settings `…`.** Its hover card names it. Its proportions are locked like the office pieces'.
- **It never blocks.** A character walks in front of it or behind it, and walking onto it does nothing: the
  Directory is pressed, not walked into.
- Otherwise an ordinary element: move, resize, rotate, copy, delete, export.

## Pressing it

A press (a click that has not moved further than a wobble, `usePressWithoutDrag`, so a drag still moves it) opens
the **Directory popover** beside the stand. Every role may press it ([Share roles](../013-workspace/share-roles.md)):
an Editor, a Participant and a Viewer all walk and travel.

**It stays open until you close it**: pressing the stand again, the **Close** button in its header, or Escape (which
closes the popover only, never Avatar mode with it). A click elsewhere does **not** close it, so you can walk round
the canvas with the list open: the popover is not modal (no backdrop), so the canvas behind it still takes every
walking click, and it follows the stand on screen, kept inside the viewport, beside the stand on the side with room.
In Avatar mode a press on the stand never walks you to it ([Avatar mode](../008-canvas/avatar-mode.md) "Clicking a
piece"). Go, and Walk There, close it as they act (below). While it is open the stand's hover card stays hidden, so
the pointer resting on the stand shows only the popover.

## The list

The popover lists the space's **places**, grouped by tab, in tab order, the current tab first and marked **This
Floor** (a space's tabs are its floors, the same word the [Elevator](elevator.md) uses):

- **What counts as a place**: every Room (a box room and a [Room Builder](room-builder.md) room), every Office Pod and
  every Stage on the tab: the call areas of
  [Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md). Elements on a hidden layer are
  left out on the current tab, as the calls leave them out.
- **Names.** A room's or a stage's label is its name. An unnamed place is named by **position** among the unnamed
  places of its kind on its tab, in reading order (top to bottom, then left to right): "Room 1", "Room 2", "Office
  Pod 1", "Stage 1". A typed name wins, so a renamed room keeps its name in the list.
- **Order**: each tab's places in reading order.
- **Who is in each, right now**, from presence, never stored
  ([Chair](chair.md) "Occupancy is presence"): on the current tab, every character (yours and each peer's) is in the
  place its feet stand in: a stage's top first, else the innermost room or pod, the same rule the calls use
  (`stageAt`, then `zoneAt`). Each row shows those people's avatars (initials in their colours) and a count.
- **Around**: everyone on the current tab who is in no place (walking in the open, or not in Avatar mode at all) is
  listed in an **Around** row at the end of the tab's group.
- **Another tab**: characters are relayed only to the people on their own tab
  ([Avatar mode](../008-canvas/avatar-mode.md) "Realtime"), so for another tab the Directory knows who is on it (the
  tab bar's presence) but not which room they stand in. Its places are listed without occupants, and the people on
  it are shown in its **Around** row, headed **On This Floor**.
- **Empty states.** A space with no places at all shows "No rooms yet" and a line saying Rooms, Office Pods and
  Stages appear here. A tab with none is listed with "No rooms on this floor" so its people still show.
- **Live.** The list recomputes only when presence changes (someone moves into or out of a place, joins, leaves or
  changes tab) or the tabs change, never every frame a character walks, and only while the popover is open.

## Walk There

Shown on rows of the current tab. It walks your character to the place:

1. Not in Avatar mode: enter it first, exactly as the Avatar pick does (the entry places the character as any entry
   does).
2. Walk, with the ordinary click-to-walk (`walkTo`), to the place's **approach point** just outside its doorway,
   then on to the point just inside it. The centred camera follows ([Avatar mode](../008-canvas/avatar-mode.md) "The
   camera"). A place with no doorway (a box room set to **None**, a Room Builder room without a Door) is walked to
   its centre, and a Stage to the middle of its front edge, then up onto its top.
   - **Round the walls in the way.** Each leg is an ordinary routed walk ([Avatar mode](../008-canvas/avatar-mode.md)
     "Finding the way"), so a doorway on the far side of the place (a Door on a room's top wall walked to from below),
     or any other room or fence between, is walked round to the approach point. (Before routing, `walkThereRoute`
     went round only the place's own box; that special case is gone.)
   - **Already inside.** A character already standing in the place walks straight to the point inside its doorway,
     never out and back in.
3. The walk is the ordinary walk: it routes round walls and fences, stops at the nearest point it can reach when a
   shut door is in the way, and any key or click takes over. Go is the way that always arrives.

The popover closes as the walk starts.

## Go

On every row. It jumps you to the place, through the same path a Portal's travel takes
([Portal](portal-element.md) "Travelling"):

1. **Places your character** at the place's arrival point (inside its doorway, else its centre) when you are walking.
2. **Switches tab** when the place is on another one, through the tab-link path, **as travel**: Avatar mode stays on
   ([Avatar mode](../008-canvas/avatar-mode.md) "Changing tab"), as it does for a Portal and an Elevator.
3. **Centres the camera** on the arrival point once the tab shows.

## Model + validation

The kind carries no fields of its own. Validation is the ordinary shape validation.

## Telemetry

Adding one emits `Element·Added·Directory` ([Telemetry](../017-telemetry/telemetry.md)). Opening it, walking and
going are navigation, the same as panning, and are not tracked.

## Implementation shape

- **`packages/document/src/office-wayfinding.ts`**: the drawing (`WAYFINDING_ART.directory`), joined to `OFFICE_ART`;
  the kind is a grid office piece (`OfficeKind`), so it is placed, previewed and exported like one.
- **`apps/editor/lib/wayfinding.ts`**: the pure half: `spacePlaces` (places per tab, named and ordered), each
  place's approach and arrival points and its walls' box, `walkThereRoute` (the waypoints a Walk There follows), and
  `whoIsWhere` (presence into places). Unit-tested.
- **`apps/editor/components/canvas/wayfinding/`**: the per-canvas store the popovers read
  (`wayfinding-store.ts`), the hook that fills it and owns Walk There and Go (`useWayfinding.ts`, composed into
  `useCanvasAvatar`), and the face and popover (`DirectoryFace.tsx`).
- The face reaches the canvas through the portal resolver the element layer already carries (`onEnterPortal`
  returns a `wayfinding` handle for the two wayfinding kinds), so no new prop crosses the canvas.

## Out of scope

- Who is in which room on a tab you are not on (the relay does not carry it).
- A Directory that lists other spaces.
