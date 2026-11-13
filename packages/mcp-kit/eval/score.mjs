// Scores an MCP benchmark round from its saved transcripts and snapshots, offline (no server needed), and writes
// runs/<round>/results.json and summary.md. With --compare <earlier round> it adds what moved between the two.
// Each product's eval/bench/score.mjs hands in its runs folder, its tasks, checks and transcript reader, and the
// snapshot a run with none stands for.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { compareRounds, summarise } from './summary.mjs';

const RUN_FILE = /^([A-Z]\d+)-([a-z0-9.-]+)-(\d+)\.jsonl$/;

/**
 * @param {{
 *   runsDir: string,
 *   taskById: (id: string) => { area: string },
 *   runChecks: (task: unknown, ctx: { run: unknown, snap: unknown }) => unknown,
 *   parseTranscript: (text: string) => { mcpConnected?: boolean, calls: { tool: string, isError?: boolean, error?: unknown }[], finalText?: string },
 *   metricsOf: (run: unknown, deprecated: Set<string>) => unknown,
 *   emptySnapshot: unknown,
 * }} deps
 */
export function createScoreRound({
  runsDir,
  taskById,
  runChecks,
  parseTranscript,
  metricsOf,
  emptySnapshot,
}) {
  function scoreRound(round) {
    const dir = join(runsDir, round);
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
        : emptySnapshot;
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
        n +
        t.name.length +
        (t.description ?? '').length +
        JSON.stringify(t.inputSchema ?? {}).length,
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
  return scoreRound;
}

/** The command line: `node bench/score.mjs --round r2 [--compare r1]`. */
export function scoreMain(scoreRound, runsDir, args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: { round: { type: 'string' }, compare: { type: 'string' } },
  });
  if (!values.round) throw new Error('--round is required');
  const results = scoreRound(values.round);
  const dir = join(runsDir, values.round);
  writeFileSync(join(dir, 'results.json'), JSON.stringify(results, null, 1));
  let md = summarise(results);
  if (values.compare) md += '\n' + compareRounds(scoreRound(values.compare), results);
  writeFileSync(join(dir, 'summary.md'), md);
  console.log(md);
  return md;
}
