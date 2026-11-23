import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDynamicBoundaries, dynamicCalls } from './dynamic-boundary';
import { checkSourceIsText, firstControlByte } from './source-is-text';
import {
  checkTailwindScanSafety,
  holdsPlaceholderClass,
  tailwindScannedFiles,
} from './tailwind-scan-safety';

// The guards an editor runs over its whole folder and the shared code beside it (its lib/dynamic-has-boundary,
// lib/source-is-text and app/tailwind-scan-safety tests): each rule on its own, then over a small tree.

let root: string | null = null;
function tree(files: Record<string, string>): string {
  root = mkdtempSync(join(tmpdir(), 'tree-guards-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

// An ellipsis in brackets, assembled so this file holds no literal example either.
const placeholder = `pb-${String.fromCharCode(91)}${'.'.repeat(3)}${String.fromCharCode(93)}`;

describe('next/dynamic imports', () => {
  it('reads each call whole, nested parentheses and all', () => {
    expect(dynamicCalls('const A = dynamic(() => import("./a"), { ssr: false });\nfoo();')).toEqual(
      ['dynamic(() => import("./a"), { ssr: false })'],
    );
  });

  it('names a call with no boundary of its own, in files that import next/dynamic', () => {
    const dir = tree({
      'app/a.tsx': "import dynamic from 'next/dynamic';\nconst A = dynamic(() => import('./x'));\n",
      'app/b.tsx':
        "import dynamic from 'next/dynamic';\nconst B = dynamic(() => import('./x'), { loading: L });\nconst C = dynamic(() => import('./y'), { ssr: false });\n",
      'app/c.ts': 'const dynamic = (n: number) => n;\ndynamic(1);\n',
      'app/a.test.tsx':
        "import dynamic from 'next/dynamic';\nconst A = dynamic(() => import('./x'));\n",
      'node_modules/pkg/d.tsx':
        "import dynamic from 'next/dynamic';\nconst A = dynamic(() => import('./x'));\n",
    });
    expect(checkDynamicBoundaries({ root: dir, dirs: [dir] })).toEqual([
      "app/a.tsx: dynamic(() => import('./x'))",
    ]);
  });
});

describe('source files are text', () => {
  it('finds a C0 control byte outside tab, newline and carriage return', () => {
    expect(firstControlByte(new TextEncoder().encode('a\tb\r\nc'))).toBeNull();
    expect(firstControlByte(new Uint8Array([0x61, 0x01, 0x00]))).toBe(0x01);
  });

  it('names each file holding one, build output and other file kinds left out', () => {
    const dir = tree({
      'lib/a.ts': 'const key = "a\u0000b";\n',
      'lib/b.ts': 'const key = "a\\u0000b";\n',
      'lib/c.png': '\u0001',
      'dist/a.js': '\u0001',
    });
    expect(checkSourceIsText({ root: dir, dirs: [dir] })).toEqual(['lib/a.ts (byte 0x00)']);
  });
});

describe('no placeholder class names anywhere Tailwind can see them', () => {
  it('finds an arbitrary-value class containing an ellipsis', () => {
    expect(holdsPlaceholderClass(`// pads with ${placeholder} on a phone`)).toBe(true);
    expect(holdsPlaceholderClass(`// pads with pb-${String.fromCharCode(91)}…]`)).toBe(true);
    expect(holdsPlaceholderClass('className="pb-[12px] w-[calc(100%-8px)]"')).toBe(false);
  });

  it('names each offending line of the files Tailwind scans', () => {
    const dir = tree({
      'app/a.tsx': `const a = 1;\n// ${placeholder}\n`,
      'app/b.md': placeholder,
      'out/a.css': placeholder,
    });
    const files = tailwindScannedFiles([dir]);
    expect(files.map((f) => f.slice(dir.length + 1))).toEqual(['app/a.tsx']);
    expect(checkTailwindScanSafety({ root: dir, files })).toEqual([
      `app/a.tsx:2  // ${placeholder}`,
    ]);
  });
});
