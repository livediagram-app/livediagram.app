# Arrow labels

Status: in progress

An arrow's label names the relationship the arrow draws. It belongs to its line, so it sits **on**
the line, centred, with the line broken open around it. It wraps onto several lines rather than
running as one long strip, and how wide it may grow depends on the shape of the arrow it labels.

This replaces the earlier rule that a label must never sit on its line. That rule avoided overlap by
pushing the label sideways by its own half-width, which on a near-vertical arrow parked a long label
far from the line it named, and between two crossing lines left no way to tell whose label it was.
Breaking the line around the label avoids the overlap and keeps the ownership.

## Terms

- **Label**: the arrow's `label` text, shown as a caption. Caption formatting is unchanged (see
  [Canvas and palette](canvas-and-palette.md) "Arrow labels").
- **Route**: the drawn path of the arrow, measured by length along the line.
- **Open run**: the part of the route a label may occupy: the route minus the arrowheads and a clear
  stub at each end, so the line still visibly leaves one element and reaches the other.
- **Label anchor**: the point on the route the label is centred on.
- **Local direction**: the direction of the route around the label anchor, averaged over the
  label's own extent, so a curve is judged where the label sits rather than by its chord.
- **Knockout**: the gap cut in the line behind a label. The canvas, its grid pattern, and whatever
  lies beneath show through the gap; nothing is painted over it.
- **Auto-placed label**: a label with no stored `labelOffset`. **Placed label**: one the user has
  dragged, which keeps its `labelOffset`.

## Placement

- An auto-placed label is centred on the route, at the middle of its open run.
- If that spot collides with an unrelated box or with another arrow's label, the label anchor
  slides along the route, staying within the middle third of the open run, to the nearest spot that
  is clear. When no spot is clear, the middle wins.
- Text is always horizontal. A label never rotates with its line.
- On an **angled** arrow the label sits on one segment rather than straddling a corner. Which
  segment is chosen is decided on the label bench (see "Open decisions").
- A label that cannot fit on its route even at its narrowest wrap (the arrow is too short) sits
  **beside** the line instead: offset perpendicular to the local direction, just clear of the
  line, on whichever side is free of boxes (left of travel first). A label beside its line has no
  knockout.
- A placed label keeps its stored `labelOffset` exactly as before. When its offset puts it on the
  line it gets a knockout; when it sits clear of the line it does not.

## Width and wrapping

The label wraps at word boundaries to a maximum width, and its lines are balanced so that a
two-line label does not end in a single orphaned word. Lines are centred.

The maximum width follows the local direction:

- **Along a mostly horizontal run** the text lies along the line, so every pixel of width uses up
  line. The width is limited by the open run: the label may take the open run minus a visible stub
  of line either side of it, so the arrow still reads as one line.
- **Across a mostly vertical run** the text crosses the line and uses up only its own height. The
  width is limited by a fixed readable cap rather than by the arrow's length.
- **Diagonal runs** blend the two: the limit is whichever width makes the label's footprint along
  the line fit the open run, never above the cap.

A label is never wider than a cap, which is wider along a horizontal run than across a vertical one, so a very long arrow still gets a readable label rather than one long strip. The caps and the stub are named constants in the blueprint; their values are decided on the bench.
Explicit line breaks the author types are kept, and each explicit line still wraps to the width.

## Knockout

- The gap is the label's box plus a small padding, with rounded corners.
- The knockout cuts only the line and its selection halo. Arrowheads are outside the open run, so a
  knockout never reaches one.
- A label's plate (`labelFill`), when the author sets one, still paints inside the gap. Without one
  the gap stays transparent.
- Whether a label also cuts **other** arrows that cross beneath it is decided on the bench.

## Editing

- Double-clicking the line or the label opens the editor at the label's position, sized and wrapped
  exactly as the label will render, so committing never makes the text jump.
- **Enter** commits, **Shift+Enter** inserts a line break, **Escape** cancels, blur commits.
- The editor grows as the text wraps and re-lays out live while typing.
- An empty commit removes the label, as before.

## Existing diagrams

Placement is derived at render time, not stored, so every auto-placed label in every existing
diagram moves onto its line the next time it renders. No migration runs. Placed labels keep their
position.

## Export

The export (SVG, PNG, PDF, thumbnails, the MCP render) lays out and knocks out labels with the same
code as the canvas, so an exported label wraps at the same words and sits at the same spot.

## Open decisions

Decided on the label bench (`packages/diagram/bench/arrow-labels`), which shows ten arrow shapes,
including the diagram that prompted this spec, under each candidate:

- Which segment an angled arrow's label sits on.
- The width caps along horizontal and across vertical runs.
- Whether a label knocks out other arrows crossing beneath it.
