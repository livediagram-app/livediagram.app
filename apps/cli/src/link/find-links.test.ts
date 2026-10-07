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
        '/repo/livediagram.toml': LINK,
        '/repo/packages/app/livediagram.toml': '[covers]\nfolder = "f2"\n',
        '/repo/packages/app/src/main.ts': '',
      },
    });
    expect((await nearestLink(io, '/repo/packages/app/src')).covers.folder).toBe('f2');
    expect(await nearestLink(io, '/repo/packages')).toMatchObject({
      path: '/repo/livediagram.toml',
      root: '/repo',
    });
  });

  it('refuses when there is none at or above', async () => {
    expect(await failureOf(() => nearestLink(fakeIo(), '/work/a'))).toEqual({
      exit: 3,
      code: 'no_link',
      message: 'no livediagram.toml in /work/a or above',
      hint: 'livediagram link init --folder <folder>',
    });
  });

  it('reads the link through its real path', async () => {
    const io = fakeIo({
      files: { '/real/repo/livediagram.toml': LINK },
      links: { '/repo': '/real/repo' },
    });
    io.fileMap.set('/repo/livediagram.toml', { data: LINK, mode: 0o644 });
    expect((await nearestLink(io, '/repo')).path).toBe('/real/repo/livediagram.toml');
  });

  it('refuses a mirror directory whose real path leaves the link root (E18)', async () => {
    const io = fakeIo({
      files: {
        '/repo/livediagram.toml': `${LINK}[mirror]\ndir = "docs/diagrams"\n`,
        '/home/agent/secret/x': '',
      },
      links: { '/repo/docs': '/home/agent/secret' },
    });
    expect(await failureOf(() => nearestLink(io, '/repo'))).toEqual({
      exit: 1,
      code: 'invalid_dir',
      message: '/repo/livediagram.toml: mirror.dir must stay inside /repo, not "docs/diagrams"',
    });
    const inside = fakeIo({
      files: { '/repo/livediagram.toml': `${LINK}[mirror]\ndir = "docs/diagrams"\n` },
      links: { '/repo/docs': '/repo/documentation' },
    });
    inside.dirMap.add('/repo/documentation');
    expect((await nearestLink(inside, '/repo')).mirror.dir).toBe('docs/diagrams');
  });

  it('logs what this slice leaves unread', async () => {
    const io = fakeIo({
      env: { LIVEDIAGRAM_DEBUG: '1' },
      files: {
        '/repo/livediagram.toml': `${LINK}[hooks]\nblock = true\n[[sources]]\npath = "a"\n`,
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
        '/work/livediagram.toml': LINK,
        '/work/apps/b/livediagram.toml': LINK,
        '/work/apps/a/livediagram.toml': LINK,
        '/work/.git/livediagram.toml': LINK,
        '/work/.cache/livediagram.toml': LINK,
        '/work/node_modules/x/livediagram.toml': LINK,
        '/work/zeta/livediagram.toml/inner': '',
      },
      links: { '/work/linked': '/elsewhere' },
    });
    io.fileMap.set('/elsewhere/livediagram.toml', { data: LINK, mode: 0o644 });
    expect((await linksBelow(io, '/work')).map((l) => l.path)).toEqual([
      '/work/apps/a/livediagram.toml',
      '/work/apps/b/livediagram.toml',
      '/work/livediagram.toml',
    ]);
  });

  it('refuses when there is none below', async () => {
    expect(await failureOf(() => linksBelow(fakeIo(), '/work'))).toMatchObject({
      exit: 3,
      code: 'no_link',
      message: 'no livediagram.toml in /work or below',
    });
  });
});
