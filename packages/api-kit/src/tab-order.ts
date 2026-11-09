// Where a new tab lands in a document, plan or design: one past the highest place its tabs hold, 0 with none (each
// product's docs/specs/006-*/per-tab-storage.md "New tabs and the tab order"). Never the count of tabs: once a tab
// leaves the middle, the count is the last tab's own place, and the new tab ties with it.
export function nextOrderIndex(tabs: readonly { orderIndex: number }[]): number {
  let max = -1;
  for (const t of tabs) if (t.orderIndex > max) max = t.orderIndex;
  return max + 1;
}
