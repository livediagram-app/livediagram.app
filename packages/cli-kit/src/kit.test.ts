import { describe, expect, it } from 'vitest';
import { CliError, formatError } from './cli-error';
import { parseConfig, withTelemetry } from './config-file';
import { storedCredential } from './credentials';
import { debugLog } from './debug';
import { didYouMean } from './did-you-mean';
import { EXIT, exitCodeForStatus } from './exit-codes';
import { inputReader } from './input';
import { discover } from './oauth';
import type { CliIo } from './io';
import { cacheDir, configDir } from './paths';
import { transport } from './transport';
import { isBelow, upgradeHint } from './version';

// The shared modules on their own, for an example product. Each product's CLI suite runs them again through its
// commands, on its fake host, under its own names.
const PRODUCT = {
  name: 'example',
  envPrefix: 'EXAMPLE',
  npmPackage: '@example/cli',
  version: '1.2.3',
  clientId: 'example-cli',
};

function io(over: Partial<Omit<CliIo, 'files'>> & { files?: Record<string, string> } = {}) {
  let err = '';
  const files: Record<string, string> = over.files ?? {};
  const base = {
    env: {},
    homedir: '/home/agent',
    cwd: '/work',
    stdinIsTTY: false,
    readStdin: async () => 'from stdin',
    stderr: (text: string) => void (err += text),
    now: () => 0,
    runtime: 'node/22 test',
    ...over,
    files: { read: async (path: string) => files[path] ?? null },
  };
  return { io: base as unknown as CliIo, err: () => err };
}

describe('exit codes', () => {
  it('maps an api status to one of the eight', () => {
    expect([401, 403, 404, 410, 409, 412, 429, 500, 400].map(exitCodeForStatus)).toEqual([
      EXIT.auth,
      EXIT.auth,
      EXIT.notFound,
      EXIT.notFound,
      EXIT.conflict,
      EXIT.conflict,
      EXIT.rateLimited,
      EXIT.failure,
      EXIT.rejected,
    ]);
  });
});

describe('formatError', () => {
  const failure = {
    exit: EXIT.usage,
    code: 'usage',
    message: 'use read_doc',
    lines: ['  a'],
    hint: 'read_doc --help',
  };

  it('prints text or one JSON object, each line through the product words', () => {
    const words = (text: string) => text.replace('read_doc', 'example read');
    expect(formatError(failure, false, words)).toBe(
      'error: use example read\n    a\nhint: example read --help\n',
    );
    expect(JSON.parse(formatError(failure, true))).toEqual({
      error: 'usage',
      message: 'use read_doc',
      candidates: ['a'],
      hint: 'read_doc --help',
    });
  });

  it('carries the failure on the error', () => {
    expect(new CliError(failure).failure).toBe(failure);
  });
});

describe('didYouMean', () => {
  it('offers the nearest word within two edits', () => {
    expect(didYouMean('raed', ['read', 'write'])).toBe('read');
    expect(didYouMean('zzzzz', ['read', 'write'])).toBeNull();
  });
});

describe('config.toml', () => {
  it('reads profiles and settings, and sets telemetry beside the rest', () => {
    const text = 'default_profile = "work"\n[profiles.work]\nhost = "https://x.test"\n';
    expect(parseConfig(text, 'config.toml')).toEqual({
      defaultProfile: 'work',
      profiles: { work: { host: 'https://x.test' } },
    });
    expect(withTelemetry(text, false)).toBe(`telemetry = false\n${text}`);
    expect(
      parseConfig('telemetry = true # off later\n  # a note\n[profiles.a]\nhost = "h#1"\t# x', 'c'),
    ).toEqual({
      profiles: { a: { host: 'h#1' } },
      telemetry: true,
    });
    expect(withTelemetry('a = "b"\n\n\n', true)).toBe('telemetry = true\na = "b"\n');
    expect(withTelemetry('', true)).toBe('telemetry = true\n');
    const worst = `a${'\t'.repeat(50_000)}b`;
    const started = process.cpuUsage();
    expect(() => parseConfig(worst, 'c')).toThrow(CliError);
    expect(() => parseConfig(`_=${'\t'.repeat(50_000)}\u2028x`, 'c')).toThrow(CliError);
    expect(withTelemetry(`x${'\n'.repeat(50_000)}y`, true).length).toBeGreaterThan(50_000);
    const { user, system } = process.cpuUsage(started);
    expect((user + system) / 1000).toBeLessThan(500);
    expect(() => parseConfig('what', 'config.toml')).toThrow(CliError);
  });

  it('keeps a " #" inside a quoted value, escaped quotes and all, and still drops the comment after it', () => {
    const text =
      'default_profile = "my #1"  # the usual\n[profiles.a]\nhost = "https://x.test/ #top \\" #x" # note';
    expect(parseConfig(text, 'config.toml')).toEqual({
      defaultProfile: 'my #1',
      profiles: { a: { host: 'https://x.test/ #top " #x' } },
    });
  });

  it('names the line of a string whose escape JSON does not read, rather than throwing a SyntaxError', () => {
    for (const text of ['[profiles.a]\nhost = "https://x.app/a\\q"', 'default_profile = "a\tb"']) {
      expect(() => parseConfig(text, 'config.toml'), text).toThrow(CliError);
    }
    expect(() => parseConfig('[profiles.a]\nhost = "x\\q"', 'config.toml')).toThrow(
      'config.toml line 2 does not read',
    );
  });
});

describe('profile names that shadow Object members', () => {
  it('reads [profiles.__proto__] and [profiles.constructor] as ordinary profiles, never onto Object.prototype', () => {
    const text =
      '[profiles.__proto__]\nhost = "https://evil.test"\n[profiles.constructor]\nhost = "https://c.test"\n';
    const config = parseConfig(text, 'config.toml');
    expect(({} as { host?: unknown }).host).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('host');
    expect(Object.keys(config.profiles)).toEqual(['__proto__', 'constructor']);
    expect(config.profiles['constructor']).toEqual({ host: 'https://c.test' });
    expect(parseConfig('', 'c').profiles['toString']).toBeUndefined();
  });

  it('finds no stored credential for a profile named after an inherited member', async () => {
    const path = '/home/agent/.config/example/credentials.json';
    const files = { [path]: JSON.stringify({ version: 1, profiles: {} }) };
    const reader = io({ files }).io;
    (reader.files as unknown as { mode: () => Promise<null> }).mode = async () => null;
    expect(await storedCredential(reader, PRODUCT, 'constructor')).toBeNull();
    expect(await storedCredential(reader, PRODUCT, 'toString')).toBeNull();
    const empty = io().io;
    expect(await storedCredential(empty, PRODUCT, 'hasOwnProperty')).toBeNull();
  });
});

describe('the product names', () => {
  it('keeps files in a directory named for the product', () => {
    expect(configDir(io().io, PRODUCT)).toBe('/home/agent/.config/example');
    expect(cacheDir(io({ env: { XDG_CACHE_HOME: '/c' } }).io, PRODUCT)).toBe('/c/example');
  });

  it("prints debug lines only under the product's own variable", () => {
    const on = io({ env: { EXAMPLE_DEBUG: '1' } });
    debugLog(on.io, PRODUCT, 'sync')('lock taken');
    expect(on.err()).toBe('[sync] lock taken\n');
    const off = io({ env: { OTHER_DEBUG: '1' } });
    debugLog(off.io, PRODUCT)('quiet');
    expect(off.err()).toBe('');
  });

  it('names its client and version on every request', async () => {
    const sent: Request[] = [];
    const fetch = async (request: Request) => {
      sent.push(request);
      return Response.json({});
    };
    const client = transport(io({ fetch }).io, 'https://api.test', () => {}, PRODUCT).forToken('t');
    await client.fetch('/x');
    expect(sent[0]?.headers.get('X-Example-Client')).toBe('cli');
    expect(sent[0]?.headers.get('User-Agent')).toBe('example-cli/1.2.3 node/22 test');
  });
});

describe('discover', () => {
  const meta = (body: string) => io({ fetch: async () => new Response(body, { status: 200 }) }).io;
  const log = () => {};

  it('takes metadata whose endpoints are on the issuer', async () => {
    const good = JSON.stringify({
      authorization_endpoint: 'https://host.test/authorize',
      token_endpoint: 'https://host.test/token',
    });
    expect(await discover(meta(good), 'https://host.test', log)).toMatchObject({
      token_endpoint: 'https://host.test/token',
    });
  });

  it('refuses unreadable metadata or endpoints that are not URLs as a sign-in error, not a crash', async () => {
    for (const body of [
      '<html>oops</html>',
      'null',
      JSON.stringify({
        authorization_endpoint: 'not a url',
        token_endpoint: 'https://host.test/t',
      }),
      JSON.stringify({ authorization_endpoint: 'https://host.test/a', token_endpoint: 7 }),
      JSON.stringify({
        authorization_endpoint: 'https://host.test/a',
        token_endpoint: 'https://evil.test/t',
      }),
    ]) {
      const err = await discover(meta(body), 'https://host.test', log).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).failure.exit).toBe(EXIT.auth);
    }
  });
});

describe('versions', () => {
  it('compares x.y.z and says how to upgrade', () => {
    expect(isBelow('0.3.0', '0.10.0')).toBe(true);
    expect(isBelow('1.0.0', '1.0.0')).toBe(false);
    expect(upgradeHint('@example/cli')).toBe(
      'npm install -g @example/cli@latest, or npx @example/cli@latest',
    );
  });

  it('follows semver precedence for prereleases and ignores build metadata', () => {
    expect(isBelow('1.3.0-rc.1', '1.3.0')).toBe(true);
    expect(isBelow('1.3.0', '1.3.0-rc.1')).toBe(false);
    expect(isBelow('1.3.0-rc.1', '1.3.0-rc.1')).toBe(false);
    expect(isBelow('1.3.0-alpha', '1.3.0-alpha.1')).toBe(true);
    expect(isBelow('1.3.0-alpha.1', '1.3.0-alpha')).toBe(false);
    expect(isBelow('1.3.0-alpha.1', '1.3.0-alpha.beta')).toBe(true);
    expect(isBelow('1.3.0-beta', '1.3.0-alpha.1')).toBe(false);
    expect(isBelow('1.3.0-rc.2', '1.3.0-rc.10')).toBe(true);
    expect(isBelow('1.3.0-rc.10', '1.3.0-rc.2')).toBe(false);
    expect(isBelow('1.3.0-x-y', '1.3.0-x-z')).toBe(true);
    expect(isBelow('1.3.0+build.5', '1.3.0')).toBe(false);
    expect(isBelow('1.2.9', '1.3.0-rc.1')).toBe(true);
  });
});

describe('inputReader', () => {
  it('reads a relative, absolute or Windows path, and stdin for -', async () => {
    const read = inputReader(
      io({
        files: {
          '/work/a.txt': 'rel',
          '/abs.txt': 'abs',
          'C:\\x\\ops.txt': 'drive',
          'D:/y.txt': 'slash',
          '\\\\host\\share\\z.txt': 'unc',
        },
      }).io,
    );
    expect(await read('a.txt')).toBe('rel');
    expect(await read('/abs.txt')).toBe('abs');
    expect(await read('C:\\x\\ops.txt')).toBe('drive');
    expect(await read('D:/y.txt')).toBe('slash');
    expect(await read('\\\\host\\share\\z.txt')).toBe('unc');
    expect(await read('-')).toBe('from stdin');
  });

  it('refuses a missing file, and stdin when it is a terminal', async () => {
    await expect(inputReader(io().io)('nope.txt')).rejects.toThrow('no file nope.txt');
    const tty = inputReader(io({ stdinIsTTY: true }).io);
    await expect(tty('-')).rejects.toBeInstanceOf(CliError);
    await expect(tty('-')).rejects.toThrow('- reads stdin, which is a terminal here');
  });
});
