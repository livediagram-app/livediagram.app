# Poster

Status: **approved** (owner, 2026-11-27: "I want the ability to add posters to walls, a frame which I can then in edit
mode choose a photo from gallery, upload, search etc"; then "we don't have 2d mode anymore, don't support 2d").

A picture frame that hangs on a wall of the Space: a thin dark frame round a white mat, and in it a picture an Editor
chooses. A team hangs its photos, its product shots, a map or a poster for the next offsite, and everyone walking by
sees them. It is a [wall piece](wall-pieces.md) and an [Office](office.md) piece in every way not said here, seen in
the 3D Space (the flat plan is gone, so the piece draws only what Edit needs to select, move and resize it).

## Where it lives

The **Meet** category, after the Team Photo Wall ([Team pieces](team-pieces.md#where-they-live)): the tile **Poster**,
"A picture for the wall". Shape kind `poster`.

## The piece

- **Default size** 56 × 76, portrait. **Resizable** to any size, its proportions free (not aspect locked): the box's
  width is the frame's width along the wall and its height the frame's height, so a wide poster is a landscape one.
- **On a wall**: placed, dropped, pasted or moved, it lands on the nearest wall face and hangs flat on it, as every
  [wall piece](wall-pieces.md) does; it keeps the room's facing (it does not turn).
- **In 3D** ([3D engine](../008-canvas/3d-engine.md#wall-pieces-sit-on-their-wall)) it hangs flat on its wall, its
  middle at eye height (a character's eyes), never below the floor's skirting nor above the wall: a dark frame 3 px
  wide, a white mat inside it, and the picture filling the mat's opening, cropped to fill it (cover), never stretched.
- **Empty**, the opening shows a soft grey placeholder: a pale mount with a small landscape mark (a sun over two hills)
  in a quiet ink, so an empty frame reads as "Add a picture" rather than broken.
- **A picture that cannot load** (removed from the gallery, offline) shows the empty placeholder.
- No words of its own (no label), no walking behaviour: it never blocks and is never a destination.

## Choosing its picture

The picture is chosen with the same **image picker** the Image element uses ([Images](images.md), [Image
search](image-search.md)): its **Upload**, **Gallery** and **Search** tabs exactly as they are, and **Remove Image**
when it has one. The picture is stored on the piece as an Image element's is: `imageId` (the gallery id) and, from a
search pick, its `credit`. So it reaches every peer through the room, survives a reload, and is in the image reference
index (`image_refs` counts a `shape` element's `imageId`), so a share-link visitor is served it and the unused-image
sweep keeps it.

The picker opens from:

- a **double click** on the poster in Edit;
- **Choose Picture** on its selection toolbar (a picture button between More and Duplicate);
- the element menu's **Picture** section: **Choose Picture** while empty, **Change Picture** and **Remove Picture**
  once it has one, and the picture's credit when it came from Search.

Choosing replaces the picture (and its credit) in one undoable step; Remove clears `imageId` and `credit` in one
undoable step and keeps the frame's size.

## Share roles

| Who             | Poster                                                              |
| --------------- | ------------------------------------------------------------------- |
| **Editor**      | Places, moves, resizes it; chooses, changes and removes its picture |
| **Participant** | Sees it and its picture                                             |
| **Viewer**      | Sees it and its picture                                             |

Only an Editor's double click, toolbar and menu open the picker for a poster (a Participant may swap an Image
element's picture, [Share roles](../013-workspace/share-roles.md), but a poster is part of the Space's build).

## Performance

- The frame is part of the pieces' one geometry; the picture is a textured quad of its own on the frame's face, so a
  picture loading or changing never rebuilds the pieces' geometry.
- Each picture is drawn to a texture at most 1024 px on its longer side, one texture per poster, released when its
  picture changes, the poster goes or the 3D view closes.

## Telemetry

- Placing one: `Element · Added · Poster`.
- Choosing its picture: `Element · Changed · Poster`; from Search also `Element · Used · ImageSearch`.

## Not in scope

- A frame colour or mat choice, a caption, several pictures in one frame, or a slideshow.
- Pictures from a URL that is not in the gallery (Search copies its pick into the gallery).
- The flat plan's drawing beyond the plain frame Edit selects and resizes.
