# Motion

Status: shipped

## What

The interface moves quickly. Chrome motion confirms what just happened; it does not narrate it, and the
person using it never waits for it. Motion on the canvas, and in marketing illustrations, is content,
and follows its own specs.

This applies to everyone. It isn't a preference. [Reduce motion](../007-editor/user-preferences.md) is
the one switch, and it goes further: it collapses all motion to instant.

## The budget

- **Ceiling.** Every chrome transition or animation settles within **250ms**, delay included.
- **Hovers and small fades** settle within **150ms**. This covers hover, focus and press feedback,
  colour changes, tooltips, and opacity fades on small surfaces.
- **Cascades** settle as a whole within 250ms, and the last item lands by then too. A cascade is a
  list, grid, menu or feed whose items enter one beat apart. Each item runs at most 150ms, and the
  delay stops growing at 100ms.

Chrome is everything that isn't the diagram. That includes panels, menus, popovers, flyouts,
dropdowns, tooltips, dialogs, sheets, drawers, toasts, banners, tab bars, the tour, the Explorer,
the help centre, the telemetry dashboard and the marketing site's own navigation and cards.

## Motion tokens

Three named durations, shared by every app through the Tailwind theme (`@livediagram/tailwind-config`).
A chrome duration is one of these three and never a bare number.

| Token   | Duration | For                                                                                                                        |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `micro` | 150ms    | Hover, focus, press and colour feedback. Tooltips, small fades, chevrons, menu and dropdown opens. Each item of a cascade. |
| `short` | 200ms    | Panels opening and resizing, accordions, rails, sliding indicators, progress bars, step swaps, drawers.                    |
| `long`  | 250ms    | Dialogs and modals, sheets, tour moves, page transitions. This is also the ceiling.                                        |

Tailwind's bare `transition` utility runs at `micro`.

## Kinds of motion

Every duration in the codebase belongs to exactly one kind. The budget applies to the first two.

| Kind                     | What it is                                                                                             | Budget                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------- |
| **Chrome transition**    | A chrome surface changing state: entering, leaving, opening, resizing, hovering                        | 250ms, or 150ms for hovers  |
| **Cascade**              | Chrome items entering one beat apart                                                                   | 250ms for the whole cascade |
| **Canvas animation**     | Motion of or on the diagram. Element entry and animations, arrow flow, slide transitions, Q&A board    | Its own spec                |
| **Content illustration** | Marketing illustrations and template-preview stories: a picture that moves, not a control              | Its own spec                |
| **Ambient indicator**    | Looping status. Spinners, skeleton pulses, live dots, empty-state float, attention pulses that repeat  | Exempt; not a transition    |
| **Timer**                | Time before something happens: debounce, hover grace, close delay, long press, auto-save, auto-dismiss | Untouched; not motion       |

A timer that only waits for an exit animation to finish before unmounting is an **exit hold**. It
belongs to the animation it waits for, not to the timers, so it runs for that animation's token.
Timers of every other kind keep their own durations.

A progress ring that fills over a timer's window measures that timer. It is an ambient indicator
(the touch long-press hold ring, for example).

## Where durations live

- **Chrome** durations are tokens, in chrome stylesheets and in component classes.
- **Canvas** and **content** durations live only in their own stylesheets. In the editor that's
  `canvas-motion.css` and `qa-board.css`. In marketing it's `hero-animations.css`,
  `feature-art-animations.css` and `ShowcaseStagger.module.css`. In the template previews it's
  `preview-motion.css`. Any other stylesheet is chrome, including telemetry's `dataviz-motion.css`
  and marketing's `page-motion.css`.
- No component class or inline style carries a duration above the ceiling.

## Reduced motion

Reduced motion is unchanged, and it outranks the budget. The OS `prefers-reduced-motion` setting and
the per-user `reduceMotion` preference both collapse every animation and transition to about
instant, canvas included, and zero every cascade delay. The budget describes full motion; reduced
motion is stricter still.

- **Animations** collapse to 0.01ms rather than 0, so `animationend` still fires for code that
  waits on it (the presentation host).
- **Transitions** collapse to 0s, so none is created. Every element's `transition-property`
  defaults to `all`, so any non-zero duration on every element turns every style write into a
  transition. A position written and measured in the same frame then reads back its old value. The
  tab menu's viewport clamp looped on exactly that ("Maximum update depth exceeded"). Nothing waits
  on `transitionend`.

## Layout stability

Shortening motion changes when things settle, never where. Chrome motion animates `opacity` and
`transform`. The exceptions are height, width and grid-row reveals, and those are driven by the
person's own input. Layout shift stays at zero.

## Under comparison

The operator is comparing three kinds of motion at their current length against 250ms:

- **Telemetry data-viz reveals** are capped as chrome. The word cloud and a charted metric's rise
  are `micro` cascades, and the chart's line wipe and the funnel bars settle at `short`. They
  were 420ms, 420ms on a 60ms beat, 800ms after a 300ms delay, and 500ms.
- **The marketing page transition and hero entrance** are capped as chrome. The cross-document
  view transition takes `long`, and the hero's pieces enter as a `micro` cascade. They were
  260ms and 620ms with delays up to 260ms. The scroll-driven section reveal follows the scroll,
  not a clock, so it isn't timed motion.
- **Template-preview hover stories** stay content at their own pace, 420–1600ms per beat. They
  play in the marketing gallery, and the comparison compresses them in the browser only.

## Enforcement

- A **static guard** runs in every app's and shared package's test suite. It reads each chrome
  stylesheet and every component source, and computes an upper bound for every duration and delay.
  It fails when a chrome duration passes 250ms, or when a hover transition passes 150ms. It also
  fails when a bound can't be computed, so an unresolvable duration is never let through.
- A **runtime guard** in the end-to-end suite opens chrome surfaces in the editor. It reads every
  running animation outside the canvas and fails if any settles past 250ms.

## Related

- [User preferences](../007-editor/user-preferences.md): the `reduceMotion` preference
- [Canvas and palette](../008-canvas/canvas-and-palette.md): canvas motion
- [Menu flyouts must not resize under the pointer](flyout-height-stability.md)
