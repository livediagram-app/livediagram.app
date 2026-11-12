# @liveworkspace/e2e-kit

The parts of the editors' Playwright suites that read the same in every product: what a spec or
the canvas performance probe measures with, not what it drives. Each editor's `e2e/` keeps its specs,
fixtures and stack, and imports these by subpath.

- `contrast`: the contrast audit (`auditContrast`), every visible text node against the background
  painted under it, held to WCAG 2.2 SC 1.4.3 (docs/specs/003-system-architecture/e2e-smoke.md).
- `optical-snap`: the baseline snap a shape inherits from its fractional position, which the optical
  audit subtracts (docs/specs/004-interface-design/optical-alignment.md).
- `optical` and `optical-discover`: the optical alignment audit (`auditOptical(page)`) and its in-page half
  (`discover`, one self-contained function `page.evaluate` runs), same doc. They run in a browser, so each
  editor's `optical-audit*.spec.ts` and `optical-snap.spec.ts` are their tests.
- `perf/calibrate`, `perf/interactive`, `perf/trace-tasks`: the canvas performance probe's CPU
  calibration, its time-to-interactive reading and its main-thread task list from a trace
  (docs/specs/008-canvas/canvas-performance.md).
- `perf/budget`: the budget's rules, table and median of runs, generic over the tabs a probe names
  (`Measurement<'whiteboard' | 'diagram'>`, `Measurement<'plan'>`).
- `perf/budget-report` and `perf/nightly.mjs`: what the nightly run does with the budget issue
  (`budgetIssueTitle(product)`, `budgetIssueAction`, `budgetIssueComment`), and its I/O, dependency-free, which
  `.github/workflows/canvas-perf.yml` runs from each editor's folder before `pnpm install`:
  `node ../../../packages/e2e-kit/src/perf/nightly.mjs previous`, then `... report <product>`.

Every module but the optical audit's two is pure and unit-tested here; none imports a product.
