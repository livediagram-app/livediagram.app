import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkTailwindScanSafety,
  tailwindScannedFiles,
} from '@liveworkspace/style-guards/tailwind-scan-safety';

// Tailwind's scanner reads whole FILES, not just the parts that are markup. Any
// class-shaped string in a source file gets compiled, including one written
// inside a comment that DESCRIBES a class rather than uses it.
//
// Harmless for a real utility, and this codebase names them in prose
// constantly. Not harmless for a placeholder: a comment here once spelled out
// the iOS safe-area padding utility with a bracketed ellipsis standing in for
// the real value, and Tailwind compiled a rule whose declared value was that
// ellipsis. The whole stylesheet then failed to parse, taking the dev server
// with it.
//
// Worth a guard rather than a memo, because of HOW it failed: the production
// build was green and only the dev server rejected it, so the repo's own gate
// could not catch it and the first person to find out was somebody running the
// app.
//
// This file obeys its own rule and never writes the pattern out: the test is
// scanned like every other source file, so a literal example in it would be
// the very bug it forbids. (It found exactly that on its first run.) The rule
// itself is every editor's (packages/style-guards/src/tailwind-scan-safety.ts).

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// The editor code every editor shares (@liveworkspace/workbench), which app/globals.css points Tailwind at too.
const WORKBENCH = join(ROOT, '../../../packages/workbench/src');

describe('no placeholder class names anywhere Tailwind can see them', () => {
  const files = tailwindScannedFiles([ROOT, WORKBENCH]);

  it('scans a real tree (guard against this test going blind)', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('has no arbitrary-value class containing an ellipsis', () => {
    const offenders = checkTailwindScanSafety({ root: ROOT, files });
    // Named in full, because the fix is to reword ONE line and this message is
    // the only thing that says which.
    expect(
      offenders,
      `Tailwind would compile these into invalid CSS:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
