import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// People see livehuddle's items called Spaces (docs/specs/003-system-architecture/domain-language.md "Space"); code,
// routes and stored keys still say document. This scans the editor's sources, comments aside, for the old words in
// the places copy sits (command and button labels in Title Case, the untitled name, a plural in a string), so a new
// "New Document" or "New Canvas" doesn't creep back in. The flowchart Document shape is a shape, not an item, and
// keeps its name; "canvas" stays the drawing surface's word ("Open Canvas Options", "Reset This Canvas?").

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  'app',
  'components',
  'hooks',
  'lib',
  'src',
  // The editor code every editor shares (@liveworkspace/workbench) renders here too, so it is held to the rule as well.
  '../../../packages/workbench/src',
  // Avatar mode's shared code (@liveworkspace/avatar) renders here too.
  '../../../packages/avatar/src',
];
const OLD_COPY = [
  /\b(?:New|Share|Delete|Rename|Sync|Open|Current|Duplicate|Existing|Your|This|My|Recent|Team|Community) Documents?\b/,
  /\bAdd to Documents?\b/,
  /\bUntitled document\b/,
  /\bDocuments? (?:Created|Updated|Renamed|Duplicated|Filed|Deleted|Restored|Moved)\b/,
  // The items were Canvases before they were Spaces.
  /\b(?:New|Share|Delete|Rename|Sync|Open|Duplicate|Existing|Your|My|Recent|Team|Community) Canvas(?:es)?\b(?! Options)/,
  /\bAdd to Another Canvas\b/,
  /\bUntitled canvas\b/,
  /['"`>]\s*[A-Za-z ,]*\bcanvases\b/i,
];
// Where the old words are code, a stored value or search words, not copy: the untitled name a stored space may still
// carry, and search keywords, which keep the old words beside the new so an old search still finds the setting.
const ALLOWED = [
  /isUntitledDocumentName\('Untitled document'\)/,
  /'default folder where new spaces canvases documents go/,
];

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

describe('items are Spaces in copy', () => {
  it('writes no old "Document" or "Canvas" label in the editor', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sources(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
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
