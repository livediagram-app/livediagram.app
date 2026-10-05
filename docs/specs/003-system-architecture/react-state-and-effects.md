# React state and effects

Status: shipped

## What

Every React component and hook in the repo keeps render pure and uses effects only to synchronise with
something outside React. Every `eslint-plugin-react-hooks` rule, including the React Compiler rules
(`refs`, `set-state-in-effect`, `purity`, `immutability` and the rest) and `exhaustive-deps`, is an
**error** in every workspace (`packages/eslint-config`), with no per-line suppressions and no
exemptions. Tests drive hooks through a component (`renderHook`), like the app does.

## Why

The editor grew idioms that work but are fragile: values copied into refs during render, state mirrored
from props in effects, the clock and the DOM read while rendering, effects whose dependency lists were
silenced. They cost extra renders and a frame of wrong state (a flash), anchored popovers to `null` until
something else re-rendered, and hid stale-callback bugs behind suppressions. The rules warned while the
editor carried 247 findings and 73 suppressions; at zero they are errors, so no new one lands.

## The rules

- **Render is pure.** It reads props, state and context, and nothing else: no `ref.current`, no
  `Date.now()` or `Math.random()`, no DOM measurement, no storage writes, no mutation of props or state.
  That holds for helpers render calls, too, even where the lint cannot see across the module.
- **A value an event handler or effect needs at its newest** is read through:
  - `useEffectEvent`, when it is read from inside an effect (including the timers, listeners and
    frames the effect sets up): the effect keeps only its true triggers;
  - `useLatest(value)` (`apps/live/hooks/ui/useLatest.ts`: a ref updated in an insertion effect,
    before any other effect of the commit runs), when it is read from event handlers or code outside
    React. `useAssignRef(ref, value)` does the same into a ref that must be declared earlier, to break
    a cycle between hooks.
- **Derived state is computed during render**, not mirrored in an effect. State that resets when an
  input changes is adjusted during render (comparing against the previous input kept in state) or reset
  with a `key`. A local draft of a value that also changes from outside uses `useFollowingDraft`
  (`apps/live/hooks/ui/useFollowingDraft.ts`).
- **Effects synchronise with the outside world** (subscriptions, timers, the DOM, storage, the network)
  and set state only from their callbacks. External stores are read with `useSyncExternalStore`: the
  guest id (`subscribeGuestSelfId`), the URL, the help article's headings.
- **An element a popover anchors to** is held in state through a callback ref, so the first render that
  has the element has it. A floating element re-positions through `useReposition(measure)`, with
  `measure` memoised, so its dependencies are checked.
- **Measurements of the DOM** are taken in a layout effect or an observer and kept in state.
- **Clocks.** Relative time comes from the shared tick store: `useRelativeNow()` returns the instant of
  the latest 30-second tick, one timer for the whole page. A running timer's readout uses `useNow`.
  Presence statuses read a snapshot the presence tick republishes, and a returning peer republishes at
  once. Nothing reads `Date.now()` while rendering.
- **Effect dependencies are complete.** A dependency that must not retrigger the effect is read through
  an effect event, not omitted.

## The React Compiler

`apps/live` builds with the React Compiler, which memoises components and hooks at build time, so a
re-render re-runs only what its inputs changed. The rules above are its precondition: it compiles code
that keeps them and leaves the rest as plain React.

- **The native Rust port runs it**, inside Turbopack (`reactCompiler: true` with
  `experimental.turbopackRustReactCompiler`). There is no Babel plugin and no
  `babel-plugin-react-compiler` dependency. The port is experimental in Next.js; it is chosen
  deliberately, because its output matches the Babel plugin's (the same render counts in every
  measured interaction) while the Babel plugin doubles the cold compile of a dev page.
- **Turbopack only.** The Rust port throws under webpack, so the webpack escape hatch (`dev:webpack`)
  runs without the compiler.
- **Functions it cannot compile** (unsupported syntax, such as `try`/`finally`) are skipped, not
  broken: they run as uncompiled React.
- Hand-written `memo`, `useMemo` and `useCallback` stay valid; the compiler works alongside them.

## Out of scope

- The React Compiler in the other Next.js apps (marketing, help, telemetry, community).
