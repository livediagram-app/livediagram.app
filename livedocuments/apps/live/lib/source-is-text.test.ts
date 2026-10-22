import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source files must be text, because the tools everyone navigates with give up
// on files that aren't.
//
// `useEditorState.ts` carried a literal NUL and SOH byte for a while — real
// control characters, used as unforgeable separators in a memo key. Runtime
// was fine. `file` classified the module as `data`, and ripgrep answered every
// search of it with "binary file matches" and moved on, which on the 2,800-line
// module that composes every editor hook meant "find all usages" silently
// under-reported: a dead-code sweep read a hook as having a definition and no
// callers, when every call site was in that file. The fix was \uXXXX escapes,
// identical at runtime.
//
// So this guards the property rather than that one file. Scoped to apps/live
// because that is where the hook-composition modules live and where the churn
// is, and because a workspace test reaching across the whole repo would be the
// wrong shape; the same check is cheap to copy if another package ever needs it.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  'out',
  'dist',
  '.turbo',
  '.wrangler',
  'coverage',
  'e2e',
]);
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.json', '.md'];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (EXTS.some((e) => entry.endsWith(e))) acc.push(full);
  }
  return acc;
}

describe('apps/live source files are text', () => {
  it('contains no C0 control bytes outside tab / newline / carriage return', () => {
    // Tab (0x09), LF (0x0a) and CR (0x0d) are ordinary whitespace. Everything
    // else below 0x20 is what makes a file read as binary.
    const allowed = new Set([0x09, 0x0a, 0x0d]);
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const bytes = readFileSync(file);
      for (const byte of bytes) {
        if (byte < 0x20 && !allowed.has(byte)) {
          offenders.push(`${relative(ROOT, file)} (byte 0x${byte.toString(16).padStart(2, '0')})`);
          break;
        }
      }
    }
    expect(
      offenders,
      'write control characters as \\uXXXX escapes — a raw byte makes the file unsearchable',
    ).toEqual([]);
  });
});
