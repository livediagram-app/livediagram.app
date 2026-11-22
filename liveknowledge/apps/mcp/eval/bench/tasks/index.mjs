// The benchmark's task bank, every area in one list: @liveworkspace/mcp-kit's eval/task-bank.mjs over this MCP's
// areas. Ids are stable across rounds: a round is only comparable with another on the ids they share. A selection
// is `all`, an area name, or ids, comma-separated and mixed ("knowledge,K2,K3").
import { createTaskBank } from '@liveworkspace/mcp-kit/eval/task-bank';
import knowledge from './knowledge.mjs';

export const { TASKS, taskById, selectTasks } = createTaskBank({ knowledge });
