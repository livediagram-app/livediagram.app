// Reads a `claude -p --output-format stream-json` transcript into what the benchmark measures, for liveplanner's MCP
// server and its `project` ids (@liveworkspace/mcp-kit/eval/transcript).
import { createTranscript } from '@liveworkspace/mcp-kit/eval/transcript';

export { metricsOf } from '@liveworkspace/mcp-kit/eval/transcript';
export const { idsIn: projectIdsIn, parseTranscript } = createTranscript({
  server: 'liveplanner',
  noun: 'project',
});
