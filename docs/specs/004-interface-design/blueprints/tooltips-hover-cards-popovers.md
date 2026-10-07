# Tooltips, hover cards and popovers: blueprint

Derived from [Tooltips, hover cards and popovers](../tooltips-hover-cards-popovers.md), with the fade from
[Motion](../motion.md) and the long-press length from the editor's `useLongPress`. The spec decides; this file only
adds engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                 | Role                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/ui/src/hint/hint-constants.ts`             | Every timing and size, named                                                   |
| `packages/ui/src/hint/place-hint.ts`                 | Pure placement: trigger rect + surface size + viewport to a layout             |
| `packages/ui/src/hint/hint-registry.ts`              | Module state: the one open hint, and the tooltip warm-up clock                 |
| `packages/ui/src/hint/trigger-text.ts`               | `hasVisibleText` (touch gate) and `accessibleNameOf` (the name check)          |
| `packages/ui/src/hint/useHint.ts`                    | The state machine: pointer, focus, press, long press, Escape, grace            |
| `packages/ui/src/hint/HintSurface.tsx`               | The portal, the measured layout, the pointer triangle, the two looks           |
| `packages/ui/src/Tooltip.tsx`                        | `Tooltip`: the name, 1 s, on a `display: contents` wrapper                     |
| `packages/ui/src/HoverCard.tsx`                      | `HoverCard`: title + description, instant, on the layout wrapper it always had |
| `packages/ui/src/index.ts`                           | Exports `Tooltip`, `HoverCard` and their prop types                            |
| `packages/eslint-config/index.js`                    | `no-restricted-syntax`: native `title` outside the exceptions                  |
| `apps/live/components/palette/PaletteIconButton.tsx` | Which hint a palette tile carries (`tileHint`)                                 |
| `apps/live/components/palette/palette-controls.tsx`  | `SizeButton` names its swatch with a Tooltip                                   |

## Domain and naming

One term, one identifier. The left column is the only spelling used in code, tests, copy and logs.

| Term          | Identifier                                                 | Meaning                                                            |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Hint          | `HintKind` (`'tooltip' \| 'hover-card'`)                   | Floating, non-interactive content shown for hover or focus         |
| Tooltip       | `Tooltip`, `data-hint="tooltip"`                           | The control's name, after 1 s or at once on keyboard focus         |
| Hover card    | `HoverCard`, `data-hint="hover-card"`                      | Bold title over a description, at once                             |
| Popover       | (unchanged homes)                                          | Click-opened and interactive; never a hint                         |
| Hint surface  | `HintSurface`                                              | The portalled box that paints either hint                          |
| Open source   | `HintOpenSource` (`'pointer' \| 'focus' \| 'touch'`)       | What opened the hint                                               |
| Warm-up       | `isTooltipWarm(now)`                                       | A tooltip may skip its delay                                       |
| Grace         | `HINT_CLOSE_GRACE_MS`                                      | Time the pointer has to cross from trigger to surface              |
| Dismissed     | `dismissed` (ref in `useHint`)                             | Escape or a press closed it; stays closed until leave or blur      |
| Placement     | `HintPlacement` (`'top' \| 'bottom' \| 'right' \| 'left'`) | Side of the trigger the surface sits on                            |
| Chart readout | `ChartReadout`                                             | The label: value box over a chart mark; canvas content, not a hint |

Props: a Tooltip's text is `label` (it is the name, and matches `aria-label`); a hover card's is `title` +
`description`. Renamed with this change, no aliases kept: `Tooltip` (rich) to `HoverCard`; `tooltipTitle` /
`tooltipDescription` to `hoverCardTitle` / `hoverCardDescription`; `withTooltip` to `withHoverCard`; `ChartTooltip` to
`ChartReadout`; `IconButton`'s `hideTooltip` to `hint="tooltip"`; `SizeButton`'s `title` to `label`.

Banned: "tooltip" for anything with a description, "hover tooltip", "info popover" for a hint, `title=` as a hint.

## Behaviour and state

`useHint(kind)` owns one hint. React state is `open: boolean` and `source: HintOpenSource | null`; everything else is a
ref, so pointer traffic re-renders nothing until the hint actually opens or closes.

One `Machine` ref holds the rest: the wrapper element, `open`, `source`, `overTrigger`, `overSurface`, `focused`
(keyboard-visible only), `dismissed`, `suppressClick`, `pressStart`, and the timers `openTimer`, `closeTimer`,
`pressTimer`, `lingerTimer`. A `useState` token (a plain object) identifies the hint to the registry, so `close` may
change identity between renders.

Presses (T7 to T11) are heard in the capture phase (`onPointerDownCapture` and friends): many canvas controls stop their
pointer events from bubbling, and the hint must still see them.

### Transitions

| #   | Event (on the wrapper unless noted)        | Guard                                 | Effect                                                                                     |
| --- | ------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| T1  | `pointerenter`, `pointerType !== 'touch'`  | not `dismissed`                       | `overTrigger`; cancel close; open after `openDelayMs(kind, now)`                           |
| T2  | `pointerleave`, `pointerType !== 'touch'`  |                                       | clear `overTrigger`; cancel open; `settle()`                                               |
| T3  | surface `pointerenter`                     |                                       | `overSurface`; cancel close                                                                |
| T4  | surface `pointerleave`                     |                                       | clear `overSurface`; `settle()`                                                            |
| T5  | `focus` (bubbled)                          | target matches `:focus-visible` (D27) | `focused`; unless `dismissed`, cancel timers and open now, source `focus`                  |
| T6  | `blur` (bubbled)                           |                                       | clear `focused`; `settle()`                                                                |
| T7  | `pointerdown`, not touch                   |                                       | cancel open; close; `dismissed`                                                            |
| T8  | `pointerdown`, touch                       | `!hasVisibleText(anchor)`             | clear `suppressClick`; remember the point; `pressTimer` for `HINT_LONG_PRESS_MS`           |
| T9  | `pressTimer` fires                         |                                       | open, source `touch`; `suppressClick`                                                      |
| T10 | `pointermove`, touch, `pressTimer` pending | moved > `HINT_LONG_PRESS_SLOP_PX`     | cancel `pressTimer`                                                                        |
| T11 | `pointerup` / `pointercancel`, touch       |                                       | cancel `pressTimer`; if open from touch, `lingerTimer` closes after `HINT_TOUCH_LINGER_MS` |
| T12 | `click` (capture)                          | `suppressClick`                       | `preventDefault`, `stopPropagation`, clear `suppressClick`                                 |
| T13 | document `keydown` `Escape` while open     |                                       | close; `dismissed`; the event keeps propagating (spec)                                     |
| T14 | another hint opens (registry)              |                                       | close at once                                                                              |
| T15 | unmount                                    |                                       | clear every timer; release the registry                                                    |

`settle()`: if none of `overTrigger`, `overSurface`, `focused` holds, clear `dismissed` and, when open, close after
`HINT_CLOSE_GRACE_MS`. A blur with the pointer elsewhere therefore closes after the same grace (D26).

`openDelayMs(kind, now)`: `0` for a hover card; for a tooltip, `0` when `isTooltipWarm(now)`, else
`TOOLTIP_OPEN_DELAY_MS`.

Opening calls `claimHint(token, close, kind)`, which closes the previous holder (T14). Closing calls
`releaseHint(token, kind, now)`,
which, for a tooltip, stamps the warm-up clock.

### Invariants

- **I1:** at most one hint is open in a document.
- **I2:** a tooltip never opens from pointer hover sooner than `TOOLTIP_OPEN_DELAY_MS` unless warm.
- **I3:** keyboard-visible focus opens either hint in the same task; mouse focus opens nothing.
- **I4:** Escape never calls `stopPropagation` or `preventDefault`.
- **I5:** a hint never mounts anything into the trigger's layout; its surface is portalled to `document.body`.
- **I6:** a touch tap (no long press) never opens a hint and never has its click suppressed.

## Interfaces and contracts

```ts
export type TooltipProps = { label: string; children: ReactElement };
export function Tooltip(props: TooltipProps): JSX.Element;

export type HoverCardProps = {
  title: ReactNode;
  description?: string;
  block?: boolean; // full-width flex wrapper, for a grid cell or flex child
  className?: string; // merged onto the wrapper, after the display class
  style?: CSSProperties;
  children: ReactNode;
};
export function HoverCard(props: HoverCardProps): JSX.Element;

// The engine both components share; exported inside the package only.
export function useHint(kind: HintKind): {
  open: boolean;
  source: HintOpenSource | null;
  attach: (el: HTMLSpanElement | null) => void; // callback ref for the wrapper
  anchor: () => Element | null;
  triggerProps: HintTriggerProps; // spread on the wrapper
  surfaceProps: HintSurfaceProps; // spread on the surface
};

export function placeHint(input: {
  trigger: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  surface: { width: number; height: number };
  viewport: { width: number; height: number };
  gap: number;
  margin: number;
}): { left: number; top: number; placement: HintPlacement; arrowOffset: number };
```

- The anchor is the wrapper's `firstElementChild`, falling back to the wrapper itself (D31).
- `Tooltip` wraps its child in `<span class="contents">`, so the child keeps its place in grid and flex layouts
  and no caller needs a layout prop. `HoverCard` keeps its `inline-flex` / `block` wrapper and its `className` /
  `style` pass-through, because 130 call sites already lay out through it.
- An empty `label` renders the child alone, with no wrapper handlers.
- `role="tooltip"` on both surfaces, each with a `useId` id. The trigger is not given `aria-describedby`: a tooltip
  repeats the accessible name, so describing by it would announce the name twice (D30).

Placement (moved unchanged from the old `Tooltip`): try top, bottom, right, left in that order and take the first whose
box fits inside the viewport less `margin`; if none fits, top. Top and bottom centre on the trigger and clamp
horizontally; right and left centre vertically and clamp. `arrowOffset` is the trigger centre minus the surface's
clamped start edge, so the triangle keeps pointing at the trigger.

## Data and persistence

None. Hints persist nothing; the registry and warm-up clock are per page and reset on reload.

## Errors and edge cases

| Case                                               | Handling                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rendered on the server (no `document`)             | Surface renders `null`; wrapper renders; nothing to hydrate differently                                                                                                                                                                                                                                                  |
| `:focus-visible` unsupported (`matches` throws)    | Treated as visible, so keyboard users still get the hint                                                                                                                                                                                                                                                                 |
| Trigger disabled                                   | Browser may send no pointer events; the hint simply does not open. Palette tiles skip it (as today); a disabled control whose reason matters says it in visible text instead (the photo-import row)                                                                                                                      |
| Trigger stops its pointer events from bubbling     | Presses are heard in the capture phase, so T7 to T11 still run                                                                                                                                                                                                                                                           |
| A press on the hint surface itself                 | The surface stops `pointerdown`, `mousedown`, `click`, `dblclick` and `contextmenu`, so a portal event never reaches the trigger's React ancestors                                                                                                                                                                       |
| Trigger unmounts while open                        | T15: timers cleared, registry released, portal removed                                                                                                                                                                                                                                                                   |
| Pointer enters, leaves within 1 s                  | T2 cancels the timer; nothing opens                                                                                                                                                                                                                                                                                      |
| Press before the tooltip opened                    | T7 cancels it and sets `dismissed`; it stays shut until the pointer leaves                                                                                                                                                                                                                                               |
| Long press and the browser then sends no `click`   | `suppressClick` is cleared on the next touch `pointerdown` (T8), so it cannot eat a later tap                                                                                                                                                                                                                            |
| Trigger has visible text on touch                  | T8 guard: no long press, no suppressed click                                                                                                                                                                                                                                                                             |
| Scroll or resize while open                        | `HintSurface` re-measures on `scroll` (capture) and `resize`                                                                                                                                                                                                                                                             |
| Trigger moves with no scroll (canvas pan or zoom)  | `HintSurface` follows it: one `requestAnimationFrame` loop while open reads the trigger's box and re-places only on a frame where it changed; it sleeps after `HINT_FOLLOW_IDLE_FRAMES` (30) still frames and wakes on a window wheel, pointermove, pointerup or keydown (capture), the inputs that pan or zoom a canvas |
| Label changes while open                           | Layout effect depends on the content, so it re-measures                                                                                                                                                                                                                                                                  |
| Surface wider than the viewport                    | `clampIntoRange` keeps the lower bound: pinned to the left margin                                                                                                                                                                                                                                                        |
| `label` differs from the trigger's accessible name | `console.warn` fingerprint (see Observability); still renders                                                                                                                                                                                                                                                            |

## Security and trust

Hints render text through React only: no `dangerouslySetInnerHTML`, no HTML from props. A label built from user data
(a document name, a participant name) is escaped like any other text node. There is no network, storage or cross-origin
surface.

## Performance and limits

- Pointer traffic touches refs only; React re-renders a hint twice per open (open, then measured layout).
- A palette shows up to ~60 tiles; each carries one wrapper and no listeners on `document` until it opens. The
  document `keydown`, `scroll` and `resize` listeners exist only while a hint is open, which is at most one (I1).
- The accessible-name check runs once per open, not per render or mount.
- Layout reads two rects per open or scroll event, and one trigger rect per frame while a hint is open (at most one):
  well inside a frame.

## Presentation and UX

| Hint       | Surface classes (light / dark)                                                                                                                 | Gap  | Arrow |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| Tooltip    | `rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white` / `dark:border dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100` | 6px  | 8px   |
| Hover card | `w-56 rounded-lg border bg-white px-3 py-2 shadow-lg` / `dark:border-slate-700 dark:bg-slate-800`                                              | 10px | 10px  |

- Tooltip: `max-w-xs`, text wraps, never truncates (D28).
- Both: `fixed`, `z-[var(--z-toast)]`, `pointer-events-auto` (hoverable), `animate-fade-in motion-reduce:animate-none`;
  `fade-in` runs at the `micro` motion token (150ms).
  Measured off-screen and `visibility: hidden` for the first frame so the fade starts in place.
- The arrow is a rotated square carrying the surface's own colour classes.

## Accessibility

- **1.4.13 dismissible:** T13. **Hoverable:** T3, T4 and the grace. **Persistent:** no timeout; only T2/T4/T6/T7/T13/T14 close.
- **Keyboard:** T5 opens on `:focus-visible` at once; Escape closes.
- **Name:** a Tooltip's `label` equals the control's accessible name; the dev-and-prod check in Observability flags
  drift. Non-interactive text carries the same words as visually hidden text.
- **Contrast:** light, white on slate 900 is 17.9:1. Dark, under Steel: tooltip slate 100 on slate 900 (`#131b26`) is
  15.8:1; hover card title slate 100 on slate 800 (`#16202e`) is 15.0:1 and description slate 300 is 11.0:1. The dark
  border (slate 700, 1.7:1 against the surface) is decorative: the text identifies the hint, so 1.4.11 does not apply.
- **Reduced motion:** `motion-reduce:animate-none`, plus the editor's `.reduce-motion` rule.
- **Touch:** T8 to T12.

## Web Experience

- **CLS:** zero. The Tooltip wrapper is `display: contents`; both surfaces are `position: fixed` in a portal.
- **INP:** hover and focus handlers write refs and start timers; opening is one small portal render.
- **LCP:** nothing renders until a hint opens.

## Observability

- `console.warn('[tooltip] label is not the accessible name', { label, name })` when a Tooltip opens on a trigger
  whose accessible name (`aria-label`, then `aria-labelledby` text, then text content) does not contain `label` (D32).
- The lint rule reports every native `title` outside the exceptions, with a message naming the two components.
- Nothing is logged per open: hovering is not an event worth a line (spec: no telemetry).

## Testing

| Rule (spec)                                 | Test                                                               |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Tooltip opens after 1 s hover               | `Tooltip.test.tsx` (fake timers); e2e `hints.spec.ts` palette tile |
| Tooltip opens at once on keyboard focus     | `Tooltip.test.tsx`; e2e palette tile via Tab                       |
| Mouse focus opens nothing                   | `useHint.test.tsx`                                                 |
| Warm-up                                     | `hint-registry.test.ts`; `Tooltip.test.tsx` second trigger         |
| Hover card opens at once                    | `HoverCard.test.tsx`; e2e zoom control                             |
| Escape dismisses and passes through         | `useHint.test.tsx`; e2e                                            |
| Hoverable, grace                            | `useHint.test.tsx`                                                 |
| Press closes and cancels                    | `useHint.test.tsx`, including a control that stops bubbling        |
| Presses on the hint stay on the hint        | `useHint.test.tsx`                                                 |
| A disabled reason is visible text           | `EventStormingBoardRows.test.tsx`                                  |
| One at a time                               | `hint-registry.test.ts`, `Tooltip.test.tsx`                        |
| Touch long press, slop, linger, click eaten | `useHint.test.tsx`                                                 |
| Touch gate on visible text                  | `trigger-text.test.ts`, `useHint.test.tsx`                         |
| Placement fits and flips, arrow tracks      | `place-hint.test.ts`                                               |
| Name check warns                            | `Tooltip.test.tsx`                                                 |
| Native `title` rejected, exceptions allowed | `packages/eslint-config/native-title.test.ts`                      |
| Palette tile carries the right hint         | `PaletteIconButton.test.tsx`                                       |
| Dark look: Steel surface, border, 4.5:1     | e2e `hints.spec.ts`, Hints in dark mode                            |

## Constants and configuration

| Constant                  | Value | Provenance                                                 | Safe range |
| ------------------------- | ----- | ---------------------------------------------------------- | ---------- |
| `TOOLTIP_OPEN_DELAY_MS`   | 1000  | Spec                                                       | 500–1500   |
| `TOOLTIP_WARMUP_MS`       | 500   | Spec                                                       | 300–1000   |
| `HINT_CLOSE_GRACE_MS`     | 100   | D25: crosses the 6–10px gap at any human speed             | 50–300     |
| `HINT_LONG_PRESS_MS`      | 500   | Spec; `apps/live/hooks/ui/useLongPress.ts` `LONG_PRESS_MS` | 400–800    |
| `HINT_LONG_PRESS_SLOP_PX` | 10    | Spec; `useLongPress` `MOVE_SLOP_PX`                        | 6–16       |
| `HINT_TOUCH_LINGER_MS`    | 1500  | Spec                                                       | 1000–3000  |
| `TOOLTIP_GAP_PX`          | 6     | D29                                                        | 4–10       |
| `HOVER_CARD_GAP_PX`       | 10    | Unchanged from the old `Tooltip` `GAP`                     | 6–14       |
| `POPOVER_VIEWPORT_MARGIN` | 8     | Existing, `packages/ui/src/popover.ts`                     | 4–16       |

## Assets and external resources

None. No new dependency: the engine is hand-rolled on React, like the component it replaces.

## Native `title` exceptions

The lint selector allows `title` on `iframe` and `abbr` only. SVG `<title>` is an element, not an attribute, and is
untouched. The one remaining native `title` in the apps is `VideoView`'s `<iframe title>`.
