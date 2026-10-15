# Presentation mode blueprint

Derived from [Presentation mode](../presentation-mode.md): "Motion" (slide moves and the entrance as View
Transitions) and "Full screen" (refusals logged). The rest of presentation mode predates blueprints.

## Domain and naming

| Term             | Identifier                                           | Meaning                                                            |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Slide surface    | `SLIDE_SURFACE_SELECTOR` (`[data-canvas-a11y-root]`) | The canvas `<main>`, the one element a slide transition captures   |
| Surface boundary | `<ViewTransition>` around `<main>` in `Canvas.tsx`   | `default="none"`, `update` keyed by `SLIDE_VIEW_TRANSITION_UPDATE` |
| Slide type       | `SlideTransitionType`                                | `slide-in`, `slide-forward`, `slide-back`, `slide-fade`            |
| Move type        | `slideTransitionType(transition, from, to)`          | The type a move runs as, or `null` for None or no move             |
| Asked-for slide  | `asked` (ref in `PresentationHost`)                  | The slide last asked for, while React holds the transition         |
| Pending          | `data-slide-move="pending"` on `<html>`              | The first slide held hidden until the screen settles               |
| Settle           | `whenScreenSettles(ready)`                           | Waits for fullscreen (or its refusal, or 600 ms) and two frames    |

## Behaviour and state

### A move

1. `PresentationOverlay` calls `onGo(next)` (keys, clicks, the HUD's buttons, auto-advance, the jump list).
2. `PresentationHost` resolves the target: for a step (`|next - at| === 1`) it is
   `clamp(asked ?? at, + step, 0 … runnable.length)`; a jump keeps `next`. It writes `asked`.
3. `type = slideTransitionType(config.transition, asked ?? at, target)`. With no type it calls
   `setPresentingAt(target)` and stops.
4. Otherwise `startTypedTransition(type, () => setPresentingAt(target))` (`apps/live/lib/view-transition.ts`), which
   runs it plainly under `prefersReducedMotion()` and in a typed `startTransition` otherwise.
5. The layout effect on `[at, shown]` clears `asked` once `at` equals it, records the direction for the HUD and sets
   `data-presenting`, `data-hide-pointer` and `--lvd-slide-ms`; `data-slide-transition` is no longer set, and nothing
   is snapshotted, restarted or sent off.

### The entrance

1. Presenting starts with `data-slide-move="pending"` (the surface held at `opacity: 0`).
2. `whenScreenSettles` waits as before. When it is ready, the host removes `pending` inside
   `startTypedTransition('slide-in', () => setRevealed(true))`, where `revealed` is state that drives
   `data-slide-move` (`pending` until revealed). Under reduced motion it removes `pending` plainly.
3. The surface boundary's `update` for `slide-in` runs `lvd-slide-in` on the new picture; the old (empty) picture
   is not drawn.

### Full screen

`PresentationOverlay`'s effect keeps `document.documentElement.requestFullscreen()` (the whole document, which no
component renders, so the document listeners in `whenScreenSettles` stay). Its `.catch` logs instead of swallowing:
`console.warn('[presentation] fullscreen-refused', reason)` on entry and `[presentation] fullscreen-exit-failed` on
exit.

### Removed

`snapshotOutgoing`, `sendOff`, `restartMove`, `GHOST_Z`, `GHOST_FAILSAFE_MS`, the `outgoing` ref, the surface's
`animationend` / `animationcancel` listeners and their 1200 ms failsafe, and the `[data-slide-ghost]` /
`[data-slide-move='in' | 'forward' | 'back']` CSS.

## Interfaces and contracts

```ts
// apps/live/components/canvas/slide-transition.ts
export const SLIDE_TRANSITION_TYPES: readonly [
  'slide-in',
  'slide-forward',
  'slide-back',
  'slide-fade',
];
export type SlideTransitionType = (typeof SLIDE_TRANSITION_TYPES)[number];
export const SLIDE_VIEW_TRANSITION_UPDATE: Record<SlideTransitionType | 'default', string>; // default: 'none'
export function slideTransitionType(
  transition: SlideTransition,
  from: number,
  to: number,
): Exclude<SlideTransitionType, 'slide-in'> | null;
export function whenScreenSettles(ready: () => void): () => void; // unchanged
```

## Errors and edge cases

| Case                                               | Handling                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| A press while a move animates                      | Counted from `asked`; React commits the latest target after the move    |
| A jump (the list, Home, End) while a move animates | Taken as given; `asked` becomes it                                      |
| A step past the last slide                         | Clamped to `runnable.length` (the end state)                            |
| The deck edited under the presenter                | `at` follows the slide by id (unchanged); `asked` clears when they meet |
| No View Transitions in the browser                 | React applies the change; the slide cuts                                |
| The tab hidden mid-move                            | The browser skips the animation; the state is already committed         |
| Fullscreen refused or failing to exit              | Logged; the deck runs in the window                                     |
| Leaving mid-move                                   | Unchanged: the exit restores the view in the same commit                |

## Performance and limits

Measured by `apps/live/e2e/perf/slide-transition.perf.ts` at a 4x CPU slowdown on 100-element slides: a key paints
in under 16 ms and the longest task stays under the earlier DOM copy's (about 112 ms). The probe is the regression
check; a build that loses either is a defect.

## Presentation and UX

Unchanged travel, curve and durations (`lvd-slide-*`, `--lvd-slide-ms`). The page root takes no part, so the HUD
does not cross-fade.

## Accessibility

Reduced motion (either source) cuts. The slide announcer, focus and the HUD's controls are untouched.

## Observability

| Fingerprint                             | When                        |
| --------------------------------------- | --------------------------- |
| `[presentation] fullscreen-refused`     | `requestFullscreen` rejects |
| `[presentation] fullscreen-exit-failed` | `exitFullscreen` rejects    |

## Testing

| Rule                                   | Test                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Types per transition and direction     | `slide-transition.test.ts`: `slideTransitionType`                                        |
| A move runs in a typed transition      | `PresentationHost.test.tsx`: `addTransitionType` called with the move's type             |
| Reduced motion and None start none     | `PresentationHost.test.tsx`                                                              |
| Quick steps all land                   | `PresentationHost.test.tsx`: three steps before a commit land three slides on            |
| The entrance waits, then reveals typed | `PresentationHost.test.tsx` with `whenScreenSettles` driven                              |
| Refusals are logged                    | `PresentationOverlay.test.tsx`                                                           |
| It moves, lands and stays fast         | `e2e/presentation-mode.spec.ts`; `e2e/perf/slide-transition.perf.ts` (Chromium, Firefox) |

## Constants and configuration

| Constant             | Value                                   | Provenance                  | Safe range |
| -------------------- | --------------------------------------- | --------------------------- | ---------- |
| `SETTLE_FAILSAFE_MS` | 600                                     | Spec "Entering" (unchanged) | 300–1000   |
| `--lvd-slide-ms`     | 220 / 380 / 620 (Quick / Normal / Slow) | `SLIDE_SPEEDS` (unchanged)  | Spec       |

## Defaults ledger

PM1 and PM2 in [DEFAULTS.md](DEFAULTS.md).
