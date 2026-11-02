// apply with a fake Runner and Http: nothing here ever runs wrangler or reaches a network. The commands are checked
// as built, the order, the credentials each side gets, the ledger after each unit, and a resumed run.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  apply,
  checkCopiedBytes,
  d1Command,
  r2GetCommand,
  type Command,
  type Http,
  type HttpRequest,
  type Runner,
} from '../src/apply.ts';
import { Ledger } from '../src/ledger.ts';
import { REPO_ROOT } from '../src/targets.ts';
import { verifyCommand } from '../src/verify.ts';
import { planScenario, tempDir } from './helpers.ts';
import { imageBytes, scenario } from './scenario.ts';

const VARS = {
  PATH: '/usr/bin',
  HOME: '/home/x',
  // Ambient credentials a real shell might hold: never passed through.
  CLOUDFLARE_API_TOKEN: 'ambient-token',
  CLOUDFLARE_ACCOUNT_ID: 'ambient-account',
  MIGRATE_SOURCE_ACCOUNT_ID: 'old-account',
  MIGRATE_SOURCE_API_TOKEN: 'old-token',
  MIGRATE_TARGET_API_TOKEN: 'new-token',
  MIGRATE_ORIGIN_LIVEDIAGRAM: 'https://api.livediagram.test',
  MIGRATE_ORIGIN_LIVEPLANNER: 'https://api.liveplanner.test',
  MIGRATE_ORIGIN_LIVEDOCUMENTS: 'https://api.livedocuments.test',
  MIGRATION_KEY_LIVEDIAGRAM: 'key-d',
  MIGRATION_KEY_LIVEPLANNER: 'key-p',
  MIGRATION_KEY_LIVEDOCUMENTS: 'key-docs',
};

/** A runner that records each command, writes the bytes an `r2 object get` would, and can fail one on purpose. */
function fakeRunner(failOn?: (c: Command) => boolean) {
  const commands: Command[] = [];
  const runner: Runner = {
    run(command) {
      commands.push(command);
      if (failOn?.(command)) return Promise.resolve({ code: 1, stdout: '', stderr: 'boom' });
      const a = command.argv;
      if (a.includes('get')) {
        const key = a[a.indexOf('get') + 1]!.split('/')[1]!;
        writeFileSync(a[a.indexOf('--file') + 1]!, imageBytes(key === 'img-3' ? 'same' : key));
      }
      return Promise.resolve({ code: 0, stdout: '[]', stderr: '' });
    },
  };
  return { runner, commands };
}

function fakeHttp(failId?: string) {
  const requests: HttpRequest[] = [];
  const http: Http = {
    send(request) {
      requests.push(request);
      if (failId && request.url.includes(failId))
        return Promise.resolve({ status: 500, body: 'door down' });
      return Promise.resolve({
        status: 200,
        body: JSON.stringify({
          written: [],
          edited: request.url.includes('doc-guest') ? ['tg'] : [],
          meta: true,
        }),
      });
    },
  };
  return { http, requests };
}

const kind = (c: Command) => c.argv.slice(1, 4).join(' ');

describe('apply', () => {
  let outDir = '';
  beforeAll(async () => {
    ({ outDir } = await planScenario(scenario()));
  });

  it('on a dry run prints every command and request, runs none, and needs no credentials', async () => {
    const { runner, commands } = fakeRunner();
    const { http, requests } = fakeHttp();
    const lines: string[] = [];
    const ledgerPath = join(tempDir('dry'), 'ledger.sqlite');
    const summary = await apply({
      bundleDir: outDir,
      env: 'staging',
      ledgerPath,
      dryRun: true,
      runner,
      http,
      vars: { PATH: '/usr/bin' },
      wrangler: ['wrangler'],
      log: (l) => lines.push(l),
    });
    expect(commands).toEqual([]);
    expect(requests).toEqual([]);
    expect(summary.ran).toBeGreaterThan(0);
    const text = lines.join('\n');
    expect(text).toContain(
      'wrangler d1 execute liveworkspace-accounts-staging --remote --yes --file',
    );
    expect(text).toContain('wrangler r2 object get livediagram-images/img-1');
    expect(text).toContain('wrangler r2 object put liveworkspace-media-staging/img-1');
    expect(text).toContain(
      'PUT $MIGRATE_ORIGIN_LIVEDIAGRAM/api/internal/items/doc-diagram/migration (Bearer $MIGRATION_KEY_LIVEDIAGRAM)',
    );
    expect(text).toContain(
      'person livediagram/user_ali: PUT $MIGRATE_ORIGIN_LIVEDIAGRAM/api/internal/people/user_ali/migration (Bearer $MIGRATION_KEY_LIVEDIAGRAM)',
    );
    expect(text).toContain('CLOUDFLARE_API_TOKEN=$MIGRATE_TARGET_API_TOKEN');
    // A dry run never makes or writes a ledger.
    expect(() => Ledger.open(ledgerPath)).toThrow();
  });

  it('runs the steps in order, each side with its own credentials, recording each unit', async () => {
    const { runner, commands } = fakeRunner();
    const { http, requests } = fakeHttp();
    const ledgerPath = join(tempDir('real'), 'ledger.sqlite');
    const summary = await apply({
      bundleDir: outDir,
      env: 'production',
      ledgerPath,
      dryRun: false,
      runner,
      http,
      vars: VARS,
      wrangler: ['wrangler'],
      concurrency: 1,
      log: () => {},
    });
    const order = commands.map((c) =>
      kind(c) === 'd1 execute liveworkspace-accounts'
        ? 'accounts'
        : kind(c).startsWith('d1')
          ? c.argv[3]
          : kind(c),
    );
    expect(order[0]).toBe('accounts');
    expect(order.indexOf('liveworkspace-index')).toBeGreaterThan(0);
    expect(order.indexOf('r2 object get')).toBeGreaterThan(order.indexOf('liveworkspace-media'));
    // Community last: this bundle has no KV clients.
    expect(order.at(-1)).toBe('liveworkspace-community');
    for (const c of commands) {
      expect(c.env.CLOUDFLARE_API_TOKEN).not.toBe('ambient-token');
      if (kind(c) === 'r2 object get') {
        expect(c.env).toMatchObject({
          CLOUDFLARE_ACCOUNT_ID: 'old-account',
          CLOUDFLARE_API_TOKEN: 'old-token',
        });
        expect(c.argv).not.toContain('--config');
      } else {
        expect(c.env.CLOUDFLARE_API_TOKEN).toBe('new-token');
        expect(c.env.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
        expect(c.argv).toContain('--config');
      }
    }
    // The drawn picture is put from the bundle, never read from the old bucket.
    expect(commands.filter((c) => kind(c) === 'r2 object get')).toHaveLength(3);
    expect(requests.map((r) => r.url)).toContain(
      'https://api.livediagram.test/api/internal/items/doc-guest/migration',
    );
    expect(requests.every((r) => r.headers.authorization?.startsWith('Bearer key-'))).toBe(true);
    // The people after every room, each through livediagram's person door with its body from the bundle.
    const urls = requests.map((r) => r.url);
    const ali = urls.indexOf('https://api.livediagram.test/api/internal/people/user_ali/migration');
    expect(ali).toBeGreaterThan(urls.findLastIndex((u) => u.includes('/items/')));
    expect(JSON.parse(requests[ali]!.body)).toMatchObject({ personId: 'user_ali', v: 1 });
    expect(summary.edited).toEqual([{ app: 'livediagram', id: 'doc-guest', tabs: ['tg'] }]);
    const ledger = Ledger.open(ledgerPath);
    expect(ledger.generation()).toBe(1);
    expect(ledger.version('index', 'items', 'doc-diagram')).toBeDefined();
    expect(ledger.version('rooms', 'livediagram', 'doc-guest')).toBeDefined();
    expect(ledger.version('people', 'livediagram', 'user_cy')).toBeDefined();
    expect(ledger.version('r2', 'objects', 'img-1')).toBeDefined();
    ledger.close();
  });

  it('stops at a failed unit and resumes after it, never repeating a finished one', async () => {
    const ledgerPath = join(tempDir('resume'), 'ledger.sqlite');
    const first = fakeRunner();
    const failing = fakeHttp('doc-guest');
    await expect(
      apply({
        bundleDir: outDir,
        env: 'staging',
        ledgerPath,
        dryRun: false,
        runner: first.runner,
        http: failing.http,
        vars: VARS,
        wrangler: ['wrangler'],
        concurrency: 1,
        log: () => {},
      }),
    ).rejects.toThrow(/door answered 500/);
    const again = fakeRunner();
    const ok = fakeHttp();
    const summary = await apply({
      bundleDir: outDir,
      env: 'staging',
      ledgerPath,
      dryRun: false,
      runner: again.runner,
      http: ok.http,
      vars: VARS,
      wrangler: ['wrangler'],
      concurrency: 1,
      log: () => {},
    });
    // Only community's SQL was left to run, and the rooms not yet sent.
    expect(again.commands.map((c) => c.argv[3])).toEqual(['liveworkspace-community-staging']);
    expect(ok.requests.map((r) => r.url.split('/items/')[1]).sort()).toContain(
      'doc-guest/migration',
    );
    expect(ok.requests.some((r) => r.url.includes('/doc-alias/'))).toBe(false);
    expect(summary.skipped).toBeGreaterThan(0);
  });

  it('refuses a concurrency that would start no workers, before touching anything', async () => {
    for (const concurrency of [Number.NaN, 0, -2, 1.5]) {
      const { runner, commands } = fakeRunner();
      await expect(
        apply({
          bundleDir: outDir,
          env: 'staging',
          ledgerPath: join(tempDir('concurrency'), 'ledger.sqlite'),
          dryRun: false,
          runner,
          http: fakeHttp().http,
          vars: VARS,
          wrangler: ['wrangler'],
          concurrency,
          log: () => {},
        }),
        String(concurrency),
      ).rejects.toThrow(/--concurrency/);
      expect(commands).toEqual([]);
    }
  });

  it('refuses a bundle planned at an older ledger generation', async () => {
    const ledgerPath = join(tempDir('stale'), 'ledger.sqlite');
    const opts = {
      bundleDir: outDir,
      env: 'staging' as const,
      ledgerPath,
      dryRun: false,
      http: fakeHttp().http,
      vars: VARS,
      wrangler: ['wrangler'],
      log: () => {},
    };
    await apply({ ...opts, runner: fakeRunner().runner });
    await expect(apply({ ...opts, runner: fakeRunner().runner })).rejects.toThrow(/plan again/);
  });

  it('checks the bytes read from the old bucket before putting them', async () => {
    const { runner } = fakeRunner();
    const lying: Runner = {
      async run(c) {
        const r = await runner.run(c);
        if (c.argv.includes('get'))
          writeFileSync(c.argv[c.argv.indexOf('--file') + 1]!, 'other bytes');
        return r;
      },
    };
    await expect(
      apply({
        bundleDir: outDir,
        env: 'staging',
        ledgerPath: join(tempDir('sha'), 'l.sqlite'),
        dryRun: false,
        runner: lying,
        http: fakeHttp().http,
        vars: VARS,
        wrangler: ['wrangler'],
        log: () => {},
      }),
    ).rejects.toThrow(/SHA-256/);
  });

  it('holds an old JPEG to its size and everything else to its SHA-256', () => {
    // The old site stripped a JPEG's metadata on the way in but kept the hash of the file as picked.
    const picked = Buffer.from('jpeg as picked');
    const stored = Buffer.from('jpeg as stored');
    const sha = createHash('sha256').update(picked).digest('hex');
    const jpeg = {
      key: 'j',
      contentType: 'image/jpeg',
      byteSize: stored.length,
      sha256: sha,
      version: sha,
    };
    expect(() => checkCopiedBytes(jpeg, stored)).not.toThrow();
    expect(() => checkCopiedBytes(jpeg, Buffer.from('cut short'))).toThrow(/9 bytes read, not 14/);
    const png = { ...jpeg, key: 'p', contentType: 'image/png' };
    expect(() => checkCopiedBytes(png, picked)).not.toThrow();
    expect(() => checkCopiedBytes(png, stored)).toThrow(/SHA-256/);
    // A picture the plan drew is its own file, so its bytes are exact whatever its type.
    expect(() => checkCopiedBytes({ ...jpeg, file: 'r2/pictures/x.png' }, stored)).toThrow(
      /SHA-256/,
    );
  });

  it('builds each command against the right database, bucket and account', () => {
    const base = { PATH: '/usr/bin' };
    expect(
      d1Command({
        wrangler: ['w'],
        db: 'index',
        env: 'staging',
        file: '/b/sql/index/0001.sql',
        token: 't',
        base,
      }),
    ).toEqual({
      argv: [
        'w',
        'd1',
        'execute',
        'liveworkspace-index-staging',
        '--remote',
        '--yes',
        '--file',
        '/b/sql/index/0001.sql',
        '--config',
        join(REPO_ROOT, 'liveworkspace/apps/index/wrangler.toml'),
        '--env',
        'staging',
      ],
      env: { PATH: '/usr/bin', CLOUDFLARE_API_TOKEN: 't' },
      cwd: REPO_ROOT,
    });
    expect(
      r2GetCommand({
        wrangler: ['w'],
        key: 'k',
        file: '/tmp/k',
        accountId: 'a',
        token: 't',
        cwd: '/tmp',
        base,
      }).argv,
    ).toEqual(['w', 'r2', 'object', 'get', 'livediagram-images/k', '--file', '/tmp/k', '--remote']);
    expect(() =>
      verifyCommand({
        wrangler: ['w'],
        db: 'index',
        env: 'staging',
        sql: 'DELETE FROM items',
        token: 't',
        base,
      }),
    ).toThrow();
    expect(() =>
      verifyCommand({
        wrangler: ['w'],
        db: 'index',
        env: 'staging',
        sql: 'SELECT 1; DROP TABLE items',
        token: 't',
        base,
      }),
    ).toThrow();
  });
});
