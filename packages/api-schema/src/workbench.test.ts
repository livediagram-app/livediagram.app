import { describe, expect, it } from 'vitest';
import {
  capWorkbenchRole,
  isWorkbenchSessionFormat,
  normaliseWorkbenchName,
  parseWorkbenchOrigin,
  workbenchRouteVerdict,
  WORKBENCH_NAME_MAX_LENGTH,
  WORKBENCH_ORIGIN_MAX_LENGTH,
  WORKBENCH_SESSION_PREFIX,
} from './workbench';

describe('parseWorkbenchOrigin', () => {
  it.each([
    'https://example.com',
    'https://spinner.example.com:8443',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'http://[::1]:5175',
    'https://127.0.0.1:5175',
    'https://192.168.1.20:5175',
  ])('accepts %s', (input) => {
    const parsed = parseWorkbenchOrigin(input);
    expect(parsed).toEqual({ ok: true, origin: input });
  });

  it.each([
    ['a wildcard', '*'],
    ['the null origin', 'null'],
    ['an empty string', ''],
    ['a path', 'https://example.com/app'],
    ['a trailing slash', 'https://example.com/'],
    ['a query', 'https://example.com?x=1'],
    ['a fragment', 'https://example.com#x'],
    ['credentials', 'https://user:pw@example.com'],
    ['http on a public host', 'http://example.com'],
    ['http on a LAN address', 'http://192.168.1.20:5175'],
    ['a default port written out', 'https://example.com:443'],
    ['upper case the browser would lower', 'https://Example.com'],
    ['another scheme', 'vscode-webview://abc'],
    ['a file URL', 'file:///tmp/x'],
    ['no scheme', 'example.com'],
    ['surrounding space', ' https://example.com'],
  ])('refuses %s', (_why, input) => {
    expect(parseWorkbenchOrigin(input)).toEqual({ ok: false });
  });

  it('refuses an origin longer than the cap', () => {
    const host = `${'a'.repeat(WORKBENCH_ORIGIN_MAX_LENGTH)}.com`;
    expect(parseWorkbenchOrigin(`https://${host}`)).toEqual({ ok: false });
  });
});

describe('isWorkbenchSessionFormat', () => {
  it('tells an lvw_ session from a token and from a malformed one', () => {
    expect(isWorkbenchSessionFormat(`${WORKBENCH_SESSION_PREFIX}${'a'.repeat(43)}`)).toBe(true);
    expect(isWorkbenchSessionFormat(`lvd_${'a'.repeat(43)}`)).toBe(false);
    expect(isWorkbenchSessionFormat(`${WORKBENCH_SESSION_PREFIX}${'a'.repeat(42)}`)).toBe(false);
    expect(isWorkbenchSessionFormat(`${WORKBENCH_SESSION_PREFIX}${'a'.repeat(42)}!`)).toBe(false);
  });
});

describe('capWorkbenchRole', () => {
  it('takes the lower of the two on the ladder', () => {
    expect(capWorkbenchRole('edit', 'view')).toBe('view');
    expect(capWorkbenchRole('view', 'edit')).toBe('view');
    expect(capWorkbenchRole('edit', 'participate')).toBe('participate');
    expect(capWorkbenchRole('edit', 'edit')).toBe('edit');
  });

  it('gives the role itself without a ceiling', () => {
    expect(capWorkbenchRole('edit')).toBe('edit');
    expect(capWorkbenchRole('view', undefined)).toBe('view');
  });
});

describe('workbenchRouteVerdict', () => {
  const session = { documentId: 'doc1', ownerId: 'user_1' };
  const verdict = (method: string, path: string) =>
    workbenchRouteVerdict(method, ['api', ...path.split('/')], session);

  it.each([
    ['GET', 'capabilities'],
    ['GET', 'openapi.json'],
    ['GET', 'templates'],
    ['GET', 'templates/kanban'],
    ['GET', 'icons'],
    ['GET', 'schema'],
    ['GET', 'schema/square'],
    ['GET', 'participants/user_1'],
    ['GET', 'preferences'],
    ['GET', 'custom-themes'],
    ['GET', 'shape-libraries'],
    ['POST', 'images'],
    ['GET', 'images/img1'],
    ['GET', 'documents/doc1'],
    ['PUT', 'documents/doc1'],
    ['GET', 'documents/doc1/tabs/t1'],
    ['PUT', 'documents/doc1/tabs/t1'],
    ['DELETE', 'documents/doc1/tabs/t1'],
    ['PUT', 'documents/doc1/tabs/t1/name'],
    ['POST', 'documents/doc1/tabs/t1/changesets'],
    ['POST', 'documents/doc1/changesets/cs_1/revert'],
    ['GET', 'documents/doc1/changesets'],
    ['GET', 'documents/doc1/changesets/cs_1'],
    ['GET', 'documents/doc1/comments'],
    ['GET', 'documents/doc1/tabs/t1/render.svg'],
    ['GET', 'documents/doc1/tabs/t1/comment-pictures'],
    ['POST', 'documents/doc1/tabs/t1/comments'],
    ['POST', 'documents/doc1/tabs/t1/comments/c1/reply'],
    ['POST', 'documents/doc1/tabs/t1/comments/c1/resolve'],
    ['POST', 'documents/doc1/tabs/t1/comments/c1/reopen'],
    ['DELETE', 'documents/doc1/tabs/t1/comments/c1'],
    ['POST', 'documents/doc1/tabs/t1/qa'],
    ['POST', 'documents/doc1/room-ticket'],
    ['GET', 'documents/doc1/items'],
    ['POST', 'documents/doc1/items'],
    ['POST', 'documents/doc1/items/bulk'],
    ['POST', 'documents/doc1/items/i1'],
    ['POST', 'documents/doc1/items/i1/move'],
    ['POST', 'documents/doc1/items/i1/vote'],
    ['POST', 'documents/doc1/items/i1/comments'],
    ['POST', 'documents/doc1/items/i1/comments/resolve'],
    ['POST', 'documents/doc1/items/i1/comments/reopen'],
    ['DELETE', 'documents/doc1/items/i1'],
    ['DELETE', 'documents/doc1/items/i1/comments/c1'],
    ['PUT', 'documents/doc1/item-types'],
    ['DELETE', 'workbench/sessions/current'],
  ])('allows %s %s', (method, path) => {
    expect(verdict(method, path)).toBe('allow');
  });

  it.each([
    ['DELETE', 'documents/doc1'],
    ['POST', 'documents/doc1/copy'],
    ['PUT', 'documents/doc1/folder'],
    ['GET', 'documents/doc1/shared-tabs'],
    ['GET', 'documents/doc1/share'],
    ['POST', 'documents/doc1/share'],
    ['PUT', 'documents/doc1/share-password'],
    ['DELETE', 'documents/doc1/share/abc'],
    ['POST', 'documents/doc1/community'],
    ['PUT', 'documents/doc1/thumbnail'],
    ['POST', 'documents/doc1/tabs/t1/link'],
    ['PUT', 'documents/doc1/tabs/t1/presence'],
    ['GET', 'documents'],
    ['POST', 'documents'],
    ['GET', 'folders'],
    ['GET', 'shared'],
    ['GET', 'favourites'],
    ['GET', 'home'],
    ['GET', 'timeline'],
    ['GET', 'activity'],
    ['GET', 'trash'],
    ['GET', 'placement-defaults'],
    ['GET', 'tokens'],
    ['GET', 'teams'],
    ['DELETE', 'account'],
    ['POST', 'migrate'],
    ['POST', 'guest-id'],
    ['POST', 'ai'],
    ['GET', 'drive'],
    ['POST', 'oauth'],
    ['PUT', 'preferences'],
    ['PUT', 'participants/user_1'],
    ['GET', 'participants/user_2'],
    ['POST', 'custom-themes'],
    ['POST', 'shape-libraries'],
    ['DELETE', 'images/img1'],
    ['GET', 'images/usage'],
    ['GET', 'images'],
    ['POST', 'workbench/tickets'],
    ['POST', 'workbench/sessions'],
    ['GET', 'workbench/pairings'],
    ['PATCH', 'documents/doc1'],
  ])('confines %s %s', (method, path) => {
    expect(verdict(method, path)).toBe('confined');
  });

  it.each([
    ['GET', 'documents/doc2'],
    ['PUT', 'documents/doc2/tabs/t1'],
    ['GET', 'documents/doc2/share'],
    ['DELETE', 'documents/doc2'],
  ])('answers %s %s as another document', (method, path) => {
    expect(verdict(method, path)).toBe('other-document');
  });
});

describe('normaliseWorkbenchName', () => {
  it('trims a name and keeps it within the cap', () => {
    expect(normaliseWorkbenchName('  Spinner ')).toBe('Spinner');
    expect(normaliseWorkbenchName('x'.repeat(WORKBENCH_NAME_MAX_LENGTH))).toHaveLength(40);
  });

  it('refuses an empty, overlong or non-string name', () => {
    expect(normaliseWorkbenchName('   ')).toBeNull();
    expect(normaliseWorkbenchName('x'.repeat(WORKBENCH_NAME_MAX_LENGTH + 1))).toBeNull();
    expect(normaliseWorkbenchName(42)).toBeNull();
    expect(normaliseWorkbenchName(undefined)).toBeNull();
  });
});
