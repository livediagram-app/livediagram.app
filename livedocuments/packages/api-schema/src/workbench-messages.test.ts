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
      'livedocuments:hello',
      'livedocuments:hello-ack',
      'livedocuments:ready',
      'livedocuments:tab',
      'livedocuments:selection',
      'livedocuments:renew',
      'livedocuments:ticket',
      'livedocuments:reveal',
      'livedocuments:theme',
      'livedocuments:ended',
      'livedocuments:place',
      'livedocuments:open',
    ]);
  });
});

describe('parseWorkbenchMessage', () => {
  const valid: [WorkbenchMessageDirection, Record<string, unknown>][] = [
    ['to-workbench', { type: 'livedocuments:hello', v: 1 }],
    [
      'to-workbench',
      {
        type: 'livedocuments:ready',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
        role: 'edit',
      },
    ],
    ['to-workbench', { type: 'livedocuments:tab', v: 1, tabId: 't1', tabName: 'Wireframe' }],
    [
      'to-workbench',
      {
        type: 'livedocuments:selection',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        rev: 41,
        count: 0,
        reference: '[livedocuments] "Home screen"',
      },
    ],
    ['to-workbench', { type: 'livedocuments:renew', v: 1 }],
    ['to-workbench', { type: 'livedocuments:ended', v: 1, reason: 'revoked' }],
    ['to-page', { type: 'livedocuments:ticket', v: 1, ticket: TICKET }],
    ['to-page', { type: 'livedocuments:reveal', v: 1, refs: ['146b', 'e4a8'] }],
    ['to-page', { type: 'livedocuments:theme', v: 1, colourScheme: 'dark' }],
  ];

  it.each(valid)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it('accepts a hello-ack and trims its name', () => {
    expect(
      parseWorkbenchMessage(
        { type: 'livedocuments:hello-ack', v: 1, name: '  Acme Editor ' },
        'to-page',
      ),
    ).toEqual({ type: 'livedocuments:hello-ack', v: 1, name: 'Acme Editor' });
  });

  it.each([
    ['an unknown type', { type: 'livedocuments:dance', v: 1 }, 'livedocuments:dance'],
    [
      'another version',
      { type: 'livedocuments:theme', v: 2, colourScheme: 'dark' },
      'livedocuments:theme',
    ],
    ['a page message sent to the page', { type: 'livedocuments:renew', v: 1 }, 'livedocuments:renew'],
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
    ['a hello-ack with no name', { type: 'livedocuments:hello-ack', v: 1 }],
    ['a hello-ack with a blank name', { type: 'livedocuments:hello-ack', v: 1, name: '   ' }],
    [
      'a hello-ack with an overlong name',
      { type: 'livedocuments:hello-ack', v: 1, name: 'x'.repeat(41) },
    ],
    ['a ticket of the wrong shape', { type: 'livedocuments:ticket', v: 1, ticket: 'short' }],
    ['a ticket that is not a string', { type: 'livedocuments:ticket', v: 1, ticket: 42 }],
    ['a reveal with no refs', { type: 'livedocuments:reveal', v: 1, refs: [] }],
    [
      'a reveal with too many refs',
      { type: 'livedocuments:reveal', v: 1, refs: Array(21).fill('a') },
    ],
    ['a reveal with an empty ref', { type: 'livedocuments:reveal', v: 1, refs: [''] }],
    ['a reveal with an overlong ref', { type: 'livedocuments:reveal', v: 1, refs: ['x'.repeat(65)] }],
    ['a reveal whose refs are not a list', { type: 'livedocuments:reveal', v: 1, refs: 'a' }],
    ['a reveal with a ref that is not a string', { type: 'livedocuments:reveal', v: 1, refs: [1] }],
    ['a theme of another scheme', { type: 'livedocuments:theme', v: 1, colourScheme: 'sepia' }],
  ])('names %s invalid', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });

  it.each([
    [
      'a ready with an unknown role',
      {
        type: 'livedocuments:ready',
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
      { type: 'livedocuments:ready', v: 1, documentId: 'd', documentName: 'n', role: 'view' },
    ],
    ['a tab missing its name', { type: 'livedocuments:tab', v: 1, tabId: 't' }],
    [
      'a selection with a fractional rev',
      {
        type: 'livedocuments:selection',
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
        type: 'livedocuments:selection',
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
        type: 'livedocuments:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1,
        count: 0,
      },
    ],
    ['an ended with another reason', { type: 'livedocuments:ended', v: 1, reason: 'bored' }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });
});

describe('parseWorkbenchMessage, workspace scope', () => {
  const place = {
    type: 'livedocuments:place',
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
    ['to-workbench', { type: 'livedocuments:ready', v: 1, scope: 'workspace', role: 'view' }],
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
    ['to-page', { type: 'livedocuments:open', v: 1, to: { view: 'home' } }],
    ['to-page', { type: 'livedocuments:open', v: 1, to: { folderId: 'f1' } }],
    ['to-page', { type: 'livedocuments:open', v: 1, to: { documentId: 'doc-1' } }],
    ['to-page', { type: 'livedocuments:open', v: 1, to: { documentId: 'doc-1', tabId: 't1' } }],
  ] as const)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it.each([
    [
      'a workspace ready with an unknown role',
      { type: 'livedocuments:ready', v: 1, scope: 'workspace', role: 'admin' },
    ],
    [
      'a ready of another scope',
      { type: 'livedocuments:ready', v: 1, scope: 'galaxy', role: 'edit' },
    ],
    ['a place with no view', { ...place, view: '' }],
    ['a place with a fractional count', { ...place, documentCount: 1.5 }],
    ['a place with a numeric folder', { ...place, folderId: 7 }],
    ['a place missing its role', { ...place, role: undefined }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });

  it.each([
    ['an open with no target', { type: 'livedocuments:open', v: 1 }],
    ['an open to another view', { type: 'livedocuments:open', v: 1, to: { view: 'recent' } }],
    ['an open to an empty folder id', { type: 'livedocuments:open', v: 1, to: { folderId: '' } }],
    [
      'an open to an overlong document id',
      { type: 'livedocuments:open', v: 1, to: { documentId: 'x'.repeat(65) } },
    ],
    [
      'an open to a tab that is not a string',
      { type: 'livedocuments:open', v: 1, to: { documentId: 'd', tabId: 4 } },
    ],
  ])('names %s invalid at the page', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });
});
