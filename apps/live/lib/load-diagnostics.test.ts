import { describe, expect, it } from 'vitest';
import { formatDiagnostics, type DiagnosticsInput } from './load-diagnostics';

// docs/specs/007-editor/load-recovery.md "Diagnostics".

const checks = {
  localStorage: true,
  sessionStorage: true,
  cookies: true,
  indexedDb: 'timeout' as const,
  randomUuid: true,
  online: true,
  userAgent: 'TestBrowser/1',
};

const base: DiagnosticsInput = {
  ownerId: '6f1c2d3e-aaaa-bbbb-cccc-123456789abc',
  now: new Date('2026-10-06T12:00:10.000Z'),
  location: { pathname: '/document/doc-1', search: '' },
  progress: {
    step: 'document',
    startedAt: new Date('2026-10-06T12:00:00.000Z').getTime(),
    timedOut: true,
    healing: false,
  },
  buildId: 'abc123',
  checks,
  identity: {
    signedIn: false,
    guestIdPrefix: '6f1c2d3e',
    guestSigned: true,
    pendingUpgrade: false,
  },
};

describe('formatDiagnostics', () => {
  it('reports the load, the build and the browser checks', () => {
    const text = formatDiagnostics(base);
    expect(text).toContain('Page: /document/doc-1');
    expect(text).toContain('Build: abc123');
    expect(text).toContain('Load step: document');
    expect(text).toContain('Load running for: 10.0s');
    expect(text).toContain('Load timed out: yes');
    expect(text).toContain('IndexedDB: TIMEOUT');
    expect(text).toContain('Browser: TestBrowser/1');
  });

  it('describes a guest by id prefix, never the whole credential', () => {
    const text = formatDiagnostics(base);
    expect(text).toContain('Signed in: no');
    expect(text).toContain('Guest id in this browser: 6f1c2d3e… (signed: yes)');
    expect(text).not.toContain('123456789abc');
  });

  it('names a signed-in account, and flags guest documents not yet moved to it', () => {
    const text = formatDiagnostics({ ...base, ownerId: 'user_2abcDEF' });
    expect(text).toContain('Signed in: yes (user_2abcDEF)');
    expect(text).toContain('Guest documents moved to the account: NOT YET');
  });

  it('never carries a share code', () => {
    const text = formatDiagnostics({
      ...base,
      location: { pathname: '/document/doc-1', search: '?s=SECRETCODE' },
    });
    expect(text).toContain('Page: /document/doc-1 (share link: yes)');
    expect(text).not.toContain('SECRETCODE');
  });

  it('copes with a load that has not started and no guest id', () => {
    const text = formatDiagnostics({
      ...base,
      ownerId: null,
      buildId: null,
      progress: { step: null, startedAt: null, timedOut: false, healing: false },
      identity: { signedIn: null, guestIdPrefix: null, guestSigned: false, pendingUpgrade: true },
    });
    expect(text).toContain('Load step: not started');
    expect(text).toContain('Build: unknown');
    expect(text).toContain('Signed in: unknown');
    expect(text).toContain('Guest id in this browser: none');
    expect(text).toContain('Identity upgrade pending: yes');
  });
});
