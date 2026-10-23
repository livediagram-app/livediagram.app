// What livedesign makes is a design, never a "document" (docs/specs/006-design): in file names, identifiers, routes,
// tables, copy and specs. The browser's own `document` (and its DOM relatives) keeps its name, as do the telemetry
// category Document (a category every product's dashboard shares), other sites' URLs and livedocuments.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const TEXT = /\.(ts|tsx|mts|mjs|js|json|md|mdx|sql|toml|css|html|yml|yaml|txt|sh)$/;
// The tracked files only: build output and installs are not livedesign's words.
const tracked = () =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((f) => f && !f.startsWith('plans/'));

// The DOM's names that hold the word, and words that only look like it.
const ALLOWED = new Set([
  'document',
  'Document',
  'documentElement',
  'ownerDocument',
  'contentDocument',
  'compareDocumentPosition',
  'DOCUMENT_POSITION_FOLLOWING',
  'DOCUMENT_POSITION_PRECEDING',
  'DocumentTimeline',
  'DocumentFragment',
  'createDocumentFragment',
]);
const LOOKALIKE = /documentation|documented|livedocument/i;
// Other sites' addresses keep their own paths (a Google Docs link, an API reference).
const FOREIGN_URL =
  /https?:\/\/(?!(?:www\.|staging\.)?livedesign\.app|[a-z]+\.test|localhost)[^\s'"`)<>\]]+/g;

describe('a design is never called a document', () => {
  const files = tracked();

  it('in a file or folder name', () => {
    const named = files.filter((p) => /document/i.test(p) && !LOOKALIKE.test(p));
    expect(named).toEqual([]);
  });

  it('in an identifier, a route, a table or copy', () => {
    const found: string[] = [];
    for (const file of files) {
      if (!TEXT.test(file) || join(root, file) === __filename) continue;
      const text = readFileSync(join(root, file), 'utf8').replace(FOREIGN_URL, '');
      if (!/document/i.test(text)) continue;
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        for (const word of line.match(
          /[A-Za-z0-9_$]*[Dd][Oo][Cc][Uu][Mm][Ee][Nn][Tt][A-Za-z0-9_$]*/g,
        ) ?? []) {
          if (ALLOWED.has(word) || LOOKALIKE.test(word)) continue;
          found.push(`${file}:${i + 1} ${word}`);
        }
      });
    }
    expect(found).toEqual([]);
  });
});
