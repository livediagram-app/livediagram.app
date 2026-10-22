import { describe, expect, it } from 'vitest';
import { bodyExceedsCap, declaredBodyBytes } from './limits';

// The bug these exist for: the tab cap (and a since-removed second cap) were
// written as `Number.isFinite(Number(headers.get(...)))`, which is TRUE for an
// absent header (Number(null) === 0), so they measured a chunked body as zero
// bytes and never fired. The rule now lives in one place.
function req(headers: Record<string, string> = {}): Request {
  return new Request('https://api.test/x', { method: 'POST', headers });
}

describe('declaredBodyBytes', () => {
  it('returns null for the header shapes that used to read as zero bytes', () => {
    expect(declaredBodyBytes(req())).toBeNull(); // absent -> Number(null) === 0
    expect(declaredBodyBytes(req({ 'Content-Length': '' }))).toBeNull(); // '' -> 0
    expect(declaredBodyBytes(req({ 'Content-Length': '0' }))).toBeNull();
    expect(declaredBodyBytes(req({ 'Content-Length': 'abc' }))).toBeNull(); // NaN
    expect(declaredBodyBytes(req({ 'Content-Length': '-5' }))).toBeNull();
  });

  it('returns the declared count when the client gave a usable one', () => {
    expect(declaredBodyBytes(req({ 'Content-Length': '1' }))).toBe(1);
    expect(declaredBodyBytes(req({ 'Content-Length': '4194304' }))).toBe(4194304);
  });
});

describe('bodyExceedsCap', () => {
  it('falls back to measuring the parsed body when no header is usable', () => {
    // The regression: with no Content-Length the cap must still bite.
    const big = { s: 'a'.repeat(2000) };
    expect(bodyExceedsCap(req(), big, 1000)).toBe(true);
    expect(bodyExceedsCap(req(), big, 100_000)).toBe(false);
  });

  it('trusts a usable declared length without measuring', () => {
    // A tiny body that declares itself huge is rejected on the declaration —
    // that is the fast path the hot autosave PUT relies on.
    expect(bodyExceedsCap(req({ 'Content-Length': '9999' }), { s: 'x' }, 1000)).toBe(true);
    expect(bodyExceedsCap(req({ 'Content-Length': '10' }), { s: 'x' }, 1000)).toBe(false);
  });

  it('measures UTF-8 bytes, not characters, in the fallback', () => {
    // A char count would under-count multi-byte content and let a payload
    // through at up to a third of its real size.
    const emoji = { s: '🙂'.repeat(300) }; // 4 bytes each
    expect(bodyExceedsCap(req(), emoji, 500)).toBe(true);
  });
});
