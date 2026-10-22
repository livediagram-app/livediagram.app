# Canvas accessibility baseline

A first, honest accessibility layer for the canvas: keyboard traversal of
elements, selection announced to screen readers, and element views that carry
names. This is a **baseline**, not full SR canvas editing — the goal is that
a keyboard-only or screen-reader user can reach the canvas, walk its
elements, hear what they are, and use the existing keyboard verbs (nudge,
delete, undo, label edit via Space) that already work on a selection.

## Keyboard traversal

- The canvas `<main>` joins the tab order (`tabIndex=0`) with an
  `aria-label` ("Canvas") and a keyboard focus ring
  (`focus-visible` only, so pointer users see nothing new). It keeps its
  main-landmark role rather than `role="application"`: the floating
  panels (Palette or Toolbar strip, Explorer, Map) render inside it, and an
  application role would strip them of normal screen-reader navigation.
- **While focus is on / inside the canvas, Tab selects the next element and
  Shift+Tab the previous**, in render (z) order. The selection scrolls into
  view via the existing viewport `scrollIntoView` pan/zoom helper.
- **No wrap, no trap:** Tab past the last element (or Shift+Tab before the
  first) falls through to the browser default, so keyboard focus can always
  leave the canvas. Escape keeps its existing behaviour (clear selection /
  exit transient modes). An element that grows on Tab (a mind node, a flowchart step) gives way only when a
  pointer or an edit selected it: one the walk itself just reached keeps Tab as traversal, or every press would
  grow a new node and focus could never leave.
- **F6 moves between regions.** Tab is busy inside the canvas, walking its elements, so on a real document the
  chrome after it in the tab order (the palette strip, the bottom controls, the tab bar) sat behind dozens of
  presses. F6 moves focus to the next region and Shift+F6 to the previous, wrapping round, in screen order:
  **Header** (the document's title row), **Palette** (the strip or the Draw dock), **Canvas**, **Controls** (the
  bottom-right cluster: Undo, Tidy Up, Layers, Style, zoom) and **Tabs** (the tab bar). A region lands on its first
  control (the Canvas on the canvas itself); a region not on screen (a viewer has no Palette, Zen hides the chrome)
  is skipped. It works from anywhere on the page but a modal dialog (whose focus trap keeps it) and with focus in a
  text field, where F6 still moves on: typing never uses it. Each region is marked `data-region` with its name, and
  the tab order inside a region is unchanged. (`hooks/ui/useRegionCycle.ts`.)
- Traversal is **selection**: the existing selection ring is the focus
  indicator (one concept, not two). Works in read-only views (it's
  navigation); the guarded verbs (nudge / delete / …) stay edit-only as
  today. Locked-by-others elements are skipped, mirroring pointer selection.
- Standard guards apply: nothing fires while typing in an input, while a
  modal is open, or with shortcuts disabled.

## Names on elements

- **A name needs a role.** `aria-label` goes only on an element with a role (or a native one): a labelled indicator is
  `role="img"`, a loading skeleton `role="status"`, a labelled wrapper `role="group"`, and a pill whose words
  matter speaks them as `sr-only` text over an `aria-hidden` face. On a plain span or div ARIA prohibits it and
  screen readers drop it. `apps/live/aria-label-roles.test.ts` scans the editor and `@livepages/ui` for it.
- Boxed element wrappers get `role="img"` + `aria-label` derived from the
  shared naming helpers in `lib/element-names.ts` (`kindLabel` /
  `describeOne`): `Square "Login"`, `Sticky note`, `Arrow
"yes"`. Arrows carry the same on their SVG group.
- An element whose face holds controls of its own is a named `role="group"` instead (`elementRole`): the session
  buttons (timer, vote, poll), checklists, temperature checks, agendas, quizzes, reaction pads, pickers,
  reveals, decision records and mode buttons, an embed, a link card, and an image still waiting for its picture. An
  img's children are presentational, so as pictures their Start, tick and Ask buttons could
  not be reached with a screen reader.
- A session button is named by the tool it starts (`Timer`, `Stopwatch`, `Dot vote`, `Poll`), never the generic
  "Session button".

## Live announcements

- A new **visually-hidden polite live region** on the canvas (the toast
  stack is unsuitable: it's visual, auto-dismissing, and gated behind the
  "Show notifications" preference).
- Announced: selection changes (single: `Selected Square "Login"`, an arrow with what it joins, `Selected an
Arrow from 'Travel' to 'Hotel'`, so walking a map's connectors says where each runs (`describeSelected`); multi:
  a short summary such as `Selected 3 elements`; cleared: `Selection cleared`), keyboard
  delete (`Deleted …`), and undo / redo. A clear that comes with a verb that said what happened (a delete) is
  not also spoken as `Selection cleared`, which would land over the verb's word.
- Implementation: `hooks/canvas/useCanvasA11y.ts` (traversal + announcement
  state, composed in `useEditorState`) + a small
  `components/canvas/CanvasLiveRegion.tsx`.

## Telemetry

Keyboard traversal is a new shortcut surface:
`track('Element', 'Selected', 'Keyboard')` on Tab-traversal selection
(see [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Announcements themselves emit nothing.
