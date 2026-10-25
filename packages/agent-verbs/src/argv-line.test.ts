import { describe, expect, it } from 'vitest';
import { argvToOperationLine } from './argv-line';

// Each product's agent-verbs also parses these lines back with its own edit operations (its argv-line.test.ts).

describe('argvToOperationLine', () => {
  it('joins the verb and its words, quoting only what needs it', () => {
    expect(argvToOperationLine('set', ['n3', 'label=Sign in', 'shape=stadium'])).toBe(
      'set n3 label="Sign in" shape=stadium',
    );
    expect(
      argvToOperationLine('add', ['square', 'id=web', 'label=Web "app"', 'right-of:api']),
    ).toBe('add square id=web label="Web \\"app\\"" right-of:api');
    expect(argvToOperationLine('set', ['type:plan-view', 'label=Web "app"', 'all'])).toBe(
      'set type:plan-view label="Web \\"app\\"" all',
    );
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
