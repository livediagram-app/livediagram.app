// The process status (docs/specs/015-api/cli.md "Exit codes"), one of eight, and how an api answer maps to it
// (blueprint CLI14).

export const EXIT = {
  done: 0,
  rejected: 1,
  usage: 2,
  notFound: 3,
  auth: 4,
  conflict: 5,
  rateLimited: 6,
  failure: 7,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export function exitCodeForStatus(status: number): ExitCode {
  if (status === 401 || status === 403) return EXIT.auth;
  if (status === 404 || status === 410) return EXIT.notFound;
  if (status === 409 || status === 412) return EXIT.conflict;
  if (status === 429) return EXIT.rateLimited;
  if (status >= 500) return EXIT.failure;
  return EXIT.rejected;
}
