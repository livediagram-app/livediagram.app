#!/usr/bin/env node
// Scores a benchmark round from its saved transcripts and snapshots, offline (no server needed), and writes
// runs/<round>/results.json and summary.md. With --compare <earlier round> it adds what moved between the two.
//
//   node bench/score.mjs --round r2 [--compare r1]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runChecks } from './checks.mjs';
import { compareRounds, summarise } from './summary.mjs';
import { taskById } from './tasks/index.mjs';
import { metricsOf, parseTranscript } from './transcript.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = resolve(HERE, '../runs');
const RUN_FILE = /^([A-Z]\d+)-([a-z0-9.-]+)-(\d+)\.jsonl$/;

export function scoreRound(round) {
  const dir = join(RUNS, round);
  const meta = JSON.parse(readFileSync(join(dir, 'round.json'), 'utf8'));
  const deprecated = new Set(
    meta.tools.filter((t) => /^Deprecated\b/.test(t.description ?? '')).map((t) => t.name),
  );
  const runs = [];
  // Runs whose MCP never connected: they had no tools, so they say nothing about the tools and are left out.
  const excluded = [];
  for (const file of readdirSync(dir).sort()) {
    const m = RUN_FILE.exec(file);
    if (!m) continue;
    const [, taskId, model, n] = m;
    const name = file.slice(0, -'.jsonl'.length);
    const task = taskById(taskId);
    const run = parseTranscript(readFileSync(join(dir, file), 'utf8'));
    if (run.mcpConnected === false) {
      excluded.push(name);
      continue;
    }
    const snapFile = join(dir, `${name}.snapshot.json`);
    const snap = existsSync(snapFile)
      ? JSON.parse(readFileSync(snapFile, 'utf8'))
      : { documents: [] };
    runs.push({
      name,
      task: taskId,
      area: task.area,
      model,
      n: Number(n),
      metrics: metricsOf(run, deprecated),
      checks: runChecks(task, { run, snap }),
      errors: run.calls.filter((c) => c.isError).map((c) => ({ tool: c.tool, error: c.error })),
      tools: run.calls.map((c) => c.tool),
      finalText: run.finalText,
    });
  }
  const toolChars = meta.tools.reduce(
    (n, t) =>
      n + t.name.length + (t.description ?? '').length + JSON.stringify(t.inputSchema ?? {}).length,
    0,
  );
  return {
    round,
    meta: {
      ...meta,
      tools: undefined,
      instructions: undefined,
      toolCount: meta.tools.length,
      toolChars,
    },
    deprecated: [...deprecated],
    excluded,
    runs,
  };
}

function main() {
  const { values } = parseArgs({
    options: { round: { type: 'string' }, compare: { type: 'string' } },
  });
  if (!values.round) throw new Error('--round is required');
  const results = scoreRound(values.round);
  const dir = join(RUNS, values.round);
  writeFileSync(join(dir, 'results.json'), JSON.stringify(results, null, 1));
  let md = summarise(results);
  if (values.compare) md += '\n' + compareRounds(scoreRound(values.compare), results);
  writeFileSync(join(dir, 'summary.md'), md);
  console.log(md);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
