# Arrow anchors and auto-rebind

Where a pinned arrow end may sit on a boxed element, and how that place changes when elements move.
The arrow element itself (endpoints, styles, labels, handles) is specified in
[Canvas and palette](canvas-and-palette.md) "Arrows"; this spec owns the anchor vocabulary, anchor
geometry, the anchor chosen when a connector is created, the converging-fan rendering and the
auto-rebind rule.

## Anchors

A pinned endpoint names one of **sixteen anchors**, named after the sixteen points of the compass
rose. Which of them an element offers depends on its kind (below):

| Position class | Anchors                                                | Where                                            |
| -------------- | ------------------------------------------------------ | ------------------------------------------------ |
| Corner         | `ne`, `se`, `sw`, `nw`                                 | The four corners                                 |
| Middle         | `n`, `e`, `s`, `w`                                     | The midpoint of each edge                        |
| Quarter        | `nne`, `ene`, `ese`, `sse`, `ssw`, `wsw`, `wnw`, `nnw` | Halfway between a corner and its edge's midpoint |

- Every anchor has a **position class**: corner, quarter or middle.
- Every anchor lies on one or two **sides** (`n`, `e`, `s`, `w`):
  - a middle and a quarter lie on the one side their edge belongs to (`nne` lies on `n`, `ene` on `e`);
  - a corner lies on both sides that meet there (`ne` lies on `n` and `e`).
- There is no centre anchor and no free position along an edge.
- The eight anchors that predate the quarters keep their ids and their meaning, so every stored
  diagram stays valid unchanged. Stored and imported data accepts all sixteen ids.

### Anchors per shape

Each kind offers its own **anchors**: which of the sixteen it has, and where they sit.

| Kind                                                         | Count | Anchors and where they sit                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Box-shaped kinds (every kind not listed), `stadium`, `cloud` | 16    | All sixteen, on the box or projected onto the drawn outline                                                                                                                                                                                                         |
| `star`                                                       | 16    | All sixteen on its bounding rectangle, not on its points                                                                                                                                                                                                            |
| `speech-bubble`                                              | 16    | All sixteen on its body (which fills the box); the tail carries none                                                                                                                                                                                                |
| `cylinder`                                                   | 16    | All sixteen, projected onto its drawn outline (the curved top and bottom)                                                                                                                                                                                           |
| `document`                                                   | 14    | All but the two bottom corners (`sw`, `se`), on its drawn outline                                                                                                                                                                                                   |
| `parallelogram`, `trapezoid`                                 | 16    | Corners on the shape's own corners; top and bottom middles on the shape's vertical centre line; each top or bottom quarter halfway between that middle and the nearer corner of its face; left and right faces carry their quarter, middle and three-quarter points |
| `hexagon`                                                    | 16    | Top and bottom faces carry three: the middle and, halfway between it and each end of the face, a quarter; the corners and the side quarters split each slanted face into thirds; the side middles are the side points                                               |
| `triangle`                                                   | 9     | Three on each face (left `w`, right `e`, base `s`): the face's middle and, halfway between it and each end of the face, a quarter. No corners, nothing at the apex                                                                                                  |
| `circle`, `diamond`                                          | 8     | Corners and middles on the outline (a diamond's middles are its tips, its corners the centres of its edges)                                                                                                                                                         |
| `actor`                                                      | 8     | Corners and middles on the hull around the figure                                                                                                                                                                                                                   |

- A side that carries anchors always carries its middle.
- Snapping, the snap-target markers, the creation anchor and the auto-rebind only ever choose an
  offered anchor.
- An end can still sit on an anchor its element does not offer (a square with quarter ends morphed
  into a circle, an old diagram, imported data). It is drawn where that anchor projects onto the
  outline, as before; when the auto-rebind moves it, it takes an offered one.

## Anchor geometry

- An anchor is a point on the element's **connector box**: the element's box, or a Technology
  icon's mark ([Technology icons](../010-palette/technology-icons.md)).
- **Outline projection.** On a shape whose drawn outline differs from its box, the anchor moves
  onto that outline along the ray from the box centre through the box anchor, so a connector meets
  the edge the user sees. This applies to every anchor, quarters included. The outlined
  kinds are:
  - `circle` (the ellipse filling the box);
  - `diamond`, `parallelogram`, `hexagon`, `triangle` and `trapezoid` (their polygons in the
    shared shape-geometry table; the last four also place their anchors along their faces, above);
  - `stadium` (the capsule: a box with fully rounded ends);
  - `actor` (the hull around the stick figure: head, arm tips and feet, down to the bottom of its
    label band);
  - `cloud` and `document` (their drawn paths: the cloud's bumps, the document's wavy bottom edge);
  - `cylinder` (its body with the curved top and bottom).
- Every other kind keeps its box as its outline for anchoring, including `star` and
  `speech-bubble`.
- A Technology icon with a caption pushes the anchors on the caption's side out to the element
  edge, so a connector leaving toward the caption starts past the text.
- **Rotation.** On a rotated element the anchor rotates with the element about its centre.
- Rendering, snapping, the snap-target markers and the auto-rebind all resolve anchors the same
  way (`anchorPosition`), so they always agree.

## Where anchors are offered

- **Snapping.** Dragging an arrow endpoint near any element snaps it to the nearest anchor in that
  element's anchors (within the snap distance in [Canvas and palette](canvas-and-palette.md)
  "Manipulating arrows").
- **Snap-target markers.** While an endpoint is dragged, the anchors of every nearby element
  show as small dots on its outline; the one snapped to is drawn larger.
- **Quick-connect pluses** on a selected element start a connector from the middle of their side;
  a side without anchors (a triangle's top) starts it from the offered anchor nearest that middle.

## The anchor at creation

When a connector is created between two elements without the user choosing the anchors
(click-to-connect, templates, mind maps), each end takes the **middle** of the side
that the ray from its element's centre towards the other element's centre leaves through (for a
side without anchors, the next side as in "The new side"). The
choice is aspect-ratio aware and rotation aware: a short, wide box leaves through its top or bottom
for all but near-horizontal targets. Sharing an anchor with an existing connector is allowed.

## Converging-fan rendering

When two or more arrow ends pin to the same anchor of the same element, rendering them at one point
piles the arrowheads into a blur. Both render paths (the live canvas and the SVG export) fan such
ends out along that anchor's edge:

- neighbours sit 14 px apart, clamped so a fan never covers more than 80% of the room it has;
- a middle's fan is centred on it and has the whole edge as its room;
- a quarter's fan is centred on it and has half the edge as its room;
- a corner's fan marches inward along its horizontal edge;
- slots are ordered by where each arrow comes from, so neighbouring lines do not cross at the fan;
- the offsets rotate with a rotated element.

The fan is purely visual: stored anchors, snapping and the auto-rebind use the true anchor point.

## Auto-rebind

As elements move, a pinned end can end up on a side that makes its arrow run through a shape. The
auto-rebind moves such an end to the side facing the other end, and keeps everything else about
where it was.

### The setting

- The **Auto-Attach Arrows** setting (`autoRebindArrows`, Settings → Editor,
  [User preferences](../007-editor/user-preferences.md)) turns the auto-rebind on or off.
- It is **on by default**. When it is off, a move never changes an anchor.

### When it runs

- After every move of boxed elements: live on every frame of a drag, and on every keyboard nudge.
- Resizing, rotating and editing do not run it.
- Every run starts from the anchors as they are now. There is no memory of earlier anchors: once
  an end has moved, its new anchor is the truth, and the rule never returns it to where it was.
- Because a drag runs it on every frame, an end is decided at the first frame where its path runs
  through a shape, with the geometry of that frame; the rest of the drag keeps that anchor while
  the path stays clear.

### Which arrows it considers

An arrow is **considered** when at least one end is pinned to an element that moved, except:

- an arrow with both ends pinned to elements that moved together (it translates rigidly, so
  nothing about it changed);
- an arrow with both ends pinned to the same element (a self-loop).

Arrows with one free (or on-arrow) end are considered: only their pinned end can re-anchor.

### The trigger

- A considered arrow **triggers** only when its **drawn path** passes through the shape of either
  of its pinned ends:
  - the drawn path is the path as rendered: straight, curved (with any bend points) or angled
    (with any elbow offset or bend points), between the true anchor points;
  - "passes through" means some point of the path lies inside the shape's outline (the anchoring
    outline above), deeper than a small grazing tolerance, so a path touching or running along an
    edge does not trigger.
- Nothing else triggers a side change: not distance, not a better-looking side, not another
  arrow on the same anchor.

### The new side

When an arrow triggers, each of its pinned ends is re-evaluated:

1. **Facing side.** The end's facing side is the side through which the ray from its element's
   centre towards the other end's **aim point** leaves the connector box. The aim point is the
   point of the other end's connector box closest to this element's centre, or the other end's
   position when that end is not pinned to an element. Aiming at the closest point makes boxes in a
   row face each other through their opposing sides even when slightly offset. When that side
   carries no anchors (a triangle's top), the facing side is the next one that does: first the
   other side the ray leaves through, then the remaining sides by how directly they face the aim
   point.
2. **Already facing.** If the anchor already lies on the facing side (a corner lying on it through
   either of its two sides counts), the end keeps its anchor.
3. **Same class, new side.** Otherwise the end moves to an anchor of the **same position class** on
   the facing side. When the side offers none of that class, a quarter takes a corner, else a
   middle; a corner takes a quarter, else a middle:
   - a **middle** takes the facing side's middle;
   - a **quarter** takes the quarter on the facing side that is **closer to the other end**, unless
     another arrow already holds it; then it takes the other quarter;
   - a **corner** follows the quarter rule with the facing side's two corners.
4. "Closer to the other end" measures from each candidate anchor to the other end's reference
   point: the centre of the other end's connector box, or the other end's position when it is not
   pinned to an element. When both candidates are equally close, the one nearer the end's previous
   anchor wins.
5. "Held" means another arrow has an end pinned to that anchor of that element at the time of the
   decision. When both candidates are held, the closer one is taken and the fan separates them.

The rule applies to every pinned end alike, however it was set: drawn, snapped, dragged by hand,
imported or created by a template. A free end never moves.

### Crossings on one side

After the re-evaluation, two pinned ends on the **same side of the same shape** whose drawn paths
**cross** each other **swap anchors**:

- two ends are on the same side when their anchors share a side, and they are different anchors;
- at least one of the two arrows is considered in this run;
- paths meeting only at an end point (two arrows into the same far anchor) do not cross;
- the swap happens only when it uncrosses the two paths and neither swapped path then passes
  through a shape of its own pinned ends;
- a swap changes no side: both anchors stay where they were, the arrows trade them.

## Errors and limits

- A pinned end whose element no longer exists, or is not a boxed element, is left as it is.
- An end whose element centre coincides with its aim point has no facing side and keeps its
  anchor.
- A shape too small to have an inside deeper than the grazing tolerance never triggers.
- Unknown anchor ids in stored or imported data are rejected by validation like any other invalid
  endpoint.

## Implementation

- Vocabulary, anchors per shape and geometry: `packages/diagram/src/anchors.ts`, `shape-outline.ts`,
  `svg-path-outline.ts`, `geometry.ts`.
- Creation choice: `bestAnchorTowards` in `anchor-choice.ts`.
- Fan: `arrow-endpoint-spread.ts`.
- Auto-rebind: `rebindArrowAnchorsAfterMove` in `arrow-rebind.ts`, with the path tests in
  `arrow-path-hits.ts` and the swap in `arrow-rebind-swap.ts`; called from the drag and nudge hooks
  in `apps/live/hooks/canvas/`.
- Blueprint: [blueprints/arrow-anchors.md](blueprints/arrow-anchors.md).
