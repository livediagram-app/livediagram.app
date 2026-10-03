/**
 * CPU time this process spent running `fn`, in ms (user + system).
 *
 * Speed tests assert on THIS, not wall-clock time: `performance.now()` also
 * counts the time a test waits for a core while every other package's suite
 * runs in parallel (turbo), which made wall-clock budgets flake: a 30 ms
 * conversion measured at over a second. CPU time barely moves under
 * contention, so a budget on it still catches a real regression (a quadratic
 * loop, an accidental re-scan) without failing on a busy machine.
 *
 * @param {() => void} fn
 * @returns {number}
 */
export function cpuMsOf(fn) {
  const before = process.cpuUsage();
  fn();
  const spent = process.cpuUsage(before);
  return (spent.user + spent.system) / 1000;
}

/**
 * `cpuMsOf` for async work: the CPU time this process spent while `fn`'s
 * promise settled. The worker runs one test at a time, so nothing else is
 * on its CPU meanwhile.
 *
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<number>}
 */
export async function cpuMsOfAsync(fn) {
  const before = process.cpuUsage();
  await fn();
  const spent = process.cpuUsage(before);
  return (spent.user + spent.system) / 1000;
}
