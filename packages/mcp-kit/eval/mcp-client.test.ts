import { afterEach, describe, expect, it, vi } from 'vitest';
import { connect, resultJson, resultText } from './mcp-client.mjs';

// The benchmark's MCP client (each product's docs/instructions/evaluate-mcp-output.md): a session over
// streamable HTTP, and a tool result read as text or JSON.

const text = (...parts: string[]) => ({ content: parts.map((t) => ({ type: 'text', text: t })) });

describe('resultText', () => {
  it('joins the text parts and leaves out the rest', () => {
    expect(resultText({ content: [...text('a', 'b').content, { type: 'image', data: 'x' }] })).toBe(
      'a\nb',
    );
  });

  it('is null on an error result or none at all', () => {
    expect(resultText({ ...text('nope'), isError: true })).toBeNull();
    expect(resultText(null)).toBeNull();
  });
});

describe('resultJson', () => {
  it('reads the first part that parses whole, past a lint part after it', () => {
    expect(resultJson(text('{"id":1}', 'lint: fine'))).toEqual({ id: 1 });
  });

  it('reads the first line that parses when a header line comes first', () => {
    expect(resultJson(text('Overview of a tab\n{"id":2}\nmore'))).toEqual({ id: 2 });
  });

  it('is null when nothing parses, or on an error result', () => {
    expect(resultJson(text('plain words', '{not json'))).toBeNull();
    expect(resultJson({ ...text('{"id":1}'), isError: true })).toBeNull();
  });
});

describe('connect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('needs the server address', async () => {
    await expect(connect({ token: 't' })).rejects.toThrow(
      '[mcp-client] connect needs the MCP server url',
    );
  });

  it('opens a session, carries its id and lists and calls tools, streamed or plain', async () => {
    const seen: { body: { method: string }; session: string | null; auth: string | null }[] = [];
    const reply = (status: number, body: string, headers: Record<string, string> = {}) =>
      new Response(body, { status, headers });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const headers = init.headers as Record<string, string>;
        const body = JSON.parse(init.body as string) as { method: string };
        seen.push({
          body,
          session: headers['Mcp-Session-Id'] ?? null,
          auth: headers.Authorization ?? null,
        });
        if (body.method === 'initialize')
          return reply(200, `data: ${JSON.stringify({ result: { instructions: 'Be kind.' } })}\n`, {
            'Mcp-Session-Id': 's1',
          });
        if (body.method === 'notifications/initialized') return reply(202, '');
        if (body.method === 'tools/list')
          return reply(200, JSON.stringify({ result: { tools: [{ name: 'find' }] } }));
        return reply(200, JSON.stringify({ error: { code: -1, message: 'no such tool' } }));
      }),
    );
    const client = await connect({ url: 'http://mcp.test/mcp', token: 't' });
    expect(client.instructions).toBe('Be kind.');
    expect(await client.tools()).toEqual([{ name: 'find' }]);
    expect(await client.call('missing')).toEqual({ code: -1, message: 'no such tool' });
    expect(seen.map((s) => s.body.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
      'tools/call',
    ]);
    expect(seen.slice(1).every((s) => s.session === 's1')).toBe(true);
    expect(seen.every((s) => s.auth === 'Bearer t')).toBe(true);
  });

  it('retries a dropped request, then lets the error stand', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async () => {
        throw new Error('Network connection lost');
      });
      vi.stubGlobal('fetch', fetch);
      const opening = connect({ url: 'http://mcp.test/mcp', token: 't' });
      const failed = expect(opening).rejects.toThrow('Network connection lost');
      await vi.runAllTimersAsync();
      await failed;
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
