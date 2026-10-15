#!/usr/bin/env node
// Drives a livediagram MCP server over JSON-RPC (streamable HTTP), so an evaluating agent that cannot mount a new MCP
// server mid-session still calls exactly the tools a real assistant would (docs/instructions/evaluate-mcp-output.md).
//
//   node mcp-call.mjs instructions            the server instructions
//   node mcp-call.mjs tools [<name> ...]      one line per tool, or the full description and schema of those named
//   node mcp-call.mjs <tool> '<json args>'    call a tool and print its result
//
// Environment: LIVEDIAGRAM_TOKEN (an lvd_ API token; else read from token.env beside this file), MCP_URL (default
// http://127.0.0.1:8798/mcp), EVAL_LOG (a jsonl of every call; default runs/calls.jsonl) and EVAL_IMG_DIR (where
// image results are saved; default runs/shots). Never commit a token: token.env and runs/ are gitignored.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.MCP_URL ?? 'http://127.0.0.1:8798/mcp';
const LOG = process.env.EVAL_LOG ?? join(HERE, 'runs', 'calls.jsonl');
const IMG_DIR = process.env.EVAL_IMG_DIR ?? join(HERE, 'runs', 'shots');

function token() {
  if (process.env.LIVEDIAGRAM_TOKEN) return process.env.LIVEDIAGRAM_TOKEN;
  const file = join(HERE, 'token.env');
  if (!existsSync(file))
    throw new Error('No token: set LIVEDIAGRAM_TOKEN or write TOKEN=lvd_… to eval/token.env');
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('TOKEN='));
  if (!line) throw new Error('eval/token.env has no TOKEN= line');
  return line.slice('TOKEN='.length).trim();
}

async function post(body, session) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify(body),
  });
  const sid = res.headers.get('Mcp-Session-Id') ?? session;
  const raw = await res.text();
  // A streamed reply carries its messages on `data:` lines; a plain one is the message itself.
  const messages = raw
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5)));
  if (messages.length === 0 && raw.trim()) messages.push(JSON.parse(raw));
  return { sid, message: messages.at(-1) ?? null };
}

async function open() {
  const { sid, message } = await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'eval', version: '1' },
    },
  });
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);
  return { sid, init: message };
}

async function main() {
  const [what, ...rest] = process.argv.slice(2);
  if (!what)
    throw new Error("usage: mcp-call.mjs instructions | tools [<name> ...] | <tool> '<json args>'");
  const { sid, init } = await open();
  if (what === 'instructions') return console.log(init?.result?.instructions ?? '');
  if (what === 'tools') {
    const { message } = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, sid);
    for (const t of message.result.tools) {
      if (rest.length && !rest.includes(t.name)) continue;
      console.log(
        rest.length
          ? JSON.stringify({ name: t.name, description: t.description, inputSchema: t.inputSchema })
          : `${t.name}: ${t.description.slice(0, 160)}`,
      );
    }
    return;
  }
  const args = rest[0] ? JSON.parse(rest[0]) : {};
  const started = Date.now();
  const { message } = await post(
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: what, arguments: args } },
    sid,
  );
  const out = message?.result ?? message?.error;
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(
    LOG,
    JSON.stringify({
      tool: what,
      args,
      isError: !out?.content || !!out.isError,
      ms: Date.now() - started,
    }) + '\n',
  );
  if (!out?.content) return console.log(JSON.stringify(out, null, 1));
  for (const c of out.content) {
    if (c.type === 'text') console.log(c.text);
    else if (c.type === 'image') {
      mkdirSync(IMG_DIR, { recursive: true });
      const file = join(IMG_DIR, `${what}-${Date.now()}.png`);
      writeFileSync(file, Buffer.from(c.data, 'base64'));
      console.log(`[image saved: ${file}]`);
    } else console.log(`[${c.type} omitted]`);
  }
  if (out.isError) console.log('(tool error)');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
