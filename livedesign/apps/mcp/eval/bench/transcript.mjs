// Reads a `claude -p --output-format stream-json` transcript into what the benchmark measures, for livedesign's MCP
// server and its `design` ids (@liveworkspace/mcp-kit/eval/transcript).
import { createTranscript } from '@liveworkspace/mcp-kit/eval/transcript';

export { metricsOf } from '@liveworkspace/mcp-kit/eval/transcript';
export const { idsIn: designIdsIn, parseTranscript } = createTranscript({
  server: 'livedesign',
  noun: 'design',
});
