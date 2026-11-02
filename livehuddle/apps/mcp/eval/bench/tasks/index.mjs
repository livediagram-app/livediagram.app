// The benchmark's task bank, every area in one list. Ids are stable across rounds: a round is only comparable with
// another on the ids they share.
import diagram from './diagram.mjs';
import workshop from './workshop.mjs';

const AREAS = { diagram, workshop };

export const TASKS = Object.entries(AREAS).flatMap(([area, tasks]) =>
  tasks.map((t) => ({ ...t, area })),
);

const BY_ID = new Map(TASKS.map((t) => [t.id, t]));

export function taskById(id) {
  const task = BY_ID.get(id);
  if (!task) throw new Error(`No task ${id}`);
  return task;
}

// `all`, an area name, or ids, comma-separated and mixed ("workshop,D1,D2").
export function selectTasks(spec = 'all') {
  const picked = new Map();
  for (const part of spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (part === 'all') TASKS.forEach((t) => picked.set(t.id, t));
    else if (part in AREAS)
      TASKS.filter((t) => t.area === part).forEach((t) => picked.set(t.id, t));
    else picked.set(part, taskById(part));
  }
  return [...picked.values()];
}
