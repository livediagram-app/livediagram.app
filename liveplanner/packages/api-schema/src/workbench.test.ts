import { describe, expect, it } from 'vitest';
import {
  capWorkbenchRole,
  pairingCoversScope,
  workbenchAmbientHeaders,
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
    expect(isWorkbenchSessionFormat(`lwt_${'a'.repeat(43)}`)).toBe(false);
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
  const session = { scope: 'project' as const, projectId: 'doc1', ownerId: 'user_1' };
  const verdict = (method: string, path: string) =>
    workbenchRouteVerdict(method, ['api', ...path.split('/')], session);

  it.each([
    ['GET', 'capabilities'],
    ['GET', 'openapi.json'],
    ['GET', 'templates'],
    ['GET', 'templates/kanban'],
    ['GET', 'schema'],
    ['GET', 'schema/square'],
    ['GET', 'participants/user_1'],
    ['GET', 'preferences'],
    ['GET', 'custom-themes'],
    ['GET', 'projects/doc1'],
    ['PUT', 'projects/doc1'],
    ['GET', 'projects/doc1/tabs/t1'],
    ['PUT', 'projects/doc1/tabs/t1'],
    ['DELETE', 'projects/doc1/tabs/t1'],
    ['PUT', 'projects/doc1/tabs/t1/name'],
    ['POST', 'projects/doc1/tabs/t1/changesets'],
    ['POST', 'projects/doc1/changesets/cs_1/revert'],
    ['GET', 'projects/doc1/changesets'],
    ['GET', 'projects/doc1/changesets/cs_1'],
    ['GET', 'projects/doc1/comments'],
    ['GET', 'projects/doc1/tabs/t1/render.svg'],
    ['POST', 'projects/doc1/tabs/t1/comments'],
    ['POST', 'projects/doc1/tabs/t1/comments/c1/reply'],
    ['POST', 'projects/doc1/tabs/t1/comments/c1/resolve'],
    ['POST', 'projects/doc1/tabs/t1/comments/c1/reopen'],
    ['DELETE', 'projects/doc1/tabs/t1/comments/c1'],
    ['POST', 'projects/doc1/room-ticket'],
    ['GET', 'projects/doc1/items'],
    ['POST', 'projects/doc1/items'],
    ['POST', 'projects/doc1/items/bulk'],
    ['POST', 'projects/doc1/items/i1'],
    ['POST', 'projects/doc1/items/i1/move'],
    ['POST', 'projects/doc1/items/i1/vote'],
    ['POST', 'projects/doc1/items/i1/comments'],
    ['POST', 'projects/doc1/items/i1/comments/resolve'],
    ['POST', 'projects/doc1/items/i1/comments/reopen'],
    ['DELETE', 'projects/doc1/items/i1'],
    ['DELETE', 'projects/doc1/items/i1/comments/c1'],
    ['PUT', 'projects/doc1/item-types'],
    ['DELETE', 'workbench/sessions/current'],
  ])('allows %s %s', (method, path) => {
    expect(verdict(method, path)).toBe('allow');
  });

  it.each([
    ['DELETE', 'projects/doc1'],
    ['POST', 'projects/doc1/copy'],
    ['PUT', 'projects/doc1/folder'],
    ['GET', 'projects/doc1/shared-tabs'],
    ['GET', 'projects/doc1/share'],
    ['POST', 'projects/doc1/share'],
    ['PUT', 'projects/doc1/share-password'],
    ['DELETE', 'projects/doc1/share/abc'],
    ['PUT', 'projects/doc1/thumbnail'],
    ['POST', 'projects/doc1/tabs/t1/link'],
    ['PUT', 'projects/doc1/tabs/t1/presence'],
    ['GET', 'projects'],
    ['POST', 'projects'],
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
    ['POST', 'oauth'],
    ['PUT', 'preferences'],
    ['PUT', 'participants/user_1'],
    ['GET', 'participants/user_2'],
    ['POST', 'custom-themes'],
    ['POST', 'workbench/tickets'],
    ['POST', 'workbench/sessions'],
    ['GET', 'workbench/pairings'],
    ['PATCH', 'projects/doc1'],
  ])('confines %s %s', (method, path) => {
    expect(verdict(method, path)).toBe('confined');
  });

  it.each([
    ['GET', 'projects/doc2'],
    ['PUT', 'projects/doc2/tabs/t1'],
    ['GET', 'projects/doc2/share'],
    ['DELETE', 'projects/doc2'],
  ])('answers %s %s as another project', (method, path) => {
    expect(verdict(method, path)).toBe('other-project');
  });
});

describe('normaliseWorkbenchName', () => {
  it('trims a name and keeps it within the cap', () => {
    expect(normaliseWorkbenchName('  Acme Editor ')).toBe('Acme Editor');
    expect(normaliseWorkbenchName('x'.repeat(WORKBENCH_NAME_MAX_LENGTH))).toHaveLength(40);
  });

  it('refuses an empty, overlong or non-string name', () => {
    expect(normaliseWorkbenchName('   ')).toBeNull();
    expect(normaliseWorkbenchName('x'.repeat(WORKBENCH_NAME_MAX_LENGTH + 1))).toBeNull();
    expect(normaliseWorkbenchName(42)).toBeNull();
    expect(normaliseWorkbenchName(undefined)).toBeNull();
  });
});

describe('pairingCoversScope', () => {
  it('lets a workspace pairing through for both scopes, a project pairing for its own only', () => {
    expect(pairingCoversScope('workspace', 'workspace')).toBe(true);
    expect(pairingCoversScope('workspace', 'project')).toBe(true);
    expect(pairingCoversScope('project', 'project')).toBe(true);
    expect(pairingCoversScope('project', 'workspace')).toBe(false);
  });
});

describe('workbenchAmbientHeaders', () => {
  it('refuses every borrowed credential in the project scope, only the guest header in the workspace', () => {
    expect(workbenchAmbientHeaders('project')).toEqual([
      'X-Share-Code',
      'X-Owner-Id',
      'X-Share-Password',
    ]);
    expect(workbenchAmbientHeaders('workspace')).toEqual(['X-Owner-Id']);
  });
});

describe('workbenchRouteVerdict, workspace scope', () => {
  const session = { scope: 'workspace' as const, projectId: null, ownerId: 'user_1' };
  const verdict = (method: string, path: string) =>
    workbenchRouteVerdict(method, ['api', ...path.split('/')], session);

  it.each([
    ['GET', 'capabilities'],
    ['GET', 'openapi.json'],
    ['GET', 'templates/kanban'],
    ['GET', 'schema/square'],
    ['GET', 'preferences'],
    ['GET', 'participants/user_1'],
    ['GET', 'share/abc123'],
    ['GET', 'projects'],
    ['POST', 'projects'],
    ['GET', 'projects/any-doc'],
    ['PUT', 'projects/any-doc/tabs/t1'],
    ['DELETE', 'projects/any-doc'],
    ['POST', 'projects/any-doc/copy'],
    ['PUT', 'projects/any-doc/folder'],
    ['GET', 'projects/any-doc/share'],
    ['POST', 'projects/any-doc/share'],
    ['PUT', 'projects/any-doc/share-password'],
    ['POST', 'projects/any-doc/room-ticket'],
    ['POST', 'projects/any-doc/tabs/t1/link'],
    ['GET', 'folders'],
    ['POST', 'folders'],
    ['PUT', 'folders/f1'],
    ['DELETE', 'folders/f1'],
    ['GET', 'shared'],
    ['DELETE', 'shared/doc1'],
    ['PUT', 'favourites/doc1'],
    ['GET', 'tags'],
    ['GET', 'home'],
    ['GET', 'timeline'],
    ['GET', 'activity'],
    ['GET', 'trash'],
    ['POST', 'trash/doc1/restore'],
    ['GET', 'placement-defaults'],
    ['POST', 'custom-themes'],
    ['GET', 'teams'],
    ['GET', 'teams/team1'],
    ['GET', 'teams/team1/library'],
    ['GET', 'teams/team1/members'],
    ['DELETE', 'workbench/sessions/current'],
  ])('allows %s %s', (method, path) => {
    expect(verdict(method, path)).toBe('allow');
  });

  it.each([
    ['DELETE', 'account'],
    ['GET', 'account'],
    ['POST', 'migrate'],
    ['POST', 'guest-id'],
    ['GET', 'tokens'],
    ['DELETE', 'tokens/current'],
    ['GET', 'workbench/pairings'],
    ['DELETE', 'workbench/pairings/p1'],
    ['POST', 'workbench/tickets'],
    ['POST', 'workbench/sessions'],
    ['PUT', 'preferences'],
    ['PUT', 'participants/user_1'],
    ['GET', 'participants/user_2'],
    ['POST', 'ai'],
    ['POST', 'oauth'],
    ['POST', 'teams'],
    ['PUT', 'teams/team1'],
    ['GET', 'teams/invites'],
    ['POST', 'teams/team1/members'],
    ['GET', 'teams/team1/invite-link'],
    ['GET', 'teams/invite-link/tok'],
    ['PUT', 'projects/any-doc/tabs/t1/presence'],
    ['GET', 'forms/abc'],
    ['GET', 'telemetry'],
    ['PATCH', 'projects/any-doc'],
  ])('confines %s %s', (method, path) => {
    expect(verdict(method, path)).toBe('confined');
  });
});
