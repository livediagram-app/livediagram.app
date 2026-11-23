import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { filesUnder } from './source-files';

// Source files must be text, because the tools everyone navigates with give up on files that aren't: a module
// that carried a literal NUL and SOH byte (real control characters, used as separators in a memo key) ran fine,
// but `file` classified it as `data` and ripgrep answered every search of it with "binary file matches", so
// "find all usages" silently under-reported. The fix is \uXXXX escapes, identical at runtime.
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
// Tab (0x09), LF (0x0a) and CR (0x0d) are ordinary whitespace. Everything else below 0x20 is what makes a file
// read as binary.
const ALLOWED = new Set([0x09, 0x0a, 0x0d]);

/** The first C0 control byte in a file's bytes that is not tab, newline or carriage return, or null. */
export function firstControlByte(bytes: Uint8Array): number | null {
  for (const byte of bytes) if (byte < 0x20 && !ALLOWED.has(byte)) return byte;
  return null;
}

/** Every source file under `dirs` (absolute folders) that holds such a byte, as `path (byte 0x..)`. */
export function checkSourceIsText({
  root,
  dirs,
}: {
  root: string;
  dirs: readonly string[];
}): string[] {
  const offenders: string[] = [];
  for (const file of dirs.flatMap((dir) =>
    filesUnder(dir, SKIP_DIRS, (name) => EXTS.some((e) => name.endsWith(e))),
  )) {
    const byte = firstControlByte(readFileSync(file));
    if (byte !== null)
      offenders.push(`${relative(root, file)} (byte 0x${byte.toString(16).padStart(2, '0')})`);
  }
  return offenders;
}
