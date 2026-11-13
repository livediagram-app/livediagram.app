import { describe, expect, it } from 'vitest';
import { CliError, type CliFailure } from './cli-error';
import { GLOBAL_FLAGS, splitGlobals } from './globals';

function failureOf(fn: () => unknown): CliFailure {
  try {
    fn();
  } catch (err) {
    if (err instanceof CliError) return err.failure;
    throw err;
  }
  throw new Error('expected a CliError');
}

describe('GLOBAL_FLAGS', () => {
  it('names every flag splitGlobals takes', () => {
    expect(GLOBAL_FLAGS).toEqual([
      '--host',
      '--profile',
      '--json',
      '--quiet',
      '--help',
      '--version',
    ]);
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
