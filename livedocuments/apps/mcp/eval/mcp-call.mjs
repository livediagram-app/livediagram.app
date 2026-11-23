#!/usr/bin/env node
// Drives a livedocuments MCP server over JSON-RPC (streamable HTTP), so an evaluating agent that cannot mount a new MCP
// server mid-session still calls exactly the tools a real assistant would (docs/instructions/evaluate-mcp-output.md).
//
//   node mcp-call.mjs instructions            the server instructions
//   node mcp-call.mjs tools [<name> ...]      one line per tool, or the full description and schema of those named
//   node mcp-call.mjs <tool> '<json args>'    call a tool and print its result
//
// Environment: LIVEDOCUMENTS_TOKEN (an lwt_ API token; else read from token.env beside this file), MCP_URL (default
// http://127.0.0.1:8988/mcp), EVAL_LOG (a jsonl of every call; default runs/calls.jsonl) and EVAL_IMG_DIR (where
// image results are saved; default runs/shots). Never commit a token: token.env and runs/ are gitignored.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mcpCallMain } from '@liveworkspace/mcp-kit/eval/mcp-call';

mcpCallMain({
  here: dirname(fileURLToPath(import.meta.url)),
  tokenEnv: 'LIVEDOCUMENTS_TOKEN',
  mcpUrl: 'http://127.0.0.1:8988/mcp',
});
