# Element animations

An element can carry a looping or play-once **animation** to show flow, signal status, reveal content or draw the
room's eye during a presentation. Each kind of element animates in ways that suit what it is: words type and ripple,
shapes pulse and bounce, sticky notes flutter, drawings draw themselves on, photos pan and develop, tables cascade
row by row. The element context menu offers only the animations that fit what is selected.

This spec owns the animation **sets** and how the menu offers them. The shared mechanics it builds on (pure CSS,
reduced motion, export freeze, Speed and Repeat, hover-to-preview) are described here too; arrow flow, icon glyph
motion and the progress, rating and chart animations keep their own catalogues, listed in
[Sets that already exist](#sets-that-already-exist).

## Animation sets

An **animation set** is the catalogue of animations offered for one family of elements. Every animatable element
belongs to exactly one **body set**, which animates the element itself. An element that carries words also takes the
**Text set**, which animates its words. The two compose: a box can pulse while its label types itself in.

| Set     | Menu section | Members                                                                             | Field           |
| ------- | ------------ | ----------------------------------------------------------------------------------- | --------------- |
| Shape   | Shape        | shapes (every shape kind without a set of its own below), annotations, link cards   | `animation`     |
| Sticky  | Sticky       | sticky notes                                                                        | `animation`     |
| Drawing | Drawing      | freehand strokes, paths                                                             | `animation`     |
| Media   | Media        | images, videos                                                                      | `animation`     |
| Table   | Table        | tables                                                                              | `animation`     |
| Text    | Text         | the words of a text element, a shape's label, a sticky note's text, a table's cells | `textAnimation` |

A standalone **text element** has no body set: its words are the whole element, so it shows only Text Animation.

A shape **carries words** when its kind takes a label. Icons, charts, progress, rating, stickers and chairs keep
their own sets (below) and take no Text set.

### Sets that already exist

These keep their catalogues and fields unchanged; they are listed so the menu rules below cover every element.

| Set              | Menu section                                                         | Members                          | Field                        | Owned by                                                                      |
| ---------------- | -------------------------------------------------------------------- | -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Icon             | Icon                                                                 | icon shapes                      | `iconAnimation`              | [Canvas and palette](../008-canvas/canvas-and-palette.md) "Animated icons"    |
| Chart            | Chart                                                                | pie, bar and line charts         | `pieAnim`                    | [Data charts](../009-elements/pie-chart.md)                                   |
| Arrow            | Arrow                                                                | arrows                           | `flow`                       | [Canvas and palette](../008-canvas/canvas-and-palette.md) "Animated elements" |
| Progress, Rating | (inside their own Progress / Rating category, not the Animation row) | progress bars and rings, ratings | `progressAnim`, `ratingAnim` | [Progress](../009-elements/progress.md), [Rating](../009-elements/rating.md)  |

## The menu

- The element context menu has one **Animation** row. Its flyout holds **one section per set present in the
  selection**, named by its set (Shape, Text, Sticky, Drawing, Media, Table, Icon, Chart, Arrow), and no others.
  A single shape with a label shows Shape and Text. When only one set is present (a single text element), there
  is nothing to choose between, so its section shows inline in the menu, titled Animation.
- Sections appear in a fixed order: Shape, Sticky, Drawing, Media, Table, Icon, Chart, Text, Arrow. A body set
  comes before the words it carries; arrows come last, as today.
- A section applies to **every member of its set in the selection** and to nothing else. With a shape and a text
  element selected, the Shape section animates the shape, and the Text section animates the text element and the
  shape's label.
- A section reads its current value, Speed and Repeat from the **first member of its set** in the selection.
- Every section is a closed `MenuAccordionSection`, as every element-menu section is.
- Each option is a tile with a **live miniature** of its kind (a small box, a word, a note, a zig-zag line, a
  photo, a table, an arrow, a star, a progress bar, stars, a pie) running the real animation, frozen on a telling
  frame so the options read apart at a glance, and playing while the tile is hovered. A motion that moves the
  element rests over a faint dashed ghost of where it started. **None** shows the miniature still and clears the
  animation. Every animation menu uses these tiles, Arrow, Icon, Chart, Progress and Rating included.
- Once an animation is picked, the section shows the shared **Speed** row (Slowest, Slow, Normal, Fast; Slow is
  the default) and **Repeat** toggle (on by default).
- **Hover-to-preview** works in every section: hovering a tile with a desktop mouse plays it live on the selected
  members of that set, moving off reverts, and a click commits (the existing `useStylePreview` path: no undo
  snapshot or broadcast until the click).

### Values a set no longer offers

Before the sets split, every boxed element took the shape set. A saved value that the element's set does not offer
(a sticky that bounces, a text element that traces) **keeps playing exactly as before**. Its section shows it as
one extra, selected tile after the set's own, labelled with its old name, so it can be seen and replaced. Picking
anything else removes the extra tile for good.

A text element's old value lives in `animation`. Picking a Text animation for it writes `textAnimation` and clears
`animation`, so a text element never carries both.

## Shared behaviour

- **Pure CSS.** Every animation is keyframes on classes; no animation-frame loop and no script runs to drive one,
  so a board at rest stays at rest ([Canvas performance](../008-canvas/canvas-performance.md)).
- **Deterministic.** Nothing is broadcast: collaborators see the same motion from the stored fields. Anything that
  looks random (a scramble, a flicker) is seeded from the element's id, so everyone sees the same letters.
- **Rest frame.** Every animation has a rest frame: the element fully shown, in place, as it is with no animation.
  Reduced motion, PNG and SVG export, and a still canvas show the rest frame. A reveal's rest frame is fully
  revealed, so nothing is ever exported or shown blank.
- **Loops and reveals.** A **loop** repeats a motion around the rest frame. A **reveal** brings the element or its
  words in. With Repeat on, a reveal cycles: reveal, hold, clear, again. With Repeat off, it plays once and stays
  revealed; a loop plays one cycle and settles on its rest frame.
- **When a play-once runs.** When the element appears with it: the board opening, a tab switch, or the moment it
  is picked.
- **Text plays once by default.** A Text animation's Repeat starts off: words type in (or ripple, or glow)
  once and stay revealed. Every other set loops by default.
- **Speed** multiplies each animation's own tuned duration (`ANIMATION_SPEED_FACTOR`), so every animation keeps its
  character. Each set's Speed and Repeat are its own fields.
- **Editing pauses words.** While a label is being edited, its words show still.
- **Accent.** A body animation's ring, halo, light or band takes the element's border colour as drawn (its
  theme's default stroke when it sets none); a text element, which has no border, takes its own ink.
- **Composes with rotation.** Motion uses the independent `translate`, `rotate` and `scale` properties, so it
  composes with an element's own rotation.
- **The format painter** copies a body animation only between members of the same set, and a Text animation to any
  element that carries words.
- **Clear animation** (the command palette) clears the body and the Text animation together.

## The quality bar

The Shape set keeps today's fifteen motions and raises their quality; every new set is built to the same bar.

- **True silhouette.** An effect around or across an element follows its real outline: the shape's geometry, the
  note's paper, the stroke's line, the letters. No effect ever paints the element's bounding rectangle when the
  element is not a rectangle.
- **Motion with character.** A move has anticipation, overshoot and settle where it suits it, each segment eased
  on its own, not a symmetric two-keyframe ease-in-out. A light that runs an outline or a line keeps one steady
  speed all the way round.
- **A beat of rest.** Attention loops (pulse, heartbeat, shimmer, wiggle, …) hold still between beats so they read
  as deliberate, not frantic. Ambient loops (float, gradient, trace, ken burns) run continuously.
- **Size-aware.** How far a move travels is proportional to the element's size within fixed limits, so a 24px
  status light and a 400px box both read.
- **Cheap to draw.** Motion animates `transform`, `opacity`, `filter` and `clip-path`. A ring or halo is its own
  layer that scales and fades, never an animated `box-shadow`. A property that only repaints (a colour, a
  background, an SVG stroke's dash or width) is used only where nothing cheaper can draw the effect, and only over
  a small area: letters, a highlight behind words, a single line.
- **Seamless.** A loop has no visible jump at its seam, and a play-once ends on its rest frame.

## The catalogues

Each entry is the option's tile label, then what it does. **Reveal** marks a reveal; everything else is a loop.

### Shape

The fifteen of today, unchanged in name and intent, rebuilt to the quality bar:

- **Pulse** – an attention ring expands from the outline and fades.
- **Blink** – a status breathe of opacity; a small coloured circle with Blink is a status light.
- **Glow** – a soft halo hugging the outline breathes.
- **Trace** – a light with a fading tail runs around the outline at a steady speed.
- **Gradient** – a gradient blending the fill and the accent drifts across the fill.
- **Heartbeat** – a lub-dub double pump of scale.
- **Breathe** – a slow, gentle swell.
- **Shimmer** – a quick double glint, then rest.
- **Highlight** – the fill dips, then brightens in a luminous swell.
- **Bounce** – hops up, squashes on landing, settles.
- **Wobble** – tilts side to side, dying away.
- **Shake** – a quick horizontal jitter, then still.
- **Jelly** – squash and stretch.
- **Float** – a slow circular drift.
- **Swing** – a pendulum from the top edge.

### Text

Reveals bring the words in; the rest play on words that are already there.

- **Typewriter** (reveal) – letters appear one at a time behind a blinking caret.
- **Words** (reveal) – each word rises and fades in, in turn.
- **Cascade** (reveal) – letters drop in from above in sequence and settle.
- **Focus** (reveal) – the words sharpen from a blur.
- **Scramble** (reveal) – random characters resolve, left to right, into the real words.
- **Highlighter** (reveal) – a marker stroke sweeps behind the words.
- **Underline** (reveal) – a line draws itself beneath the words.
- **Wave** – letters ripple up and down in sequence.
- **Shine** – a band of light sweeps across the letters.
- **Flicker** – a neon sign: now and then a letter or two stutters.
- **Rainbow** – colour flows through the letters.
- **Glow** – a soft halo hugging the letters breathes.
- **Bounce** – the words hop and settle together.
- **Float** – the words drift in a slow circle.

Words are animated letter by letter or word by word. A label longer than the letter limit animates by word, and one
longer than the word limit animates as one block (limits in the blueprint). Splitting words into letters never
changes what a screen reader reads or what copying picks up. Rich text keeps its formatting: letters split inside
each styled run. Auto-fit labels animate like any other: their animated words are drawn at the size the fit
measured.

Words take an accent of their own: the element's stroke colour when it has one, else brand sky (Underline,
Shine, Glow), and marker yellow for Highlighter. A label's own ink would make a muddy halo or marker.

In a table, each cell's words animate, staggered from the top-left cell to the bottom-right. On a page, the title
and subtitle animate with its body, the subtitle carrying on where the title ends.

### Sticky

- **Flutter** – the bottom edge lifts and ripples as if in a breeze.
- **Sway** – the note swings gently from a pin at its top centre.
- **Peel** – the bottom-right corner curls up, then smooths flat.
- **Lift** – the note lifts off the board (its shadow grows), then settles back.
- **Wiggle** – a quick "look at me" wiggle, then rest.
- **Drop** (reveal) – the note falls onto the board, squashes and settles.
- **Slap** (reveal) – the note is slapped down: it lands from slightly larger with a tightening shadow.
- **Pulse** – an attention ring expands from the note's edge.
- **Glow** – a soft halo around the note breathes.
- **Highlight** – the paper dips, then brightens.

### Drawing

- **Draw** (reveal) – the line draws itself on from its start to its end.
- **Trace** – a bright segment with a fading tail runs along the line.
- **Dash** – marching dashes run along the line.
- **Boil** – the line jitters like hand-drawn animation, a few frames a second.
- **Ink** – the line's thickness swells and eases like a pen pressing.
- **Glow** – a soft halo hugging the line breathes.
- **Shimmer** – an occasional glint runs along the line.

### Media

- **Ken Burns** – a slow pan and zoom inside the frame.
- **Zoom** – a slow push in, then back out.
- **Pan** – a slow drift from side to side inside the frame.
- **Tilt** – a gentle three-dimensional tilt, as if held in the hand.
- **Develop** (reveal) – the picture develops from washed out to full colour, like an instant photo.
- **Focus** (reveal) – the picture sharpens from a blur.
- **Wipe** (reveal) – the picture is wiped in from the left.
- **Iris** (reveal) – the picture opens from a circle at its centre.
- **Sheen** – a band of light sweeps across the surface now and then.

Motion inside the frame never shows past the frame's edges or its crop. A video keeps playing under its animation.

### Table

- **Rows** (reveal) – rows cascade in from the top, one after another.
- **Columns** (reveal) – columns cascade in from the left.
- **Cells** (reveal) – cells pop in along a diagonal from the top-left.
- **Scan** – a highlight bar sweeps down the rows.
- **Sweep** – a highlight bar sweeps across the columns.
- **Header** – the header row glints now and then.
- **Pulse** – an attention ring expands from the table's edge.
- **Glow** – a soft halo around the table breathes.

A table of many rows or columns keeps the whole cascade within a fixed time, so a long table does not take minutes
to appear.

## Data

- `animation?: ElementAnimation` stays the body animation of every boxed element; `ElementAnimation` is the union of
  the five body sets' values, so every value saved before the split stays valid.
- `animationSpeed?: AnimationSpeed` and `animationRepeat?: boolean` stay its Speed and Repeat.
- `textAnimation?: TextAnimation`, `textAnimationSpeed?: AnimationSpeed` and `textAnimationRepeat?: boolean` are
  new, on every element that carries words. Text plays once by default, so its Repeat is stored only when true
  (every other animation loops by default and stores Repeat only when false).
- The fields are cosmetic. Validation is lenient on them as on every cosmetic field: an unknown value renders as no
  animation.
- No migration: old documents render as they did.

## Telemetry

Picking an animation fires `track('Element', 'Changed', <type>)` with the set's type: `Animation` (Shape),
`StickyAnimation`, `DrawingAnimation`, `MediaAnimation`, `TableAnimation`, `TextAnimation`. Speed and Repeat keep
their existing types.

## Non-goals

- Animations triggered by presentation steps, clicks or scrolling. Every animation runs from the stored fields
  alone.
- Choosing a different animation per letter, word, row or cell.
- Sequencing animations across elements (one after another).
