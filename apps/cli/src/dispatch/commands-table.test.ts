import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Verb } from '@livediagram/agent-verbs';
import { fieldsOf, flagOf } from './fields';
import { route } from './route';

// The spec's command table (docs/specs/015-api/cli.md "Commands", blueprint "Testing"): every command it lists
// routes to a verb, and every flag it names belongs to one of its row's commands.

const spec = readFileSync(
  new URL('../../../../docs/specs/015-api/cli.md', import.meta.url),
  'utf8',
);
const table = spec.slice(spec.indexOf('## Commands'), spec.indexOf('**Addressing.**'));

// Each backticked command in a row's first cell, with `a|b` alternatives expanded: the words, then the flags.
function commands(): { words: string[]; flags: string[]; source: string }[] {
  const rows = table.split('\n').filter((l) => l.startsWith('| `'));
  return rows.flatMap((row) => {
    const cell = row.split(/(?<!\\)\|/)[1]!;
    return [...cell.matchAll(/`([^`]+)`/g)].flatMap(([, text]) => {
      const source = text!.replace(/\\\|/g, '|');
      const tokens = source.split(' ');
      const words: string[][] = [];
      for (const token of tokens) {
        if (!/^[a-z]+(\|[a-z]+)*$/.test(token)) break;
        words.push(token.split('|'));
      }
      const flags = [...source.matchAll(/--([a-z-]+)/g)].map((m) => `--${m[1]}`);
      const expand = (rest: string[][]): string[][] =>
        rest.length === 0
          ? [[]]
          : rest[0]!.flatMap((w) => expand(rest.slice(1)).map((tail) => [w, ...tail]));
      return expand(words).map((w) => ({ words: w, flags, source }));
    });
  });
}

const flagsOf = (verb: Verb) => {
  const renamed = verb.cli?.flags ?? {};
  return new Set(
    fieldsOf(verb.input).map((f) =>
      renamed[f.key]?.name ? `--${renamed[f.key]!.name}` : flagOf(f.key),
    ),
  );
};

describe('the spec’s command table', () => {
  const all = commands();

  it('is read: every row has at least one command', () => {
    expect(all.length).toBeGreaterThan(40);
  });

  it('routes every command to a verb, and each flag a row names to one of its commands', () => {
    const problems: string[] = [];
    const flagsBySource = new Map<string, Set<string>>();
    for (const { words, source } of all) {
      const routed = route(words);
      if (routed.kind !== 'verb') {
        problems.push(`${words.join(' ')} (from \`${source}\`) is no command`);
        continue;
      }
      const known = flagsBySource.get(source) ?? new Set<string>();
      for (const flag of flagsOf(routed.verb)) known.add(flag);
      flagsBySource.set(source, known);
    }
    // `presence set|clear ... --status`: a flag belongs to at least one of its row's commands.
    for (const { flags, source } of all)
      for (const flag of flags)
        if (!flagsBySource.get(source)?.has(flag))
          problems.push(`no command of \`${source}\` takes ${flag}`);
    expect([...new Set(problems)]).toEqual([]);
  });
});
