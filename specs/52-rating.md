# 52 — Rating

A **Rating** element is a row of five stars showing a 1–5 score. Drag it in from
the palette (Tools tab, by the progress elements), set the score, and optionally
give it a star-specific animation — the same shape of feature as the progress
elements (spec/46).

## Behaviour

- Drops as five stars, **three filled** by default, in an amber accent.
- A **Rating** context-menu category carries:
  - a **star picker** — click a star to set the score (1–5);
  - an **Animation** row of star-specific animations (None / Pop / Twinkle /
    Pulse / Rock), with a **Speed** row + **Repeat** toggle once one is picked.
    Pop / Rock play once (an entrance); Twinkle / Pulse loop by default.
- It's a normal boxed element otherwise (move / resize / rotate / select /
  group / lock / theme-colour). Its accent (stroke colour) tints the filled
  stars; the wrapper draws no box border.

## Model

Rating is a `ShapeKind` `'rating'` (like the progress elements), not a new
top-level type — so it inherits boxed-element behaviour with no new
render/copy/export branches.

- `ShapeElement.rating?` (0..`RATING_MAX` = 5), `ratingAnim?` (`RatingAnim`),
  `ratingAnimSpeed?`, `ratingAnimRepeat?`. The `RatingAnim` union +
  `RATING_ANIMS` + `clampRating()` + `isRatingShape()` live in
  `packages/diagram/src/index.ts`.
- Rendered by `RatingView` (`apps/live/components/RatingView.tsx`): five star
  SVGs sized to the box, filled up to the score; the filled stars carry the
  `lvd-rating-*` animation (CSS in `globals.css`, reduced-motion-safe) with
  speed / iteration from inline custom properties and a per-star stagger for
  pop / twinkle. `element-variant.ts` gives it a borderless wrapper.
- Setters in `useElementStyle.ts` (`setRatingSelected` +
  `setRatingAnim*Selected`) mirror the progress setters, gated to rating shapes.
- Telemetry (spec/22): `track('Element', 'Added', 'Rating')` on create,
  `track('Element', 'Changed', 'Rating' | 'RatingAnim')` on edits.

Follows the composite-component pattern established by the timeline rail
(spec/51): a dedicated `ShapeKind` + small `ShapeElement` fields + a bespoke
`*View` + a borderless variant + a context-menu category.
