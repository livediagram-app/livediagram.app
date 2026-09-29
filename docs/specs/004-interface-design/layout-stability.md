# Layout stability

Nothing on screen moves because something else changed state. A status that
flips from "Synced" to "Syncing", a button that turns into "Connecting…", a
badge that appears on an avatar, a count that ticks from 9 to 10: none of them
may push, pull or resize anything around them, including themselves. The
page holds still; only the changed thing's content changes.

This is the product's zero layout shift rule (Cumulative Layout Shift of 0),
stated once for all chrome. [Menu flyouts must not resize under the pointer](flyout-height-stability.md)
is the same rule applied to flyouts, where a shift also makes a menu close
under a stationary pointer.

## The rule

**A piece of UI whose content can change occupies, from its first render, the
space its largest possible content needs.** Changing its content never changes
its box.

This applies to every surface the user does not directly resize: labels,
buttons, badges, counts, status lines, loading states, notices and the rows
that hold them. It does not apply to the canvas, where elements are content
the user moves on purpose.

## What this means in practice

- **Status labels reserve their longest variant.** A label with a closed set
  of states (Not connected / Connecting… / Synced / Syncing / Needs attention)
  renders every variant in the same grid cell, stacked, with only the active
  one visible (`visibility: hidden` on the others, not `display: none`). The
  cell is as wide as the widest variant in the current language and font, so
  translations and font changes stay correct without magic widths. Hidden
  variants are hidden from assistive technology too (`aria-hidden`); only the
  active one is announced.
- **Buttons whose label changes** ("Connect" to "Connecting…", "Save" to
  "Saved") reserve their longest label the same way. A spinner sits in space
  the button already has; it never widens the button.
- **Counts and times use tabular numerals** (`font-variant-numeric:
tabular-nums`) and reserve the widest count they can show, so "9" to "10"
  or "1 min ago" to "12 min ago" changes digits, not width. An unbounded count
  caps its display ("99+"), per [Counts](counts.md).
- **Badges and indicators overlay; they never occupy flow.** A badge that
  appears on an avatar, icon or tab is absolutely positioned in space its host
  already has. Its host has the same size with and without it.
- **Optional rows and notices have a stable home.** A notice that appears
  inside a card either sits in space the card always reserves, or appears in a
  layer (a toast, a popover) that moves nothing. An inline notice that pushes
  content down is a layout shift. Where a block genuinely must grow, it grows
  from a user action on that block (expanding a section), never on its own.
- **Loading states match the loaded size.** A skeleton or placeholder has the
  size of what replaces it.
- **Optimistic states take the destination's shape at once.** When an action
  starts (Connect, Sync now, Delete), the UI switches immediately to the
  in-progress state, which is laid out like the states it leads to, so there
  is no gap where nothing appears to happen and nothing to settle later.
- **Motion does not count as a shift only when it follows the user's own
  input** and animates `transform` or `opacity` ([Motion](motion.md)).

## Verifying it

- Every component with more than one content state has a test that renders
  each state and asserts the same bounding box (width and height) for the
  component and its neighbours. In end-to-end tests this is Playwright's
  `boundingBox()` compared across states; in unit tests, the reserved
  variants are asserted present in the DOM.
- Visual reviews include the transition, not only each state on its own: a
  screenshot per state at the same viewport, compared for position.

## Non-goals

- The canvas and its elements.
- Content the user resizes or expands on purpose (a panel they drag, a section
  they open).
- The first layout of a page before it has any content, which is governed by
  the Core Web Vitals work on each app, not by this rule.

## References

[Menu flyouts must not resize under the pointer](flyout-height-stability.md),
[Motion](motion.md), [Counts](counts.md),
[Tooltips, hover cards and popovers](tooltips-hover-cards-popovers.md).
