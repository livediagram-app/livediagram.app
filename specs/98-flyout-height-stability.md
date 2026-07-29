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

## It must also stack above its host

A second way the same panel could be on screen and invisible, found on a
phone: the flyout was `z-overlay` (40) while the tab menu it opens from is
`z-modal` (50).

On a wide screen that never showed. The panel fits _beside_ the menu, so the
two never overlap and the stacking order is moot. On a narrow one there is no
room to the side, the viewport clamp puts the panel directly on top of the
menu, and it painted behind it — so tapping **Collaborate** on a phone did
nothing at all, with the panel mounted, positioned, and `visibility: visible`
the whole time.

It is now `z-popover` (55), the token that already existed for exactly this
relationship ("a context / dropdown menu opened from inside a dialog renders
on top of it rather than behind"). The element context menu is itself
`z-overlay`, so there the flyout tied with its host and won on DOM order,
which is why only the tab menu's flyout broke.

Guarded by the suite's one mobile e2e test (spec/72). It deliberately does
**not** assert the panel is in the DOM — it was, before the fix. It asks
`document.elementFromPoint` what is actually painted at the panel's own
centre, because "present" and "visible" were both true of the broken state.

## On a phone it covers the parent, with a way back

Fixing the stacking order made the panel visible; it did not make it usable.
On a phone the flyout lands directly on the menu that opened it, and a panel
sitting on top of its own parent with no title and no exit is a dead end —
you can't see which category you're in, and the only way out is a lucky tap.

So on a mobile viewport (`useIsMobileViewport`, Tailwind's `sm` breakpoint)
the flyout stops pretending to be a side panel and becomes a **drill-down**:

- It takes the host menu's **left, width and height**, covering it completely.
  A shorter child used to leave the parent's remaining rows poking out below,
  which both read as a stray panel and left those rows tappable, so the two
  menus fought over the same gesture.
- It gains a **header** — the category's icon and name, and a **Close** button
  that returns to the parent. On desktop neither is needed: the panel sits
  beside the menu, so the parent is still on screen and still shows which row
  is open.

Desktop keeps the side layout and the fixed `w-56` exactly as before; the
mobile branch only engages when there genuinely isn't room beside the menu.

## Both dismissers listen for `pointerdown`, not `mousedown`

A touch emits a compatibility `mousedown` only when the gesture wasn't
`preventDefault`ed — and the canvas surface does preventDefault on several of
its pointer paths. So on a phone, tapping the canvas never reached the tab
menu's outside-click dismisser and the menu simply stayed open. `pointerdown`
fires for mouse, touch and pen alike, ahead of all that. `PointerEvent`
extends `MouseEvent`, so every target guard is unchanged, and the grace window
that protects the long-press which opened the menu still applies.

## Out of scope

- **Click-to-dismiss flyouts.** Pointer-leave dismissal is what makes the
  category flyouts feel like one continuous surface; the fix is to stop
  resizing, not to change the dismissal model.
- **Animating the height change.** A transition makes the sweep slower, not
  absent, and the pointer still ends up outside.
