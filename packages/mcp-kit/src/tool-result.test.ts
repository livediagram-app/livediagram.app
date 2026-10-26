import { describe, expect, it } from 'vitest';
import {
  answerFixable,
  errorResult,
  isErrorResult,
  requireToken,
  textResult,
  TOOL_ANNOTATIONS,
  ToolInputError,
  viewResult,
  type Extra,
} from './tool-result';

// The plumbing every product's MCP tools go through (docs/specs/015-api/mcp-server.md). `requireToken` is an auth boundary: it is the check standing between
// an unauthenticated caller and the api. The result helpers decide what an AI
// client actually receives, including whether it can tell a failure from a
// success.

// `token === undefined` means no authInfo at all; a passed '' really does
// reach requireToken as an empty token, which is the case worth testing.
const extra = (token?: string) =>
  ({ authInfo: token === undefined ? undefined : { token } }) as unknown as Extra;

describe('requireToken', () => {
  it('returns the bearer token when one was presented', () => {
    expect(requireToken(extra('tok_abc'))).toBe('tok_abc');
  });

  it('throws when there is no authInfo at all', () => {
    expect(() => requireToken({} as Extra)).toThrow(/unauthorized/i);
  });

  it('throws when authInfo carries no token', () => {
    expect(() => requireToken(extra())).toThrow(/unauthorized/i);
  });

  it('treats an empty-string token as absent', () => {
    // A blank Authorization header must not read as authenticated. `''` is
    // falsy, so this holds today; pinned because a change to `!== undefined`
    // would look equivalent and let a blank token through to the api.
    expect(() => requireToken(extra(''))).toThrow(/unauthorized/i);
  });

  it('fails closed rather than returning something falsy', () => {
    // The tools use the return value directly as a bearer token. Returning
    // undefined instead of throwing would send `Bearer undefined` to the api
    // and surface as a confusing 401 rather than a clear refusal.
    for (const bad of [{} as Extra, extra(), extra('')]) {
      expect(() => requireToken(bad)).toThrow();
    }
  });
});

describe('textResult', () => {
  it('wraps a value as pretty-printed JSON text', () => {
    const r = textResult({ id: 'd1', name: 'Roadmap' });
    expect(r.content).toHaveLength(1);
    expect(r.content[0]).toMatchObject({ type: 'text' });
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({
      id: 'd1',
      name: 'Roadmap',
    });
  });

  it('carries the same value as structuredContent', () => {
    // The SDK validates this against the tool's outputSchema (docs/specs/015-api/mcp-server.md §4.17).
    const value = { id: 'd1', name: 'Roadmap' };
    expect(textResult(value).structuredContent).toBe(value);
  });

  it('is not marked as an error', () => {
    // The MCP client branches on isError; a success that carried it would make
    // every tool call look failed.
    expect(textResult({}).isError).toBeUndefined();
  });
});

describe('errorResult', () => {
  it('marks the result as an error and passes the message through verbatim', () => {
    const r = errorResult('diagram not found');
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toBeUndefined();
    expect(r.content[0]).toEqual({ type: 'text', text: 'diagram not found' });
  });

  it('does not JSON-encode the message', () => {
    // The message is meant to be read by a model as prose. Quoting it would
    // put escaped quotes in front of whoever reads the failure.
    expect((errorResult('nope').content[0] as { text: string }).text).toBe('nope');
  });
});

describe('viewResult', () => {
  it('puts the view first and one line of JSON naming the file, tab and link after it', () => {
    const r = viewResult('box a', {
      id: 'd1',
      name: 'Roadmap',
      tab: { id: 't1', name: 'Board', rev: 3, view: 'outline' },
      tabs: [{ id: 't1', name: 'Board' }],
      url: 'https://example.app/document/d1',
    });
    const [view, line] = (r.content[0] as { text: string }).text.split('\n');
    expect(view).toBe('box a');
    expect(JSON.parse(line!)).toEqual({
      id: 'd1',
      name: 'Roadmap',
      tab: { id: 't1', name: 'Board', rev: 3 },
      tabs: [{ id: 't1', name: 'Board' }],
      url: 'https://example.app/document/d1',
    });
    expect(r.structuredContent).toMatchObject({ tab: { view: 'outline', text: 'box a' } });
  });
});

describe('TOOL_ANNOTATIONS', () => {
  it('marks only reads read-only and only destructive tools destructive', () => {
    expect(TOOL_ANNOTATIONS.read).toEqual({ readOnlyHint: true, openWorldHint: false });
    expect(TOOL_ANNOTATIONS.write.destructiveHint).toBe(false);
    expect(TOOL_ANNOTATIONS.destructive.destructiveHint).toBe(true);
  });
});

describe('answerFixable', () => {
  const refusalOf = (err: unknown) =>
    err instanceof RangeError ? { message: `refused: ${err.message}` } : null;

  it('passes a result through', async () => {
    expect(await answerFixable(() => textResult({ ok: true }), refusalOf)).toMatchObject({
      structuredContent: { ok: true },
    });
  });

  it('answers a ToolInputError and a known refusal as tool errors', async () => {
    const input = await answerFixable(() => {
      throw new ToolInputError('No tab "x".');
    }, refusalOf);
    expect(input).toEqual(errorResult('No tab "x".'));
    const refused = await answerFixable(() => {
      throw new RangeError('gone');
    }, refusalOf);
    expect(refused).toEqual(errorResult('refused: gone'));
  });

  it('lets anything else throw', async () => {
    await expect(
      answerFixable(() => {
        throw new TypeError('boom');
      }, refusalOf),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

describe('isErrorResult', () => {
  it('is true only for a result marked isError', () => {
    expect(isErrorResult(errorResult('x'))).toBe(true);
    expect(isErrorResult(textResult({}))).toBe(false);
    expect(isErrorResult(null)).toBe(false);
    expect(isErrorResult('isError')).toBe(false);
  });
});
