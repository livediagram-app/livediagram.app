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
  guest: { id: '6f1c2d3e-aaaa-bbbb-cccc-123456789abc', signed: true, pendingUpgrade: false },
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

  it('carries only a guest id prefix, never the whole credential', () => {
    const text = formatDiagnostics(base);
    expect(text).toContain('Identity: guest 6f1c2d3e…');
    expect(text).not.toContain('123456789abc');
    expect(text).toContain('Guest id signed: yes');
  });

  it('names a signed-in account', () => {
    const text = formatDiagnostics({ ...base, ownerId: 'user_2abcDEF' });
    expect(text).toContain('Identity: signed in (user_2abcDEF)');
    expect(text).not.toContain('Guest id signed');
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
      guest: { id: null, signed: false, pendingUpgrade: true },
    });
    expect(text).toContain('Load step: not started');
    expect(text).toContain('Build: unknown');
    expect(text).toContain('Identity: guest (none yet)');
    expect(text).toContain('Identity upgrade pending: yes');
  });
});
