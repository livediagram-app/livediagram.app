# Stairs

**Stairs**: a flight between a Space's tabs, which are its floors, one floor at a time. Click it, or walk an
[Avatar-mode](../008-canvas/avatar-mode.md) character onto it, pick **Up** or **Down**, and your character climbs
the flight and steps off the Stairs on the next floor. The [Elevator](elevator.md)'s floor-per-tab model, for the
floor above or below.

## Why

A building with floors only had Elevators: a panel of every floor, a ride that is a jump. Real buildings have stairs
too, and people take them for one floor: they are where the floors visibly meet, and walking up them feels like
moving through the building rather than teleporting. Stairs give a multi-floor Space that short walk, with nothing to
link.

## The element

- A **shape kind**, `stairs`, in the palette's **Travel** category after the Elevator. The tile reads **Stairs**.
  Search adds one in any mode.
- **A placed piece** at a fixed default size (96x128), drawn like the [office pieces](office.md), upright from the
  room's camera: a flight of seven steps rising away from you, narrowing as it goes, between two side walls, a handrail on each, the
  landing at the top opening onto the floor above, and a small sign over it with an up and a down arrow. One
  drawing for the canvas, the placement preview and an export (`office-wayfinding.ts`). Outlines follow the theme's
  stroke on light and dark paper; the stone of the steps, the landing's dark and the sign keep their colours.
- **Turned** ([Turning furniture](furniture-facing.md)): from behind (facing up), the flight climbs down the
  canvas: the landing's dark opening is nearest you, the treads step away from it to the foot at the top (their risers
  face away), the newel caps at the far foot, the sign over the landing. Turned to face left, the flight climbs to the
  right: its foot on the left, each step a rise higher than the last, the landing at the top on the right, the near
  side wall's face rising with it and its handrail along it; facing right, mirrored, it climbs to the left.
- **It carries no name.** Its hover card and panel say where it leads. No settings `…`. Proportions locked.
- **It never blocks**: walking onto it is how you take it.
- Otherwise an ordinary element: move, resize, turn, lock, copy, delete, export.

## Floors

- **A space's tabs are its floors**, in tab order, the first the ground floor, numbered from 1 as the Elevator
  numbers them. **Up** is the next tab, **Down** the one before. The floor's name is the tab's name.
- **One piece goes both ways.** The same Stairs offers Up and Down; the top floor has no Up and the ground floor no
  Down.
- **Where you land**: on the Stairs on that floor nearest (in canvas position) to the ones you took, since a
  building's stairs stand over each other; ties go to reading order (top to bottom, then left to right). A floor with
  **no Stairs** lands where an Elevator ride with nothing picked would ([Elevator](elevator.md) "Where a floor
  arrives"): its first Elevator, stepping out of it with its doors opening, else its Avatar Pad, else its middle.
- **Pairing is automatic.** Nothing is stored or linked; adding, moving or deleting Stairs never needs a menu.

## The panel

Pressing it (a click that is not a drag, `usePressWithoutDrag`) or walking onto it opens a small **panel** beside
the Stairs, titled **Stairs**, its line saying which floor you are on ("Floor 2 of 3, Level 2"). Every role may take
them ([Share roles](../013-workspace/share-roles.md)).

- **Up**, first: the floor above's number and name and an **Up** button; on the top floor it reads "No floor above".
- **Down**: the floor below's number and name and a **Down** button; on the ground floor it reads "No floor below".
- **Where it lands** shows under the floor's name when it is not Stairs: "Lands at its Elevator", "at its Avatar
  Pad" or "in its middle".
- **Floors not opened yet** are fetched on opening, as the Elevator panel does ([Elevator](elevator.md) "The
  panel"): only the floor above and below matter, and until one lands its row reads **Loading this floor** with no
  button; after eight seconds (a failed fetch) it offers the button and lands as a floor with no Stairs.
- A space with **one tab** says "This space has one floor. Add a tab with Stairs on it to make another."
- Escape, a click outside or pressing the Stairs again closes it; walking off the Stairs closes a panel the walk-in
  opened.

## Taking them

Choosing Up or Down travels like an Elevator ride ([Elevator](elevator.md) "Riding"), with a short walk:

1. **The walk up.** Walking, with your character on the Stairs or near their foot (within 160px of it), it climbs
   the flight first: it walks to the top step (about half a second at walking pace), and the floor changes when it
   gets there, or after 1.5 seconds whatever happens (a wall in the way, a key pressed). Farther away it does not
   walk across the room first: the floor changes at once.
2. **Switches tab as travel**: Avatar mode stays on ([Avatar mode](../008-canvas/avatar-mode.md) "Changing tab").
3. **The walk off.** On the new floor your character stands on the top step of the Stairs it landed on, and walks
   down off them to just in front of their foot: below them facing down, above them facing up, beside them on the
   foot's side when turned onto their side. Those Stairs are **ignored until it steps off them**, so landing
   never reopens the panel. Landing at an Elevator steps out of it as a ride does.
4. **Centres the camera** on the landing, at the walk's zoom, once the floor shows.

**Reduced motion.** Under `prefers-reduced-motion` there is no walk: your character is placed just in front of the
landing Stairs' foot and the floor changes at once.

Not walking, taking the Stairs moves the view to the landing on that floor only.

## Model + validation

The kind carries no fields. Validation is the ordinary shape validation.

## Telemetry

Adding one emits `Element·Added·Stairs`. Taking them is navigation and is not tracked.

## In the templates

The **Co-working Tower** has Stairs beside its North Lift, in the same place on every floor, so the flight you take
lands you in the same spot a floor up. The **Hotel and Suites** keeps its Elevators only: its lifts stand in a
different place on each floor, and a hotel's guests ride.

## Implementation shape

- **`packages/document/src/office-wayfinding.ts`**: the drawing (`WAYFINDING_ART.stairs`); a grid office piece that
  never blocks, like the Elevator.
- **`apps/editor/lib/wayfinding.ts`**: `stairsTopPoint` / `stairsFootPoint` (where the climb ends and the walk off
  ends), `stairsFlights` (the floors above and below, each with where it lands). Unit-tested.
- **`apps/editor/components/canvas/wayfinding/`**: `StairsFace.tsx` (the press, the panel) and the shared
  `useWayfinding.ts`, whose `climb` action walks up, travels, and walks off, and whose walk-in opens the panel through
  the store (`openPanelId`, shared with the Elevator).

## Out of scope

- Separate up and down flights, or Stairs that skip floors.
- Stairs within one tab (split levels on one canvas).
- A climbing pose: the character walks up the flight with its ordinary walk.
