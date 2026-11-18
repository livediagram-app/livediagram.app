// Many requests from one Worker invocation, a few at a time. A Worker holds at most six connections open at once and
// queues the rest, so a request's own deadline would start while it waited in that queue; running them through a
// pool starts each one's clock only when a slot is free. Shared by the status Worker's probes, the index's calls to
// the apps and livediagram's live status checks.

/** Run every task, at most `limit` at once (at least one), in their order; the answers in the tasks' order. */
export async function pooled<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const out: T[] = Array.from({ length: tasks.length });
  let next = 0;
  async function lane() {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), tasks.length) }, lane));
  return out;
}
