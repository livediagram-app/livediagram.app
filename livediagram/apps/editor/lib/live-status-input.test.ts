import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createShape, isStatusUrl, type Element } from '@livediagram/document';
import {
  canBindLiveStatus,
  readStatusUrlInput,
  STATUS_URL_INVALID,
  STATUS_URL_PRIVATE,
} from './live-status-input';

// docs/specs/009-elements/live-status.md "The Live Status dialog": the field's check agrees with the document's.

describe('readStatusUrlInput', () => {
  it('takes a public https address, as the document stores it', () => {
    const read = readStatusUrlInput('  https://www.githubstatus.com/api/v2/status.json ');
    expect(read).toEqual({ ok: true, url: 'https://www.githubstatus.com/api/v2/status.json' });
    expect(isStatusUrl(read.ok ? read.url : '')).toBe(true);
  });

  it('adds https:// to an address typed without a scheme, and normalises the host', () => {
    expect(readStatusUrlInput('API.Example.com/healthz')).toEqual({
      ok: true,
      url: 'https://api.example.com/healthz',
    });
    expect(readStatusUrlInput('status.example.com')).toEqual({
      ok: true,
      url: 'https://status.example.com/',
    });
  });

  it('says nothing for an empty field', () => {
    expect(readStatusUrlInput('   ')).toEqual({ ok: false, error: 'empty' });
  });

  it.each([
    'http://status.example.com/',
    'ftp://status.example.com/',
    'https://user:pw@status.example.com/',
    'https://status.example.com:8443/',
    'https://',
    '://status.example.com',
  ])('refuses %s as not an https address', (raw) => {
    expect(readStatusUrlInput(raw)).toEqual({
      ok: false,
      error: 'invalid',
      message: STATUS_URL_INVALID,
    });
  });

  it.each([
    'https://10.0.0.1/health',
    'https://[::1]/',
    'localhost/health',
    'https://db.internal/health',
    'https://printer.local/',
    'https://intranet/',
    '1http://status.example.com',
  ])('refuses %s as private', (raw) => {
    expect(readStatusUrlInput(raw)).toEqual({
      ok: false,
      error: 'private',
      message: STATUS_URL_PRIVATE,
    });
  });

  it('refuses an address past the stored length', () => {
    const read = readStatusUrlInput(`https://status.example.com/${'a'.repeat(2048)}`);
    expect(read.ok).toBe(false);
  });

  it('refuses one the parser grows past the stored length', () => {
    // Each space becomes %20, so the stored form is three times longer than what was typed.
    const read = readStatusUrlInput(`https://status.example.com/${'a b'.repeat(600)}`);
    expect(read).toEqual({ ok: false, error: 'invalid', message: STATUS_URL_INVALID });
  });

  it('reads a long worst-case input within budget', () => {
    const long = `${'a+-.'.repeat(20_000)}://x`;
    const spent = cpuMsOf(() => {
      for (let i = 0; i < 20; i++) readStatusUrlInput(long);
    });
    expect(spent).toBeLessThan(cpuBudgetMs(200));
  });
});

describe('canBindLiveStatus', () => {
  it('takes a plain shape, never a self-drawing one, a locked one or another element', () => {
    expect(canBindLiveStatus(createShape('square', 0, 0))).toBe(true);
    expect(canBindLiveStatus({ ...createShape('square', 0, 0), locked: true })).toBe(false);
    expect(canBindLiveStatus({ ...createShape('square', 0, 0), shape: 'progress-bar' })).toBe(
      false,
    );
    expect(canBindLiveStatus({ id: 's', type: 'sticky' } as Element)).toBe(false);
  });
});
