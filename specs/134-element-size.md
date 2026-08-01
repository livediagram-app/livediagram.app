# 134 — The Size category

A category in the element context menu holding the three controls that all
answer **"how big is this?"**: the exact width and height, the aspect-ratio
lock, and the reset-to-default-proportion action.

## Why a category

The three were scattered. The **lock** lived at the bottom of Layer, under the
opacity slider, next to send-to-back — filed by "it is a property of the
element" rather than by what it does. The **reset** lived in Shape, which meant
it only appeared for morphable kinds, so an image or a frame could be locked
but never un-warped. And there was no way to state a size at all: every
dimension came from a drag handle.

## Typing an exact size

Two number boxes, width and height, in **canvas pixels at 100% zoom**.

That is the only unit the model has. A floorplan drawn at "10px per cm" is the
author's own scale, and inventing a units system to record it would be a far
bigger feature than a number box — one that would have to touch export, the
grid, the ruler that does not exist yet, and every element that stores a size.
Pixels are honest about what they are, and they are enough to draw to scale.

Behaviour:

- **Anchored top-left**, not centred. Typing a width is a layout act: the edge
  you are aligned to should stay put. (The aspect _reset_ holds the centre
  instead, because that is a proportion act, and holding an edge would make it
  drift.)
- **Drafts, not live commits.** The boxes hold what you type and commit on blur
  or Enter; Escape reverts. Committing per keystroke would resize the element
  three times on the way to "120" and leave two junk entries in the undo
  history.
- **The lock applies.** With it on, typing one dimension carries the other, so
  the lock means the same thing here as it does on a drag handle. Setting both
  at once is not overruled — that IS the intent.
- **Clamped to 8…20000px.** A zero or negative box is not a shape, and a stray
  extra digit should not produce a diagram nobody can pan out of.
- The boxes **follow the element**: a drag-resize, an undo, or the lock
  carrying the other dimension all update what is shown.

## Scope

Boxed elements only (`isBoxed`), which is the same set the aspect lock always
applied to. Arrows have no width and height to type.

`Reset aspect ratio` still only shows for a shape with a canonical proportion
to return to, matching the Shape category's morph grid.
