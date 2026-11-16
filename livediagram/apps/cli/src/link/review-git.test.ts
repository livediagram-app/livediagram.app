import { describe, expect, it } from 'vitest';
import { CliError } from '../output/cli-error';
import { fakeGit, type FakeRepo } from '../testing/fake-git';
import { fakeIo } from '../testing/fake-io';
import { changedMirrorPaths, fileAt, reviewRange } from './review-git';

// The git `link review` asks (docs/specs/027-repositories/blueprints/link-review.md "`link review`" steps 1 to 3).

const repo = (over: Partial<FakeRepo> = {}): FakeRepo => ({
  commits: {
    c0: { 'a.livediagram.json': 'A0', 'README.md': 'r0' },
    c1: { 'a.livediagram.json': 'A1', 'b/c.livediagram.json': 'C1', 'README.md': 'r1' },
  },
  refs: { main: 'c0', HEAD: 'c1' },
  mergeBase: 'c0',
  ...over,
});

const ioOf = (r: FakeRepo) => {
  const git = fakeGit(r);
  return { io: fakeIo({ tool: git.tool }), calls: git.calls };
};

async function failure(p: Promise<unknown>) {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(CliError);
  return (err as CliError).failure;
}

describe('reviewRange', () => {
  it('answers the merge base and head, every ref after --end-of-options', async () => {
    const { io, calls } = ioOf(repo());
    expect(await reviewRange(io, 'main', 'HEAD')).toEqual({ base: 'c0', head: 'c1' });
    expect(calls[1]).toEqual([
      'rev-parse',
      '--verify',
      '--quiet',
      '--end-of-options',
      'main^{commit}',
    ]);
    expect(calls[3]).toEqual(['merge-base', '--end-of-options', 'c0', 'c1']);
  });

  it('refuses outside a work tree, or without git', async () => {
    expect(
      (await failure(reviewRange(ioOf(repo({ inside: false })).io, 'main', 'HEAD'))).code,
    ).toBe('not_a_repository');
    expect((await failure(reviewRange(fakeIo(), 'main', 'HEAD'))).code).toBe('not_a_repository');
  });

  it('names a ref git cannot find, base or head', async () => {
    const base = await failure(reviewRange(ioOf(repo()).io, 'nope', 'HEAD'));
    expect(base).toMatchObject({
      exit: 2,
      code: 'bad_revision',
      message: 'git cannot find the commit "nope"',
    });
    const head = await failure(reviewRange(ioOf(repo()).io, 'main', 'gone'));
    expect(head.message).toBe('git cannot find the commit "gone"');
  });

  it('names the full history when there is no merge base', async () => {
    const f = await failure(reviewRange(ioOf(repo({ mergeBase: null })).io, 'main', 'HEAD'));
    expect(f).toMatchObject({
      code: 'no_merge_base',
      hint: 'fetch the full history (actions/checkout fetch-depth: 0)',
    });
  });
});

describe('changedMirrorPaths and fileAt', () => {
  it('lists only changed mirror files, and reads a file at a commit or null', async () => {
    const { io } = ioOf(repo());
    const range = { base: 'c0', head: 'c1' };
    expect(await changedMirrorPaths(io, range)).toEqual([
      'a.livediagram.json',
      'b/c.livediagram.json',
    ]);
    expect(await fileAt(io, 'c1', 'b/c.livediagram.json')).toBe('C1');
    expect(await fileAt(io, 'c0', 'b/c.livediagram.json')).toBeNull();
  });

  it('refuses when git cannot compare', async () => {
    const f = await failure(
      changedMirrorPaths(ioOf(repo({ diffFails: true })).io, { base: 'c0', head: 'c1' }),
    );
    expect(f.code).toBe('git_failed');
  });
});
