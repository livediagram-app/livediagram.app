import { describe, expect, it } from 'vitest';
import { linkInit, linkLs, linkStatus, MIRROR_LEVELS, sync } from './link';

// The repository link's verbs (docs/specs/027-repositories/blueprints/repository-link.md "The verbs"): declared
// here, run by the CLI (CLI55); what they print is theirs.

describe('link init', () => {
  it('takes a folder, repeated documents and a level, and prints the path written', () => {
    expect(
      linkInit.input.parse({ folder: 'Minigames', doc: ['3f9c', '7a1b'], level: 'files' }),
    ).toEqual({ folder: 'Minigames', doc: ['3f9c', '7a1b'], level: 'files' });
    expect(linkInit.input.safeParse({ level: 'all' }).success).toBe(false);
    expect(linkInit.text!({ path: '/work/livepages.toml' })).toEqual(['/work/livepages.toml']);
    expect(MIRROR_LEVELS).toEqual(['none', 'index', 'files']);
  });
});

describe('link status', () => {
  const output = {
    all: false,
    links: [
      {
        path: 'livepages.toml',
        rows: [
          {
            state: 'in-step',
            ref: 'aaaa',
            name: 'Home screen',
            path: 'diagrams/home-screen.livepages.json',
          },
          { state: 'behind', ref: 'bbbb1', name: 'Flow', path: null },
          { state: 'conflicted', ref: null, name: null, path: 'diagrams/x.livepages.json' },
          { state: '?', ref: 'cccc', name: 'Offline', path: null },
        ],
        totals: { 'in-step': 1, behind: 1, conflicted: 1, '?': 1 },
      },
    ],
  };

  it('prints one aligned row per document or file, then the totals in state order', () => {
    expect(linkStatus.text!(output)).toEqual([
      'in-step     aaaa   "Home screen"  diagrams/home-screen.livepages.json',
      'behind      bbbb1  "Flow"',
      'conflicted  -                     diagrams/x.livepages.json',
      '?           cccc   "Offline"',
      '1 in-step · 1 behind · 1 conflicted · 1 ?',
    ]);
  });

  it('names each link before its rows under --all, a blank line between, and counts none when nothing is covered', () => {
    const empty = { path: 'b/livepages.toml', rows: [], totals: {} };
    expect(linkStatus.text!({ all: true, links: [output.links[0]!, empty] })).toEqual([
      'livepages.toml',
      ...linkStatus.text!(output),
      '',
      'b/livepages.toml',
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
    const result = { lines: ['+ diagrams/home.livepages.json  "Home" · 1 tab · rev 3'], exit: 1 };
    expect(sync.text!(result)).toEqual(result.lines);
    expect(sync.json!(result)).toEqual({ lines: result.lines });
    expect(sync.exitCode!(result)).toBe(1);
    expect(sync.telemetryType!(sync.input.parse({ watch: true }))).toBe('SyncWatch');
    expect(sync.telemetryType!(sync.input.parse({}))).toBe('Sync');
  });
});
