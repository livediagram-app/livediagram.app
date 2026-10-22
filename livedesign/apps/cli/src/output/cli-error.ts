// A failure the CLI reports (docs/specs/015-api/cli.md "Output"): what was wrong, the candidates or detail
// lines, one runnable fix, and the exit code. Printed to stderr as text, or as one JSON object with --json.

import type { ExitCode } from './exit-codes';
import { inCliWords } from './tool-names';

export type CliFailure = {
  exit: ExitCode;
  // A stable token: `not_found`, `ambiguous`, `usage`, an api error code.
  code: string;
  message: string;
  // Candidates or detail, each printed indented.
  lines?: string[];
  hint?: string;
};

export class CliError extends Error {
  readonly failure: CliFailure;
  constructor(failure: CliFailure) {
    super(failure.message);
    this.name = 'CliError';
    this.failure = failure;
  }
}

export function formatError(given: CliFailure, json: boolean): string {
  // The shared engine's refusals name MCP tools; here they read as the commands that do the same.
  const failure: CliFailure = {
    ...given,
    message: inCliWords(given.message),
    ...(given.lines ? { lines: given.lines.map(inCliWords) } : {}),
    ...(given.hint ? { hint: inCliWords(given.hint) } : {}),
  };
  if (json)
    return `${JSON.stringify({
      error: failure.code,
      message: failure.message,
      ...(failure.lines?.length ? { candidates: failure.lines.map((line) => line.trim()) } : {}),
      ...(failure.hint ? { hint: failure.hint } : {}),
    })}\n`;
  const lines = [`error: ${failure.message}`, ...(failure.lines ?? []).map((line) => `  ${line}`)];
  if (failure.hint) lines.push(`hint: ${failure.hint}`);
  return `${lines.join('\n')}\n`;
}
