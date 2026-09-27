# React state and effects

Status: in progress

## What

Every React component and hook in the repo keeps render pure and uses effects only to synchronise with
something outside React. The React hooks lint rules (`eslint-plugin-react-hooks`, including its React
Compiler rules: `refs`, `set-state-in-effect`, `purity`, `immutability`) are **errors** in every
workspace, with no per-line suppressions. The one exemption is written in the lint config, not in code:
test files that call a hook outside a component on purpose (to drive a hook that uses none) are exempt
from `rules-of-hooks`.

## Why

The editor grew idioms that work today but are fragile: values copied into refs during render, state
mirrored from props in effects, the clock and the DOM read while rendering. They cost extra renders and
a frame of wrong state (a flash), anchor popovers to `null` until something else re-renders, and keep
the code from running under the React Compiler. The rules warned while the editor carried 247 findings;
at zero they become errors, so no new one lands.

## The rules

- **Render is pure.** It reads props, state and context, and nothing else: no `ref.current`, no
  `Date.now()` or `Math.random()`, no DOM measurement, no mutation of props or state.
- **A value an event handler or effect needs at its newest** is read through:
  - `useEffectEvent`, when what is kept is a callback called from an effect;
  - `useLatest(value)` (a ref updated in an insertion effect, before any other effect runs), when it is a value read from
    event handlers, timers or subscriptions.
- **Derived state is computed during render**, not mirrored in an effect. State that resets when an
  input changes is adjusted during render (comparing against the previous input kept in state) or reset
  with a `key`.
- **Effects synchronise with the outside world** (subscriptions, timers, the DOM, storage, the network)
  and set state only from their callbacks. External stores are read with `useSyncExternalStore`.
- **An element a popover anchors to** is held in state through a callback ref, so the first render
  that has the element has it.
- **Measurements of the DOM** are taken in a layout effect or an observer and kept in state.
- **Relative time** comes from the shared tick store: `useRelativeNow()` returns the timestamp of the latest
  30-second tick, one timer for the whole page. Nothing reads `Date.now()` while rendering.
- **Effect dependencies are complete.** A dependency that must not retrigger the effect is an effect
  event, not an omission.

## Out of scope

- Enabling the React Compiler itself. These rules are the precondition; turning it on is its own change.
