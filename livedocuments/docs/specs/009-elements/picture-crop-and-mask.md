# Picture crop, mask and greyscale

## What

Three ways to shape the picture an [image element](images.md) shows, without changing the picture in the gallery:

- **Crop**: keep part of the picture. The box shows only that part.
- **Mask**: cut the box to a shape: a circle, a rounded rectangle, an arch, a hexagon, a diamond, a triangle, a star or a
  blob.
- **Greyscale**: draw the picture without colour (a logo strip's quiet logos, [Logo strip](logo-strip.md)).

## Why

Slides lean on photos: a portrait cut to a circle, a product shot cropped to its subject, a photo filling half a
slide ([Pages](../007-editor/pages-mode.md) "Slide layouts", Pictures). Without a crop the box shows the whole picture
(or covers and crops it about its centre); the person had to crop the file in another app and upload it again. A
mask turns a rectangle into the shape the slide wants without a separate shape element on top.

## The fields

On `ImageElement`, all optional, absent being the plain picture:

- `crop: { x, y, width, height }`: the part of the picture kept, as fractions of the picture's own width and height
  (0 to 1), from its top-left corner. `width` and `height` are at least 0.02, and the part never runs past the
  picture (`x + width <= 1`, `y + height <= 1`). The whole picture (`0, 0, 1, 1`) is stored as no crop.
- `mask: 'circle' | 'rounded' | 'arch' | 'hexagon' | 'diamond' | 'triangle' | 'star' | 'blob'`, each drawn to fill
  the box:
  - **Circle**: an ellipse touching the box's four sides (a circle in a square box).
  - **Rounded**: a rounded rectangle, its corners a fifth of the shorter side, softer than the largest corner
    radius ([Corner radius](../008-canvas/corner-radius.md)).
  - **Arch**: a rectangle whose top is a half ellipse as wide as the box (an arched window).
  - **Hexagon**: points at the left and right, the slanted sides a quarter of the width in.
  - **Diamond**: the four side midpoints joined.
  - **Triangle**: pointing up, its base the box's bottom edge.
  - **Star**: five points, the inner points at 0.4 of the outer radius.
  - **Blob**: a soft organic shape of four curves, fixed (the same blob for every picture).
- `greyscale: true`: the picture drawn without colour.

Every reader drops a value it does not know: a crop out of range, a mask not in the list, a greyscale that is not
`true`. The picture then draws without it.

## How a crop and a mask draw

- **The kept part is the picture.** A crop's part is laid into the box as a whole picture is: `objectFit` `contain`
  (the default) fits it whole, `cover` fills the box. A crop made in the editor sizes the box to the part's own
  proportions, so the two agree and nothing is letterboxed.
- **A masked picture always covers.** The shape is filled edge to edge, whatever `objectFit` says, so a circle never
  shows white bands. The mask replaces the box's corner radius, and a Sketch or Marker finish draws no hand-drawn
  edge round a masked picture (its rectangle would no longer follow the picture).
- **The drop shadow follows the shape** ([Element shadows](../008-canvas/element-shadows.md)): it is cast by what is
  drawn, so a circle casts a round shadow.
- **The selection and the handles stay the box.** Moving, resizing, rotating and snapping work on the box as for any
  picture.
- **Greyscale** is the picture's luminance (Rec. 709 weights), the same on screen and in every export.
- **The placeholder** (no picture yet) is round under a Circle mask, as an avatar's is, and keeps its rectangle under
  the other masks, so its dashed outline and Select Image button stay whole; the mask cuts the picture once there is
  one.

## Cropping in the editor

The Image section of the element's menu holds **Crop Image** between **Change Image** and **Remove Image**, for a
picture only (an empty placeholder has nothing to crop). Pressing it closes the menu and starts **cropping** that
image on the canvas:

- **What shows**: the whole picture at the size it is drawn, the part outside the box dimmed under a dark veil; the
  box as a white frame with faint thirds lines; eight handles on the frame (four corners, four edges), the same size on
  screen at any zoom. The element's own resize handles step aside while it is cropped.
- **Moving the picture**: dragging anywhere on the picture (inside the frame or the dimmed part) slides the picture
  under the frame. It never leaves a gap: the frame always lies on the picture.
- **Changing the crop**: dragging a handle moves that edge or corner of the frame, never past the picture's edge and
  never smaller than 24 canvas px across. While an aspect is chosen (below) only the corners show, and they keep its
  proportions; with Free, Shift held on a corner keeps the frame's own.
- **The crop bar**, fixed at the foot of the screen while cropping (above the safe area on a phone):
  - **Aspect**: **Free**, **Original** (the picture's own proportions), **Square**, **4:3** and **16:9**, as a
    segmented control. A choice reshapes the frame to it about its centre, as large as fits inside the picture and no
    larger than the frame was, and holds it while the corners are dragged; Free lets them go.
  - **Zoom**: a slider from 100% to 400%, the picture's size against its fitted size. It scales the picture about the
    frame's centre, kept covering the frame.
  - **Reset** (back to the whole picture at the box's size, still cropping), **Cancel** and **Done**.
- **Ending**: **Done** or Enter applies; **Cancel** or Escape leaves the image as it was; a press anywhere off the
  picture applies, as clicking away does in a slide app. Selecting another element, an undo, the image leaving the
  tab or losing its picture ends cropping without a change.
- **What Done stores**, one edit and one undo step: the box becomes the frame (it can move and change size) and
  `crop` the part of the picture under it. Nothing is stored when the frame and the picture are where they began.
- **Rotation**: a rotated image is cropped in its own frame: the veil, the frame and the handles turn with it, and a
  drag moves along its edges.

## Masks in the editor

The Image section holds **Mask**, a grid of tiles under the crop: **No Mask** then the eight shapes, each tile
showing its shape. Hovering a tile previews it on the selected pictures; a press sets it (one edit), even while its own
preview shows, and No Mask removes it. A mask applies to every selected image.

## Greyscale in the editor

The Image section's **Greyscale** toggle ("Draw the picture in shades of grey."): one edit, on every selected image.

## Export and preview

- **SVG** (the export, the previews and the live image): the picture is drawn at its laid-out rectangle inside a clip
  of the box (or the mask's path), with the kept part's own clip for a letterboxed crop; greyscale is an
  `feColorMatrix` filter. Every renderer, the api's preview included, draws these SVG constructs.
- **PNG and PDF** draw the same geometry onto the canvas: the clip is the mask's path (`Path2D`), and greyscale is the
  canvas filter where the browser has one, else the picture's pixels turned grey once per export.
- **PowerPoint** draws slides as pictures (Office export), so it shows the crop, the mask and the greyscale as drawn.
- **Office import**: a picture cropped in a PowerPoint file (`a:srcRect`) comes in with that crop as `crop`, instead
  of covering its box about the centre.

## Share roles

| Role        | May                                                                                   |
| ----------- | ------------------------------------------------------------------------------------- |
| Editor      | Crop, mask and set greyscale (each changes the element)                               |
| Participant | See them; never crops, masks or turns greyscale on or off (none is text it may write) |
| Viewer      | See them                                                                              |

A Participant's or a Viewer's menu has no Crop Image, Mask or Greyscale, and a locked image (its own lock, a locked
tab or layer) cannot be cropped: cropping moves and resizes the box, which the lock holds. A locked image's mask and
greyscale stay with the lock's other style edits: refused.

## Agents

The MCP server and the REST API take `crop`, `mask` and `greyscale` on an image element, with the rules above; a value
out of range is refused naming the field. `read_document` lists them with the element.

## Performance

- **Canvas**: a crop is the `<img>` placed and sized inside a clipping box (no copy of the picture is made); a mask is
  a CSS `clip-path: path()` on the same box; greyscale a CSS `filter`. None adds a layer per frame, and none redraws
  on pan or zoom. The mask's path is worked out once per box size.
- **While cropping**, a drag moves the picture by `transform` only and commits once, on Done.

## Telemetry

`Element · Changed · ImageCrop` on Done (when something changed), `ImageMask` when a mask is set or removed,
`ImageGreyscale` when greyscale is turned on or off.
