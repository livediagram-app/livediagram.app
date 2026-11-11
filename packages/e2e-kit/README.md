# @liveworkspace/e2e-kit

The pure parts of the editors' Playwright suites that read the same in every product: what a spec or
the canvas performance probe measures with, not what it drives. Each editor's `e2e/` keeps its specs,
fixtures and stack, and imports these by subpath.

- `contrast`: the contrast audit (`auditContrast`), every visible text node against the background
  painted under it, held to WCAG 2.2 SC 1.4.3 (docs/specs/003-system-architecture/e2e-smoke.md).
- `optical-snap`: the baseline snap a shape inherits from its fractional position, which the optical
  audit subtracts (docs/specs/004-interface-design/optical-alignment.md).
- `perf/calibrate`, `perf/interactive`, `perf/trace-tasks`: the canvas performance probe's CPU
  calibration, its time-to-interactive reading and its main-thread task list from a trace
  (docs/specs/008-canvas/canvas-performance.md). The budget itself (`perf/budget`) names each
  product's tabs and gestures, so it stays in each editor.

Every module is pure and unit-tested here; none imports a product.
