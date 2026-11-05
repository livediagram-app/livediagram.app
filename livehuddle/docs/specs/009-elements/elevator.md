# Elevator

An **Elevator**: a lift between a Space's tabs, which are its floors. Click it, or walk an
[Avatar-mode](../008-canvas/avatar-mode.md) character into it, pick a floor, and you step out of that floor's
Elevator, or another Elevator on the same floor. A [Portal](portal-element.md) with a picker and no wiring.

## Why

Portals link two places, one pair at a time, and someone has to link each pair. A space with four tabs that wants
every floor reachable from every other needs six pairs of portals and a menu session to wire them. A building solves
this with a lift: one in the lobby, one on each floor, and a panel of buttons. The Elevator is that lift: put one on
each tab and every floor is one press away, with nothing to link.

## The element

- A **shape kind**, `elevator`, in the palette's **Travel** category after the Directory. The tile reads
  **Elevator**. Search adds one in any mode.
- **A placed piece** at a fixed default size (112x140), drawn like the [office pieces](office.md): a lift set into a
  wall, seen from the front: its surround, a floor display with an up arrow over the doors, two brushed-steel doors
  meeting in the middle, a call panel beside them and the threshold. One drawing for the canvas, the placement
  preview and an export (`office-wayfinding.ts`). Outlines follow the theme's stroke on light and dark paper; the
  steel, the display and its lamp keep their colours.
- **Its name is its label** ([Names](#names)), under the piece. No settings `…`. Proportions locked.
- **It never blocks**: walking into it is how you call it.
- Otherwise an ordinary element: move, resize, rotate, lock, copy, delete, export.

## Floors and pairing

- **A space's tabs are its floors**, in tab order. The floor's name is the tab's name.
- **Pairing is automatic.** Every Elevator in the space serves every floor: nothing is stored, nothing is linked, and
  adding, moving or deleting one never needs a menu.
- **Where a floor arrives**: at that floor's first Elevator in reading order (or the one picked), stepping out at its
  base (centred, 36px below its bottom edge, clear of its footprint and its name, the avatar's position being its feet). A floor with **no Elevator**
  arrives at its [Avatar Pad](avatar-pad.md) (the first in layer order, on its core), else at the middle of what the
  tab holds, else the canvas origin.

## Names

- **An Elevator's name is its label**, retyped like any label: double-click it, or Rename in the element menu. Only
  an Editor can rename one; every role sees the name.
- **Unnamed** (empty or blank), it reads **"Elevator n"** by position on its floor in reading order (top to bottom,
  then left to right), `n` counting only the unnamed ones before it, as [Directory](directory.md) names unnamed rooms.
- The name shows **under the piece** (small, in the theme's text colour), in its hover card, as the panel's title and
  in every other Elevator's panel.

## The panel

Pressing it (a click that is not a drag, `usePressWithoutDrag`) or walking into it opens the **panel** beside the
Elevator, titled with its name. It lists **every Elevator in the space**. Every role may ride
([Share roles](../013-workspace/share-roles.md)).

- **This floor first**: its number, its tab's name and **You Are Here**, then the **other Elevators on this floor**,
  each with a Go. Riding to one stays on the tab. With no other, it says "No other Elevator on this floor".
- **Then each other floor**, in tab order, numbered: one row per Elevator by name, each with a Go, so you pick which
  one you step out of. A floor with none offers one row, its Avatar Pad or its middle, saying it has no Elevator.
- A space with **one tab** adds a line saying to add a tab (a floor) with an Elevator on it.
- Escape, a click outside or pressing the Elevator again closes it; walking off the Elevator closes a panel the
  walk-in opened.

## Riding

Choosing an Elevator travels like a Portal ([Portal](portal-element.md) "Travelling"):

1. **Places your character** just outside the chosen Elevator, at its base, when you are walking. The Elevator it
   steps out of is **ignored until the character steps off it**, so arriving never reopens the panel.
2. **Switches tab** when the Elevator is on another floor, **as travel**: Avatar mode stays on
   ([Avatar mode](../008-canvas/avatar-mode.md) "Changing tab"). On the same floor nothing changes tab.
3. **Centres the camera** on the arrival point, at the walk's zoom, once the floor shows.

Not walking, a ride moves the view only.

**Arriving.** The arrival Elevator's doors open: two panels slide apart over its doors and close again (about a
second, a CSS animation), seen on your screen. Under reduced motion they do not move.

## Model + validation

The kind carries no fields. Validation is the ordinary shape validation.

## Telemetry

Adding one emits `Element·Added·Elevator`. Riding is navigation and is not tracked.

## Implementation shape

- **`packages/document/src/office-wayfinding.ts`**: the drawing (`WAYFINDING_ART.elevator`); a grid office piece.
- **`apps/editor/lib/wayfinding.ts`**: `floorElevators` / `elevatorName` (names), `spaceFloors` (each tab's
  Elevators and its arrival point), `elevatorExitPoint`. Unit-tested.
- **`hooks/canvas/useCanvasTool.ts`**: `keepWalkingTo(tabId)` marks the next change of tab as travel.
- **`apps/editor/components/canvas/wayfinding/`**: `ElevatorFace.tsx` (the press, the panel, the doors) and the
  shared `useWayfinding.ts`, which detects the walk-in from the walk's `standingOnId` (once on arrival, ignoring the
  Elevator just stepped out of) and opens that Elevator's panel through the store.

## Out of scope

- Floors that are not tabs (several floors on one canvas).
- A ride animation between floors beyond the doors.
- Elevators that serve only some floors.
