// Reads a `claude -p --output-format stream-json` transcript into what the benchmark measures: each tool call with
// its outcome, the final reply, usage and the items the run touched. Pure: lines in, a run out. Each product's
// eval/bench/transcript.mjs binds its MCP server's name and its noun (`document`: ids are read from `"documentId"`
// and `/document/`, and the run lists them as `documentIds`).

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

// Results longer than this (an item read whole) are kept only as their length.
const RESULT_TEXT_MAX = 20_000;

/**
 * @param {{ server: string, noun: string }} product the MCP server's name and the noun its ids go by
 */
export function createTranscript({ server, noun }) {
  const MCP_PREFIX = `mcp__${server}__`;
  const DOC_ID = new RegExp(`(?:"${noun}Id"\\s*:\\s*"|/${noun}/)(${UUID})`, 'g');
  const idsKey = `${noun}Ids`;

  function idsIn(text) {
    return [...text.matchAll(DOC_ID)].map((m) => m[1]);
  }

  function parseTranscript(jsonl) {
    const calls = [];
    const byId = new Map();
    const docs = new Set();
    const run = {
      model: null,
      sessionId: null,
      mcpConnected: null,
      calls,
      texts: [],
      finalText: '',
      [idsKey]: [],
      result: null,
    };
    for (const line of jsonl.split('\n')) {
      if (!line.trim()) continue;
      let m;
      try {
        m = JSON.parse(line);
      } catch {
        continue;
      }
      if (m.type === 'system' && m.subtype === 'init') {
        run.model = m.model ?? null;
        run.sessionId = m.session_id ?? null;
        // Whether the product's server came up for this session: a run without it never had the tools.
        const mounted = (m.mcp_servers ?? []).find((s) => s.name === server);
        run.mcpConnected = mounted ? mounted.status === 'connected' : false;
      } else if (m.type === 'assistant' && Array.isArray(m.message?.content)) {
        for (const c of m.message.content) {
          if (c.type === 'text' && c.text.trim()) run.texts.push(c.text);
          if (c.type !== 'tool_use') continue;
          const call = {
            tool: c.name.startsWith(MCP_PREFIX) ? c.name.slice(MCP_PREFIX.length) : c.name,
            input: c.input,
            isError: false,
            error: null,
            resultChars: 0,
            // The result's text, for checks that judge what a call answered (a card a run later deleted); null past
            // RESULT_TEXT_MAX or on an error.
            result: null,
            images: 0,
          };
          for (const id of idsIn(JSON.stringify(c.input ?? {}))) docs.add(id);
          calls.push(call);
          byId.set(c.id, call);
        }
      } else if (m.type === 'user' && Array.isArray(m.message?.content)) {
        for (const c of m.message.content) {
          if (c.type !== 'tool_result') continue;
          const call = byId.get(c.tool_use_id);
          if (!call) continue;
          const text = textOf(c.content);
          call.isError = c.is_error === true;
          call.error = call.isError
            ? (text.split('\n').find((l) => l.trim()) ?? '').slice(0, 300)
            : null;
          call.resultChars = text.length;
          call.result = !call.isError && text.length <= RESULT_TEXT_MAX ? text : null;
          call.images = Array.isArray(c.content)
            ? c.content.filter((x) => x.type === 'image').length
            : 0;
          if (!call.isError) for (const id of idsIn(text)) docs.add(id);
        }
      } else if (m.type === 'result') {
        run.result = {
          subtype: m.subtype ?? null,
          isError: m.is_error === true,
          turns: m.num_turns ?? null,
          durationMs: m.duration_ms ?? null,
          costUsd: m.total_cost_usd ?? null,
          outputTokens: m.usage?.output_tokens ?? null,
          inputTokens:
            (m.usage?.input_tokens ?? 0) +
            (m.usage?.cache_creation_input_tokens ?? 0) +
            (m.usage?.cache_read_input_tokens ?? 0),
        };
        if (typeof m.result === 'string') run.finalText = m.result;
      }
    }
    if (!run.finalText) run.finalText = run.texts.at(-1) ?? '';
    run[idsKey] = [...docs];
    return run;
  }

  return { idsIn, parseTranscript };
}

// The measures a run is compared on, from its parsed transcript.
export function metricsOf(run, deprecated = new Set()) {
  const { calls } = run;
  let retries = 0;
  for (let i = 1; i < calls.length; i++)
    if (calls[i - 1].isError && calls[i].tool === calls[i - 1].tool) retries++;
  const errors = calls.filter((c) => c.isError);
  return {
    calls: calls.length,
    errors: errors.length,
    retries,
    firstTool: calls[0]?.tool ?? null,
    deprecatedCalls: calls.filter((c) => deprecated.has(c.tool)).length,
    images: calls.reduce((n, c) => n + c.images, 0),
    resultChars: calls.reduce((n, c) => n + c.resultChars, 0),
    turns: run.result?.turns ?? null,
    durationMs: run.result?.durationMs ?? null,
    costUsd: run.result?.costUsd ?? null,
    inputTokens: run.result?.inputTokens ?? null,
    outputTokens: run.result?.outputTokens ?? null,
    finished: run.result ? !run.result.isError : false,
  };
}
