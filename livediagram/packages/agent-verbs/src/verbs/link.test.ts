import { describe, expect, it } from 'vitest';
import {
  linkFromCode,
  linkInit,
  linkLs,
  linkReview,
  linkStatus,
  MIRROR_LEVELS,
  REVIEW_OUT_DIR,
  sync,
} from './link';

// The repository link's verbs (docs/specs/027-repositories/blueprints/repository-link.md "The verbs"): declared
// here, run by the CLI (CLI55); what they print is theirs.

describe('link init', () => {
  it('takes a folder, repeated documents and a level, and prints the path written', () => {
    expect(
      linkInit.input.parse({ folder: 'Minigames', doc: ['3f9c', '7a1b'], level: 'files' }),
    ).toEqual({ folder: 'Minigames', doc: ['3f9c', '7a1b'], level: 'files' });
    expect(linkInit.input.safeParse({ level: 'all' }).success).toBe(false);
    expect(linkInit.text!({ path: '/work/livediagram.toml' })).toEqual(['/work/livediagram.toml']);
    expect(MIRROR_LEVELS).toEqual(['none', 'index', 'files']);
  });
});

describe('link status', () => {
  const output = {
    all: false,
    links: [
      {
        path: 'livediagram.toml',
        rows: [
          {
            state: 'in-step',
            ref: 'aaaa',
            name: 'Home screen',
            path: 'diagrams/home-screen.livediagram.json',
          },
          { state: 'behind', ref: 'bbbb1', name: 'Flow', path: null },
          { state: 'conflicted', ref: null, name: null, path: 'diagrams/x.livediagram.json' },
          { state: '?', ref: 'cccc', name: 'Offline', path: null },
        ],
        totals: { 'in-step': 1, behind: 1, conflicted: 1, '?': 1 },
      },
    ],
  };

  it('prints one aligned row per document or file, then the totals in state order', () => {
    expect(linkStatus.text!(output)).toEqual([
      'in-step     aaaa   "Home screen"  diagrams/home-screen.livediagram.json',
      'behind      bbbb1  "Flow"',
      'conflicted  -                     diagrams/x.livediagram.json',
      '?           cccc   "Offline"',
      '1 in-step · 1 behind · 1 conflicted · 1 ?',
    ]);
  });

  it('names each link before its rows under --all, a blank line between, and counts none when nothing is covered', () => {
    const empty = { path: 'b/livediagram.toml', rows: [], totals: {} };
    expect(linkStatus.text!({ all: true, links: [output.links[0]!, empty] })).toEqual([
      'livediagram.toml',
      ...linkStatus.text!(output),
      '',
      'b/livediagram.toml',
      '0 documents',
    ]);
  });
});

describe('link ls', () => {
  it('prints as document ls prints', () => {
    const listed = {
      documents: [
        { ref: 'aaaa', id: 'aaaa-1', name: 'Home', library: 'personal', updated: '2026-10-05' },
      ],
      more: 0,
    };
    expect(linkLs.text!(listed)).toEqual(['aaaa  "Home"  personal  2026-10-05']);
    expect(linkLs.quiet!(listed)).toEqual(['aaaa']);
    expect(linkLs.input.parse({})).toEqual({ limit: 20 });
  });
});

describe('sync', () => {
  it('prints its lines, exits with the pass’s code, and counts --watch as SyncWatch', () => {
    const result = { lines: ['+ diagrams/home.livediagram.json  "Home" · 1 tab · rev 3'], exit: 1 };
    expect(sync.text!(result)).toEqual(result.lines);
    expect(sync.json!(result)).toEqual({ lines: result.lines });
    expect(sync.exitCode!(result)).toBe(1);
    expect(sync.telemetryType!(sync.input.parse({ watch: true }))).toBe('SyncWatch');
    expect(sync.telemetryType!(sync.input.parse({}))).toBe('Sync');
  });
});

describe('link from-code', () => {
  it('takes files, a document, a name, an environment and --dry-run, and prints the graph only on a dry run', () => {
    expect(
      linkFromCode.input.parse({
        files: ['wrangler.toml'],
        doc: 'Arch',
        name: 'Api',
        env: 'staging',
        dryRun: true,
      }),
    ).toEqual({ files: ['wrangler.toml'], doc: 'Arch', name: 'Api', env: 'staging', dryRun: true });
    expect(linkFromCode.input.safeParse({ name: '' }).success).toBe(false);
    const graph = { nodes: [], edges: [] };
    const made = { text: 'tab t1 "Api"', id: 't1', dryRun: false, graph: null };
    expect(linkFromCode.text!(made)).toEqual(['tab t1 "Api"']);
    expect(linkFromCode.json!(made)).toEqual({ id: 't1', text: 'tab t1 "Api"' });
    expect(linkFromCode.quiet!(made)).toEqual(['t1']);
    const dry = { text: '', id: null, dryRun: true, graph };
    expect(linkFromCode.json!(dry)).toBe(graph);
    expect(linkFromCode.quiet!(dry)).toEqual([]);
  });
});

describe('link review', () => {
  it('takes a base, a head (HEAD), an out directory and an image address holding {file}', () => {
    expect(linkReview.input.parse({ base: 'origin/main' })).toEqual({
      base: 'origin/main',
      head: 'HEAD',
      out: REVIEW_OUT_DIR,
    });
    expect(
      linkReview.input.parse({ base: 'a', head: 'b', out: 'r', imageUrl: 'https://x/{file}' }),
    ).toEqual({ base: 'a', head: 'b', out: 'r', imageUrl: 'https://x/{file}' });
    const refused = linkReview.input.safeParse({ base: 'a', imageUrl: 'https://x/' });
    expect(refused.success).toBe(false);
    expect(refused.error!.issues[0]!.message).toBe('needs {file} where the picture’s name goes');
    expect(linkReview.input.safeParse({ base: '' }).success).toBe(false);
  });

  it('prints its lines, answers the counts as JSON and the comment’s path when quiet', () => {
    const counts = {
      comment: 'r/comment.md',
      documents: 1,
      tabs: 2,
      drawn: 2,
      listed: 0,
      skipped: 0,
      pictures: [{ file: 'a.png', width: 10, height: 20 }],
    };
    const result = { ...counts, lines: ['r/comment.md', 'r/a.png  10×20 · 1 KB'] };
    expect(linkReview.text!(result)).toEqual(result.lines);
    expect(linkReview.json!(result)).toEqual(counts);
    expect(linkReview.quiet!(result)).toEqual(['r/comment.md']);
    expect(linkReview.offline).toBe(true);
  });
});
