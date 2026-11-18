import { describe, expect, it } from 'vitest';
import { fakeIo, NOW, type FakeIoOptions, type Route } from './testing/fake-io';
import {
  binUpdate,
  finishUpdateCheck,
  isNewer,
  refreshLatest,
  registryUrl,
  skipReason,
  UPDATE_CHECK_ARG,
  UPDATE_CHECK_INTERVAL_MS,
  updateFile,
  updateNotice,
} from './update-check';

const PRODUCT = {
  name: 'example',
  envPrefix: 'EXAMPLE',
  npmPackage: '@example/cli',
  version: '1.2.1',
};
const FILE = '/home/agent/.config/example/update.json';
const DAY = UPDATE_CHECK_INTERVAL_MS;
const NOTICE = 'example 1.4.0 is out (you have 1.2.1). Update: npm i -g @example/cli';

const registry =
  (latest: unknown, status = 200): Route =>
  (_, url) =>
    url.href === 'https://registry.npmjs.org/-/package/@example%2Fcli/dist-tags'
      ? Response.json({ latest }, { status })
      : undefined;

const offline: Route = () => {
  throw new TypeError('fetch failed');
};

const io = (options: FakeIoOptions = {}) => fakeIo(PRODUCT, { stderrIsTTY: true, ...options });
type Io = ReturnType<typeof io>;

const stored = (value: Record<string, unknown>) => ({ [FILE]: JSON.stringify(value) });
const storedIn = (fake: Io) => JSON.parse(fake.fileMap.get(FILE)!.data) as Record<string, unknown>;
const refuseWrites = (fake: Io) => {
  fake.files.write = async () => {
    throw new Error('EACCES');
  };
};

// A command's end: the notice, and how many background copies it started.
async function finish(fake: Io, exitCode = 0) {
  let started = 0;
  const notice = await finishUpdateCheck(fake, PRODUCT, exitCode, () => void started++);
  return { notice, started };
}

describe('finishUpdateCheck', () => {
  it('on the first run, marks the check done for the day and starts the background ask', async () => {
    const fake = io();
    expect(await finish(fake)).toEqual({ notice: null, started: 1 });
    expect(storedIn(fake)).toEqual({ checkedAt: NOW, latest: null, notifiedAt: 0 });
    expect(fake.requests).toHaveLength(0);
  });

  it('does not ask again within a day', async () => {
    const fake = io({ files: stored({ checkedAt: NOW - DAY + 1, latest: '1.2.1' }) });
    expect(await finish(fake)).toEqual({ notice: null, started: 0 });
  });

  it('asks again once a day has passed, or when the stored time is in the future', async () => {
    for (const checkedAt of [NOW - DAY, NOW + 60_000]) {
      const fake = io({ files: stored({ checkedAt, latest: '1.2.1' }) });
      expect((await finish(fake)).started).toBe(1);
    }
  });

  it('names a newer stored version once a day, after an exit 0', async () => {
    const fake = io({ files: stored({ checkedAt: NOW - 60_000, latest: '1.4.0' }) });
    expect(await finish(fake)).toEqual({ notice: NOTICE, started: 0 });
    expect(storedIn(fake)).toEqual({ checkedAt: NOW - 60_000, latest: '1.4.0', notifiedAt: NOW });
    expect(await finish(fake)).toEqual({ notice: null, started: 0 });
    const tomorrow = io({
      files: stored({ checkedAt: NOW - 60_000, latest: '1.4.0', notifiedAt: NOW - DAY }),
    });
    expect((await finish(tomorrow)).notice).toBe(NOTICE);
  });

  it('names it and asks again in the same run when both are due', async () => {
    const fake = io({ files: stored({ checkedAt: NOW - 2 * DAY, latest: '1.4.0' }) });
    expect(await finish(fake)).toEqual({ notice: NOTICE, started: 1 });
    expect(storedIn(fake)).toEqual({ checkedAt: NOW, latest: '1.4.0', notifiedAt: NOW });
  });

  it('says nothing when the running version is the newest', async () => {
    const fake = io({ files: stored({ checkedAt: NOW - 60_000, latest: '1.2.1' }) });
    expect(await finish(fake)).toEqual({ notice: null, started: 0 });
  });

  it('is skipped after a failed command, in CI, when stderr is not a terminal, and when opted out', async () => {
    const files = stored({ checkedAt: 0, latest: '9.0.0' });
    const cases: [FakeIoOptions, number][] = [
      [{ files }, 1],
      [{ files, env: { CI: 'true' } }, 0],
      [{ files, env: { CI: '1' } }, 0],
      [{ files, stderrIsTTY: false }, 0],
      [{ files, env: { EXAMPLE_NO_UPDATE_CHECK: '1' } }, 0],
    ];
    for (const [options, exitCode] of cases) {
      const fake = io(options);
      expect(await finish(fake, exitCode)).toEqual({ notice: null, started: 0 });
      expect(storedIn(fake)).toEqual({ checkedAt: 0, latest: '9.0.0' });
    }
    expect(skipReason(io({ env: { CI: '' } }), PRODUCT)).toBeNull();
    expect(skipReason(io({ env: { EXAMPLE_NO_UPDATE_CHECK: '0' } }), PRODUCT)).toBeNull();
  });

  it('reads an unreadable or foreign file as never checked', async () => {
    for (const data of [
      'not json',
      'null',
      '"text"',
      '{"checkedAt":"yesterday","latest":"next","notifiedAt":null}',
    ]) {
      const fake = io({ files: { [FILE]: data } });
      expect(await finish(fake)).toEqual({ notice: null, started: 1 });
      expect(storedIn(fake)).toEqual({ checkedAt: NOW, latest: null, notifiedAt: 0 });
    }
  });

  it('swallows a config folder that refuses the write, and starts nothing', async () => {
    const fake = io();
    refuseWrites(fake);
    expect(await finish(fake)).toEqual({ notice: null, started: 0 });
  });
});

describe('refreshLatest', () => {
  it('asks npm with a time limit and stores the answer beside what the file holds', async () => {
    const fake = io({
      routes: [registry('1.4.0')],
      files: stored({ checkedAt: NOW - 5, latest: '1.3.0', notifiedAt: NOW - 9 }),
    });
    await refreshLatest(fake, PRODUCT);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(storedIn(fake)).toEqual({ checkedAt: NOW, latest: '1.4.0', notifiedAt: NOW - 9 });
  });

  it('stores nothing when the registry is offline, refuses, or answers something that is not a version', async () => {
    for (const route of [
      offline,
      registry('1.4.0', 503),
      registry(42),
      registry('latest'),
      () => new Response('<html>'),
    ]) {
      const fake = io({ routes: [route], files: stored({ checkedAt: NOW - 5, latest: '1.3.0' }) });
      await expect(refreshLatest(fake, PRODUCT)).resolves.toBeUndefined();
      expect(storedIn(fake)).toEqual({ checkedAt: NOW - 5, latest: '1.3.0' });
    }
  });
});

describe('binUpdate', () => {
  it('starts the background copy with the check argument, and refreshes in it', async () => {
    const fake = io({ routes: [registry('1.4.0')] });
    const update = binUpdate(fake, PRODUCT);
    expect(await update.finish(0)).toBeNull();
    expect(fake.background).toEqual([[UPDATE_CHECK_ARG]]);
    await update.refresh();
    expect(storedIn(fake).latest).toBe('1.4.0');
  });
});

describe('debug lines', () => {
  const lines = async (options: FakeIoOptions, step: (fake: Io) => unknown) => {
    const fake = io({ ...options, env: { EXAMPLE_DEBUG: '1', ...options.env } });
    await step(fake);
    return fake.err();
  };
  const refresh = (fake: Io) => refreshLatest(fake, PRODUCT);

  it('say what the check did under <PREFIX>_DEBUG=1', async () => {
    expect(await lines({ stderrIsTTY: false }, finish)).toBe(
      '[cli] update-check skipped not-a-terminal\n',
    );
    expect(await lines({}, (fake) => finish(fake, 2))).toBe(
      '[cli] update-check skipped failed-command\n',
    );
    expect(await lines({ files: stored({ checkedAt: NOW }) }, finish)).toBe(
      '[cli] update-check skipped checked-today\n',
    );
    expect(await lines({}, finish)).toBe('[cli] update-check started\n');
    expect(await lines({}, (fake) => (refuseWrites(fake), finish(fake)))).toBe(
      '[cli] update-check failed\n',
    );
    expect(await lines({ routes: [registry('1.4.0')] }, refresh)).toBe(
      '[cli] update-check latest 1.4.0\n',
    );
    expect(await lines({ routes: [registry(null)] }, refresh)).toBe('[cli] update-check failed\n');
    expect(await lines({ routes: [offline] }, refresh)).toBe('[cli] update-check failed\n');
  });
});

describe('isNewer', () => {
  it('compares by semver, pre-releases below their release', () => {
    expect(isNewer('1.2.1', '1.4.0')).toBe(true);
    expect(isNewer('1.2.1', '1.10.0')).toBe(true);
    expect(isNewer('1.10.0', '1.9.9')).toBe(false);
    expect(isNewer('1.2.1', '1.2.1')).toBe(false);
    expect(isNewer('2.0.0', '1.9.9')).toBe(false);
    expect(isNewer('1.3.0-rc.1', '1.3.0')).toBe(true);
    expect(isNewer('1.3.0-rc.1', '1.3.0-rc.2')).toBe(true);
    expect(isNewer('1.3.0-rc.2', '1.3.0-rc.10')).toBe(true);
    expect(isNewer('1.3.0-rc.2', '1.3.0-rc.1')).toBe(false);
    expect(isNewer('1.3.0', '1.3.0+build.5')).toBe(false);
  });

  it('offers a pre-release only to someone already on one', () => {
    expect(isNewer('1.2.1', '1.3.0-rc.1')).toBe(false);
    expect(isNewer('1.2.1-beta.1', '1.3.0-rc.1')).toBe(true);
  });

  it('never compares something that is not a version', () => {
    expect(isNewer('1.2.1', 'latest')).toBe(false);
    expect(isNewer('dev', '1.4.0')).toBe(false);
    expect(isNewer('1.2', '1.4.0')).toBe(false);
  });
});

describe('helpers', () => {
  it('name the file, the registry address and the notice', () => {
    expect(updateFile(fakeIo(PRODUCT, { env: { XDG_CONFIG_HOME: '/xdg' } }), PRODUCT)).toBe(
      '/xdg/example/update.json',
    );
    expect(registryUrl('@livediagram/cli')).toBe(
      'https://registry.npmjs.org/-/package/@livediagram%2Fcli/dist-tags',
    );
    expect(registryUrl('a/b/c')).toBe('https://registry.npmjs.org/-/package/a%2Fb%2Fc/dist-tags');
    expect(updateNotice(PRODUCT, '2.0.0')).toBe(
      'example 2.0.0 is out (you have 1.2.1). Update: npm i -g @example/cli',
    );
  });
});
