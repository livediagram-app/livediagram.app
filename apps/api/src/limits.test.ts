import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_MB } from '@livediagram/api-schema';
import { MAX_BODY_BYTES, MAX_IMAGE_BYTES, bodyExceedsCap, declaredBodyBytes } from './limits';

// The image cap is one number written in four places a reader will believe:
// this worker's enforcement, the editor's pre-upload gate, spec/19, and the
// help article. The first two now share the constant from
// @livediagram/api-schema, so they cannot disagree. Prose cannot import, so it
// is checked here — this is the app that enforces the cap, so it is the one
// that should fail when the documentation stops describing what it enforces.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

describe('image cap', () => {
  it('is quoted as the same number of MB by spec/19 and the help article', () => {
    const quoted = `${MAX_IMAGE_MB} MB`;
    for (const doc of ['specs/19-images.md', 'apps/help/app/palette/tools/images/page.mdx']) {
      const source = readFileSync(`${ROOT}/${doc}`, 'utf8');
      // Guard against passing by absence if a file is ever renamed.
      expect(source.length, doc).toBeGreaterThan(200);
      expect(source, doc).toContain(quoted);
    }
  });

  it('stays above the generic body cap, or the image route becomes unreachable', () => {
    // limits.ts spells this out: the pre-dispatch gate picks MAX_IMAGE_BYTES
    // for the image route precisely because the 8 MB outer bound would
    // otherwise reject a legal upload with the generic payload_too_large,
    // never reaching the route's file_too_large + limitBytes envelope.
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(MAX_BODY_BYTES);
  });
});

// spec/25 tabulates the AI route's error envelope. It had drifted badly: it
// listed `ai_parse_error`, a token that exists in that sentence and nowhere
// else in the repo, and `off_topic`, which is not an envelope at all — an
// off-topic prompt returns 200 with `"offTopic": true` in the body and the
// EDITOR raises the error. Both tokens the route really emits for auth
// failures were missing. Someone building a client from the spec would have
// handled two errors that never arrive and none of the two that do.
describe('spec/25 lists the AI route error tokens the route emits', () => {
  it('names each one, and invents none', () => {
    const route = readFileSync(`${ROOT}/apps/api/src/routes/ai.ts`, 'utf8');
    const spec = readFileSync(`${ROOT}/specs/25-ai-assistance.md`, 'utf8');
    const emitted = [...route.matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]!);
    expect(new Set(emitted).size).toBeGreaterThan(3);

    for (const token of new Set(emitted)) {
      expect(spec, `spec/25 omits ${token}`).toContain(`\`${token}\``);
    }
    // The spec may only claim tokens the route actually produces. Scoped to
    // the envelope table so unrelated prose elsewhere in the spec is free.
    const table = spec.slice(
      spec.indexOf('Error responses follow'),
      spec.indexOf('## Environment'),
    );
    for (const m of table.matchAll(/`([a-z]+_[a-z_]+)`/g)) {
      const claimed = m[1]!;
      if (claimed === 'off_topic') continue; // called out as NOT an envelope
      expect(emitted, `spec/25 claims ${claimed}, which the route never emits`).toContain(claimed);
    }
  });
});

// The bug these exist for, twice over: the tab cap and the change-log entry
// cap were both written as `Number.isFinite(Number(headers.get(...)))`, which
// is TRUE for an absent header (Number(null) === 0), so both measured a
// chunked body as zero bytes and never fired. The rule now lives in one place.
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
