// One tab's writes in the order they were made (docs/specs/012-collaboration/collab-race-hardening.md "Saves"):
// each save or delete of a tab waits for that tab's previous one to settle. Without it a save holding Plan
// ledger changes (which waits up to ROOM_SEQUENCE_ACK_TIMEOUT_MS for the room) could be overtaken by a
// newer save of the same tab, and the server kept the older snapshot. Different tabs never wait on each
// other. A failed write does not hold the queue: the next one still goes.
export type TabSaveQueue = {
  run<T>(tabId: string, task: () => Promise<T>): Promise<T>;
};

export function createTabSaveQueue(): TabSaveQueue {
  const tails = new Map<string, Promise<unknown>>();
  return {
    run(tabId, task) {
      const before = tails.get(tabId);
      // Nothing of this tab in flight: the write starts now, in this tick, as it did unqueued.
      const result = before ? before.then(task, task) : startNow(task);
      const tail = result.then(
        () => undefined,
        () => undefined,
      );
      tails.set(tabId, tail);
      // Forget a settled tab, unless a newer write queued behind it meanwhile.
      void tail.then(() => {
        if (tails.get(tabId) === tail) tails.delete(tabId);
      });
      return result;
    },
  };
}

function startNow<T>(task: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(task());
  } catch (err) {
    return Promise.reject(err);
  }
}
