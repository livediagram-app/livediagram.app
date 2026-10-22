import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The docs' ledgers and indexes stay unique (AGENTS.md "Organisation process").
//
// Several branches extend the same blueprint DEFAULTS.md ledger, the same COMPLETENESS.md and the
// same README.md index at once. A merge that keeps both sides leaves two rows called D22, two
// sections for one blueprint, or one index entry twice; nothing compiles prose, so each was found
// by someone reading. These checks make that a red test instead. Lives beside
// repo-paths-in-docs.test.ts for the same reason: this suite owns documentation correctness.

const DOCS = fileURLToPath(new URL('../../../docs', import.meta.url));

function filesNamed(dir: string, name: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...filesNamed(path, name));
    else if (entry === name) out.push(path);
  }
  return out;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

function report(name: string, find: (text: string) => string[]): string[] {
  return filesNamed(DOCS, name).flatMap((file) =>
    duplicates(find(readFileSync(file, 'utf8'))).map((d) => `${relative(DOCS, file)}: ${d}`),
  );
}

describe('docs ledgers and indexes', () => {
  it('give every default in a DEFAULTS.md ledger its own id', () => {
    expect(
      report('DEFAULTS.md', (t) => [...t.matchAll(/^\| (D\d+) +\|/gm)].map((m) => m[1]!)),
    ).toEqual([]);
  });

  it('give every blueprint one section in a COMPLETENESS.md', () => {
    expect(
      report('COMPLETENESS.md', (t) => [...t.matchAll(/^## (.+)$/gm)].map((m) => m[1]!)),
    ).toEqual([]);
  });

  it('list every file once in a README.md index', () => {
    expect(report('README.md', (t) => [...t.matchAll(/^- (\.\/\S+)/gm)].map((m) => m[1]!))).toEqual(
      [],
    );
  });

  it('finds a duplicate it is meant to catch', () => {
    expect(duplicates(['D1', 'D2', 'D1'])).toEqual(['D1']);
  });
});
