import { describe, expect, it } from 'vitest';
import { AddressError, verbById, VerbRefusal } from '@livediagram/agent-verbs';
import { ApiError } from '@livediagram/api-client';
import { CliError, formatError } from './cli-error';
import { EXIT, exitCodeForStatus } from './exit-codes';
import { failureOf, ISSUES_URL } from './failure-of';
import { render } from './print';

const HOST = 'https://livediagram.app';
const apiError = (status: number, body: unknown) =>
  new ApiError(status, typeof body === 'string' ? body : JSON.stringify(body));

describe('exitCodeForStatus', () => {
  it('maps each api status to one of the eight exits', () => {
    expect([401, 403, 404, 410, 409, 412, 429, 500, 503, 400, 422].map(exitCodeForStatus)).toEqual([
      4, 4, 3, 3, 5, 5, 6, 7, 7, 1, 1,
    ]);
  });
});

describe('formatError', () => {
  const failure = {
    exit: EXIT.notFound,
    code: 'not_found',
    message: 'no tab',
    lines: ['  a1  "A"'],
    hint: 'livediagram tab ls x',
  };

  it('prints the message, the indented lines and the hint as text', () => {
    expect(formatError(failure, false)).toBe(
      'error: no tab\n    a1  "A"\nhint: livediagram tab ls x\n',
    );
    expect(formatError({ exit: EXIT.usage, code: 'usage', message: 'bad' }, false)).toBe(
      'error: bad\n',
    );
  });

  it('prints one JSON object with --json', () => {
    expect(JSON.parse(formatError(failure, true))).toEqual({
      error: 'not_found',
      message: 'no tab',
      candidates: ['a1  "A"'],
      hint: 'livediagram tab ls x',
    });
    expect(
      JSON.parse(formatError({ exit: EXIT.usage, code: 'usage', message: 'bad', lines: [] }, true)),
    ).toEqual({
      error: 'usage',
      message: 'bad',
    });
  });
});

describe('failureOf', () => {
  it('passes a CliError through', () => {
    const failure = { exit: EXIT.usage, code: 'usage', message: 'x' } as const;
    expect(failureOf(new CliError(failure), HOST)).toBe(failure);
  });

  it('reads an address failure: not found with the nearest, ambiguous, usage', () => {
    const candidates = [{ ref: 'aaaa1', name: 'Auth flow', detail: 'personal' }];
    const base = { what: 'document' as const, input: 'Auth', hint: 'livediagram document ls' };
    expect(
      failureOf(
        new AddressError({
          ...base,
          kind: 'not-found',
          candidates,
          message: 'no document matches "Auth"',
        }),
        HOST,
      ),
    ).toEqual({
      exit: EXIT.notFound,
      code: 'not_found',
      message: 'no document matches "Auth"; the nearest:',
      lines: ['aaaa1     "Auth flow"             personal'],
      hint: 'livediagram document ls',
    });
    expect(
      failureOf(
        new AddressError({ ...base, kind: 'not-found', candidates: [], message: 'none' }),
        HOST,
      ).message,
    ).toBe('none');
    expect(
      failureOf(new AddressError({ ...base, kind: 'ambiguous', candidates, message: 'two' }), HOST),
    ).toMatchObject({ exit: 3, code: 'ambiguous' });
    expect(
      failureOf(new AddressError({ ...base, kind: 'usage', candidates: [], message: 'url' }), HOST),
    ).toMatchObject({ exit: 2, code: 'usage' });
  });

  it("reads an api answer by its status, keeping a refusal's lines", () => {
    expect(failureOf(apiError(401, { error: 'token_revoked' }), HOST)).toEqual({
      exit: EXIT.auth,
      code: 'token_revoked',
      message: `${HOST} did not accept the credential (token_revoked)`,
      hint: 'livediagram auth login --with-token, or set LIVEDIAGRAM_TOKEN',
    });
    expect(failureOf(apiError(403, { error: 'read_only' }), HOST)).toMatchObject({
      message: 'refused: read_only',
      hint: 'livediagram auth status',
    });
    expect(failureOf(apiError(429, ''), HOST)).toMatchObject({ exit: 6, code: 'http_429' });
    expect(failureOf(apiError(502, 'bad gateway'), HOST)).toMatchObject({
      exit: 7,
      message: `${HOST} failed (HTTP 502)`,
    });
    expect(
      failureOf(
        apiError(422, { error: 'rejected', text: '! 1 target_not_found n9\n  hint' }),
        HOST,
      ),
    ).toEqual({
      exit: EXIT.rejected,
      code: 'rejected',
      message: 'refused: rejected',
      lines: ['! 1 target_not_found n9', '  hint'],
    });
    expect(
      failureOf(apiError(400, { error: 'invalid_value', message: 'limit is 1 to 200' }), HOST)
        .message,
    ).toBe('limit is 1 to 200');
    expect(failureOf(apiError(404, { error: 'not_found' }), HOST)).toMatchObject({
      exit: 3,
      message: 'not_found',
    });
    expect(failureOf(apiError(400, 'null'), HOST)).toMatchObject({ exit: 1, code: 'http_400' });
  });

  it('reads a network failure, and anything else as an internal error', () => {
    expect(failureOf(new TypeError('fetch failed'), HOST)).toMatchObject({
      exit: 7,
      code: 'network',
      message: `could not reach ${HOST} (fetch failed)`,
    });
    expect(failureOf(new RangeError('x'), HOST)).toEqual({
      exit: EXIT.failure,
      code: 'internal',
      message: 'internal error (RangeError)',
      hint: `run again with LIVEDIAGRAM_DEBUG=1 and report it at ${ISSUES_URL}`,
    });
    expect(failureOf('boom', HOST).message).toBe('internal error (string)');
  });
});

describe('render', () => {
  const ls = verbById('document.ls')!;
  const out = {
    documents: [
      {
        ref: 'aaaa1',
        id: 'aaaa1-full',
        name: 'Auth flow',
        library: 'personal',
        updated: '2026-10-01',
      },
    ],
    more: 0,
  };

  it('prints the compact text, the quiet refs, or JSON', () => {
    expect(render(ls, out, { json: false, quiet: false })).toBe(
      'aaaa1  "Auth flow"  personal  2026-10-01\n',
    );
    expect(render(ls, out, { json: false, quiet: true })).toBe('aaaa1\n');
    expect(JSON.parse(render(ls, out, { json: true, quiet: false }))).toEqual(out);
  });

  it('picks fields of each list item, or of the output', () => {
    expect(JSON.parse(render(ls, out, { json: true, fields: ['name'], quiet: false }))).toEqual({
      documents: [{ name: 'Auth flow' }],
      more: 0,
    });
    const status = verbById('auth.status')!;
    const s = {
      host: HOST,
      account: 'Ada',
      token: 'cli',
      role: 'full',
      expires: 'never',
      source: 'env',
    };
    expect(
      JSON.parse(render(status, s, { json: true, fields: ['account', 'role'], quiet: false })),
    ).toEqual({ account: 'Ada', role: 'full' });
    expect(render(status, s, { json: false, quiet: true })).toContain('host');
  });

  it('refuses a field the output does not have, naming the ones it does', () => {
    expect(() => render(ls, out, { json: true, fields: ['nope'], quiet: false })).toThrow(CliError);
    try {
      render(ls, out, { json: true, fields: ['nope'], quiet: false });
    } catch (err) {
      expect((err as CliError).failure).toMatchObject({
        exit: 2,
        message: 'unknown field nope for --json',
        lines: ['fields: ref, id, name, library, updated'],
      });
    }
  });

  it("prints a view as JSON through the verb's projection, and a primitive as itself", () => {
    const view = verbById('tab.view')!;
    expect(render(view, { json: { nodes: [] } }, { json: true, quiet: false })).toBe(
      '{"nodes":[]}\n',
    );
    expect(render(view, { json: 3 }, { json: true, fields: ['x'], quiet: false })).toBe('3\n');
    expect(render(view, { text: 'a\n' }, { json: false, quiet: false })).toBe('a\n');
  });
});

describe("a verb's own refusal", () => {
  it('exits by its status with its lines and hint', () => {
    const refusal = new VerbRefusal({
      status: 412,
      code: 'stale_tab',
      message: '"Main" changed',
      lines: [],
      hint: 're-read',
    });
    expect(failureOf(refusal, HOST)).toEqual({
      exit: EXIT.conflict,
      code: 'stale_tab',
      message: '"Main" changed',
      lines: [],
      hint: 're-read',
    });
  });
});
