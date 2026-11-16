import { describe, expect, it } from 'vitest';
import { run } from '../main';
import { fakeGit, type FakeRepo } from '../testing/fake-git';
import { fakeIo } from '../testing/fake-io';
import { arrow, box, mirrorText, tab } from '../testing/review-fixtures';

// `link review` (docs/specs/027-repositories/blueprints/link-review.md): offline, from git alone, real PNGs at
// scale 2, each named by a hash of its drawing.

const PNG = [0x89, 0x50, 0x4e, 0x47];
const flowBefore = tab('flow', 'Flow', [
  box('a', 'Cart', 0),
  box('b', 'Pay', 200),
  arrow('x', 'a', 'b'),
]);
const flowAfter = tab('flow', 'Flow', [
  box('a', 'Cart', 0),
  box('b', 'Pay now', 200),
  box('c', 'Done', 400),
]);
const one = (id: string, label: string) => tab(id, 'Same', [box('s', label, 0)]);

const repo: FakeRepo = {
  commits: {
    base: {
      'docs/shop.livediagram.json': mirrorText('d1', 'Shop', [flowBefore]),
      'docs/gone.livediagram.json': mirrorText('d2', 'Gone', [one('g', 'G')]),
      'docs/fixed.livediagram.json': '{ broken',
      'docs/conflict.livediagram.json': mirrorText('d4', 'Conflict', [one('c', 'C')]),
    },
    head: {
      'docs/shop.livediagram.json': mirrorText('d1', 'Shop', [flowAfter]),
      'docs/fixed.livediagram.json': mirrorText('d3', 'Fixed', [one('f', 'F')]),
      'docs/conflict.livediagram.json': '<<<<<<< ours\n=======\n>>>>>>> theirs\n',
      'docs/plain.livediagram.json': '{"kind":"something else"}',
      'docs/twin.livediagram.json': mirrorText('d1', 'Shop', [flowAfter]),
      'README.md': 'changed',
    },
  },
  refs: { main: 'base', HEAD: 'head' },
  mergeBase: 'base',
};

async function review(argv: string[], r: FakeRepo = repo) {
  const io = fakeIo({ tool: fakeGit(r).tool, env: { LIVEDIAGRAM_DEBUG: '1' } });
  const code = await run(['link', 'review', ...argv], io);
  return { code, io, out: io.out(), err: io.err() };
}

describe('link review', () => {
  it('draws each changed tab before and after, writes the comment, and sends nothing', async () => {
    const { code, io, out, err } = await review([
      'main',
      '--image-url',
      'https://x/{file}?raw=true',
    ]);
    expect(code).toBe(0);
    expect(io.requests).toEqual([]);
    const lines = out.trim().split('\n');
    expect(lines[0]).toBe('livediagram-review/comment.md');
    expect(
      lines
        .slice(1)
        .every((l) => /^livediagram-review\/[0-9a-f]{16}\.png {2}\d+×\d+ · \d+ KB$/.test(l)),
    ).toBe(true);
    // Shop's Flow before and after, Fixed's (its base copy no mirror file) and Gone's single side.
    expect(lines).toHaveLength(5);
    for (const line of lines.slice(1)) {
      const path = `/work/${line.split('  ')[0]}`;
      expect([...io.byteMap.get(path)!.slice(0, 4)]).toEqual(PNG);
    }
    expect(lines.some((l) => l.includes('  448×248 · '))).toBe(true);
    const comment = io.fileMap.get('/work/livediagram-review/comment.md')!.data;
    expect(comment).toContain('3 tabs changed in 3 documents.');
    expect(comment).toContain('![Flow after](https://x/');
    expect(comment).toContain('`docs/fixed.livediagram.json` · new file');
    expect(comment).toContain('`docs/gone.livediagram.json` · file removed');
    expect(comment).toContain('- `docs/conflict.livediagram.json` (has conflict markers)');
    expect(comment).toContain('- `docs/plain.livediagram.json` (not a livediagram document)');
    expect(comment).toContain(
      '- `docs/twin.livediagram.json` (same document as docs/shop.livediagram.json)',
    );
    expect(err).toContain('[review] range base head files 6');
    expect(err).toContain('[review] skipped conflicted');
    expect(err).toContain('[review] skipped invalid');
    expect(err).toContain('[review] skipped duplicate');
    expect(err).toContain('[review] tab d1 flow changed +1 ~1 -1');
    expect(err).not.toContain('Pay now');
  });

  it('answers counts as JSON, writes where --out says, and links bare names without --image-url', async () => {
    const { io, out } = await review(['--json', 'main', 'HEAD', '--out', '/tmp/r']);
    const json = JSON.parse(out) as { pictures: unknown[] };
    expect(json).toMatchObject({
      comment: '/tmp/r/comment.md',
      documents: 3,
      tabs: 3,
      drawn: 3,
      listed: 0,
      skipped: 3,
    });
    expect(json.pictures).toHaveLength(4);
    expect(io.fileMap.get('/tmp/r/comment.md')!.data).toMatch(
      /!\[Flow after\]\([0-9a-f]{16}\.png\)/,
    );
  });

  it('draws at most ten tabs, names a repeated drawing once, and lists the rest', async () => {
    const many = Array.from({ length: 12 }, (_, i) => one(`t${i}`, 'Same box'));
    const r: FakeRepo = {
      commits: {
        base: {},
        head: { 'm.livediagram.json': mirrorText('d9', 'Many', many) },
      },
      refs: { main: 'base', HEAD: 'head' },
      mergeBase: 'base',
    };
    const { out, err, io } = await review(['--json', 'main'], r);
    expect(JSON.parse(out)).toMatchObject({ tabs: 12, drawn: 10, listed: 2, pictures: [{}] });
    expect(err).toContain('[review] capped 2');
    expect(io.fileMap.get('/work/livediagram-review/comment.md')!.data).toContain(
      '2 more tabs not drawn',
    );
  });

  it('refuses a bad ref with exit 2 and runs without git refused alike', async () => {
    const bad = await review(['nope']);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain('git cannot find the commit "nope"');
    const usage = await review(['main', '--image-url', 'https://x/']);
    expect(usage.code).toBe(2);
    expect(usage.err).toContain('needs {file}');
  });
});
