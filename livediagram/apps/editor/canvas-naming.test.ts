import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// People see livediagram's items called canvases (docs/specs/003-system-architecture/domain-language.md "Canvas");
// code, routes and stored keys still say document. This scans the editor's sources, comments aside, for the old
// words in the places copy sits (command and button labels in Title Case, and the untitled name), so a new
// "New Document" doesn't creep back in. The flowchart Document shape is a shape, not an item, and keeps its name.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = ['app', 'components', 'hooks', 'lib', 'src'];
const OLD_COPY = [
  /\b(?:New|Share|Delete|Rename|Sync|Open|Current|Duplicate|Existing|Your|This|My|Recent|Team|Community) Documents?\b/,
  /\bAdd to Documents?\b/,
  /\bUntitled document\b/,
  /\bDocuments? (?:Created|Updated|Renamed|Duplicated|Filed|Deleted|Restored|Moved)\b/,
];
// Where the old words are code or a stored value, not copy: the untitled name a stored canvas may still carry.
const ALLOWED = [
  /isUntitledDocumentName\('Untitled document'\)/,
  /Document (?:Created|Updated|Duplicated|Opened|Renamed)\)\$/,
];

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

describe('items are canvases in copy', () => {
  it('writes no old "Document" label in the editor', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sources(join(ROOT, dir))) {
        const rel = file.slice(ROOT.length);
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            const code = line.replace(/\/\/.*$/, '');
            if (/^\s*(\*|\/\*)/.test(code)) return;
            if (ALLOWED.some((re) => re.test(code))) return;
            if (OLD_COPY.some((re) => re.test(code)))
              offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          });
      }
    expect(offenders).toEqual([]);
  });
});
