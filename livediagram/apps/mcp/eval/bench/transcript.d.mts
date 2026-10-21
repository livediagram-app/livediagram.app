/** One MCP tool call in a run, with its outcome; see transcript.mjs. */
export interface Call {
  tool: string;
  input: unknown;
  isError: boolean;
  error: string | null;
  resultChars: number;
  /** The result's text when it succeeded and is at most 20,000 characters; else null. */
  result: string | null;
  images: number;
}

export interface RunResult {
  subtype: string | null;
  isError: boolean;
  turns: number | null;
  durationMs: number | null;
  costUsd: number | null;
  outputTokens: number | null;
  inputTokens: number;
}

export interface Run {
  model: string | null;
  sessionId: string | null;
  // Whether the livediagram MCP server connected; null with no init line.
  mcpConnected: boolean | null;
  calls: Call[];
  texts: string[];
  finalText: string;
  documentIds: string[];
  result: RunResult | null;
}

export interface Metrics {
  calls: number;
  errors: number;
  retries: number;
  firstTool: string | null;
  deprecatedCalls: number;
  images: number;
  resultChars: number;
  turns: number | null;
  durationMs: number | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  finished: boolean;
}

export declare function documentIdsIn(text: string): string[];
export declare function parseTranscript(jsonl: string): Run;
export declare function metricsOf(run: Run, deprecated?: ReadonlySet<string>): Metrics;
