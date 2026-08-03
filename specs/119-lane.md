# 119 — The lane

Status: shipped

## What

A **Lane**: a horizontal band with a titled gutter down its left edge, for
swimlane diagrams — a role, a team, or a system per band, with the steps laid
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
cross-functional flows are one of the three things spec/00 names its target
users doing.

## It reuses the frame, deliberately

`shape: 'lane'`, and one predicate change. `withFrameContents`
(`apps/live/lib/canvas.ts`) already answers "which elements travel with this
container", including the two rules that make it correct — a container only
carries a box it FULLY contains, and an element overlapped by two containers
belongs to the backmost one. Lanes join that predicate rather than getting
their own copy, so both kinds share the containment rules and can't drift
apart.

What differs from a frame is presentation only:

- **900 × 200** by default: a band, not a box.
- **A gutter** down the left (`LANE_GUTTER_PX`, 132) on a tinted strip, with a
  divider line where it meets the body. The title lives in the gutter, which is
  why the swimlane template needed separate cells before.
- **Left-aligned, vertically centred label**, so the title reads along the
  band's leading edge rather than floating in the middle of the work.

## Aligning the title re-orients the lane

The gutter is the title's backdrop, so it runs along whichever **edge the
title is pinned to** (`laneGutterEdge`, `LaneGutter.tsx`):

| Title alignment           | Gutter                                          |
| ------------------------- | ----------------------------------------------- |
| Left / right (any height) | Strip down that side, 132 wide                  |
| Centre, top or bottom     | Band across that edge, `LANE_BAND_PX` (64) tall |
| Centre, middle            | Strip down the middle                           |

A horizontal pin wins whenever there is one: a title reading down the leading
edge is the swimlane idiom, and nudging it up or down that edge must not
re-orient the band. Only a title with no horizontal edge to hug lets the
vertical pin decide — and that is the point of the rule. **Centring the title
at the top or bottom turns the lane into a vertical one**, a column with a
header band, which is how you build a board of columns rather than a stack of
rows. Before, the strip stayed vertical down the middle with the words perched
at its top: the lane still read as horizontal while its title read as a header.

The band is 64 rather than 132 because the job differs by axis. 132 buys room
for words across; a band only has to hold one line down, which is the `lg`
padding (24) above and below it.

## Stacking lanes

Lanes are placed like any other element and are not auto-stacked. Snapping and
the alignment guides already make butting one under another easy, and a
container that repositioned its neighbours would be the same "silently re-flowed
what I arranged" problem spec/118 avoids for mind nodes.

Their borders no longer double up when flush, because a lane's outline is a
single hairline drawn on the CSS box path rather than two frames' borders
meeting.
