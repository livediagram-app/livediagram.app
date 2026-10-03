# The lane

## What

A **Lane**: a horizontal band with a titled gutter down its left edge, for
swimlane documents: a role, a team, or a system per band, with the steps laid
inside it.

Dragging a lane carries everything inside it, exactly as a frame does.

## Why

The swimlane template already existed, built out of `frame` shapes. Its own
source says what that cost:

> Lanes sit slightly apart: flush frames doubled their borders into a heavier
> line with a hairline sliver between (the old design's visual glitch)

and the role labels had to be moved into separate gutter cells "so no step can
overlap them". Both are workarounds for a missing element: a frame is a
square-ish section container with a corner title, and a lane is a wide band
with a side title. Faking the second with the first means fighting the border
model and hand-placing the labels.

Containers and swimlanes are first-class in both draw.io and Miro, and
cross-functional flows are one of the three things [Purpose](../001-project-vision/purpose.md) names its target
users doing.

## It reuses the frame, deliberately

`shape: 'lane'`, and one predicate change. `containerContents`
(`packages/document/src/containment.ts`) answers "which elements travel with this
container" for frames and lanes alike, by the one membership rule: an element
belongs to the smallest frame or lane holding its centre, so a box straddling
the edge travels when its centre is inside, and an element overlapped by two
containers belongs to the smaller. Lanes share that predicate rather than
getting their own copy, so both kinds share the containment rules, and an
agent's `move` carries exactly what a person's drag does.

What differs from a frame is presentation only:

- **900 × 200** by default: a band, not a box.
- **A gutter** down the left (`LANE_GUTTER_PX`, 132) on a tinted strip, with a
  divider line where it meets the body. The title lives in the gutter, so a swimlane needs no
  separate title cells.

  Both the gutter's **colour** and its **thickness** are the user's:

  - **Heading** in the context menu's Colours section sets `headerFill`. Unset
    paints a 10% wash of the lane's own stroke, so a
    recoloured lane carries its gutter with it. The field is shared with a
    table's header row, because a heading band is one idea wearing two
    silhouettes.
  - **Dragging the seam** between the gutter and the body sets `headerSize`.
    132 and 64 suit only the titles they were measured against; a lane holding "Q3 Marketing Programme" wants more than
    one holding "Q3". One commit per gesture, so a drag is one undo step, and
    the seam is clamped so a gutter can neither vanish nor eat the lane.

    The live size during a drag is held in a ref as well as in state, and
    release commits from the ref. Committing from inside a `setState`
    UPDATER is wrong, because React runs it during the render phase and the
    commit would update the page while the gutter is rendering. Reading the
    effect's closed-over state is wrong a different way, since `pointermove`
    is not a discrete event and its re-render may not have flushed by the time
    the release arrives.

    The drag **snaps**, to the ordinary alignment grid AND to **other lanes'
    seams** (`lane-seam-snapping.ts`). The second is the one that matters: a
    stack of swimlanes with headings a few pixels apart is the thing that
    makes a canvas look untidy, and it is nearly impossible to fix by eye
    because the seams are too far apart vertically to sit in one glance. Only
    lanes whose heading runs along the same axis are offered, since a column's
    seam and a row's seam are different lines. A centred strip has two seams
    and no single line to align, so it is sized freely rather than snapped.

- **Left-aligned, vertically centred label**, so the title reads along the
  band's leading edge rather than floating in the middle of the work.

## Aligning the title re-orients the lane

The gutter is the title's backdrop, so it runs along whichever **edge the
title is pinned to** (`laneGutterEdge` in `packages/document/src/lane-gutter.ts`, drawn by `LaneGutter.tsx`):

| Title alignment           | Gutter                                          |
| ------------------------- | ----------------------------------------------- |
| Left / right (any height) | Strip down that side, 132 wide by default       |
| Centre, top or bottom     | Band across that edge, `LANE_BAND_PX` (64) tall |
| Centre, middle            | Strip down the middle                           |

A horizontal pin wins whenever there is one: a title reading down the leading
edge is the swimlane idiom, and nudging it up or down that edge must not
re-orient the band. Only a title with no horizontal edge to hug lets the
vertical pin decide, and that is the point of the rule. **Centring the title
at the top or bottom turns the lane into a vertical one**, a column with a
header band, which is how you build a board of columns rather than a stack of
rows.

The band is 64 rather than 132 because the job differs by axis. 132 buys room
for words across; a band only has to hold one line down, which is the `lg`
padding (24) above and below it.

## Stacking lanes

Lanes are placed like any other element and are not auto-stacked. Snapping and
the alignment guides already make butting one under another easy, and a
container that repositioned its neighbours would be the same "silently re-flowed
what I arranged" problem [The mind node](mind-node.md) avoids for mind nodes.

Their borders no longer double up when flush, because a lane's outline is a
single hairline drawn on the CSS box path rather than two frames' borders
meeting.

## Upright titles

A swimlane drawn as a stack of wide rows often reads its titles **upright**, turned a quarter to
read from bottom to top in a thin strip down the leading edge, as draw.io, Visio and BPMN tools draw
them. The strip then only has to hold one line across its thickness, so the rows keep their width
for the work.

- `titleOrientation: 'upright'` turns the title; absent means across, as every lane drawn so far.
- An upright title reads from bottom to top, centred along its strip by default; its alignment
  along the strip follows the vertical pin (top, middle, bottom), so the gutter rule above still
  places the strip by the horizontal pin.
- The strip is `LANE_BAND_PX` (64) thick by default, the same one-line band a column's header uses,
  and the seam drag sizes it like any gutter (`headerSize`).
- Only a strip down a side turns its title: a band across the top or bottom always reads across, so
  turning a column's header has no effect and the toggle is not offered there.
- A title longer than the strip is tall wraps across the strip's thickness; what does not fit is
  clipped. The strip's padding is at most the small padding, so a one-line strip keeps its line.
- The context menu's Text section carries **Upright title** for a lane with a side strip; one commit,
  one undo step.
- Export (SVG, PNG, PDF) draws the turned title exactly as the canvas does; screen readers read the
  title as text, unaffected by its turn.
- The [draw.io import](../020-import-export/drawio-import.md) uses it for every `horizontal=0` lane.
