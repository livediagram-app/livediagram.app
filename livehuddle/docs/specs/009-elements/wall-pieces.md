# Wall pieces

Some pieces of a Space only make sense on a wall: a Fireplace, a Bookshelf, a Screen, a Notice Board, a Room Sign, a
World Clock, a Dartboard, a Calendar Wall, a Photo Wall and a Hand Dryer (`WALL_MOUNTED` in `@livehuddle/document`).
Dropped in the middle of a floor they float, in the flat plan and more so in the 3D view (the owner, 2026-11-18:
"fireplaces should only be placed on walls, some element types are designed for walls and should not be dropped in
other places").

## Only on a wall

- **Placing one** (a click, a drag from the palette, a drawn box, a paste or a duplicate) puts it on the nearest
  face of a wall: a Room's (box or Room Builder), a Corridor's or an Office Pod's. A piece that turns (a Fireplace, a
  Bookshelf) turns to face away from the wall into the room; one that does not (a sign, a board) hangs flat on a back
  wall's standing face, or stands edge on against a side wall as a blade sign. It slides along the wall to stay
  inside its run, and a piece longer than the wall is centred on it.
- **Moving one** snaps it the same way when the drag ends, so it slides from wall to wall.
- **One already on a wall stays where it is**: its middle along the wall and its edge within 24 px of the wall's
  face (or anywhere on a back wall's standing face), on the room's side of it.
- **No wall on the board**: it is placed where it was dropped, as before.
- The preview while placing shows where it will land.

## Templates

Every template's wall pieces are on a wall: building a template runs its pieces through the same snap
(`onWalls` in `@livehuddle/templates`), and a test checks every template's wall pieces are left unchanged by it and
overlap neither each other nor any other piece's footprint.

## Share roles

Placing and moving are editing: an Editor's alone, as for any element. Participants and Viewers see the result.
