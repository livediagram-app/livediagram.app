// list_threads and change_threads (docs/specs/015-api/mcp-server.md "Comment threads"): the shared comment thread
// tools (@liveworkspace/agent-verbs/mcp/thread-tools) in this product's words, and their run over its api.
import { createThreadRun } from '@liveworkspace/agent-verbs/mcp/thread-run';
export { threadStopText } from '@liveworkspace/agent-verbs/mcp/thread-run';
import { createThreadTools } from '@liveworkspace/agent-verbs/mcp/thread-tools';
import { AGENT_PRODUCT } from '../agent-product';

export const { listThreads: mcpListThreads, changeThreads: mcpChangeThreads } = createThreadTools(
  AGENT_PRODUCT,
  'designId',
);

export const { listThreads, applyThreadChanges } = createThreadRun(AGENT_PRODUCT);

// Their outputs by name, as the other tools' are (output-schema.ts).
export const listThreadsOutput = mcpListThreads.mcpShapes.output;
export const changeThreadsOutput = mcpChangeThreads.mcpShapes.output;
