import { describe, expect, it } from 'vitest';
import { documentIdsIn, metricsOf, parseTranscript } from './transcript.mjs';

const DOC = '981c336f-c993-4206-a00c-8d1cc03822ff';
const line = (o: unknown) => JSON.stringify(o);

const transcript = [
  line({
    type: 'system',
    subtype: 'init',
    model: 'claude-haiku-5-5',
    session_id: 's-1',
    mcp_servers: [{ name: 'livedesign', status: 'connected' }],
  }),
  line({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 't1',
          name: 'mcp__livedesign__change_pages',
          input: { documentId: 'd1' },
        },
      ],
    },
  }),
  line({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: 't1',
          is_error: true,
          content: [{ type: 'text', text: 'Give a layout or elements, not both.\nmore' }],
        },
      ],
    },
  }),
  line({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 't2',
          name: 'mcp__livedesign__change_pages',
          input: { documentId: 'd1' },
        },
      ],
    },
  }),
  line({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: 't2',
          content: [
            { type: 'text', text: `{"documentId":"${DOC}"}` },
            { type: 'image', source: { type: 'base64', data: 'AA' } },
          ],
        },
      ],
    },
  }),
  line({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', id: 't3', name: 'mcp__livedesign__find_diagrams', input: {} }],
    },
  }),
  line({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: 't3', content: '[]' }] },
  }),
  line({ type: 'assistant', message: { content: [{ type: 'text', text: 'Here is your deck.' }] } }),
  'not json',
  line({
    type: 'result',
    subtype: 'success',
    num_turns: 4,
    duration_ms: 1200,
    total_cost_usd: 0.1,
    result: 'Here is your deck.',
    usage: {
      input_tokens: 5,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 50,
      output_tokens: 40,
    },
  }),
].join('\n');

describe('parseTranscript', () => {
  const run = parseTranscript(transcript);

  it('reads each MCP call without its prefix, with its outcome', () => {
    expect(run.calls.map((c) => [c.tool, c.isError])).toEqual([
      ['change_pages', true],
      ['change_pages', false],
      ['find_diagrams', false],
    ]);
    expect(run.calls[0].error).toBe('Give a layout or elements, not both.');
    expect(run.calls[1].images).toBe(1);
    // A successful result's text is kept for checks; a refusal's is not.
    expect(run.calls[1].result).toBe(`{"documentId":"${DOC}"}`);
    expect(run.calls[0].result).toBeNull();
  });

  it('finds the documents a successful result names', () => {
    expect(run.documentIds).toEqual([DOC]);
  });

  it('reads the model, session, reply and usage', () => {
    expect(run.model).toBe('claude-haiku-5-5');
    expect(run.sessionId).toBe('s-1');
    expect(run.mcpConnected).toBe(true);
    expect(run.finalText).toBe('Here is your deck.');
    expect(run.result).toMatchObject({
      turns: 4,
      inputTokens: 155,
      outputTokens: 40,
      isError: false,
    });
  });

  it('falls back to the last text when there is no result line', () => {
    const cut = transcript.split('\n').slice(0, -1).join('\n');
    expect(parseTranscript(cut).finalText).toBe('Here is your deck.');
    expect(metricsOf(parseTranscript(cut)).finished).toBe(false);
  });
});

describe('mcpConnected', () => {
  it('is false when the server failed to come up, null with no init line', () => {
    const failed = JSON.stringify({
      type: 'system',
      subtype: 'init',
      mcp_servers: [{ name: 'livedesign', status: 'failed' }],
    });
    expect(parseTranscript(failed).mcpConnected).toBe(false);
    expect(parseTranscript('').mcpConnected).toBeNull();
  });
});

describe('metricsOf', () => {
  it('counts errors, retries of the failed tool and deprecated calls', () => {
    const m = metricsOf(parseTranscript(transcript), new Set(['find_diagrams']));
    expect(m).toMatchObject({
      calls: 3,
      errors: 1,
      retries: 1,
      deprecatedCalls: 1,
      firstTool: 'change_pages',
      finished: true,
    });
  });
});

describe('documentIdsIn', () => {
  it('reads ids from documentId fields and document links', () => {
    const other = '11111111-2222-3333-4444-555555555555';
    expect(
      documentIdsIn(`"documentId": "${DOC}" https://livedesign.app/document/${other}`),
    ).toEqual([DOC, other]);
    expect(documentIdsIn(`"tabId":"${DOC}"`)).toEqual([]);
  });
});
