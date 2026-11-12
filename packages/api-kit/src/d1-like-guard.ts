// Tests only: every D1 and Durable Object SQLite stand-in calls this on each statement it runs with its bound
// values. D1 and a Durable Object's SQLite refuse a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB pattern too
// complex") where node:sqlite allows 50,000, so a query that passes a test could fail in production: a GitHub
// address (`%github.com/owner/repo/pull/n%`) did, 2026-11-12. Refuse a bound pattern the way production does. Look
// for text with `instr(haystack, needle) > 0` instead, which has no such limit. No Worker imports this module.

/** The longest LIKE or GLOB pattern D1 and a Durable Object's SQLite take, in bytes. */
export const D1_LIKE_PATTERN_MAX = 50;

const QUOTED = /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;
// A bound parameter (`?` or `?N`), or a LIKE / GLOB naming one as its pattern.
const TOKEN = /\b(?:LIKE|GLOB)\s+\?(\d*)|\?(\d*)/gi;

const bytes = (text: string) => new TextEncoder().encode(text).length;

export function assertD1LikePatterns(
  query: string,
  args: readonly unknown[],
  max = D1_LIKE_PATTERN_MAX,
): void {
  let positional = 0;
  for (const m of query.replace(QUOTED, ' ').matchAll(TOKEN)) {
    const isPattern = m[0][0] !== '?';
    const numbered = isPattern ? m[1] : m[2];
    const index = numbered ? Number(numbered) - 1 : positional++;
    const value = args[index];
    if (isPattern && typeof value === 'string' && bytes(value) > max) {
      throw new Error('D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR');
    }
  }
}
