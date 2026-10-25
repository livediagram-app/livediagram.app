import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_MB } from '@livediagram/api-schema';
import { MAX_BODY_BYTES, MAX_IMAGE_BYTES, bodyExceedsCap, declaredBodyBytes } from './limits';

// The image cap is one number written in four places a reader will believe:
// this worker's enforcement, the editor's pre-upload gate, docs/specs/009-elements/images.md, and the
// help article. The first two now share the constant from
// @livediagram/api-schema, so they cannot disagree. Prose cannot import, so it
// is checked here — this is the app that enforces the cap, so it is the one
// that should fail when the documentation stops describing what it enforces.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url).href);

describe('image cap', () => {
  it('is quoted as the same number of MB by docs/specs/009-elements/images.md and the help article', () => {
    const quoted = `${MAX_IMAGE_MB} MB`;
    for (const doc of [
      'docs/specs/009-elements/images.md',
      'apps/help/app/palette/tools/images/page.mdx',
    ]) {
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

// docs/specs/021-event-storming/note-reader.md tabulates the reader route's
// error envelope. An earlier AI spec drifted badly here (it listed a token that
// existed nowhere in the repo and missed two the route really emitted), so the
// table is pinned to the code both ways.
describe('docs/specs/021-event-storming/note-reader.md lists the error tokens the reader route emits', () => {
  it('names each one, and invents none', () => {
    // Every file a caller of the reader can receive an envelope from: the
    // admission gate and the handler. Reading one file would quietly stop
    // checking most of them.
    const route = ['ai-gate.ts', 'ai-read-notes.ts']
      .map((f) => readFileSync(`${ROOT}/apps/api/src/routes/${f}`, 'utf8'))
      .join('\n');
    const spec = readFileSync(`${ROOT}/docs/specs/021-event-storming/note-reader.md`, 'utf8');
    // Tokens come from inline envelopes AND the shared helpers in
    // responses.ts: a no-arg helper (`aiError()`) stands for the fixed token
    // its body returns, and `forbidden('x')` / `conflict('x')` carry theirs as
    // the argument. Reading only the inline literals would stop checking a
    // token the moment its route switched to the helper. The helpers every api
    // shares are @liveworkspace/api-kit's (`const signInRequired = (): Response =>`).
    const responses = [
      `${ROOT}/apps/api/src/responses.ts`,
      `${ROOT}/../packages/api-kit/src/responses.ts`,
    ]
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const helperTokens = new Map(
      [
        ...responses.matchAll(
          /(?:export function (\w+)\(\): Response \{\s*return|const (\w+) = \(\): Response =>)\s*json\(\{ error: '([a-z_]+)'/g,
        ),
      ].map((m) => [(m[1] ?? m[2])!, m[3]!]),
    );
    const emitted = [
      ...[...route.matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]!),
      ...[...route.matchAll(/\b(?:forbidden|conflict)\('([a-z_]+)'\)/g)].map((m) => m[1]!),
      ...[...route.matchAll(/\b(\w+)\(\)/g)].flatMap((m) => helperTokens.get(m[1]!) ?? []),
    ];
    expect(new Set(emitted).size).toBeGreaterThan(3);

    for (const token of new Set(emitted)) {
      expect(spec, `docs/specs/021-event-storming/note-reader.md omits ${token}`).toContain(
        `\`${token}\``,
      );
    }
    // The spec may only claim tokens the route actually produces. Scoped to
    // the envelope TABLES — the `|`-delimited rows between the error section
    // and the env section — so prose in between (which legitimately names
    // things like `json_object`) is free.
    const rows = spec
      .slice(spec.indexOf('Error responses follow'), spec.indexOf('## Environment'))
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .join('\n');
    for (const m of rows.matchAll(/`([a-z]+_[a-z_]+)`/g)) {
      const claimed = m[1]!;
      expect(
        emitted,
        `docs/specs/021-event-storming/note-reader.md claims ${claimed}, which the route never emits`,
      ).toContain(claimed);
    }
  });
});

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
