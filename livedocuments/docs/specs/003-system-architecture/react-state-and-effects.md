# React state and effects

Status: shipped

## What

Every React component and hook in the repo keeps render pure and uses effects only to synchronise with
something outside React. Every React hooks rule (oxlint's native port of `eslint-plugin-react-hooks`),
including the React Compiler rules (`refs`, `set-state-in-effect`, `purity`, `immutability` and the
rest) and `exhaustive-deps`, is an **error** in every workspace (`packages/oxlint-config`, run by
oxlint: [Linting](linting.md)), with no per-line suppressions and no exemptions. Tests drive hooks
through a component (`renderHook`), like the app does.

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
  - `useLatest(value)` (`../packages/workbench/src/hooks/ui/useLatest.ts`: a ref updated in an insertion effect,
    before any other effect of the commit runs), when it is read from event handlers or code outside
    React. `useAssignRef(ref, value)` does the same into a ref that must be declared earlier, to break
    a cycle between hooks.
- **Derived state is computed during render**, not mirrored in an effect. State that resets when an
  input changes is adjusted during render (comparing against the previous input kept in state) or reset
  with a `key`. A local draft of a value that also changes from outside uses `useFollowingDraft`
  (`../packages/workbench/src/hooks/ui/useFollowingDraft.ts`).
- **Effects synchronise with the outside world** (subscriptions, timers, the DOM, storage, the network)
  and set state only from their callbacks. External stores are read with `useSyncExternalStore`: the
  guest id (`subscribeGuestSelfId`), the guest-data migration (`subscribeGuestMigration`), the URL,
  the help article's headings.
- **An element a popover anchors to** is held in state through a callback ref, so the first render that
  has the element has it. A floating element re-positions through `useReposition(measure)`, with
  `measure` memoised, so its dependencies are checked.
- **Measurements of the DOM** are taken in a layout effect or an observer and kept in state.
- **Clocks.** Relative time comes from the shared tick store: `useRelativeNow()` returns the instant of
  the latest 30-second tick, one timer for the whole page. A running timer's readout uses `useNow`.
  Presence statuses read a snapshot the presence tick republishes, and a returning peer republishes at
  once. A reading by the day (due and overdue counts, the calendar's month, the Gantt's today line) uses
  `useToday()`, a store that moves on at local midnight and when the page is shown again. Nothing reads
  the clock (`Date.now()`, `new Date()`) while rendering; a static page's copyright year is the build's,
  inlined at build (`@liveworkspace/next-config`).
- **Effect dependencies are complete.** A dependency that must not retrigger the effect is read through
  an effect event, not omitted.
- **A handler decides before it commits.** A state updater (the function a commit or a `setX` takes) may
  run after the call returns: React runs it at once only when nothing else is queued on that component,
  and a menu closing first is enough to queue something. So what a handler does next (a toast, a
  selection, a go-to, a telemetry event) is worked out from the state as the handler sees it, never from
  a variable the updater writes. Where the result is costly or names things afresh (random ids), the
  handler commits the result it worked out when the state is unchanged, `(t) => (t === tab ? out :
recompute(t))`. `apps/editor/commit-updater-flags.test.ts` fails a new one.

## The React Compiler

The editor (`apps/editor`) builds with the React Compiler, which memoises components and hooks at build time, so a
re-render re-runs only what its inputs changed. The three static sites (marketing, help, telemetry) do not:
their pages rarely re-render, and the compiler's memoisation added 6 to 44 KiB of first-load JavaScript to them.
The editor asks for it through `@liveworkspace/next-config` (`reactCompiler: true`). The rules above are its precondition: it compiles code
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
- **A forced re-render does not re-read module state.** A render-time call such as
  `isPending(userId)` is memoised on its arguments, so bumping an unused reducer to "refresh" it
  returns the cached value. Module state a render depends on is an external store that notifies
  its subscribers, and the render reads it through the value its subscription returns: the async
  icon catalogues (`useIconCatalogs`) re-rendered every glyph when they landed, but a glyph that
  called `getIcon(iconId)` without that value kept its placeholder, so a first visit's page
  showed a framed question mark on every node. `hooks/ui/useIconCatalogs.guard.test.ts` fails on
  a call that drops the value, since Vitest runs without the compiler.

## Rendering in the browser only

Every app is a static export, so every component also renders once at build time, where there is no window.

- **A component that cannot render meaningfully at build time** calls `use(browser())` (`browser` from `react-dom`).
  It suspends during the prerender and renders at once in the browser.
- **Its nearest `<Suspense>`** has a fallback that reserves the final size, so the swap moves nothing
  ([Layout stability](../004-interface-design/layout-stability.md)).
- **Render never guards a browser global with `typeof window`**, and no `useHydrated`-style state stands in for it.
  `typeof window` stays only in effects, handlers and module code that runs outside React.
- **Render never reads the clock**, the shared footer's year included: the prerendered HTML and the hydrating
  browser must render the same text whatever the date.

## Animating a state change

- **A state change animates as a View Transition**: the update runs in `startTransition`, and the `<ViewTransition>`
  around the surface that changes animates it. `addTransitionType` names why it changes, and the surface keys its
  `update`, `enter` and `exit` classes by that type, with `default="none"` so no other transition animates it.
- **Nothing calls `document.startViewTransition` directly**, and nothing uses `flushSync` to feed one.
- **Reduced motion** (the OS setting or the in-app preference, `prefersReducedMotion()`) runs the change without a
  transition, so the browser captures nothing ([Motion](../004-interface-design/motion.md) "Reduced motion").
- **React holds a transition while a View Transition runs.** A handler that counts from the state on screen counts
  from the state it last asked for instead, or quick repeats are lost.

## Fragments and DOM events

- **A node that exists only to carry a ref** (for an observer, a listener, focus or a measurement) goes. Where an
  event already names the element (its `currentTarget`), the handler uses that; otherwise a `<Fragment ref>` takes
  its place, and its `FragmentInstance` observes, listens, focuses and measures the children as a group.
- **A node that carries more than a ref** stays: React event props (a tooltip's trigger), `textContent`, or the
  component's own box are not what a `FragmentInstance` offers.
- **An event React exposes is listened to through React** (`onFullscreenChange`, `onFullscreenError`) when it fires
  on an element the component renders. An event that fires on `<html>` or `document` (presenting fullscreens the
  whole document) is beyond any component's tree, so an effect listens on `document`.

## Out of scope

- Server Components, Server Actions and request-time rendering: every app is a static export
  ([Next.js](../016-platform/nextjs.md)).
