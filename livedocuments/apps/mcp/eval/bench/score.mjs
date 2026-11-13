#!/usr/bin/env node
// Scores a benchmark round from its saved transcripts and snapshots, offline (no server needed), and writes
// runs/<round>/results.json and summary.md. With --compare <earlier round> it adds what moved between the two.
// The scoring is @liveworkspace/mcp-kit's eval/score.mjs; this hands in this MCP's tasks, checks and transcripts.
//
//   node bench/score.mjs --round r2 [--compare r1]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScoreRound, scoreMain } from '@liveworkspace/mcp-kit/eval/score';
import { runChecks } from './checks.mjs';
import { taskById } from './tasks/index.mjs';
import { metricsOf, parseTranscript } from './transcript.mjs';

const RUNS = resolve(dirname(fileURLToPath(import.meta.url)), '../runs');

export const scoreRound = createScoreRound({
  runsDir: RUNS,
  taskById,
  runChecks,
  parseTranscript,
  metricsOf,
  emptySnapshot: { documents: [] },
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  scoreMain(scoreRound, RUNS);
