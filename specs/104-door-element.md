# 104 — Door element

Status: **implemented**.

A **Door**: a canvas element paired with another door. Click it — or walk an [Avatar-mode](101-avatar-mode.md) character into it — and you travel to its pair.

## Why

A big diagram is a place, and places have shortcuts. Two doors turn "scroll across the canvas hunting for the other half of this flow" into one click, and they make an Avatar-mode walkthrough feel like moving through rooms rather than panning a plane. It is the cheapest possible in-diagram navigation: no minimap coordinates, no bookmarks UI, just a thing you walk into.

## The element

- A **shape kind**, `door`, like the Selection Mode button ([spec/103](103-mode-button.md)) and the Page ([spec/100](100-page-element.md)) — so it inherits label, colours, border, shadow, layers, groups, comments, export.
- Door-shaped: 72x112, taller than wide, drawn as a frame with a panel and a knob, its label under the frame. **Aspect-locked on creation**, because stretched wide it stops reading as a door at all (the panel and knob distort with the box). Unlockable from the menu like any element.
- **Timber colours**, not the tab theme's node fill: a door is scenery you walk through, not a box in the diagram's colour scheme. Like the Page and the Selection Mode button it is exempt from the backdrop-derived colour projection, and recolourable from the menu.
- The pairing lives in **`ShapeElement.doorTarget`** — the id of the door this one leads to.

## Travelling

Clicking a paired door does two things at once:

1. **The camera centres on the far door.** That is the whole feature for someone in Select / Hand mode.
2. **An Avatar-mode character steps out of it**, at the far door's threshold (centred on the doorway, on its bottom edge — the avatar's position is its feet, so it lands standing in the doorway).

**Walking into a door does the same thing.** The walk hook already knows which element the character is standing on; arriving on a door fires the same travel. Two rules keep that from becoming a trap:

- It fires **once on arrival**, not every frame the character stands there.
- The door it just came OUT of is **ignored until the character steps off it**. Without that, a pair of doors bounces the traveller back and forth forever.

## Pairing

Right-click a door → **Tools › Door**: a "Leads to" grid of the OTHER doors on the tab, named by their label (or positionally — "Door 2" — when unlabelled), the current target marked active. Picking the active one again unpairs it, so the tiles double as an off switch. With only one door on the tab it says so rather than showing an empty grid.

Pairing is **one-way by design**: A → B does not imply B → A. A one-way door is a legitimate thing to build (an entrance, a fire exit), and two clicks make it two-way.

## Unpaired doors are inert and say so

A door with no target does not take clicks; its tooltip reads _"Door (not connected) — Right-click the door and open Tools › Door to pick where it leads."_ A portal that silently swallows clicks is worse than one that admits it isn't wired up. The same forgiveness runs through resolution: a target that was deleted, re-pointed at a non-door, or points at itself resolves to unpaired rather than erroring, because a diagram is edited in any order and a half-wired portal is a normal intermediate state.

## Model + validation

`doorTarget` is validated as a **non-empty string** only. An id that doesn't resolve to a door is NOT a structural error — the editor resolves the pairing at press time and renders the door unpaired if it can't — so the validator has no business rejecting a tab because two elements are mid-rewire.

## Telemetry

Per [spec/22](22-telemetry.md): adding one emits `Element·Added·Door`; pairing / unpairing emits `Element·Changed·Door`. Travelling is not tracked — it is navigation, the same as panning, and would be the chattiest event in the app.

## Implementation shape

- **`apps/live/lib/doors.ts`** — the pure half: `doorsOnTab`, `doorName`, `resolveDoorTarget`, `doorExitPoint`, and `viewportOffsetCentredOn`. Unit-tested, including every way a pairing can be broken.
- **`apps/live/components/canvas/DoorFace.tsx`** — the drawn door + its pressable / inert states.
- **`Canvas.tsx`** owns `enterDoor` (it has the viewport, the elements, and the avatar hook) and hands the same action to both the door's click and the walk-in, so the two can never drift. The walk hook gains `teleportTo` and an on-arrival door callback; the two meet through a ref, because each needs the other.
- Wiring: the `door` kind in `packages/diagram` (union, `SHAPE_KINDS`, default size, factory, `doorTarget` validation), the CSS-box render path, the palette tile, the `Door` menu section + setter, and the telemetry token.

## Out of scope (v1)

- **Doors across tabs.** A cross-tab portal has to switch tab, wait for its content to load, and then place the camera; worth doing, bigger than this.
- Doors that lead to a saved viewport / zoom level rather than another door.
- Animating the trip (a fade or a step-through) instead of cutting to the far door.
- Locked doors, one-time doors, or doors that need a key — fun, and firmly out of scope for a diagram tool.
