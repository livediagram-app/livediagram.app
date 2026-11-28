# Road

Status: **approved** (owner, 2026-11-27: "I would like a road element type I can draw outside rooms which occasionally
has cars driving through it of different colors. Like they fade in one one end and fade out when they drive to the
other, two lanes, one way each lane").

A **Road** is a two-lane street laid out of doors: asphalt between two kerbs, a dashed white line down its middle,
one lane each way. Now and then a car drives along a lane: it fades in at one end, drives at a steady speed to the
other and fades out there. It is an [Office](office.md) piece in every way not said here: an Editor's to place,
move, resize, turn and delete, walked by everyone in [Avatar mode](../008-canvas/avatar-mode.md), no words on it, no
settings `…`.

## Why

A campus or a park reads as somewhere real when the world goes on past its gate. A street with the odd car going by
is the cheapest way to say "this is a place in a town", and it gives a Space a little life while nobody is moving.

## Where it lives

Its tile is in the palette's **Garden** category, in **Paths and Fences** after the Garden Path
([Groups in a flyout](../010-palette/palette-top-level-categories.md#groups-in-a-flyout)). Shape kind: `road`.

## The piece

- **A floor piece**, like the [Garden Path](office.md#garden-path): it lies on the ground behind everything, never
  blocks and is never a destination. A click on it walks you to the clicked point. People cross it where they like.
- **Drawn to its size**, long either way: the lanes run along its longer side, so a box wider than tall is a road
  across the canvas and one taller than wide a road down it. Default 480 × 136. Not aspect locked; stretched along its
  length to any length, its width across holds the two lanes (a wider road has wider lanes; the lines and kerbs keep
  their size).
- **Its look**: a grey asphalt carriageway with a fine speckle, a pale stone kerb along each long side (a lit top and
  a shaded face), and a dashed white centre line, dashes the same length however long the road, the first and last
  whole. The ends are open: roads laid end to end join into one street. The asphalt takes the element's fill (a
  warm mid grey when unstyled, a deeper grey on dark paper).
- **Turning**: Rotate Left and Right (and Space while placing) turn it as a [Rug](office.md#rug) turns: its box's
  sides swap about its middle, so a road across becomes a road down at the same length.
- **In 3D** its kerbs stand a little proud of the asphalt (about 3 canvas px as the pieces rise), low enough to
  step over without a thought; the carriageway and its line are the floor's.

## Traffic

- **Two lanes, one way each.** Traffic keeps to the right of the centre line: on a road across the canvas the lane
  nearer the bottom drives left to right and the lane nearer the top right to left; on a road down the canvas the left
  lane drives down and the right lane up. Turning the road never changes this.
- **Now and then a car.** Each lane is its own timeline: time is cut into 7 second slots and in about six slots in ten
  a car sets off, at a moment in the slot that keeps it at least 2.5 s behind the car before it, so cars on a lane
  are a few seconds to a quarter of a minute apart and never meet. A car fades in over its first 0.5 s at its lane's
  start, drives at a steady 300 canvas px a second (a little faster than a character walks) to the far end and fades
  out over its last 0.5 s. A long road can have a few cars on a lane at once, spaced out as they set off.
- **Every viewer sees the same cars**, with no network traffic: which cars set off, when, and their colours, come from
  the road's id and the time on the viewer's clock alone. Two people whose clocks agree see the same car pass the same
  spot together; a road's traffic carries on as it was if you look away and back.
- **Colours** are picked per car from a small palette that suits the art: cherry red, cornflower blue, sage green,
  sunflower yellow, pearl white, slate grey and teal. The car itself is the [Car Park](venue-pieces.md#car-park-bike-rack)'s low-poly
  car (body, glass cabin, wheels, lamps), longer, in the car's colour.
- **Scenery only.** Cars never stop for anyone, never collide with characters or each other and never block a walk:
  you walk through a car as you would through its shadow. Nothing about a car is stored or sent.
- **Out of doors only.** A road is made for outside. A road whose middle lies inside a Room or a Corridor still
  draws, but no car drives on it, so no car ever drives through an office. Every template keeps its roads out of its
  rooms (the templates' `outdoor` check).
- **Only roads in view drive.** A road outside the view costs nothing: no car is drawn for it.
- **Reduced motion**: no cars at all; the road is a quiet street.
- **A road too narrow for a car** (under 96 canvas px across its lanes) has no traffic.

## Performance

- Every car on a tab is drawn by one instanced mesh (its body tinted per car, the parts that keep their colour
  untinted), so ten roads cost one draw, not one per car. Nothing is allocated per car or per frame.
- Cars move in the scene's own frame loop and never wake it: the scene stays at its calm 30 frames a second while
  cars drive, as the grass's wind does ([Real 3D "Performance"](../008-canvas/3d-engine.md#performance)).
- A tab with no road builds no car and does no traffic work at all.

## Share roles

- **Editor**: places, moves, resizes, turns, recolours and deletes roads.
- **Participant**: has no palette, so places none; walks across roads and sees their traffic.
- **Viewer**: walks across roads and sees their traffic (it is drawn from the board, which a Viewer has).

## Telemetry

Placing one: `Element · Added · Road`. Cars send nothing.

## Not in scope

- Junctions, bends, crossings, traffic lights, parking on the road, buses, bikes or people in cars.
- Cars that stop for characters, horns or engine sounds.
- Traffic that follows a shared server clock (it follows each viewer's own clock).
