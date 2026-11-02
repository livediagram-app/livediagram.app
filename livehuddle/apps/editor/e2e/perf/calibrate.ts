// Calibrating the probe's CPU slowdown (docs/specs/008-canvas/canvas-performance.md "The budget"): the
// budget holds at the reference speed, the machine it was set on throttled 4x. A runner benchmarks
// itself and is throttled so the benchmark takes as long as there; one slower than that runs
// unthrottled, and its report says its numbers read harsher than the budget's.

// The machine the budget was set on throttled this much stands in for an ordinary laptop under load.
export const TARGET_SLOWDOWN = 4;
// The benchmark on that machine, quiet (an Intel i7-14700K desktop, headless Chromium, unthrottled;
// the probe's own procedure, the fastest of five pages' medians: 13.6 ms over 36 pages, 13.6 to
// 15 ms each), measured 2026-10-03. Under load it reads up to 24 ms, which is why the probe takes
// the fastest. Re-measure only with the budget itself.
export const REFERENCE_BENCH_MS = 13.6;

export type Calibration = { rate: number; slowerThanTarget: boolean };

export function calibratedThrottle(benchMs: number): Calibration {
  if (!Number.isFinite(benchMs) || benchMs <= 0) throw new Error(`BadBenchmark: ${benchMs}`);
  const rate = (TARGET_SLOWDOWN * REFERENCE_BENCH_MS) / benchMs;
  return rate >= 1 ? { rate, slowerThanTarget: false } : { rate: 1, slowerThanTarget: true };
}

// A fixed workload in the shape of the canvas's own (DOM building, style and layout, JS, JSON),
// run in a blank page, unthrottled; its median of seven runs in ms. Self-contained: it is sent to
// the page by page.evaluate, so it closes over nothing.
export function benchmarkInPage(): number {
  const runs: number[] = [];
  for (let run = 0; run < 7; run++) {
    const start = performance.now();
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:800px';
    for (let i = 0; i < 1500; i++) {
      const cell = document.createElement('div');
      cell.textContent = `item ${i}`;
      cell.style.cssText = `display:inline-block;padding:2px;width:${20 + (i % 50)}px`;
      host.appendChild(cell);
    }
    document.body.appendChild(host);
    let sum = host.offsetHeight;
    for (let i = 0; i < 2_000_000; i++) sum = (sum * 31 + i) % 1_000_003;
    const json = JSON.stringify(Array.from({ length: 3000 }, (_, i) => ({ i, v: sum + i })));
    sum += (JSON.parse(json) as unknown[]).length;
    host.remove();
    runs.push(performance.now() - start);
  }
  runs.sort((a, b) => a - b);
  return runs[3]!;
}
