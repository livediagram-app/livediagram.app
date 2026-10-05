import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineVerb, verbById, type Verb } from '@livediagram/agent-verbs';
import { CliError, type CliFailure } from '../output/cli-error';
import { didYouMean } from './did-you-mean';
import { fieldsOf, flagOf } from './fields';
import { splitGlobals } from './globals';
import { parseVerbArgs } from './parse-flags';
import { route } from './route';

function failureOf(fn: () => unknown): CliFailure {
  try {
    fn();
  } catch (err) {
    if (err instanceof CliError) return err.failure;
    throw err;
  }
  throw new Error('expected a CliError');
}

const verb = (id: string): Verb => verbById(id)!;

describe('didYouMean', () => {
  it('names the nearest word within two edits, or nothing', () => {
    expect(didYouMean('vew', ['ls', 'view', 'lint'])).toBe('view');
    expect(didYouMean('documnet', ['document', 'tab'])).toBe('document');
    expect(didYouMean('zzzzzz', ['document', 'tab'])).toBeNull();
  });
});

describe('route', () => {
  it('finds a top-level verb, a resource, an alias and a resource verb', () => {
    expect(route([])).toEqual({ kind: 'top' });
    expect(route(['guide', 'edit'])).toMatchObject({
      kind: 'verb',
      verb: { id: 'guide' },
      rest: ['edit'],
    });
    expect(route(['doc'])).toEqual({ kind: 'resource', resource: 'document' });
    expect(route(['tab', 'lint', 'x'])).toMatchObject({
      kind: 'verb',
      verb: { id: 'tab.lint' },
      rest: ['x'],
    });
  });

  it('refuses an unknown command or verb with a suggestion when one is near', () => {
    expect(failureOf(() => route(['tabs']))).toMatchObject({
      exit: 2,
      lines: ['did you mean: tab'],
      hint: 'livediagram --help',
    });
    expect(failureOf(() => route(['zzzzzz']))).toEqual({
      exit: 2,
      code: 'usage',
      message: 'unknown command "zzzzzz"',
      hint: 'livediagram --help',
    });
    expect(failureOf(() => route(['tab', 'vew']))).toMatchObject({
      lines: ['did you mean: view'],
      hint: 'livediagram tab --help',
    });
    expect(failureOf(() => route(['tab', 'zzzzzz']))).not.toHaveProperty('lines');
  });
});

describe('fieldsOf', () => {
  it("reads each key's kind, whether it is required, its values and its description", () => {
    const fields = fieldsOf(verb('tab.view').input);
    expect(fields.find((f) => f.key === 'doc')).toMatchObject({ kind: 'string', required: true });
    expect(fields.find((f) => f.key === 'view')).toMatchObject({
      kind: 'enum',
      required: false,
      values: expect.arrayContaining(['outline', 'graph']),
    });
    expect(fields.find((f) => f.key === 'budget')).toMatchObject({
      kind: 'number',
      required: false,
    });
    expect(fields.find((f) => f.key === 'coarse')).toMatchObject({
      kind: 'boolean',
      description: 'layout: rows instead of geometry',
    });
    expect(fieldsOf(verb('skill.print').input)).toEqual([]);
  });

  it('writes a key as its kebab-case flag', () => {
    expect(flagOf('withToken')).toBe('--with-token');
    expect(flagOf('tab')).toBe('--tab');
  });
});

describe('splitGlobals', () => {
  it('takes the global flags wherever they stand and leaves the rest', () => {
    expect(
      splitGlobals([
        '--profile',
        'work',
        'tab',
        'ls',
        'x',
        '--json=name,id',
        '-q',
        '--host=https://h',
      ]),
    ).toEqual({
      globals: {
        profile: 'work',
        host: 'https://h',
        help: false,
        version: false,
        mode: { json: true, fields: ['name', 'id'], quiet: true },
      },
      words: ['tab', 'ls', 'x'],
    });
    expect(splitGlobals(['--json', '-h', '--version', '--quiet']).globals).toEqual({
      help: true,
      version: true,
      mode: { json: true, quiet: true },
    });
  });

  it('refuses a valued flag without its value', () => {
    expect(failureOf(() => splitGlobals(['--host']))).toMatchObject({
      exit: 2,
      message: '--host needs a value',
    });
    expect(failureOf(() => splitGlobals(['--profile=']))).toMatchObject({
      message: '--profile needs a value',
    });
  });
});

describe('parseVerbArgs', () => {
  it('maps positionals in order and flags by kebab case, then checks the schema', () => {
    expect(
      parseVerbArgs(verb('tab.view'), [
        'Auth flow',
        '--tab',
        'Overview',
        '--budget',
        '300',
        '--coarse',
      ]),
    ).toEqual({
      doc: 'Auth flow',
      tab: 'Overview',
      view: 'outline',
      budget: 300,
      coarse: true,
    });
    expect(parseVerbArgs(verb('auth.login'), ['--with-token'])).toEqual({ withToken: true });
    expect(parseVerbArgs(verb('document.ls'), [])).toEqual({ limit: 20 });
  });

  it('refuses an unknown flag, an extra word, a missing argument and a bad value', () => {
    expect(failureOf(() => parseVerbArgs(verb('document.ls'), ['--token', 'x']))).toMatchObject({
      exit: 2,
      message: 'unknown flag --token for "document ls"',
      hint: 'livediagram document ls --help',
    });
    expect(failureOf(() => parseVerbArgs(verb('tab.ls'), ['a', 'b']))).toMatchObject({
      message: 'unexpected "b"',
    });
    expect(failureOf(() => parseVerbArgs(verb('tab.ls'), []))).toMatchObject({
      message: 'missing <doc>',
    });
    expect(failureOf(() => parseVerbArgs(verb('changeset.show'), ['doc']))).toMatchObject({
      message: 'missing <changeset>',
    });
    expect(
      failureOf(() => parseVerbArgs(verb('tab.view'), ['d', '--view', 'nope'])).message,
    ).toMatch(/^--view: /);
    expect(failureOf(() => parseVerbArgs(verb('document.ls'), ['--limit', '0'])).message).toMatch(
      /^--limit: /,
    );
  });
});

describe('a verb without a CLI projection', () => {
  const bare = defineVerb({
    id: 'probe.bare',
    summary: 's',
    description: 'd',
    behaviour: 'read',
    input: z.object({ name: z.string() }),
    output: z.object({}),
  });

  it('takes every key as a flag, undescribed keys with an empty description', () => {
    expect(parseVerbArgs(bare, ['--name', 'x'])).toEqual({ name: 'x' });
    expect(fieldsOf(bare.input)).toEqual([
      { key: 'name', kind: 'string', required: true, description: '' },
    ]);
    expect(failureOf(() => parseVerbArgs(bare, []))).toMatchObject({ message: 'missing --name' });
  });
});

describe('flag problems', () => {
  it('name a valued flag without its value, a switch given one, and a short flag the verb lacks', () => {
    expect(failureOf(() => parseVerbArgs(verb('document.ls'), ['--limit']))).toMatchObject({
      message: '--limit needs a value',
    });
    expect(failureOf(() => parseVerbArgs(verb('tab.view'), ['d', '--coarse=1']))).toMatchObject({
      message: '--coarse takes no value',
    });
    expect(failureOf(() => parseVerbArgs(verb('tab.ls'), ['-x']))).toMatchObject({
      message: 'unknown flag -x for "tab ls"',
    });
  });
});

describe('rest positionals and short flags', () => {
  it('collect the remaining words, read -f, and route the edit alias', () => {
    expect(
      parseVerbArgs(verb('element.set'), [
        'Auth flow',
        'n3',
        'label=Sign in',
        '--tab',
        'Main',
        '--dry-run',
      ]),
    ).toEqual({
      doc: 'Auth flow',
      tab: 'Main',
      words: ['n3', 'label=Sign in'],
      dryRun: true,
    });
    expect(parseVerbArgs(verb('element.move'), ['d', 'n3', '--', '-20,0'])).toMatchObject({
      words: ['n3', '-20,0'],
    });
    expect(parseVerbArgs(verb('changeset.apply'), ['d', '-f', '-'])).toMatchObject({ file: '-' });
    expect(route(['edit', 'd', '-f', 'x'])).toMatchObject({
      kind: 'verb',
      verb: { id: 'changeset.apply' },
      rest: ['d', '-f', 'x'],
    });
  });

  it('name a missing rest, a short flag without its value, and the alias as a suggestion', () => {
    expect(failureOf(() => parseVerbArgs(verb('element.rm'), ['d']))).toMatchObject({
      message: 'missing <words…>',
    });
    expect(failureOf(() => parseVerbArgs(verb('changeset.apply'), ['d', '-f']))).toMatchObject({
      message: '--file needs a value',
    });
    expect(failureOf(() => parseVerbArgs(verb('changeset.apply'), ['d']))).toMatchObject({
      message: 'missing --file',
    });
    expect(failureOf(() => route(['edt']))).toMatchObject({ lines: ['did you mean: edit'] });
  });
});
