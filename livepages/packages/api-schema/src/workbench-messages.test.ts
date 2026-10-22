import { describe, expect, it } from 'vitest';
import {
  parseWorkbenchMessage,
  WORKBENCH_MESSAGE_TYPES,
  type WorkbenchMessageDirection,
} from './workbench-messages';

const TICKET = 'A'.repeat(21) + '_';

describe('WORKBENCH_MESSAGE_TYPES', () => {
  it('holds the twelve types of the spec', () => {
    expect(WORKBENCH_MESSAGE_TYPES).toEqual([
      'livepages:hello',
      'livepages:hello-ack',
      'livepages:ready',
      'livepages:tab',
      'livepages:selection',
      'livepages:renew',
      'livepages:ticket',
      'livepages:reveal',
      'livepages:theme',
      'livepages:ended',
      'livepages:place',
      'livepages:open',
    ]);
  });
});

describe('parseWorkbenchMessage', () => {
  const valid: [WorkbenchMessageDirection, Record<string, unknown>][] = [
    ['to-workbench', { type: 'livepages:hello', v: 1 }],
    [
      'to-workbench',
      {
        type: 'livepages:ready',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
        role: 'edit',
      },
    ],
    ['to-workbench', { type: 'livepages:tab', v: 1, tabId: 't1', tabName: 'Wireframe' }],
    [
      'to-workbench',
      {
        type: 'livepages:selection',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        rev: 41,
        count: 0,
        reference: '[livepages] "Home screen"',
      },
    ],
    ['to-workbench', { type: 'livepages:renew', v: 1 }],
    ['to-workbench', { type: 'livepages:ended', v: 1, reason: 'revoked' }],
    ['to-page', { type: 'livepages:ticket', v: 1, ticket: TICKET }],
    ['to-page', { type: 'livepages:reveal', v: 1, refs: ['146b', 'e4a8'] }],
    ['to-page', { type: 'livepages:theme', v: 1, colourScheme: 'dark' }],
  ];

  it.each(valid)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it('accepts a hello-ack and trims its name', () => {
    expect(
      parseWorkbenchMessage(
        { type: 'livepages:hello-ack', v: 1, name: '  Acme Editor ' },
        'to-page',
      ),
    ).toEqual({ type: 'livepages:hello-ack', v: 1, name: 'Acme Editor' });
  });

  it.each([
    ['an unknown type', { type: 'livepages:dance', v: 1 }, 'livepages:dance'],
    [
      'another version',
      { type: 'livepages:theme', v: 2, colourScheme: 'dark' },
      'livepages:theme',
    ],
    ['a page message sent to the page', { type: 'livepages:renew', v: 1 }, 'livepages:renew'],
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
    ['a hello-ack with no name', { type: 'livepages:hello-ack', v: 1 }],
    ['a hello-ack with a blank name', { type: 'livepages:hello-ack', v: 1, name: '   ' }],
    [
      'a hello-ack with an overlong name',
      { type: 'livepages:hello-ack', v: 1, name: 'x'.repeat(41) },
    ],
    ['a ticket of the wrong shape', { type: 'livepages:ticket', v: 1, ticket: 'short' }],
    ['a ticket that is not a string', { type: 'livepages:ticket', v: 1, ticket: 42 }],
    ['a reveal with no refs', { type: 'livepages:reveal', v: 1, refs: [] }],
    [
      'a reveal with too many refs',
      { type: 'livepages:reveal', v: 1, refs: Array(21).fill('a') },
    ],
    ['a reveal with an empty ref', { type: 'livepages:reveal', v: 1, refs: [''] }],
    ['a reveal with an overlong ref', { type: 'livepages:reveal', v: 1, refs: ['x'.repeat(65)] }],
    ['a reveal whose refs are not a list', { type: 'livepages:reveal', v: 1, refs: 'a' }],
    ['a reveal with a ref that is not a string', { type: 'livepages:reveal', v: 1, refs: [1] }],
    ['a theme of another scheme', { type: 'livepages:theme', v: 1, colourScheme: 'sepia' }],
  ])('names %s invalid', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });

  it.each([
    [
      'a ready with an unknown role',
      {
        type: 'livepages:ready',
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
      { type: 'livepages:ready', v: 1, documentId: 'd', documentName: 'n', role: 'view' },
    ],
    ['a tab missing its name', { type: 'livepages:tab', v: 1, tabId: 't' }],
    [
      'a selection with a fractional rev',
      {
        type: 'livepages:selection',
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
        type: 'livepages:selection',
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
        type: 'livepages:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1,
        count: 0,
      },
    ],
    ['an ended with another reason', { type: 'livepages:ended', v: 1, reason: 'bored' }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });
});

describe('parseWorkbenchMessage, workspace scope', () => {
  const place = {
    type: 'livepages:place',
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
    ['to-workbench', { type: 'livepages:ready', v: 1, scope: 'workspace', role: 'view' }],
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
    ['to-page', { type: 'livepages:open', v: 1, to: { view: 'home' } }],
    ['to-page', { type: 'livepages:open', v: 1, to: { folderId: 'f1' } }],
    ['to-page', { type: 'livepages:open', v: 1, to: { documentId: 'doc-1' } }],
    ['to-page', { type: 'livepages:open', v: 1, to: { documentId: 'doc-1', tabId: 't1' } }],
  ] as const)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it.each([
    [
      'a workspace ready with an unknown role',
      { type: 'livepages:ready', v: 1, scope: 'workspace', role: 'admin' },
    ],
    [
      'a ready of another scope',
      { type: 'livepages:ready', v: 1, scope: 'galaxy', role: 'edit' },
    ],
    ['a place with no view', { ...place, view: '' }],
    ['a place with a fractional count', { ...place, documentCount: 1.5 }],
    ['a place with a numeric folder', { ...place, folderId: 7 }],
    ['a place missing its role', { ...place, role: undefined }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });

  it.each([
    ['an open with no target', { type: 'livepages:open', v: 1 }],
    ['an open to another view', { type: 'livepages:open', v: 1, to: { view: 'recent' } }],
    ['an open to an empty folder id', { type: 'livepages:open', v: 1, to: { folderId: '' } }],
    [
      'an open to an overlong document id',
      { type: 'livepages:open', v: 1, to: { documentId: 'x'.repeat(65) } },
    ],
    [
      'an open to a tab that is not a string',
      { type: 'livepages:open', v: 1, to: { documentId: 'd', tabId: 4 } },
    ],
  ])('names %s invalid at the page', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });
});
