# Element indicators

The marks on an element that say it carries something you cannot otherwise see: a **link**, a
**note**, an open assigned **action** ([Assigned actions](../012-collaboration/assigned-actions.md))
or unresolved **comments**. A mind map root also carries two **commands** here, **Edit Outline**
and **Tidy Map** ([Mind node](../009-elements/mind-node.md)).

## Why

They used to be one connected chip of 32px buttons on the element's top-right corner, half in and
half out, with a ring, a shadow and hairline dividers. It read as a toolbar parked on the canvas,
louder than the element's own label, and it mixed what an element **has** (a note) with what you
can **do** to it (Tidy Map), all at equal weight, all the time. Indicators are status: they should
read as part of the element, quiet until you look for them, and commands should appear only when
you are working on that element.

## Two styles

A per-person preference, `elementIndicatorStyle` ([User preferences](../007-editor/user-preferences.md)),
picks one of two styles. Settings › Editor › **Element Indicators** offers **Corner** (the
default) and **Footer**.

### Corner (default)

The indicators are **glyphs printed inside the element**, near its top-right corner, with no chip
of their own: they read like metadata printed on a card.

- Each is a 14px line glyph in the element's own **text colour** at 50% opacity, so they suit any
  fill, theme or style preset. While the element is hovered or selected they rise to 85%, and the
  glyph under the pointer to 100%.
- Order, left to right: link, note, action, comment. The comment glyph carries its count beside it
  in small bold digits. Comment sits last because it is the most frequent and most urgent: the
  far-right spot is the first one the eye finds.
- The glyphs sit on a backing in the element's own fill, so the backing is invisible on the
  element but masks a label that runs under the glyphs rather than printing over it.

### Footer

The indicators form a **row along the inside of the element's bottom edge**, the way a task card
shows its metadata, with words beside the glyphs:

- **Link** (link glyph + "Link"), **Note** (note glyph + "Note"), the action as the assignee's
  initials on a small disc in their colour + "Action", and comments as the comment glyph + the
  count.
- Same colour rules as Corner: the element's text colour at 50%, 85% on hover or selection.
- When the labelled row does not fit, the words drop and the row shows glyphs, the disc and the
  count only (**compact**).
- On box-like elements (a rectangle, rounded rectangle, pill, mind node, card or panel) the row
  starts at the bottom-left; on every other shape (circle, diamond, hexagon, triangle, cloud, and
  so on) it is centred, so it sits in the shape's lower curve or point rather than in an empty
  corner.

## Placement on any shape

Both styles sit **inside the element's outline**, never across it, on every shape:

- The outline is the one the canvas already hit-tests against
  ([Draw mode](../023-draw-mode/draw-mode.md) "Selecting"): a circle's ellipse, a diamond's,
  hexagon's or triangle's polygon, a cloud's curve, a pill's rounded ends, and for an element
  that paints its own face (a mind node, a card, a panel) its box with its own corner radius.
- The cluster keeps **at least 6px clear of the outline** on every side.
- Corner starts tight in the top-right corner and slides **inward along the diagonal** until it
  fits, so on a rounded rectangle it sits about 9px in, and on a circle inside the curve of its
  top-right, still reading as "top-right". A diamond's corner only has room on a large diamond.
- Footer starts on the bottom edge and slides **up** until it fits.
- Neither may reach the element's **middle band**, where the label is: Corner stays above, and
  Footer below, a line 14px short of the element's vertical centre. A cluster that would have to
  cross it does not fit.
- A **scale-to-fit label** (the default text size, which grows to fill its element) pulls in from
  its top and bottom by the band the cluster takes, so it shrinks to clear the indicators and
  stays centred. A fixed-size label never moves; the middle band keeps it clear.

### When it does not fit

On an element too small, too thin or too spiky for the cluster (a small pill, a progress bar, a
star, an actor, most diamonds), the indicators fall back to a **pip**: a small chip centred on the
element's outline where a 45° line in from its box's top-right corner first meets the shape (a
hexagon's or triangle's edge, never the empty corner beside it), half in and half out, drawn in the element's own fill
with a hairline ring (no shadow), holding the same glyphs at 11px with no dividers. Footer tries
its compact row before falling back.

## Commands

A mind map root's **Edit Outline** and **Tidy Map** are commands, not status, so they are hidden
at rest and appear only while that root is **hovered or selected**. In Corner they lead the cluster
(left of the indicators); in Footer they end the row; in the pip they lead it. Their space is
reserved at rest, so nothing moves when they appear. Both stay in the root's Mind Map menu section
too, which is the way in on a touch device without selecting first.

## Unchanged

- Each glyph is a button: a click follows the link, opens the note, the action or the comments.
  The link keeps its hover card naming the destination, the action its "Assigned to …" card.
- Indicators scale with the canvas zoom and hide below 40% zoom (`ADORNMENT_MIN_ZOOM`), with the
  lock badge and the remote selectors.
- An annotation's marker is its note, and a margin note shows its count on its own face, so
  neither shows a note indicator.
- They are editor chrome: exports, thumbnails, the share view and embeds never draw them.

## Accessibility

- Every glyph is a real `button` with an `aria-label` ("Follow link", "Open note", "Open action",
  "Open 2 comments", "Edit Outline", "Tidy Map") and a visible focus ring.
- A hidden command is `visibility: hidden`, so it is out of the tab order and the accessibility
  tree until the root is selected; selecting a root by keyboard reveals it.
- The 50% resting glyph is a status cue, not text; the action's assignee and the comment count are
  also in the button's label.

## Telemetry

Picking a style in Settings sends `UI` · `Changed` · `ElementIndicatorsCorner` or
`ElementIndicatorsFooter` ([Telemetry](../017-telemetry/telemetry.md)).
