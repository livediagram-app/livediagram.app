# Trace a canvas gesture

How to measure what one gesture (a click, a drag, a pan) costs on a large board, by hand, in a real
browser. The budget it is held to is in [Canvas performance](../specs/008-canvas/canvas-performance.md).

## Build

1. Work in your own worktree off `origin/main`.
2. For named functions in profiles, add `productionBrowserSourceMaps: true` to
   `apps/live/next.config.ts` for this build only.
3. Build the export against the api whose board you measure:
   `NEXT_PUBLIC_API_BASE=https://staging.livediagram.app/api npx next build` in `apps/live`, under
   PM2.
4. Revert `next.config.ts` as soon as the build is done; the flag is never committed.
5. Serve `apps/live/out` over HTTPS on a free loopback port, mapping every `/document/<id>` path to
   `document/placeholder.html`, under PM2.

## Open the board

6. Launch headless Chromium at 1440 × 900 in dark mode, ignoring the local certificate.
7. Route every non-GET `/api/**` request to a 204 and swallow every WebSocket
   (`context.routeWebSocket`), so the board is never written; staging boards belong to people.
8. Open the board, wait for network idle, dismiss any dialog, and press `v` for the Select tool.
9. Set `Emulation.setCPUThrottlingRate` to 4.

## Measure

10. Take the numbers that count from the page itself first: a `PerformanceObserver` on `longtask`
    and on `event` (`durationThreshold: 16`), registered before the gesture and read after it.
11. For a breakdown, trace the gesture with `devtools.timeline` and
    `disabled-by-default-devtools.timeline`; add `v8.execute` and
    `disabled-by-default-v8.compile` when compilation is suspected.
12. Find the longest `RunTask` on `CrRendererMain` and sum the events inside it by name
    (`EventDispatch`, `FunctionCall`, `UpdateLayoutTree`, `Layout`, `PrePaint`, `Paint`,
    `Layerize`, `V8.*`).
13. A long task with no `EventDispatch` in it is not the gesture's work; find what else ran in it.

## Profile

14. Start the CPU profiler (`Profiler.start`) once, over an idle window before the first measured
    gesture, and throw that window away. Starting it parses every script again to collect source
    positions: about a second at 4× on a large board, which otherwise lands in the first gesture's
    trace as a task of `(program)`.
15. Profile the following gestures; their timings carry the sampler's overhead, so read budgets from
    step 10, and the profile only for where the time goes.
16. Map the `.cpuprofile` back through the build's source maps and read self and inclusive time
    for app code.

## Report

17. Measure the same gesture, with the same script, on the deployed build and on the local build,
    and give the numbers side by side.
18. Record what was learned in [Canvas performance on large boards](../research/canvas-performance.md).
19. Stop and delete your PM2 processes.
