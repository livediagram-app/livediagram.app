// A failure the CLI reports (docs/specs/015-api/cli.md "Output"): what was wrong, the candidates or detail
// lines, one runnable fix, and the exit code. Printed to stderr as text, or as one JSON object with --json.

import type { ExitCode } from './exit-codes';

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

// `words` rewrites each line first: a product's shared engine refuses in its MCP tools' names, which a CLI reads as
// the commands that do the same.
export function formatError(
  given: CliFailure,
  json: boolean,
  words: (text: string) => string = (text) => text,
): string {
  const failure: CliFailure = {
    ...given,
    message: words(given.message),
    ...(given.lines ? { lines: given.lines.map(words) } : {}),
    ...(given.hint ? { hint: words(given.hint) } : {}),
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
