import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScoreRound, scoreMain } from './score.mjs';

afterEach(() => vi.restoreAllMocks());

// A round on disk: its meta, two runs of one task (one with a snapshot), one whose MCP never connected.
function round(runsDir: string, name: string) {
  const dir = join(runsDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'round.json'),
    JSON.stringify({
      models: ['m'],
      tools: [
        { name: 'list', description: 'Lists', inputSchema: { a: 1 } },
        { name: 'old', description: 'Deprecated: use list' },
      ],
      instructions: 'x',
    }),
  );
  writeFileSync(join(dir, 'A1-m-1.jsonl'), 'ok');
  writeFileSync(join(dir, 'A1-m-1.snapshot.json'), JSON.stringify({ items: ['i'] }));
  writeFileSync(join(dir, 'A1-m-2.jsonl'), 'error');
  writeFileSync(join(dir, 'A1-m-3.jsonl'), 'offline');
  writeFileSync(join(dir, 'notes.txt'), 'not a run');
  return dir;
}

function scorer(runsDir: string) {
  const snaps: unknown[] = [];
  const scoreRound = createScoreRound({
    runsDir,
    taskById: () => ({ area: 'basics' }),
    runChecks: (_task: unknown, ctx: { snap: unknown }) => {
      snaps.push(ctx.snap);
      return [{ name: 'made', pass: true }];
    },
    parseTranscript: (text: string) => ({
      mcpConnected: text !== 'offline',
      calls:
        text === 'error'
          ? [{ tool: 'list', isError: true, error: 'boom' }]
          : [{ tool: 'list', isError: false }],
      finalText: text,
    }),
    metricsOf: (_run: unknown, deprecated: Set<string>) => ({ deprecated: [...deprecated] }),
    emptySnapshot: { items: [] },
  });
  return { scoreRound, snaps };
}

describe('createScoreRound', () => {
  it('scores every connected run, leaving out the ones that never connected', () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'mcp-score-'));
    round(runsDir, 'r1');
    const { scoreRound, snaps } = scorer(runsDir);
    const results = scoreRound('r1');
    expect(results.deprecated).toEqual(['old']);
    expect(results.excluded).toEqual(['A1-m-3']);
    expect(results.meta).toMatchObject({ models: ['m'], toolCount: 2 });
    expect(results.meta.tools).toBeUndefined();
    expect(results.meta.toolChars).toBe('list'.length + 'Lists'.length + 7 + 'old'.length + 20 + 2);
    expect(results.runs.map((r: { name: string }) => r.name)).toEqual(['A1-m-1', 'A1-m-2']);
    expect(results.runs[1]).toMatchObject({
      task: 'A1',
      area: 'basics',
      model: 'm',
      n: 2,
      errors: [{ tool: 'list', error: 'boom' }],
      tools: ['list'],
    });
    // A run with no snapshot is scored against the product's empty one.
    expect(snaps).toEqual([{ items: ['i'] }, { items: [] }]);
  });
});

describe('scoreMain', () => {
  it('writes the results and the summary, with the comparison when asked', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const runsDir = mkdtempSync(join(tmpdir(), 'mcp-score-main-'));
    const dir = round(runsDir, 'r2');
    round(runsDir, 'r1');
    const { scoreRound } = scorer(runsDir);
    const md = scoreMain(scoreRound, runsDir, ['--round', 'r2', '--compare', 'r1']);
    expect(JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8')).round).toBe('r2');
    expect(readFileSync(join(dir, 'summary.md'), 'utf8')).toBe(md);
    expect(scoreMain(scoreRound, runsDir, ['--round', 'r2'])).not.toContain('r1');
    expect(() => scoreMain(scoreRound, runsDir, [])).toThrow(/--round is required/);
  });
});
