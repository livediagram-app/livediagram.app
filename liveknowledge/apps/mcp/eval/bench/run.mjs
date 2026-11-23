#!/usr/bin/env node
// Runs the benchmark: each task, on each model, a number of times, as a real headless Claude session with the
// liveknowledge MCP mounted and nothing else (docs/instructions/evaluate-mcp-output.md). Each run gets its own fresh
// library (a token minted for a throwaway account), so runs never see each other's documents. Writes, per run,
// runs/<round>/<task>-<model>-<n>.{jsonl,snapshot.json} (and .base.jsonl for an edit task's first turn).
//
//   node bench/run.mjs --round r1 [--tasks all|<area>|<ids>] [--models haiku,sonnet,opus] [--repeat 2]
//                      [--concurrency 4] [--api-dir ../../api]
//
// Needs the local MCP + api running (MCP_URL, default http://127.0.0.1:9288/mcp) and the `claude` CLI signed in.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBench } from '@liveworkspace/mcp-kit/eval/run';
import { snapshot } from './snapshot.mjs';
import { selectTasks, taskById } from './tasks/index.mjs';
import { parseTranscript } from './transcript.mjs';

runBench({
  here: dirname(fileURLToPath(import.meta.url)),
  product: 'liveknowledge',
  mcpUrl: 'http://127.0.0.1:9288/mcp',
  galleryApp: 'liveknowledge.app',
  idsOf: (run) => run.documentIds,
  snapshot,
  selectTasks,
  taskById,
  parseTranscript,
});
