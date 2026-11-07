import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe as group, expect, it } from 'vitest';
import { describe, ensureDevVars, main } from './dev-vars';

let dir: string;
const file = (name: string) => path.join(dir, name);

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'dev-vars-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

group('ensureDevVars', () => {
  it('copies the example when there is no .dev.vars', () => {
    writeFileSync(file('.dev.vars.example'), 'A=1\n');
    expect(ensureDevVars(dir)).toBe('created');
    expect(readFileSync(file('.dev.vars'), 'utf8')).toBe('A=1\n');
  });

  it('never changes an existing .dev.vars', () => {
    writeFileSync(file('.dev.vars.example'), 'A=1\n');
    writeFileSync(file('.dev.vars'), 'SECRET=keep-me\n');
    expect(ensureDevVars(dir)).toBe('kept');
    expect(readFileSync(file('.dev.vars'), 'utf8')).toBe('SECRET=keep-me\n');
  });

  it('does nothing without an example', () => {
    expect(ensureDevVars(dir)).toBe('no-example');
  });

  it('waits for the file named by --after, then copies', () => {
    writeFileSync(file('.dev.vars.example'), 'A=1\n');
    expect(ensureDevVars(dir, 'accounts.vars')).toBe('waiting');
    writeFileSync(file('accounts.vars'), '');
    expect(ensureDevVars(dir, 'accounts.vars')).toBe('created');
  });

  it('rethrows a copy failure that is not a race', () => {
    // The example is a directory: the copy fails, and not because .dev.vars appeared.
    mkdirSync(file('.dev.vars.example'));
    expect(() => ensureDevVars(dir)).toThrow();
  });
});

group('main', () => {
  it('logs what it made, and what it waits for', () => {
    writeFileSync(file('.dev.vars.example'), 'A=1\n');
    const lines: string[] = [];
    main(['--after', 'missing'], dir, (line) => lines.push(line));
    main([], dir, (line) => lines.push(line));
    main([], dir, (line) => lines.push(line));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('restart this to sign in');
    expect(lines[1]).toContain('made .dev.vars');
    expect(describe('kept')).toBeNull();
  });
});
