import { describe, expect, it } from 'vitest';
import {
  googleConsentUrl,
  rememberConsent,
  safeReturnPath,
  takeConsent,
  withSettingsTarget,
  markConnectCancelled,
  markConnectConnected,
  peekConnectOutcome,
  clearConnectOutcome,
} from './consent';

function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('googleConsentUrl', () => {
  it('asks for drive.file and drive.install, offline, in code flow', () => {
    const url = new URL(
      googleConsentUrl({
        clientId: 'cid',
        redirectUri: 'https://x/drive/connected',
        state: 's1',
        promptConsent: true,
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'cid',
      redirect_uri: 'https://x/drive/connected',
      response_type: 'code',
      scope:
        'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install',
      access_type: 'offline',
      include_granted_scopes: 'true',
      state: 's1',
      prompt: 'consent',
    });
  });

  it('leaves prompt out when a refresh token is stored', () => {
    const url = new URL(
      googleConsentUrl({ clientId: 'c', redirectUri: 'r', state: 's', promptConsent: false }),
    );
    expect(url.searchParams.has('prompt')).toBe(false);
  });
});

describe('safeReturnPath', () => {
  it('keeps same-origin paths and refuses the rest', () => {
    expect(safeReturnPath('/diagram/abc#t=1')).toBe('/diagram/abc#t=1');
    expect(safeReturnPath('//evil.example')).toBe('/explorer');
    expect(safeReturnPath('https://evil.example')).toBe('/explorer');
    expect(safeReturnPath('/drive/connected?code=x')).toBe('/explorer');
    expect(safeReturnPath(null)).toBe('/explorer');
  });

  it('refuses every way out of this origin', () => {
    for (const bad of [
      '/\\evil.example',
      '/\\/evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      ' /explorer',
      '/explorer\n//evil.example',
      '/explorer\t',
      '/%5C%5Cevil.example'.replace('%5C%5C', '\\\\'),
      '',
      'explorer',
      'http:/evil.example',
    ]) {
      expect(safeReturnPath(bad), JSON.stringify(bad)).toBe('/explorer');
    }
  });

  it('keeps a query and a hash', () => {
    expect(safeReturnPath('/explorer/recent?settings=account&section=cloud-sync')).toBe(
      '/explorer/recent?settings=account&section=cloud-sync',
    );
    expect(safeReturnPath('/diagram/a?x=1#t')).toBe('/diagram/a?x=1#t');
  });
});

describe('a cancel at Google', () => {
  it('is said once', () => {
    const s = storage();
    expect(peekConnectOutcome(s)).toBeNull();
    markConnectCancelled(s);
    expect(peekConnectOutcome(s)).toBe('cancelled');
    clearConnectOutcome(s);
    expect(peekConnectOutcome(s)).toBeNull();
  });
});

describe('a finished connection', () => {
  it('is told to the page it returns to, once', () => {
    const s = storage();
    markConnectConnected(s);
    expect(peekConnectOutcome(s)).toBe('connected');
    clearConnectOutcome(s);
    expect(peekConnectOutcome(s)).toBeNull();
  });
});

describe('withSettingsTarget', () => {
  it('names the Settings category and section in the path, keeping the rest', () => {
    expect(withSettingsTarget('/explorer/recent', 'account', 'cloud-sync')).toBe(
      '/explorer/recent?settings=account&section=cloud-sync',
    );
    expect(withSettingsTarget('/diagram/a?view=1#t', 'account', 'cloud-sync')).toBe(
      '/diagram/a?view=1&settings=account&section=cloud-sync#t',
    );
    expect(
      withSettingsTarget('/explorer?settings=privacy&section=x', 'account', 'cloud-sync'),
    ).toBe('/explorer?settings=account&section=cloud-sync');
  });
});

describe('rememberConsent / takeConsent', () => {
  it('returns the path once, for the state issued here only', () => {
    const s = storage();
    rememberConsent(s, 'state-1', '/explorer/recent');
    expect(takeConsent(s, 'state-2')).toBeNull();
    rememberConsent(s, 'state-1', '/explorer/recent');
    expect(takeConsent(s, 'state-1')).toBe('/explorer/recent');
    expect(takeConsent(s, 'state-1')).toBeNull();
  });
});
