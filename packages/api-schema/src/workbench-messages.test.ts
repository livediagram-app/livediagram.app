import { describe, expect, it } from 'vitest';
import {
  parseWorkbenchMessage,
  WORKBENCH_MESSAGE_TYPES,
  type WorkbenchMessageDirection,
} from './workbench-messages';

const TICKET = 'A'.repeat(21) + '_';

describe('WORKBENCH_MESSAGE_TYPES', () => {
  it('holds the ten types of the spec', () => {
    expect(WORKBENCH_MESSAGE_TYPES).toEqual([
      'livediagram:hello',
      'livediagram:hello-ack',
      'livediagram:ready',
      'livediagram:tab',
      'livediagram:selection',
      'livediagram:renew',
      'livediagram:ticket',
      'livediagram:reveal',
      'livediagram:theme',
      'livediagram:ended',
    ]);
  });
});

describe('parseWorkbenchMessage', () => {
  const valid: [WorkbenchMessageDirection, Record<string, unknown>][] = [
    ['to-workbench', { type: 'livediagram:hello', v: 1 }],
    [
      'to-workbench',
      {
        type: 'livediagram:ready',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
        role: 'edit',
      },
    ],
    ['to-workbench', { type: 'livediagram:tab', v: 1, tabId: 't1', tabName: 'Wireframe' }],
    [
      'to-workbench',
      {
        type: 'livediagram:selection',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        rev: 41,
        count: 0,
        reference: '[livediagram] "Home screen"',
      },
    ],
    ['to-workbench', { type: 'livediagram:renew', v: 1 }],
    ['to-workbench', { type: 'livediagram:ended', v: 1, reason: 'revoked' }],
    ['to-page', { type: 'livediagram:ticket', v: 1, ticket: TICKET }],
    ['to-page', { type: 'livediagram:reveal', v: 1, refs: ['146b', 'e4a8'] }],
    ['to-page', { type: 'livediagram:theme', v: 1, colourScheme: 'dark' }],
  ];

  it.each(valid)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it('accepts a hello-ack and trims its name', () => {
    expect(
      parseWorkbenchMessage(
        { type: 'livediagram:hello-ack', v: 1, name: '  Acme Editor ' },
        'to-page',
      ),
    ).toEqual({ type: 'livediagram:hello-ack', v: 1, name: 'Acme Editor' });
  });

  it.each([
    ['an unknown type', { type: 'livediagram:dance', v: 1 }, 'livediagram:dance'],
    [
      'another version',
      { type: 'livediagram:theme', v: 2, colourScheme: 'dark' },
      'livediagram:theme',
    ],
    ['a page message sent to the page', { type: 'livediagram:renew', v: 1 }, 'livediagram:renew'],
    ['a message with no type', { v: 1 }, 'undefined'],
    ['a string', 'hello', 'undefined'],
    ['null', null, 'undefined'],
  ])('ignores %s', (_label, data, type) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ ignored: type });
  });

  it('bounds the logged type of an ignored message', () => {
    const parsed = parseWorkbenchMessage({ type: 'x'.repeat(200), v: 1 }, 'to-page');
    expect(parsed).toEqual({ ignored: 'x'.repeat(64) });
  });

  it.each([
    ['a hello-ack with no name', { type: 'livediagram:hello-ack', v: 1 }],
    ['a hello-ack with a blank name', { type: 'livediagram:hello-ack', v: 1, name: '   ' }],
    [
      'a hello-ack with an overlong name',
      { type: 'livediagram:hello-ack', v: 1, name: 'x'.repeat(41) },
    ],
    ['a ticket of the wrong shape', { type: 'livediagram:ticket', v: 1, ticket: 'short' }],
    ['a ticket that is not a string', { type: 'livediagram:ticket', v: 1, ticket: 42 }],
    ['a reveal with no refs', { type: 'livediagram:reveal', v: 1, refs: [] }],
    [
      'a reveal with too many refs',
      { type: 'livediagram:reveal', v: 1, refs: Array(21).fill('a') },
    ],
    ['a reveal with an empty ref', { type: 'livediagram:reveal', v: 1, refs: [''] }],
    ['a reveal with an overlong ref', { type: 'livediagram:reveal', v: 1, refs: ['x'.repeat(65)] }],
    ['a reveal whose refs are not a list', { type: 'livediagram:reveal', v: 1, refs: 'a' }],
    ['a reveal with a ref that is not a string', { type: 'livediagram:reveal', v: 1, refs: [1] }],
    ['a theme of another scheme', { type: 'livediagram:theme', v: 1, colourScheme: 'sepia' }],
  ])('names %s invalid', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });

  it.each([
    [
      'a ready with an unknown role',
      {
        type: 'livediagram:ready',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        tabName: 'n',
        role: 'admin',
      },
    ],
    [
      'a ready missing its tab',
      { type: 'livediagram:ready', v: 1, documentId: 'd', documentName: 'n', role: 'view' },
    ],
    ['a tab missing its name', { type: 'livediagram:tab', v: 1, tabId: 't' }],
    [
      'a selection with a fractional rev',
      {
        type: 'livediagram:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1.5,
        count: 0,
        reference: 'r',
      },
    ],
    [
      'a selection with a negative count',
      {
        type: 'livediagram:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1,
        count: -1,
        reference: 'r',
      },
    ],
    [
      'a selection with no reference',
      {
        type: 'livediagram:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1,
        count: 0,
      },
    ],
    ['an ended with another reason', { type: 'livediagram:ended', v: 1, reason: 'bored' }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });
});
