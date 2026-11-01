import { describe, expect, it } from 'vitest';
import {
  parseWorkbenchMessage,
  WORKBENCH_MESSAGE_TYPES,
  type WorkbenchMessageDirection,
} from './workbench-messages';

const TICKET = 'A'.repeat(21) + '_.' + '0f'.repeat(32);

describe('WORKBENCH_MESSAGE_TYPES', () => {
  it('holds the twelve types of the spec', () => {
    expect(WORKBENCH_MESSAGE_TYPES).toEqual([
      'livehuddle:hello',
      'livehuddle:hello-ack',
      'livehuddle:ready',
      'livehuddle:tab',
      'livehuddle:selection',
      'livehuddle:renew',
      'livehuddle:ticket',
      'livehuddle:reveal',
      'livehuddle:theme',
      'livehuddle:ended',
      'livehuddle:place',
      'livehuddle:open',
    ]);
  });
});

describe('parseWorkbenchMessage', () => {
  const valid: [WorkbenchMessageDirection, Record<string, unknown>][] = [
    ['to-workbench', { type: 'livehuddle:hello', v: 1 }],
    [
      'to-workbench',
      {
        type: 'livehuddle:ready',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
        role: 'edit',
      },
    ],
    ['to-workbench', { type: 'livehuddle:tab', v: 1, tabId: 't1', tabName: 'Wireframe' }],
    [
      'to-workbench',
      {
        type: 'livehuddle:selection',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        rev: 41,
        count: 0,
        reference: '[livehuddle] "Home screen"',
      },
    ],
    ['to-workbench', { type: 'livehuddle:renew', v: 1 }],
    ['to-workbench', { type: 'livehuddle:ended', v: 1, reason: 'revoked' }],
    ['to-page', { type: 'livehuddle:ticket', v: 1, ticket: TICKET }],
    ['to-page', { type: 'livehuddle:reveal', v: 1, refs: ['146b', 'e4a8'] }],
    ['to-page', { type: 'livehuddle:theme', v: 1, colourScheme: 'dark' }],
  ];

  it.each(valid)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it('accepts a hello-ack and trims its name', () => {
    expect(
      parseWorkbenchMessage(
        { type: 'livehuddle:hello-ack', v: 1, name: '  Acme Editor ' },
        'to-page',
      ),
    ).toEqual({ type: 'livehuddle:hello-ack', v: 1, name: 'Acme Editor' });
  });

  it.each([
    ['an unknown type', { type: 'livehuddle:dance', v: 1 }, 'livehuddle:dance'],
    [
      'another version',
      { type: 'livehuddle:theme', v: 2, colourScheme: 'dark' },
      'livehuddle:theme',
    ],
    ['a page message sent to the page', { type: 'livehuddle:renew', v: 1 }, 'livehuddle:renew'],
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
    ['a hello-ack with no name', { type: 'livehuddle:hello-ack', v: 1 }],
    ['a hello-ack with a blank name', { type: 'livehuddle:hello-ack', v: 1, name: '   ' }],
    [
      'a hello-ack with an overlong name',
      { type: 'livehuddle:hello-ack', v: 1, name: 'x'.repeat(41) },
    ],
    ['a ticket of the wrong shape', { type: 'livehuddle:ticket', v: 1, ticket: 'short' }],
    ['a ticket that is not a string', { type: 'livehuddle:ticket', v: 1, ticket: 42 }],
    ['a reveal with no refs', { type: 'livehuddle:reveal', v: 1, refs: [] }],
    ['a reveal with too many refs', { type: 'livehuddle:reveal', v: 1, refs: Array(21).fill('a') }],
    ['a reveal with an empty ref', { type: 'livehuddle:reveal', v: 1, refs: [''] }],
    ['a reveal with an overlong ref', { type: 'livehuddle:reveal', v: 1, refs: ['x'.repeat(65)] }],
    ['a reveal whose refs are not a list', { type: 'livehuddle:reveal', v: 1, refs: 'a' }],
    ['a reveal with a ref that is not a string', { type: 'livehuddle:reveal', v: 1, refs: [1] }],
    ['a theme of another scheme', { type: 'livehuddle:theme', v: 1, colourScheme: 'sepia' }],
  ])('names %s invalid', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });

  it.each([
    [
      'a ready with an unknown role',
      {
        type: 'livehuddle:ready',
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
      { type: 'livehuddle:ready', v: 1, documentId: 'd', documentName: 'n', role: 'view' },
    ],
    ['a tab missing its name', { type: 'livehuddle:tab', v: 1, tabId: 't' }],
    [
      'a selection with a fractional rev',
      {
        type: 'livehuddle:selection',
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
        type: 'livehuddle:selection',
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
        type: 'livehuddle:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1,
        count: 0,
      },
    ],
    ['an ended with another reason', { type: 'livehuddle:ended', v: 1, reason: 'bored' }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });
});

describe('parseWorkbenchMessage, workspace scope', () => {
  const place = {
    type: 'livehuddle:place',
    v: 1,
    view: 'folder',
    folderId: 'f1',
    folderName: 'Minigames',
    documentCount: 0,
    documentId: null,
    documentName: null,
    tabId: null,
    tabName: null,
    role: 'edit',
  };

  it.each([
    ['to-workbench', { type: 'livehuddle:ready', v: 1, scope: 'workspace', role: 'view' }],
    ['to-workbench', place],
    [
      'to-workbench',
      {
        ...place,
        view: 'document',
        documentCount: null,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
      },
    ],
    ['to-page', { type: 'livehuddle:open', v: 1, to: { view: 'home' } }],
    ['to-page', { type: 'livehuddle:open', v: 1, to: { folderId: 'f1' } }],
    ['to-page', { type: 'livehuddle:open', v: 1, to: { documentId: 'doc-1' } }],
    ['to-page', { type: 'livehuddle:open', v: 1, to: { documentId: 'doc-1', tabId: 't1' } }],
  ] as const)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it.each([
    [
      'a workspace ready with an unknown role',
      { type: 'livehuddle:ready', v: 1, scope: 'workspace', role: 'admin' },
    ],
    ['a ready of another scope', { type: 'livehuddle:ready', v: 1, scope: 'galaxy', role: 'edit' }],
    ['a place with no view', { ...place, view: '' }],
    ['a place with a fractional count', { ...place, documentCount: 1.5 }],
    ['a place with a numeric folder', { ...place, folderId: 7 }],
    ['a place missing its role', { ...place, role: undefined }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });

  it.each([
    ['an open with no target', { type: 'livehuddle:open', v: 1 }],
    ['an open to another view', { type: 'livehuddle:open', v: 1, to: { view: 'recent' } }],
    ['an open to an empty folder id', { type: 'livehuddle:open', v: 1, to: { folderId: '' } }],
    [
      'an open to an overlong document id',
      { type: 'livehuddle:open', v: 1, to: { documentId: 'x'.repeat(65) } },
    ],
    [
      'an open to a tab that is not a string',
      { type: 'livehuddle:open', v: 1, to: { documentId: 'd', tabId: 4 } },
    ],
  ])('names %s invalid at the page', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });
});
