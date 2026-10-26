import { describe, expect, it } from 'vitest';
import type { DriveResult } from '@liveworkspace/drive/client';
import type { DriveConnectAnswer, DriveOpenAnswer } from '@liveworkspace/drive';
import {
  connectedQuery,
  connectedView,
  defaultReturn,
  importFailedBody,
  openView,
  planConnected,
  rememberConsent,
  safeReturn,
  switchOutcome,
  takeConsent,
} from './pages';

// liveworkspace's three Drive pages (liveworkspace/docs/specs/005-drive/drive.md "Connecting", "Open with").
const LW = 'https://lw.test';
const EXPLORER = `${LW}/explorer?settings=profile&section=cloud-sync`;
const ours = (url: URL) => url.origin === LW || url.host === 'liveplanner.app';
const ok = <T>(data: T): DriveResult<T> => ({ ok: true, data });
const refused = <T>(status: number, error: string): DriveResult<T> =>
  ({ ok: false, status, error }) as DriveResult<T>;

function memory(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('where a connect comes back to', () => {
  it('is liveworkspace’s Explorer on Cloud Sync by default', () => {
    expect(defaultReturn(LW)).toBe(EXPLORER);
  });

  it('keeps a page of liveworkspace or an app, and refuses anything else', () => {
    expect(safeReturn('https://liveplanner.app/project/p?settings=account', LW, ours)).toBe(
      'https://liveplanner.app/project/p?settings=account',
    );
    expect(safeReturn('/explorer/recent', LW, ours)).toBe(`${LW}/explorer/recent`);
    expect(safeReturn('https://evil.example/x', LW, ours)).toBe(EXPLORER);
    expect(safeReturn('javascript:alert(1)', LW, ours)).toBe(EXPLORER);
    expect(safeReturn(null, LW, ours)).toBe(EXPLORER);
    // Never the connect pages themselves; Open with's own page, so Allow access comes back to the file.
    expect(safeReturn(`${LW}/drive/connected?code=x`, LW, ours)).toBe(EXPLORER);
    expect(safeReturn(`${LW}/drive/open?state=s`, LW, ours)).toBe(`${LW}/drive/open?state=s`);
  });

  it('is kept against the state issued, once', () => {
    const storage = memory();
    const session = () => storage;
    rememberConsent(session, 'st1', 'https://liveplanner.app/p');
    expect(takeConsent(session, 'other')).toBeNull();
    rememberConsent(session, 'st1', 'https://liveplanner.app/p');
    expect(takeConsent(session, 'st1')).toBe('https://liveplanner.app/p');
    expect(takeConsent(session, 'st1')).toBeNull();
  });

  it('carries on when the tab has no storage at all (site data blocked)', () => {
    // Reading `window.sessionStorage` itself throws then, before any getItem.
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    expect(() => rememberConsent(blocked, 'st1', 'https://liveplanner.app/p')).not.toThrow();
    expect(takeConsent(blocked, 'st1')).toBeNull();
  });
});

describe('/drive/connected', () => {
  const query = (search: string) => connectedQuery(search);

  it('goes back calmly after a cancel at Google, to the page it came from', () => {
    expect(
      planConnected(query('?error=access_denied&state=st1'), 'https://liveplanner.app/p', LW),
    ).toEqual({
      kind: 'leave',
      to: 'https://liveplanner.app/p?drive=cancelled',
    });
    // A cancel this tab didn't start: Cloud Sync on liveworkspace.
    expect(planConnected(query('?error=access_denied'), null, LW)).toEqual({
      kind: 'leave',
      to: `${EXPLORER}&drive=cancelled`,
    });
  });

  it('redeems a code with its state, and stops on an address with neither', () => {
    expect(planConnected(query('?code=c1&state=st1'), null, LW)).toEqual({
      kind: 'redeem',
      code: 'c1',
      state: 'st1',
    });
    expect(planConnected(query('?code=c1'), null, LW)).toEqual({ kind: 'invalid' });
    expect(planConnected(query(''), null, LW)).toEqual({ kind: 'invalid' });
  });

  it('sends a connection back to its return page, saying so', () => {
    const answer = ok<DriveConnectAnswer>({
      outcome: 'connected',
      returnTo: 'https://liveplanner.app/p?a=1',
    });
    expect(connectedView(answer, EXPLORER)).toEqual({
      kind: 'leave',
      to: 'https://liveplanner.app/p?a=1&drive=connected',
    });
  });

  it('asks Switch Google Account? for a consent from another account', () => {
    const answer = ok<DriveConnectAnswer>({
      outcome: 'switch_pending',
      returnTo: `${LW}/x`,
      until: 5,
    });
    expect(connectedView(answer, EXPLORER)).toEqual({
      kind: 'switch',
      returnTo: `${LW}/x`,
      until: 5,
    });
  });

  it('says why a connection failed, with the way back', () => {
    expect(
      connectedView(
        ok<DriveConnectAnswer>({ outcome: 'no_refresh_token', returnTo: `${LW}/x` }),
        EXPLORER,
      ),
    ).toEqual({ kind: 'failed', reason: 'no_refresh_token', returnTo: `${LW}/x` });
    expect(connectedView(refused(400, 'invalid_state'), EXPLORER)).toMatchObject({
      reason: 'invalid_state',
      returnTo: EXPLORER,
    });
    expect(connectedView(refused(502, 'google_failed'), EXPLORER)).toMatchObject({
      reason: 'refused',
    });
    expect(connectedView(refused(0, 'offline'), EXPLORER)).toMatchObject({ reason: 'offline' });
  });

  it('reads a switch answered after its 30 minutes as expired', () => {
    expect(switchOutcome(ok(undefined))).toBe('done');
    expect(switchOutcome(refused(409, 'failed'))).toBe('expired');
    expect(switchOutcome(refused(404, 'not_found'))).toBe('expired');
    expect(switchOutcome(refused(500, 'failed'))).toBe('failed');
    expect(switchOutcome(refused(0, 'offline'))).toBe('failed');
  });
});

describe('/drive/open', () => {
  it('opens the person’s own item in its app', () => {
    const answer = ok<DriveOpenAnswer>({
      action: 'open',
      app: 'liveplanner',
      itemId: 'p1',
      url: 'https://liveplanner.app/project/p1',
    });
    expect(openView(answer)).toEqual({ kind: 'go', to: 'https://liveplanner.app/project/p1' });
  });

  it('offers Import as a copy, saying when it is a copy made in Drive', () => {
    expect(
      openView(
        ok<DriveOpenAnswer>({ action: 'import', app: 'livediagram', name: 'Flow', reason: 'copy' }),
      ),
    ).toEqual({ kind: 'import', app: 'livediagram', name: 'Flow', copy: true });
    expect(
      openView(
        ok<DriveOpenAnswer>({
          action: 'import',
          app: 'livediagram',
          name: 'Flow',
          reason: 'shared',
        }),
      ),
    ).toMatchObject({ copy: false });
  });

  it('offers Allow access without a usable connection', () => {
    expect(openView(ok<DriveOpenAnswer>({ action: 'allow_access' }))).toEqual({
      kind: 'allow_access',
    });
    expect(openView(refused(409, 'not_connected'))).toEqual({ kind: 'allow_access' });
    expect(openView(refused(409, 'needs_reconnect'))).toEqual({ kind: 'allow_access' });
  });

  it('says a file isn’t ours, and a failure is only a failure', () => {
    expect(openView(ok<DriveOpenAnswer>({ action: 'not_ours' }))).toEqual({ kind: 'not_ours' });
    expect(openView(refused(404, 'not_found'))).toEqual({ kind: 'not_ours' });
    expect(openView(refused(0, 'offline'))).toEqual({ kind: 'failed' });
  });
});

describe('a failed import', () => {
  it('says when the file is too big to import, and otherwise that it couldn’t be read', () => {
    expect(importFailedBody('file_too_large')).toBe(
      'The file is bigger than 32 MB, the most an import can take.',
    );
    expect(importFailedBody('invalid_request')).toBe(
      'The file couldn’t be read as one of your liveworkspace apps’ files.',
    );
  });
});
