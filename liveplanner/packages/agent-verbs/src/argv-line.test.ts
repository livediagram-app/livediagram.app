import { describe, expect, it } from 'vitest';
import { parseEditOperations } from '@liveplanner/edit-operations';
import { argvToOperationLine } from './argv-line';

describe('argvToOperationLine', () => {
  it('joins the verb and its words, quoting only what needs it', () => {
    expect(argvToOperationLine('set', ['w1', 'label=Team load', 'textSize=lg'])).toBe(
      'set w1 label="Team load" textSize=lg',
    );
    expect(argvToOperationLine('set', ['type:plan-view', 'label=Web "app"', 'all'])).toBe(
      'set type:plan-view label="Web \\"app\\"" all',
    );
    expect(argvToOperationLine('rm', ['label~old\\name'])).toBe('rm label~"old\\\\name"');
    expect(argvToOperationLine('rm', ['Sign in'])).toBe('rm "Sign in"');
    expect(argvToOperationLine('set', ['n3', 'label='])).toBe('set n3 label=');
  });
});

describe('the line it writes', () => {
  it('parses back to the words it was given', () => {
    const line = argvToOperationLine('set', ['w1', 'label=Say "hi" \\ there', 'textSize=lg']);
    const parsed = parseEditOperations(line);
    expect(parsed).toHaveProperty('operations');
    expect(JSON.stringify(parsed)).toContain('Say \\"hi\\" \\\\ there');
    expect(parseEditOperations(argvToOperationLine('rm', ['label~Sign in']))).toHaveProperty(
      'operations',
    );
  });
});
