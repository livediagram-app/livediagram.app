import { describe, expect, it } from 'vitest';
import { parseEditOperations } from '@livediagram/edit-operations';
import { argvToOperationLine } from './argv-line';

describe('argvToOperationLine', () => {
  it('joins the verb and its words, quoting only what needs it', () => {
    expect(argvToOperationLine('set', ['n3', 'label=Sign in', 'shape=stadium'])).toBe(
      'set n3 label="Sign in" shape=stadium',
    );
    expect(
      argvToOperationLine('add', ['square', 'id=web', 'label=Web "app"', 'right-of:api']),
    ).toBe('add square id=web label="Web \\"app\\"" right-of:api');
    expect(argvToOperationLine('rm', ['label~old\\name'])).toBe('rm label~"old\\\\name"');
    expect(argvToOperationLine('rm', ['Sign in'])).toBe('rm "Sign in"');
    expect(argvToOperationLine('set', ['n3', 'label='])).toBe('set n3 label=');
  });

  it('puts the arrow between the two ends of connect, so the shell never sees it', () => {
    expect(argvToOperationLine('connect', ['web', 'api', 'label=calls'])).toBe(
      'connect web -> api label=calls',
    );
    expect(argvToOperationLine('connect', ['web'])).toBe('connect web');
  });
});

describe('the line it writes', () => {
  it('parses back to the words it was given', () => {
    const line = argvToOperationLine('set', ['n3', 'label=Say "hi" \\ there', 'shape=stadium']);
    const parsed = parseEditOperations(line);
    expect(parsed).toHaveProperty('operations');
    expect(JSON.stringify(parsed)).toContain('Say \\"hi\\" \\\\ there');
    expect(
      parseEditOperations(argvToOperationLine('connect', ['web', 'api', 'label=calls it'])),
    ).toHaveProperty('operations');
    expect(parseEditOperations(argvToOperationLine('rm', ['label~Sign in']))).toHaveProperty(
      'operations',
    );
  });
});
