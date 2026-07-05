# 71 — Canvas accessibility baseline

A first, honest accessibility layer for the canvas: keyboard traversal of
elements, selection announced to screen readers, and element views that carry
names. This is a **baseline**, not full SR diagram editing — the goal is that
a keyboard-only or screen-reader user can reach the canvas, walk its
elements, hear what they are, and use the existing keyboard verbs (nudge,
delete, undo, label edit via Space) that already work on a selection.

## Keyboard traversal

- The canvas `<main>` joins the tab order (`tabIndex=0`) with an
  `aria-label` ("Diagram canvas") and a keyboard focus ring
  (`focus-visible` only, so pointer users see nothing new). It keeps its
  main-landmark role rather than `role="application"`: the floating
  panels (Palette, Explorer, Map, mobile dock) render inside it, and an
  application role would strip them of normal screen-reader navigation.
- **While focus is on / inside the canvas, Tab selects the next element and
  Shift+Tab the previous**, in render (z) order. The selection scrolls into
  view via the existing viewport `scrollIntoView` pan/zoom helper.
- **No wrap, no trap:** Tab past the last element (or Shift+Tab before the
  first) falls through to the browser default, so keyboard focus can always
  leave the canvas. Escape keeps its existing behaviour (clear selection /
  exit transient modes).
- Traversal is **selection**: the existing selection ring is the focus
  indicator (one concept, not two). Works in read-only views (it's
  navigation); the guarded verbs (nudge / delete / …) stay edit-only as
  today. Locked-by-others elements are skipped, mirroring pointer selection.
- Standard guards apply: nothing fires while typing in an input, while a
  modal is open, or with shortcuts disabled.

## Names on elements

- Boxed element wrappers get `role="img"` + `aria-label` derived from the
  same naming helpers the change log uses (`kindLabel` / `describeOne`,
  lifted from `lib/change-log.ts` into a shared `lib/element-names.ts` so
  the two surfaces can't drift): `Square "Login"`, `Sticky note`, `Arrow
"yes"`. Arrows carry the same on their SVG group.

## Live announcements

- A new **visually-hidden polite live region** on the canvas (the toast
  stack is unsuitable: it's visual, auto-dismissing, and gated behind the
  "Show notifications" preference).
- Announced: selection changes (single: `Selected Square "Login"`; multi:
  the change-log style summary; cleared: `Selection cleared`), keyboard
  delete (`Deleted …`), and undo / redo.
- Implementation: `hooks/canvas/useCanvasA11y.ts` (traversal + announcement
  state, composed in `useEditorState`) + a small
  `components/canvas/CanvasLiveRegion.tsx`.

## Telemetry

Keyboard traversal is a new shortcut surface:
`track('Element', 'Selected', 'Keyboard')` on Tab-traversal selection
(see [spec/22](22-telemetry.md)). Announcements themselves emit nothing.
