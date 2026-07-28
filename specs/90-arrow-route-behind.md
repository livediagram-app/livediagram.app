# 90 — Arrows pass behind intervening boxes

Status: shipped

## What

With boxes packed close together — a parent fanning out to several children —
an arrow to a far child draws straight over the children in between. It reads
as though the line belongs to the box it crosses, and a fan of them turns into
clutter.

So where an arrow's line crosses an unrelated box, it **breaks a short
distance before the box and resumes past it**, as though passing underneath.
Not a z-index swap: a hard clip at the box edge looks like a rendering fault,
whereas a gap either side reads as depth.

## Default ON

`ArrowElement.routeBehind?: boolean`, where **absent means on**. Only an
explicit `false` opts out.

This is a rendering default rather than a stored one, which matters on two
counts: existing diagrams pick the behaviour up without a migration, and an
arrow that should pass behind never has to be told to. The cost is that
existing diagrams _change appearance_ on upgrade — deliberate, since crossing
a box was never the intent in the cases this fixes.

The per-arrow escape is the **Pass behind boxes** toggle in the arrow's Line
section, for the times drawing over the top is wanted. It's hidden in a
multi-selection: the row shows one arrow's state, and a mixed selection has no
single answer.

## Which boxes may cut an arrow

The exclusions carry the weight here, because the feature is on by default and
a wrong obstacle **erases a line that should be visible**:

- **`frame` shapes never cut.** A frame is a section backdrop — everything
  inside it sits on top by design — so treating one as an obstacle would break
  every arrow drawn within a section. The single worst failure this feature
  could have.
- **`text` and `annotation` never cut.** They have no fill to hide behind, so
  a gap under a transparent label reads as a bug, not as depth.
- **Arrows and freehand never cut**: not boxes.
- **The arrow's own endpoint elements never cut.** The line has to reach their
  edges, and the arrowhead sits on one.
- **A box CONTAINING an endpoint never cuts.** An arrow drawn out of an
  overlapping element would otherwise be erased at its own start. Same rule
  spec/77 uses for the same reason.

Everything else opaque — shapes, stickies, images, tables, link cards — cuts.
**Every** crossed box does, not just the first: the mask below takes N holes
for the cost of one, so a single-box limit would be extra code for less.

## The break

`ROUTE_BEHIND_MARGIN` = **10 canvas units** beyond the box on every side.
Fixed rather than scaled to the box or the stroke: every arrow crossing a
given box then breaks identically, which is what makes a fan of them look
deliberate rather than ragged. Being canvas units it scales with zoom like
everything else. Box-proportional sizing was rejected — a large box already
makes a long break by being wide, so scaling on top over-cuts the line.

## How (packages/diagram/src/arrow-behind.ts + ArrowView)

`routeBehindHoles(arrow, from, to, elements)` returns the margin-inflated
rects, filtered by the rules above and by intersection with the arrow's padded
bounding box. It deliberately does **not** work out where the path actually
crosses: a mask hole over a box the arrow misses changes nothing on screen, so
sampling the curve would buy precision nobody can see.

`ArrowView` renders them as an **SVG mask** (white paints, black cuts) applied
to the visible path and the selection halo:

- A mask, not a split path, so the one path keeps its dash pattern, its flow
  animation class, and its markers. Splitting would mean re-deriving all three
  per segment.
- The mask backdrop is deliberately vast rather than the arrow's bbox: a curve
  can bow well outside its chord, and a backdrop ending at the chord would
  clip the bow instead of the boxes.
- The mask is only minted when something actually cuts the arrow. Nothing in
  the way is the common case, and an empty mask is pure overhead.
- **The hit band is NOT masked.** The arrow stays clickable across the gap, so
  selecting one that runs behind a box doesn't mean hunting for a visible
  stub.
- The holes are memoised on the element-map identity, so a pan or selection
  re-render doesn't rescan every element per arrow.

## Relationship to spec/77

[spec/77](77-arrow-collision-avoidance.md) bows a **freshly drawn** arrow
around an obstacle: one shot, at creation, and it changes the arrow's
geometry. This is a **render-time** treatment that never moves the line.

They don't fight — an arrow that bowed clear at draw time simply never crosses
anything, so it has no holes. The two cover different cases: spec/77 can't
help an arrow whose obstacle arrived later (a box dragged into the path, or an
arrow whose endpoint moved), and this can't tidy an arrow that would read
better bowed.

## Telemetry (spec/22)

`track('Element', 'Changed', 'ArrowRouteBehind')` when the toggle is flipped,
via the shared arrow-field setter. The default costs no event: it isn't an
interaction.

## Out of scope

- **Breaking around non-box elements** (freehand strokes, other arrows). Arrow
  crossings are a different problem — a jump/hop notation — and freehand has
  no rectangle to break around.
- **Path-accurate holes.** The mask cuts the arrow's bounding-box neighbours,
  not the exact crossings. Invisible in practice, per the note above.
- **Choosing which of two crossing arrows breaks.** Both cut around boxes;
  neither cuts around the other.
