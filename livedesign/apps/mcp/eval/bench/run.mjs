#!/usr/bin/env node
// Runs the benchmark: each task, on each model, a number of times, as a real headless Claude session with the
// livedesign MCP mounted and nothing else (docs/instructions/evaluate-mcp-output.md). Each run gets its own fresh
// library (a token minted for a throwaway owner), so runs never see each other's designs. Writes, per run,
// runs/<round>/<task>-<model>-<n>.{jsonl,snapshot.json} (and .base.jsonl for an edit task's first turn).
//
//   node bench/run.mjs --round r1 [--tasks all|<area>|<ids>] [--models haiku,sonnet,opus] [--repeat 2]
//                      [--concurrency 4] [--api-dir ../../api]
//
// Needs the local MCP + api running (MCP_URL, default http://127.0.0.1:8798/mcp) and the `claude` CLI signed in.
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { seedGalleries } from './gallery-seed.mjs';
import { connect, DEFAULT_MCP_URL } from './mcp-client.mjs';
import { snapshot } from './snapshot.mjs';
import { selectTasks, taskById } from './tasks/index.mjs';
import { parseTranscript } from './transcript.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_URL = process.env.MCP_URL ?? DEFAULT_MCP_URL;
// What the assistant is told besides the MCP's own instructions: as little as a chat app says, and a fixed date so
// date questions ("18 December") read the same in every round.
export const SYSTEM_PROMPT =
  'You are Claude, an AI assistant made by Anthropic, chatting with a user who has connected the livedesign ' +
  'connector. Use its tools to do what they ask, then reply to them. The current date is Friday 16 October 2026.';
const RUN_TIMEOUT_MS = 20 * 60_000;
const TOKEN_TTL_MS = 30 * 86_400_000;

const { values: opts } = parseArgs({
  options: {
    round: { type: 'string' },
    tasks: { type: 'string', default: 'all' },
    models: { type: 'string', default: 'haiku,sonnet,opus' },
    repeat: { type: 'string', default: '2' },
    concurrency: { type: 'string', default: '4' },
    'api-dir': { type: 'string', default: resolve(HERE, '../../../api') },
  },
});
if (!opts.round) throw new Error('--round is required');
const OUT = resolve(HERE, '../runs', opts.round);
mkdirSync(OUT, { recursive: true });

// Every run's plain token and its owner, minted into local D1 in one write before the round starts.
function mintTokens(count) {
  const now = Date.now();
  const tokens = [];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const token = `lvd_${randomBytes(32).toString('base64url')}`;
    const owner = `bench_${opts.round}_${randomUUID().slice(0, 8)}`;
    const hash = createHash('sha256').update(token).digest('hex');
    tokens.push({ token, owner });
    rows.push(
      `insert into api_tokens(id,owner_id,token_hash,name,created_at,expires_at,revoked,read_only) values` +
        `('${randomUUID()}','${owner}','${hash}','bench',${now},${now + TOKEN_TTL_MS},0,0);`,
    );
  }
  const file = join(mkdtempSync(join(tmpdir(), 'ldbench-sql-')), 'mint.sql');
  writeFileSync(file, rows.join('\n'));
  const res = spawnSync(
    'corepack',
    [
      'pnpm',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--persist-to',
      '.wrangler/state',
      '--file',
      file,
    ],
    { cwd: opts['api-dir'], encoding: 'utf8' },
  );
  if (res.status !== 0) throw new Error(`Minting tokens failed:\n${res.stderr || res.stdout}`);
  return tokens;
}

// One headless turn; answers the transcript. `resume` continues an earlier turn's session (an edit task).
function claudeTurn({ prompt, model, token, cwd, resume }) {
  writeFileSync(
    join(cwd, 'mcp.json'),
    JSON.stringify({
      mcpServers: {
        livedesign: { type: 'http', url: MCP_URL, headers: { Authorization: `Bearer ${token}` } },
      },
    }),
  );
  const args = [
    '-p',
    prompt,
    '--model',
    model,
    '--mcp-config',
    'mcp.json',
    '--strict-mcp-config',
    '--tools',
    '',
    '--allowedTools',
    'mcp__livedesign',
    '--setting-sources',
    '',
    '--system-prompt',
    SYSTEM_PROMPT,
    '--output-format',
    'stream-json',
    '--verbose',
    ...(resume ? ['--resume', resume] : []),
  ];
  return new Promise((done) => {
    // Every tool schema loaded up front, as a chat app's connector is, never behind a tool search.
    const child = spawn('claude', args, {
      cwd,
      env: { ...process.env, ENABLE_TOOL_SEARCH: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => child.kill('SIGTERM'), RUN_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ transcript: out, code, stderr: err.slice(-2000) });
    });
  });
}

async function runJob(job) {
  const { task, model, n, token } = job;
  const name = `${task.id}-${model}-${n}`;
  if (existsSync(join(OUT, `${name}.snapshot.json`))) return console.log(`skip ${name} (done)`);
  // A directory outside the repo, so no CLAUDE.md, memory or project settings reach the assistant.
  const cwd = mkdtempSync(join(tmpdir(), 'ldbench-'));
  const started = Date.now();
  try {
    const client = await connect({ url: MCP_URL, token });
    // An edit task starts from what its first task's prompt takes for granted too ("our onboarding screens").
    const setup = task.setup ?? (task.after ? taskById(task.after).setup : undefined);
    const touched = new Set(setup ? await setup(client) : []);
    // The pictures the prompt says the user has uploaded, seeded into this run's own gallery before the round.
    const { gallery } = job;
    let resume;
    if (task.after) {
      const base = await claudeTurn({ prompt: taskById(task.after).prompt, model, token, cwd });
      writeFileSync(join(OUT, `${name}.base.jsonl`), base.transcript);
      const parsed = parseTranscript(base.transcript);
      parsed.designIds.forEach((id) => touched.add(id));
      resume = parsed.sessionId ?? undefined;
    }
    let turn = await claudeTurn({ prompt: task.prompt, model, token, cwd, resume });
    // The local server now and then refuses a session's first connection: such a run never had the tools, so it is
    // run once more rather than scored.
    if (parseTranscript(turn.transcript).mcpConnected === false) {
      console.log(`retry ${name}: the MCP did not connect`);
      turn = await claudeTurn({ prompt: task.prompt, model, token, cwd, resume });
    }
    writeFileSync(join(OUT, `${name}.jsonl`), turn.transcript);
    if (turn.code !== 0) writeFileSync(join(OUT, `${name}.stderr.txt`), turn.stderr);
    parseTranscript(turn.transcript).designIds.forEach((id) => touched.add(id));
    const snap = { ...(await snapshot(client, [...touched])), ...(gallery ? { gallery } : {}) };
    writeFileSync(join(OUT, `${name}.snapshot.json`), JSON.stringify(snap));
    console.log(
      `done ${name} in ${Math.round((Date.now() - started) / 1000)}s (exit ${turn.code})`,
    );
  } catch (err) {
    writeFileSync(join(OUT, `${name}.error.txt`), String(err?.stack ?? err));
    console.log(`FAILED ${name}: ${err?.message ?? err}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

async function main() {
  const tasks = selectTasks(opts.tasks);
  const models = opts.models.split(',').map((m) => m.trim());
  const repeat = Number(opts.repeat);
  const jobs = [];
  for (let n = 1; n <= repeat; n++)
    for (const model of models) for (const task of tasks) jobs.push({ task, model, n });
  const tokens = mintTokens(jobs.length);
  jobs.forEach((j, i) => Object.assign(j, tokens[i]));
  // Each run's token (local D1 only; runs/ is gitignored), so its library can be read again after the round.
  const prior = existsSync(join(OUT, 'tokens.json'))
    ? JSON.parse(readFileSync(join(OUT, 'tokens.json'), 'utf8'))
    : {};
  for (const j of jobs) {
    const name = `${j.task.id}-${j.model}-${j.n}`;
    if (prior[name] && existsSync(join(OUT, `${name}.snapshot.json`))) j.token = prior[name];
    else prior[name] = j.token;
  }
  writeFileSync(join(OUT, 'tokens.json'), JSON.stringify(prior, null, 1));
  // Every gallery a task needs, seeded now: the seeding blocks, so it must finish before any run starts.
  const toSeed = jobs.filter(
    (j) => j.task.gallery && !existsSync(join(OUT, `${j.task.id}-${j.model}-${j.n}.snapshot.json`)),
  );
  const galleries = seedGalleries(
    opts['api-dir'],
    toSeed.map((j) => ({ owner: j.owner, pictures: j.task.gallery })),
  );
  for (const j of toSeed) j.gallery = galleries.get(j.owner);
  // The tool list this round ran against, so a later round can compare what the assistant was offered.
  const client = await connect({ url: MCP_URL, token: tokens[0] });
  writeFileSync(
    join(OUT, 'round.json'),
    JSON.stringify(
      {
        round: opts.round,
        startedAt: new Date().toISOString(),
        commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
        models,
        repeat,
        tasks: tasks.map((t) => t.id),
        systemPrompt: SYSTEM_PROMPT,
        instructions: client.instructions,
        tools: await client.tools(),
      },
      null,
      1,
    ),
  );
  console.log(`${jobs.length} runs, ${opts.concurrency} at a time, into ${OUT}`);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) await runJob(jobs[next++]);
  };
  await Promise.all(Array.from({ length: Number(opts.concurrency) }, worker));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
