// The benchmark's task bank, every area in one list: @liveworkspace/mcp-kit's eval/task-bank.mjs over this MCP's
// areas. Ids are stable across rounds: a round is only comparable with another on the ids they share. A selection
// is `all`, an area name, or ids, comma-separated and mixed ("forms,D1,D2").
import { createTaskBank } from '@liveworkspace/mcp-kit/eval/task-bank';
import diagram from './diagram.mjs';
import workshop from './workshop.mjs';
import forms from './forms.mjs';
import plan from './plan.mjs';
import sheets from './sheets.mjs';

export const { TASKS, taskById, selectTasks } = createTaskBank({
  diagram,
  plan,
  sheets,
  workshop,
  forms,
});
