// An MCP benchmark's task bank, every area in one list (each product's apps/mcp/eval/bench/tasks/index.mjs hands in
// its areas). Ids are stable across rounds: a round is only comparable with another on the ids they share.

/** @param {Record<string, { id: string }[]>} areas each area's tasks, by the area's name */
export function createTaskBank(areas) {
  const TASKS = Object.entries(areas).flatMap(([area, tasks]) =>
    tasks.map((t) => ({ ...t, area })),
  );
  const BY_ID = new Map(TASKS.map((t) => [t.id, t]));

  function taskById(id) {
    const task = BY_ID.get(id);
    if (!task) throw new Error(`No task ${id}`);
    return task;
  }

  // `all`, an area name, or ids, comma-separated and mixed ("pages,I1,I3").
  function selectTasks(spec = 'all') {
    const picked = new Map();
    for (const part of spec
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (part === 'all') TASKS.forEach((t) => picked.set(t.id, t));
      else if (part in areas)
        TASKS.filter((t) => t.area === part).forEach((t) => picked.set(t.id, t));
      else picked.set(part, taskById(part));
    }
    return [...picked.values()];
  }

  return { TASKS, taskById, selectTasks };
}
