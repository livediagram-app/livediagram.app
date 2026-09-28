import { defineProject } from '@livediagram/vitest-config';

// The detector's correctness tests run real image processing over whole
// synthetic walls: well inside the default 5 s on an idle machine, but not
// while every other package's suite shares the cores, where they timed out.
// Their SPEED is asserted separately, on CPU time (@livediagram/vitest-config/cpu-time).
export default defineProject({ test: { testTimeout: 30_000 } });
