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

## Stacking lanes

Lanes are placed like any other element and are not auto-stacked. Snapping and
the alignment guides already make butting one under another easy, and a
container that repositioned its neighbours would be the same "silently re-flowed
what I arranged" problem spec/118 avoids for mind nodes.

Their borders no longer double up when flush, because a lane's outline is a
single hairline drawn on the CSS box path rather than two frames' borders
meeting.
