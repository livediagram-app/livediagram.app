# Presentation mode blueprint

Derived from [Presentation mode](../presentation-mode.md): "Motion" (slide moves and the entrance as View
Transitions), "Full screen" (refusals logged) and "Builds" (a slide's builds, step by step). The rest of presentation mode predates blueprints.

## Domain and naming

| Term             | Identifier                                                                                              | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Slide surface    | `CANVAS_ROOT_SELECTOR` (`[data-canvas-a11y-root]`, `../packages/workbench/src/lib/canvas-selectors.ts`) | The canvas `<main>`, the one element a slide transition captures   |
| Surface boundary | `<ViewTransition>` around `<main>` in `Canvas.tsx`                                                      | `default="none"`, `update` keyed by `SLIDE_VIEW_TRANSITION_UPDATE` |
| Slide type       | `SlideTransitionType`                                                                                   | `slide-in`, `slide-forward`, `slide-back`, `slide-fade`            |
| Move type        | `slideTransitionType(transition, from, to)`                                                             | The type a move runs as, or `null` for None or no move             |
| Asked-for slide  | `asked` (ref in `PresentationHost`)                                                                     | The slide last asked for, while React holds the transition         |
| Pending          | `data-slide-move="pending"` on `<html>`                                                                 | The first slide held hidden until the screen settles               |
| Settle           | `whenScreenSettles(ready)`                                                                              | Waits for fullscreen (or its refusal, or 600 ms) and two frames    |
| Build            | `ElementBuild` (`build` on a boxed element, `packages/document/src/slide-builds.ts`)                    | `{ order, effect }`: the step an element comes in at, and how      |
| Build effect     | `BuildEffect`, `BUILD_EFFECTS`                                                                          | `appear`, `fade`, `rise`                                           |
| Slide's steps    | `slideBuildOrders(elements)`                                                                            | The distinct orders on a slide, lowest first                       |
| Build position   | `PresentingBuild` (`presentingBuild` in `useSlideDeck`)                                                 | `{ slideId, shown, entering }`: builds showing on the slide        |
| Asked-for build  | `askedBuild` (ref in `PresentationHost`)                                                                | The build position last asked for, beside `asked`                  |
| Presented        | `presentedElements` (`useEditorViewport`)                                                               | The slide's elements less those still to build                     |
| Entrance         | `useBuildEntrance(entrance, mainRef)`                                                                   | Plays the step's effect on the elements it brought in              |

## Behaviour and state

### A move

1. `PresentationOverlay` calls `onGo(next)` (keys, clicks, the HUD's buttons, auto-advance, the jump list).
2. `PresentationHost` resolves the target: for a step (`|next - at| === 1`) it is
   `clamp(asked ?? at, + step, 0 … runnable.length)`; a jump keeps `next`. It writes `asked`.
3. `type = slideTransitionType(config.transition, asked ?? at, target)`. With no type it calls
   `setPresentingAt(target)` and stops.
4. Otherwise `startTypedTransition(type, () => setPresentingAt(target))` (`../packages/workbench/src/lib/view-transition.ts`), which
   runs it plainly under `prefersReducedMotion()` and in a typed `startTransition` otherwise.
5. The layout effect on `[at, shown]` clears `asked` once `at` equals it, records the direction for the HUD and sets
   `data-presenting`, `data-hide-pointer` and `--lvd-slide-ms`; it drives no animation itself.

### The entrance

1. Presenting starts with `data-slide-move="pending"` (the surface held at `opacity: 0`).
2. `whenScreenSettles` waits for fullscreen (or its refusal, or 600 ms) and two frames. When it is ready, the host removes `pending` inside
   `startTypedTransition('slide-in', () => setRevealed(true))`, where `revealed` is state that drives
   `data-slide-move` (`pending` until revealed). Under reduced motion it removes `pending` plainly.
3. The surface boundary's `update` for `slide-in` runs `lvd-slide-in` on the new picture; the old (empty) picture
   is not drawn.

### A build step

1. Every step reaches `PresentationHost.go(next, step)` as before. With `step` given, the host takes the position it
   counts from: the slide `from = asked ?? at`, its build `shown` (`askedBuild` when it names that slide, else 0) and
   the slide's step count `slideBuildOrders(resolveSlide(slide, tab)).length`.
2. Forward with `shown < count`, or back with `shown > 0`: `stepBuild` answers the new position (`shown ± 1`,
   `entering` true only going forward). The host writes `askedBuild`, sets `presentingBuild` (inside a plain
   `startTransition` while a slide move is still on its way, so the two commit together; directly otherwise) and
   answers `from`: no slide moved.
3. Otherwise the step is a slide move, unchanged, and the slide it lands on takes its arrival build in the same
   update as `setPresentingAt`: finished (`count` of the target, not entering) going back; unbuilt (`null`) otherwise.
   Jumps (`step` absent) arrive unbuilt.
4. `useEditorViewport` derives `presentedElements` and the entrance (`{ key, ids, effect }`, the step's own elements,
   when `entering`) with `presentedBuild`. The camera still frames `presentingElements`, so the slide never refits as
   it builds.
5. `EditorCanvasHost` hands the canvas `presentedElements`; `useBuildEntrance` runs in a layout effect keyed by the
   entrance (one object per step) and calls `animate()` on each entering element's node (`[data-element-id]`; an
   arrow's hit band's parent group) with the effect's keyframes. It plays nothing under `prefersReducedMotion()` or
   for Appear.
6. `PresentationOverlay` takes `build` (`{ shown, count }`): the HUD's previous button shows while `at > 0 || shown > 0`;
   each landed step restarts the auto-advance timer; the note card resets only when the slide changes; a build
   played forward announces "Build n of m".

### Full screen

`PresentationOverlay`'s effect keeps `document.documentElement.requestFullscreen()` (the whole document, which no
component renders, so the document listeners in `whenScreenSettles` stay). Its `.catch` logs instead of swallowing:
`console.warn('[presentation] fullscreen-refused', reason)` on entry and `[presentation] fullscreen-exit-failed` on
exit.

## Interfaces and contracts

```ts
// packages/document/src/slide-builds.ts
export const BUILD_EFFECTS: readonly ['appear', 'fade', 'rise'];
export type BuildEffect = (typeof BUILD_EFFECTS)[number];
export type ElementBuild = { order: number; effect: BuildEffect };
export function buildOf(el: Element): ElementBuild | undefined; // lenient read: no build for a bad order
export function slideBuildOrders(elements: readonly Element[]): number[];
export function nextBuildOrder(elements: readonly Element[]): number; // highest + 1, else 1
export function presentedBuild(
  elements: readonly Element[],
  shown: number,
): { shown: Element[]; entering: Element[] }; // entering: the elements the step `shown` brought in
export function withBuild<E extends Element>(el: E, build: ElementBuild | null): E;
export type PresentingBuild = { slideId: string; shown: number; entering: boolean };
export function stepBuild(
  at: { slideId: string; shown: number },
  count: number,
  step: 1 | -1,
): PresentingBuild | null; // null: the step leaves the slide
```

```ts
// packages/workbench/src/components/canvas/slide-transition.ts
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
export function whenScreenSettles(ready: () => void): () => void;
```

## Data and persistence

| Field   | Where                                                                           | Class    | Notes                                                                                                 |
| ------- | ------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `build` | Every boxed element but a margin note (`element-types.ts`, `element-fields.ts`) | Cosmetic | Rides the tab body like every element field; read leniently by `buildOf`; no migration, no api change |

The running position (`presentingBuild`) is session state in `useSlideDeck`, never stored or broadcast.

## Errors and edge cases

| Case                                               | Handling                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| A press while a move animates                      | Counted from `asked`; React commits the latest target after the move |
| A jump (the list, Home, End) while a move animates | Taken as given; `asked` becomes it                                   |
| A step past the last slide                         | Clamped to `runnable.length` (the end state)                         |
| The deck edited under the presenter                | `at` follows the slide by id; `asked` clears when they meet          |
| No View Transitions in the browser                 | React applies the change; the slide cuts                             |
| The tab hidden mid-move                            | The browser skips the animation; the state is already committed      |
| Fullscreen refused or failing to exit              | Logged; the deck runs in the window                                  |
| A build's elements deleted mid-show                | `shown` clamped to the slide's step count                            |
| A peer adds or removes a build on the slide shown  | Steps re-derive from the lowest order; `shown` clamped               |
| An arrow joining an unbuilt element                | Hidden until both its ends show (`presentedBuild`)                   |
| A build order that is not a whole number from 1    | Read as no build (`buildOf`)                                         |
| An unknown effect                                  | Read as Appear                                                       |
| Reduced motion                                     | `useBuildEntrance` plays nothing; elements cut in                    |
| No `Element.animate` (an old browser, jsdom)       | Skipped; elements cut in                                             |
| Leaving mid-move                                   | Unchanged: the exit restores the view in the same commit             |

## Performance and limits

Measured by `apps/editor/e2e/perf/slide-transition.perf.ts` at a 4x CPU slowdown on 100-element slides: a key paints
in under 16 ms and the longest task stays under the earlier DOM copy's (about 112 ms). The probe is the regression
check; a build that loses either is a defect.

A build step renders the slide once (the canvas's element list less the unbuilt) and animates only the step's own
nodes with the Web Animations API (`opacity` and `translate`, never `transform`, which carries rotation), so a step on
a 100-element slide costs one render and a few compositor animations. `presentedBuild` is O(n) over the slide's
elements. The badges' numbers (`buildStepsOfTab`, under
`BuildStepsProvider`) re-derive on every edit of a tab that builds, walking only its built elements and the slides'
element lists: 2,000 built elements over 40 slides measured 2.3 ms (12.4 ms when it resolved every slide), held by a
CPU-time test; the map keeps its identity while the numbers hold, so an edit re-renders no element view for it.

## Presentation and UX

The Build section: the effect tiles (`BuildTiles`, `components/palette/BuildTiles.tsx`) are four
`AnimationPreviewTile`s whose miniature is a slide with two lines and a third that builds in (`.lvd-build-mini-*`
in `canvas-motion.css`), then **Order** (`BorderGrid`, a `SizeButton` per step and New). The badge is `BuildBadge`
(`element-parts.tsx`): a 20px brand disc at the element's top-left, moved right of the lock badge when both show.

The travel, curve and durations are the `lvd-slide-*` keyframes on `--lvd-slide-ms`. The page root takes no part, so the HUD
does not cross-fade.

## Accessibility

Reduced motion (either source) cuts. The slide announcer, focus and the HUD's controls are untouched.

## Observability

| Fingerprint                             | When                        |
| --------------------------------------- | --------------------------- |
| `[presentation] fullscreen-refused`     | `requestFullscreen` rejects |
| `[presentation] fullscreen-exit-failed` | `exitFullscreen` rejects    |

## Testing

| Rule                                   | Test                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types per transition and direction     | `slide-transition.test.ts`: `slideTransitionType`                                                                                                                                    |
| A move runs in a typed transition      | `PresentationHost.test.tsx`: `addTransitionType` called with the move's type                                                                                                         |
| Reduced motion and None start none     | `PresentationHost.test.tsx`                                                                                                                                                          |
| Quick steps all land                   | `PresentationHost.test.tsx`: three steps before a commit land three slides on                                                                                                        |
| Quick steps at the ends                | `PresentationHost.test.tsx`: the overlay names a step's direction (`onGo(next, ±1)`); the host wraps (Loop), stops or leaves from `asked`, and takes Home, End and the list as given |
| The entrance waits, then reveals typed | `PresentationHost.test.tsx` with `whenScreenSettles` driven                                                                                                                          |
| Refusals are logged                    | `PresentationOverlay.test.tsx`                                                                                                                                                       |
| It moves, lands and stays fast         | `e2e/presentation-mode.spec.ts`; `e2e/perf/slide-transition.perf.ts` (Chromium, Firefox)                                                                                             |
| Steps, orders, arrows, leniency        | `packages/document/src/slide-builds.test.ts`                                                                                                                                         |
| Builds step forward and back           | `PresentationHost.builds.test.tsx`: three builds present in four steps each way; back arrives finished; quick presses land                                                           |
| The overlay's back, timer, announce    | `PresentationOverlay.builds.test.tsx`                                                                                                                                                |
| The entrance plays, cuts when reduced  | `useBuildEntrance.test.tsx`                                                                                                                                                          |
| Build section, order, badge            | `BuildTiles.test.tsx`, `BuildBadge.test.tsx`                                                                                                                                         |
| A slide with three builds, end to end  | `e2e/slide-builds.spec.ts`                                                                                                                                                           |

## Constants and configuration

| Constant             | Value                                   | Provenance      | Safe range |
| -------------------- | --------------------------------------- | --------------- | ---------- |
| `SETTLE_FAILSAFE_MS` | 600                                     | Spec "Entering" | 300–1000   |
| `--lvd-slide-ms`     | 220 / 380 / 620 (Quick / Normal / Slow) | `SLIDE_SPEEDS`  | Spec       |
| `BUILD_ENTER_MS`     | 420                                     | PM3             | 250–700    |
| `BUILD_RISE_PX`      | 28 (canvas px)                          | PM3             | 12–48      |

## Defaults ledger

PM1 to PM5 in [DEFAULTS.md](DEFAULTS.md).
