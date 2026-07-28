# 98 — Menu flyouts must not resize under the pointer

Status: shipped

## What

Context-menu side flyouts flickered — opening, closing, and reopening in a
tight loop while the pointer sat still (issue #27).

The mechanism is a feedback loop, and it needs two ingredients that the menu
system supplies together:

1. Flyouts are **dismissed on pointer-leave**.
2. A flyout's **content changes height in response to hovering it**.

Hover a control, the panel grows (or, when bottom-aligned, its top edge shifts
upward to stay on screen). Either way an edge sweeps past the stationary
pointer. Pointer-leave fires, the flyout closes, the hover-preview reverts, the
panel returns to its old size — back under the pointer — and it reopens. The
cursor never moved; the UI moved out from under it.

## The rule

**A flyout's height must not depend on what is hovered or selected inside it.**

Show every row the panel can ever show, and disable the ones that don't apply
yet. A control that is present-but-inert also reads better than one that
materialises: it tells you the option exists and what enables it.

Applied to the **Markers** category (spec/49), which was the reported case: the
Size row (Scale / S / M / L) used to mount only once a marker was chosen, so
hover-previewing a marker tile grew the panel by a heading plus a four-up grid.
It now always renders, at 40% opacity with `pointer-events-none` until a marker
is set.

## The second half: a settle window

Height stability removes the cause; `MenuFlyoutSection` also stops the loop
being able to run. Its position is measured after open, and a re-measure that
lands within `SETTLE_FRAMES` frames of the last one is treated as the layout
settling rather than as pointer intent — so a single legitimate reflow can't
be mistaken for a leave.

Both halves earn their place: the settle window is a guard against reflows we
don't control (fonts, scrollbars, a late-loading glyph), and the height rule is
what keeps our own content from causing them.

## Out of scope

- **Click-to-dismiss flyouts.** Pointer-leave dismissal is what makes the
  category flyouts feel like one continuous surface; the fix is to stop
  resizing, not to change the dismissal model.
- **Animating the height change.** A transition makes the sweep slower, not
  absent, and the pointer still ends up outside.
