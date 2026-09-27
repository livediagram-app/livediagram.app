# Motion: blueprint

Derived from [Motion](../motion.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                    | Role                                                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/tailwind-config/theme.css`                                    | The motion tokens, the shared `fade-in`, the cascade tokens, the shared keyframes  |
| `packages/tailwind-config/src/motion.ts`                                | The same tokens as numbers, and `cascadeDelayMs`, for code that needs milliseconds |
| `packages/tailwind-config/src/motion-budget.ts`                         | The static guard: the duration bound calculator and the file scanners              |
| `apps/*/motion-budget.test.ts`, `packages/ui/src/motion-budget.test.ts` | One guard run per workspace, over that workspace's own source                      |
| `apps/live/app/globals.css`                                             | Editor chrome motion only                                                          |
| `apps/live/app/canvas-motion.css`                                       | Editor canvas motion, moved out of `globals.css` unchanged                         |
| `apps/live/e2e/motion-budget.spec.ts`                                   | The runtime guard                                                                  |

## Domain and naming

| Term              | Identifier                                                                 | Meaning                                              |
| ----------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| Motion token      | `--transition-duration-{micro,short,long}`; `MOTION_MS.{micro,short,long}` | One of the three chrome durations                    |
| Ceiling           | `MOTION_CEILING_MS` (= `MOTION_MS.long`)                                   | The most any chrome motion may take, delay included  |
| Hover ceiling     | `MOTION_HOVER_CEILING_MS` (= `MOTION_MS.micro`)                            | The most a hover transition may take                 |
| Cascade step      | `--motion-cascade-step`; `MOTION_CASCADE_STEP_MS`                          | The beat between two cascade items                   |
| Cascade cap       | `--motion-cascade-cap`; `MOTION_CASCADE_CAP_MS`                            | The largest delay any cascade item takes             |
| Cascade delay     | `cascadeDelayMs(index)`                                                    | `min(index × step, cap)`                             |
| Bound             | `number` (ms), `Infinity` when unknown                                     | The largest value a duration or delay can take       |
| Violation         | `MotionViolation`                                                          | `{ file, line, rule, found, limit }`                 |
| Canvas stylesheet | `canvasStylesheets` option                                                 | A stylesheet the guard doesn't read (canvas/content) |
| Exit hold         | A `setTimeout` equal to a motion token                                     | Holds a leaving node until its exit animation ends   |

Tailwind's `--transition-duration-*` namespace gives `duration-micro`, `duration-short` and
`duration-long` for free (D1). Banned synonyms: "fast/slow", "quick", "snappy" as identifiers, and
"animation speed", which is the canvas element setting.

## Behaviour and state

### Tokens (`theme.css`, `@theme static`)

`static` so the variables are always emitted, even when only a `var()` reads them (D2).

```css
@theme static {
  --transition-duration-micro: 150ms;
  --transition-duration-short: 200ms;
  --transition-duration-long: 250ms;
  --default-transition-duration: var(--transition-duration-micro);
  --motion-cascade-step: 10ms;
  --motion-cascade-cap: 100ms;
  --animate-fade-in: fade-in var(--transition-duration-micro) ease-out;
}
```

`--motion-cascade-cap` is `long − micro`, so the last item of a cascade whose items run at `micro`
settles at exactly 250ms. The step is 10ms (D3). `fade-in` moves here from the live and telemetry
globals, where it was duplicated.

### `motion.ts`

```ts
export const MOTION_MS = { micro: 150, short: 200, long: 250 } as const;
export const MOTION_CEILING_MS = MOTION_MS.long;
export const MOTION_HOVER_CEILING_MS = MOTION_MS.micro;
export const MOTION_CASCADE_STEP_MS = 10;
export const MOTION_CASCADE_CAP_MS = MOTION_MS.long - MOTION_MS.micro;
export function cascadeDelayMs(index: number): number;
```

Here's how `cascadeDelayMs` treats its input:

- A negative, `NaN` or non-integer index is clamped to `0` or floored.
- An `undefined` index is not accepted; callers pass `0`.

A test parses `theme.css` and asserts every token equals its constant. That keeps the two from
drifting.

### Cascades

- **CSS cascades** read `min(calc(var(--stagger-i, 0) * var(--motion-cascade-step)), var(--motion-cascade-cap))`.
  They're `.stagger-enter`, `.lvd-menu-stagger > *`, `.lvd-cascade > *`, and the Timeline fans
  `.tl-fan-out` / `.tl-fan-out-up` through their inline delays. The `nth-child` ladders in
  `.lvd-menu-stagger` and `.lvd-cascade` are rewritten with step 10ms and cap 100ms: the first
  child at 0ms, the eleventh child and every later one at 100ms.
- **JS cascades** call `cascadeDelayMs`. That's `Timeline` (`STAGGER_MS` / `MAX_STAGGER_MS`
  removed) and `ExpandedStack` (`EXPAND_STAGGER_MS` removed).
- **Cascade items run at `micro`**: `menu-drop`, `lvd-row-in`, `tl-fan-out(-up)`, and `pop-in` /
  `slide-row-in` / `fade-in` when used with `.stagger-enter`.
- `ToolbarStripRail` drops its `--stagger-step: 22ms` override and takes the shared step.

### Exit holds

Each is set to the token of the exit animation it waits for.

| Where                              | Before | After             |
| ---------------------------------- | ------ | ----------------- |
| `TabPresenceStack` `POP_OUT_MS`    | 240    | `MOTION_MS.micro` |
| `ToolbarStripRail` `RAIL_LEAVE_MS` | 160    | `MOTION_MS.micro` |
| `ToolbarStripRail` `REORDER_MS`    | 200    | `MOTION_MS.short` |
| `QuickConnectRing` `EXIT_MS`       | 200    | `MOTION_MS.short` |

Timers of every other kind are not touched. That covers `GRACE_MS`, `CLOSE_DELAY_MS`,
`RING_CLOSE_DELAY_MS`, `LONG_PRESS_MS`, `REVEAL_DELAY_MS`, debounces, `AUTO_DISMISS_MS`,
`IDLE_MS` and the `useBoxedElementAnimation` 400ms canvas timeout.

### Chrome keyframe tokens (`apps/live/app/globals.css`)

| Token                       | Before | After   | Surface                                      |
| --------------------------- | ------ | ------- | -------------------------------------------- |
| `pop-in`                    | 360ms  | `micro` | Cluster bars, zoom menu, strip tiles, cards  |
| `pop-out`                   | 220ms  | `micro` | Presence avatars, strip tiles                |
| `fade-in`                   | 260ms  | `micro` | Moved to the shared theme                    |
| `fly-up-in`                 | 420ms  | `long`  | Dialogs, banners, search, template picker    |
| `sheet-up`                  | 340ms  | `long`  | Poll prompt sheet                            |
| `slide-row-in` / `-out`     | 220ms  | `micro` | Explorer rows, back bar, placement list (D4) |
| `slide-in-left`             | 240ms  | `short` | Mobile Explorer drawer                       |
| `tip-next` / `tip-prev`     | 260ms  | `short` | Tour steps, template-picker phases           |
| `dropdown-down` / `-up`     | 190ms  | `micro` | Palette dropdowns                            |
| `menu-drop` (stagger)       | 200ms  | `micro` | Context-menu categories                      |
| `[data-panel-translucent]`  | 200ms  | `micro` | Panel opacity restore on hover               |
| `.lvd-opt-glyph` hover lift | 160ms  | `micro` | Dropdown tile glyphs                         |

`longpress-hold` (320ms) is an ambient indicator: it fills over the long-press timer's window. It
moves to `canvas-motion.css` with the canvas gesture it belongs to.

`element-pop-in` is new, in `canvas-motion.css`. It's `pop-in 360ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
and `useBoxedElementAnimation` uses it in place of `animate-pop-in`. So canvas elements keep
exactly today's entry.

### Shared theme (`packages/tailwind-config/theme.css`)

| Rule                    | Before                    | After                        |
| ----------------------- | ------------------------- | ---------------------------- |
| `.tl-fan-out(-up)`      | 420ms                     | `micro`                      |
| `.lvd-cascade > *`      | 320ms, 35ms step to 700ms | `micro`, 10ms step to 100ms  |
| `.tl-date-pulse`        | 0.7s × 2                  | unchanged: ambient indicator |
| `empty-float` / `-ring` | loops                     | unchanged: ambient indicator |

### Component classes

Every chrome `duration-<n>` becomes a token. Hover-driven ones become `duration-micro`.

- **`apps/live`**
  - `micro`: `RecentDiagramsCard`, `BackBar`, `ChevronIcon`, `PanelSnapSlot`,
    `TimelineLanesOverlay`, and the `MovablePanel` fade.
  - `short`: `ExplorerTabBar` pill, `PaletteTabBar`, `ToolbarStripRail`, `AccordionSection`,
    `MovablePanel` rows, `AnimatedHeightBox`, the `PortalMenu` body and chevron, the
    `template-picker-wizard` progress bar, the `PollPanel` and `VotePanel` bars, and `NoteBox`.
  - `long`: `TourPopover`, `TourHost`, `PresentationHud`.
  - Inline: the `CanvasSelectionToolbars` fades take `micro`. `QuickConnectRing` takes `micro`
    for the plus and opacity, and `short` for the ring's transform. `explorer-icons` takes `micro`.
- **`packages/ui`**: `ProductNav` takes `micro` for the chevron and dropdown. `Brand` takes
  `micro` for the colour and the hover rotate.
- **`apps/help`**: `.card-glow` (0.3s) takes `micro`, as do `CategoryCard`, `FeatureArticleCard`,
  `ArticleCard`, the contact cards, `SearchInput`, `BackToTop` and the `ArticleLayout` feedback
  buttons.
- **`apps/marketing`**: the `Section` card hover takes `micro`. The page entrance is content
  (spec, "Content pacing"), and `page-motion.css` is listed as a content stylesheet. The view
  transition takes 260ms. `.enter` takes 310ms with `animation-delay: var(--enter-delay, 0ms)`.
  `FeatureCategoryHero` sets `--enter-delay` to `min(index × ENTER_BEAT_MS, 130)`, where
  `ENTER_BEAT_MS` is 35.
- **`apps/telemetry`**: the `MetricCloud` word hover and `.stack-dim` take `micro`, and
  `StickyWindowBar` takes `short`. `MetricCards` staggers its expansion with `cascadeDelayMs`,
  and `fade-in` comes from the shared theme. The data-viz reveals are content (spec, "Content
  pacing"), in `dataviz-motion.css`, which is listed as a content stylesheet:
  - `.cloud-word` and `.metric-rise` take 210ms. `MetricCloud` delays each word by
    `min(i × CLOUD_BEAT_MS, CLOUD_BEAT_CAP_MS)` (11ms, 250ms), and `MetricSearch` delays each
    piece by `step × RISE_STEP_MS` (30ms).
  - `.metric-reveal` takes 400ms and `.funnel-bar` 250ms.

Canvas and content durations above the ceiling move into their stylesheets, unchanged:

- The `QaNoteRow` heat bar (500ms) becomes `.qa-heat` in `qa-board.css`.
- The `useFlipList` play transition (420ms) becomes `.qa-flip-move` in `qa-board.css`. The hook
  adds the class instead of writing the transition inline. Like the old inline value, it stays on
  the row.
- The `HeroIllustration` card dim (500ms) becomes `.hero-card-dim` in `hero-animations.css`.
- The `ShowcaseStagger` scene dim (500ms) becomes `.scene` in `ShowcaseStagger.module.css`.

### `canvas-motion.css`

This is a pure move out of `globals.css` into a new file, imported right after `qa-board.css`. It
takes these blocks:

- The animated elements: `lvd-anim-*`, `lvd-text-*`, `lvd-svg-*`, `lvd-trace-run`, `lvd-grad-*`,
  `lvd-vote-*`, `lvd-arrow-*`, `lvd-icon-*`, `lvd-prog-*`, `lvd-rating-*` and `lvd-pie-*`, with
  their reduced-motion block.
- `[data-insert-shift]` and `lvd-done-*`.
- The presentation slide transitions (`lvd-slide-*`, `[data-slide-move]` and the reduced-motion
  fade).
- `longpress-hold` and the new `element-pop-in`.

The only change on the way is `element-pop-in`. Non-motion canvas rules stay in `globals.css`:
the sticky peel, isometric depth, cursors and note ink.

## Interfaces and contracts

```ts
type MotionViolation = {
  file: string; // repo-relative
  line: number; // 1-based
  rule: 'ceiling' | 'hover-ceiling' | 'unbounded' | 'token-drift';
  found: string; // the offending source text, trimmed to 120 chars
  limit: number; // ms
};

function durationBoundMs(value: string, tokens: TokenMap): number; // Infinity when unknown
function scanStylesheet(text: string, file: string, tokens: TokenMap): MotionViolation[];
function scanSource(text: string, file: string, tokens: TokenMap): MotionViolation[];
function checkMotionBudget(options: {
  root: string; // absolute workspace directory
  canvasStylesheets?: string[]; // paths relative to root
}): MotionViolation[];
function formatViolations(violations: MotionViolation[]): string;
```

`checkMotionBudget` walks `root` for `*.css`, `*.tsx` and `*.ts`, skipping `node_modules`,
`.next`, `.next-dev`, `out`, `coverage`, `e2e` and `*.test.*`. It returns violations sorted by file
and line. Each workspace test asserts `[]` and prints `formatViolations` on failure. A
`canvasStylesheets` entry that doesn't exist is itself a violation (`unbounded`), so a renamed
file can't quietly drop out of the classification.

### `durationBoundMs`

It works on the value with `!important` stripped.

- `Nms` gives `N`, and `Ns` gives `N × 1000`.
- `var(--x)` or `var(--x, fb)`: a known token gives its value. Any other variable gives
  `Infinity`, fallback or not, because an inline style can set it to anything (D5).
- `min(a, b, …)` gives the smallest bound, `max(…)` the largest, and `calc(…)` gives `Infinity`
  unless it's a single term.
- `${MOTION_MS.micro|short|long}ms` in a template literal gives the token. Any other `${…}` gives
  `Infinity`.
- `auto` gives `0`. A scroll-driven animation's `auto` duration fills its scroll range; it isn't
  time.
- Anything else gives `Infinity`.

### `scanStylesheet`

- Comments are stripped, preserving line numbers.
- Blocks are walked with a brace-depth parser. `@keyframes` bodies are skipped. `@media` and
  `@supports` are descended into. `@theme` declarations are read like rules.
- A rule is checked when its declarations include `transition`, `transition-duration`,
  `transition-delay`, `animation`, `animation-duration`, `animation-delay`, or a custom property
  named `--animate-*`, `--transition-duration-*` or `--motion-*`.
- **Shorthands** are split on top-level commas. In each part, the first time-like token is the
  duration and the second is the delay. A time-like token is a time literal, or a
  `var` / `min` / `max` / `calc` whose text holds a time literal or a motion variable. The part's
  bound is duration plus delay.
- **Ambient.** An `animation` part whose iteration count is `infinite` or an integer of 2 or more
  is an ambient indicator. It's exempt.
- **Hover.** A rule is hover-driven when another rule's selector, with `:hover`, `:focus`,
  `:focus-visible`, `:focus-within` and `:not(...)` removed, equals this rule's selector. Its limit
  is `MOTION_HOVER_CEILING_MS`.
- **Limits.** The limit is `MOTION_CEILING_MS`, or the hover ceiling for a hover-driven rule. A
  bound of `Infinity` is `unbounded`, a bound above the ceiling is `ceiling`, and a bound above
  the hover ceiling is `hover-ceiling`.
- **Delay-only rules** (`animation-delay`, `transition-delay`) are held to `MOTION_CASCADE_CAP_MS`
  (D6).

### `scanSource`

It works on each string or template literal in the file:

- **Tailwind durations.** A `duration-<v>` class (including after variants) gives `<n>`ms for a
  number, the token for `micro` / `short` / `long`, and `durationBoundMs` of the value for
  `duration-[<v>]`. Anything else gives `Infinity`. `delay-<v>` is held to the cascade cap.
- **Hover limit.** When the same literal also holds a `hover:`, `group-hover:` or `focus:` class,
  the limit is the hover ceiling.
- **Inline transitions.** A `transition`, `transitionDuration` or `transitionDelay` key followed by
  `:` or `=` and a literal is bounded with `durationBoundMs`.
- **Inline animation values** (`animationDuration`, `animationDelay`) are not read (D7). Their chrome
  cascades are bounded through `cascadeDelayMs`, which has its own test, and by the runtime guard.

## Data and persistence

Nothing is stored. The `reduceMotion` preference is unchanged.

## Errors and edge cases

- **An unknown `var()` in a duration position** is `unbounded`, never assumed small.
- **A missing classified stylesheet** is reported, as described above.
- **Reduced motion** still wins. The collapse in `globals.css` sets animations to
  `0.01ms !important` and transitions to `0s !important`. The zeroed cascade delays stay too.
  `app/reduced-motion.test.ts` pins both values. Cascade delays are zeroed through the same selectors, now against the
  `min()` value.
- **`fill-mode: both` cascades** still pin `opacity: 1` under reduced motion.
- **A `transition` with no duration** takes Tailwind's default, which is now bound to `micro`.
- **An exit hold can end before its animation** only if the two diverge. Both read one constant,
  so they can't.

## Security and trust

The guard only reads source files at test time. It doesn't touch the network or run anything.

## Performance and limits

Motion gets shorter, so no frame budget grows. The guard reads roughly 3,000 files per full run.
It's a single pass of string scanning per file, well under a second per workspace.

## Presentation and UX

Only durations change. Keyframes, easing, origins and distances stay the same, so every surface
moves the same way, just sooner. The copy is unchanged.

## Accessibility

- Reduced motion is untouched and stricter.
- Shorter motion helps the vestibular case.
- Focus rings don't animate.

## Web Experience

- **CLS** stays 0. Motion animates `transform` and `opacity`. Height reveals only follow the
  person's input.
- **INP** improves: nothing waits on a long exit before the next frame is interactive.
- **LCP** is unaffected.

## Observability

The guard is the observability. Its fingerprint is `motion-budget:`, followed by one line per
violation: `motion-budget: <file>:<line> <rule> <found> (> <limit>ms)`. There's no runtime
logging, because motion isn't a decision point.

## Testing

| Rule                                         | Test                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Tokens match their constants                 | `packages/tailwind-config/src/motion.test.ts`                                               |
| `cascadeDelayMs` caps and clamps             | `packages/tailwind-config/src/motion.test.ts`                                               |
| Bounds for literals, `var`, `min`, `calc`    | `packages/tailwind-config/src/motion-budget.test.ts`                                        |
| Stylesheet: ceiling, hover, ambient, delay   | `packages/tailwind-config/src/motion-budget.test.ts`                                        |
| Source: classes, hover, inline, templates    | `packages/tailwind-config/src/motion-budget.test.ts`                                        |
| The shared theme is within budget            | `packages/tailwind-config/src/theme-budget.test.ts`                                         |
| Each workspace is within budget              | `motion-budget.test.ts` in live, help, marketing, telemetry, ui and template-previews       |
| Timeline cascades use the shared cap         | `packages/ui/src/timeline/ExpandedStack.test.tsx`                                           |
| Exit holds equal their tokens                | `ToolbarStripRail.test.tsx`, `TabPresenceStack.test.tsx`                                    |
| Reduced motion creates no transitions        | `apps/live/app/reduced-motion.test.ts`                                                      |
| Canvas entry keeps 360ms                     | `apps/live/app/canvas-motion.test.ts`, `apps/live/components/canvas/canvas-motion.test.tsx` |
| Chrome animations settle in 250ms at runtime | `apps/live/e2e/motion-budget.spec.ts`                                                       |

### The runtime guard

It emulates `prefers-color-scheme: dark` and `reducedMotion: 'no-preference'`. The run goes like
this:

1. Just draw.
2. Open the palette dropdown, the context menu, the zoom menu, the Settings dialog and the search
   panel in turn.
3. After each, sample `document.getAnimations()`. Canvas animations are left out: any whose effect
   target sits inside `[data-canvas-a11y-root]`.
4. Assert `delay + activeDuration ≤ 250` for each one whose iterations are finite and fewer than 2.

A second case, with the Reduce motion preference on, asserts every sampled animation is 1ms or
shorter.

## Constants and configuration

| Constant                 | Value | Provenance                                          | Safe range |
| ------------------------ | ----- | --------------------------------------------------- | ---------- |
| `MOTION_MS.micro`        | 150   | Spec: hovers and small fades                        | 100–150    |
| `MOTION_MS.short`        | 200   | D8: midpoint tier                                   | 150–250    |
| `MOTION_MS.long`         | 250   | Spec: ceiling                                       | 200–250    |
| `MOTION_CASCADE_STEP_MS` | 10    | D3                                                  | 5–20       |
| `MOTION_CASCADE_CAP_MS`  | 100   | `long − micro`, so a cascade settles by the ceiling | Derived    |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
