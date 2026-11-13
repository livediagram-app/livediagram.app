// The benchmark's task bank, every area in one list: @liveworkspace/mcp-kit's eval/task-bank.mjs over this MCP's
// areas. Ids are stable across rounds: a round is only comparable with another on the ids they share. A selection
// is `all`, an area name, or ids, comma-separated and mixed ("pages,I1,I3").
import { createTaskBank } from '@liveworkspace/mcp-kit/eval/task-bank';
import pages from './pages.mjs';

export const { TASKS, taskById, selectTasks } = createTaskBank({ pages });
