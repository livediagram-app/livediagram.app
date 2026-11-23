// Reads a `claude -p --output-format stream-json` transcript into what the benchmark measures, for livedocuments's MCP
// server and its `document` ids (@liveworkspace/mcp-kit/eval/transcript).
import { createTranscript } from '@liveworkspace/mcp-kit/eval/transcript';

export { metricsOf } from '@liveworkspace/mcp-kit/eval/transcript';
export const { idsIn: documentIdsIn, parseTranscript } = createTranscript({
  server: 'livedocuments',
  noun: 'document',
});
