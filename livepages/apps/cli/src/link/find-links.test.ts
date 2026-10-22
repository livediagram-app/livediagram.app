import { describe, expect, it } from 'vitest';
import { CliError, type CliFailure } from '../output/cli-error';
import { fakeIo } from '../testing/fake-io';
import { linksBelow, nearestLink } from './find-links';

// Finding the link (docs/specs/027-repositories/blueprints/repository-link.md "Finding the link"): the nearest at
// or above the working directory, or with --all every one below it.

const LINK = '[covers]\nfolder = "f1"\n';

async function failureOf(run: () => Promise<unknown>): Promise<CliFailure> {
  try {
    await run();
  } catch (err) {
    if (err instanceof CliError) return err.failure;
    throw err;
  }
  throw new Error('expected a CliError');
}

describe('nearestLink', () => {
  it('finds the link in the working directory, or the first above it', async () => {
    const io = fakeIo({
      files: {
        '/repo/livepages.toml': LINK,
        '/repo/packages/app/livepages.toml': '[covers]\nfolder = "f2"\n',
        '/repo/packages/app/src/main.ts': '',
      },
    });
    expect((await nearestLink(io, '/repo/packages/app/src')).covers.folder).toBe('f2');
    expect(await nearestLink(io, '/repo/packages')).toMatchObject({
      path: '/repo/livepages.toml',
      root: '/repo',
    });
  });

  it('refuses when there is none at or above', async () => {
    expect(await failureOf(() => nearestLink(fakeIo(), '/work/a'))).toEqual({
      exit: 3,
      code: 'no_link',
      message: 'no livepages.toml in /work/a or above',
      hint: 'livepages link init --folder <folder>',
    });
  });

  it('stops at a Windows drive root', async () => {
    expect(await failureOf(() => nearestLink(fakeIo(), 'C:/work/a'))).toMatchObject({
      code: 'no_link',
      message: 'no livepages.toml in C:/work/a or above',
    });
  });

  it('reads the link through its real path', async () => {
    const io = fakeIo({
      files: { '/real/repo/livepages.toml': LINK },
      links: { '/repo': '/real/repo' },
    });
    io.fileMap.set('/repo/livepages.toml', { data: LINK, mode: 0o644 });
    expect((await nearestLink(io, '/repo')).path).toBe('/real/repo/livepages.toml');
  });

  it('refuses a mirror directory whose real path leaves the link root (E18)', async () => {
    const io = fakeIo({
      files: {
        '/repo/livepages.toml': `${LINK}[mirror]\ndir = "docs/diagrams"\n`,
        '/home/agent/secret/x': '',
      },
      links: { '/repo/docs': '/home/agent/secret' },
    });
    expect(await failureOf(() => nearestLink(io, '/repo'))).toEqual({
      exit: 1,
      code: 'invalid_dir',
      message: '/repo/livepages.toml: mirror.dir must stay inside /repo, not "docs/diagrams"',
    });
    const inside = fakeIo({
      files: { '/repo/livepages.toml': `${LINK}[mirror]\ndir = "docs/diagrams"\n` },
      links: { '/repo/docs': '/repo/documentation' },
    });
    inside.dirMap.add('/repo/documentation');
    expect((await nearestLink(inside, '/repo')).mirror.dir).toBe('docs/diagrams');
  });

  it('logs what this slice leaves unread', async () => {
    const io = fakeIo({
      env: { LIVEPAGES_DEBUG: '1' },
      files: {
        '/repo/livepages.toml': `${LINK}[hooks]\nblock = true\n[[sources]]\npath = "a"\n`,
      },
    });
    await nearestLink(io, '/repo');
    expect(io.err()).toContain('[sync] link unread: hooks block true, 1 sources\n');
  });
});

describe('linksBelow', () => {
  it('walks depth first in byte order, skipping hidden, git and node_modules directories', async () => {
    const io = fakeIo({
      files: {
        '/work/livepages.toml': LINK,
        '/work/apps/b/livepages.toml': LINK,
        '/work/apps/a/livepages.toml': LINK,
        '/work/.git/livepages.toml': LINK,
        '/work/.cache/livepages.toml': LINK,
        '/work/node_modules/x/livepages.toml': LINK,
        '/work/zeta/livepages.toml/inner': '',
      },
      links: { '/work/linked': '/elsewhere' },
    });
    io.fileMap.set('/elsewhere/livepages.toml', { data: LINK, mode: 0o644 });
    expect((await linksBelow(io, '/work')).map((l) => l.path)).toEqual([
      '/work/apps/a/livepages.toml',
      '/work/apps/b/livepages.toml',
      '/work/livepages.toml',
    ]);
  });

  it('refuses when there is none below', async () => {
    expect(await failureOf(() => linksBelow(fakeIo(), '/work'))).toMatchObject({
      exit: 3,
      code: 'no_link',
      message: 'no livepages.toml in /work or below',
    });
  });
});
