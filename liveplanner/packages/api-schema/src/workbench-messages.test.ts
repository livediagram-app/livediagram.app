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
      'liveplanner:hello',
      'liveplanner:hello-ack',
      'liveplanner:ready',
      'liveplanner:tab',
      'liveplanner:selection',
      'liveplanner:renew',
      'liveplanner:ticket',
      'liveplanner:reveal',
      'liveplanner:theme',
      'liveplanner:ended',
      'liveplanner:place',
      'liveplanner:open',
    ]);
  });
});

describe('parseWorkbenchMessage', () => {
  const valid: [WorkbenchMessageDirection, Record<string, unknown>][] = [
    ['to-workbench', { type: 'liveplanner:hello', v: 1 }],
    [
      'to-workbench',
      {
        type: 'liveplanner:ready',
        v: 1,
        projectId: 'doc-1',
        projectName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
        role: 'edit',
      },
    ],
    ['to-workbench', { type: 'liveplanner:tab', v: 1, tabId: 't1', tabName: 'Wireframe' }],
    [
      'to-workbench',
      {
        type: 'liveplanner:selection',
        v: 1,
        projectId: 'doc-1',
        projectName: 'Home screen',
        tabId: 't1',
        rev: 41,
        count: 0,
        reference: '[liveplanner] "Home screen"',
      },
    ],
    ['to-workbench', { type: 'liveplanner:renew', v: 1 }],
    ['to-workbench', { type: 'liveplanner:ended', v: 1, reason: 'revoked' }],
    ['to-page', { type: 'liveplanner:ticket', v: 1, ticket: TICKET }],
    ['to-page', { type: 'liveplanner:reveal', v: 1, refs: ['146b', 'e4a8'] }],
    ['to-page', { type: 'liveplanner:theme', v: 1, colourScheme: 'dark' }],
  ];

  it.each(valid)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it('accepts a hello-ack and trims its name', () => {
    expect(
      parseWorkbenchMessage(
        { type: 'liveplanner:hello-ack', v: 1, name: '  Acme Editor ' },
        'to-page',
      ),
    ).toEqual({ type: 'liveplanner:hello-ack', v: 1, name: 'Acme Editor' });
  });

  it.each([
    ['an unknown type', { type: 'liveplanner:dance', v: 1 }, 'liveplanner:dance'],
    [
      'another version',
      { type: 'liveplanner:theme', v: 2, colourScheme: 'dark' },
      'liveplanner:theme',
    ],
    ['a page message sent to the page', { type: 'liveplanner:renew', v: 1 }, 'liveplanner:renew'],
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
    ['a hello-ack with no name', { type: 'liveplanner:hello-ack', v: 1 }],
    ['a hello-ack with a blank name', { type: 'liveplanner:hello-ack', v: 1, name: '   ' }],
    [
      'a hello-ack with an overlong name',
      { type: 'liveplanner:hello-ack', v: 1, name: 'x'.repeat(41) },
    ],
    ['a ticket of the wrong shape', { type: 'liveplanner:ticket', v: 1, ticket: 'short' }],
    ['a ticket that is not a string', { type: 'liveplanner:ticket', v: 1, ticket: 42 }],
    ['a reveal with no refs', { type: 'liveplanner:reveal', v: 1, refs: [] }],
    [
      'a reveal with too many refs',
      { type: 'liveplanner:reveal', v: 1, refs: Array(21).fill('a') },
    ],
    ['a reveal with an empty ref', { type: 'liveplanner:reveal', v: 1, refs: [''] }],
    ['a reveal with an overlong ref', { type: 'liveplanner:reveal', v: 1, refs: ['x'.repeat(65)] }],
    ['a reveal whose refs are not a list', { type: 'liveplanner:reveal', v: 1, refs: 'a' }],
    ['a reveal with a ref that is not a string', { type: 'liveplanner:reveal', v: 1, refs: [1] }],
    ['a theme of another scheme', { type: 'liveplanner:theme', v: 1, colourScheme: 'sepia' }],
  ])('names %s invalid', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });

  it.each([
    [
      'a ready with an unknown role',
      {
        type: 'liveplanner:ready',
        v: 1,
        projectId: 'd',
        projectName: 'n',
        tabId: 't',
        tabName: 'n',
        role: 'admin',
      },
    ],
    [
      'a ready missing its tab',
      { type: 'liveplanner:ready', v: 1, projectId: 'd', projectName: 'n', role: 'view' },
    ],
    ['a tab missing its name', { type: 'liveplanner:tab', v: 1, tabId: 't' }],
    [
      'a selection with a fractional rev',
      {
        type: 'liveplanner:selection',
        v: 1,
        projectId: 'd',
        projectName: 'n',
        tabId: 't',
        rev: 1.5,
        count: 0,
        reference: 'r',
      },
    ],
    [
      'a selection with a negative count',
      {
        type: 'liveplanner:selection',
        v: 1,
        projectId: 'd',
        projectName: 'n',
        tabId: 't',
        rev: 1,
        count: -1,
        reference: 'r',
      },
    ],
    [
      'a selection with no reference',
      {
        type: 'liveplanner:selection',
        v: 1,
        projectId: 'd',
        projectName: 'n',
        tabId: 't',
        rev: 1,
        count: 0,
      },
    ],
    ['an ended with another reason', { type: 'liveplanner:ended', v: 1, reason: 'bored' }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });
});

describe('parseWorkbenchMessage, workspace scope', () => {
  const place = {
    type: 'liveplanner:place',
    v: 1,
    view: 'folder',
    folderId: 'f1',
    folderName: 'Minigames',
    projectCount: 0,
    projectId: null,
    projectName: null,
    tabId: null,
    tabName: null,
    role: 'edit',
  };

  it.each([
    ['to-workbench', { type: 'liveplanner:ready', v: 1, scope: 'workspace', role: 'view' }],
    ['to-workbench', place],
    [
      'to-workbench',
      {
        ...place,
        view: 'project',
        projectCount: null,
        projectId: 'doc-1',
        projectName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
      },
    ],
    ['to-page', { type: 'liveplanner:open', v: 1, to: { view: 'home' } }],
    ['to-page', { type: 'liveplanner:open', v: 1, to: { folderId: 'f1' } }],
    ['to-page', { type: 'liveplanner:open', v: 1, to: { projectId: 'doc-1' } }],
    ['to-page', { type: 'liveplanner:open', v: 1, to: { projectId: 'doc-1', tabId: 't1' } }],
  ] as const)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it.each([
    [
      'a workspace ready with an unknown role',
      { type: 'liveplanner:ready', v: 1, scope: 'workspace', role: 'admin' },
    ],
    [
      'a ready of another scope',
      { type: 'liveplanner:ready', v: 1, scope: 'galaxy', role: 'edit' },
    ],
    ['a place with no view', { ...place, view: '' }],
    ['a place with a fractional count', { ...place, projectCount: 1.5 }],
    ['a place with a numeric folder', { ...place, folderId: 7 }],
    ['a place missing its role', { ...place, role: undefined }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });

  it.each([
    ['an open with no target', { type: 'liveplanner:open', v: 1 }],
    ['an open to another view', { type: 'liveplanner:open', v: 1, to: { view: 'recent' } }],
    ['an open to an empty folder id', { type: 'liveplanner:open', v: 1, to: { folderId: '' } }],
    [
      'an open to an overlong project id',
      { type: 'liveplanner:open', v: 1, to: { projectId: 'x'.repeat(65) } },
    ],
    [
      'an open to a tab that is not a string',
      { type: 'liveplanner:open', v: 1, to: { projectId: 'd', tabId: 4 } },
    ],
  ])('names %s invalid at the page', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });
});
