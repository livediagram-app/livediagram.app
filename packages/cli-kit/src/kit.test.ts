import { describe, expect, it } from 'vitest';
import { CliError, formatError } from './cli-error';
import { parseConfig, withTelemetry } from './config-file';
import { debugLog } from './debug';
import { didYouMean } from './did-you-mean';
import { EXIT, exitCodeForStatus } from './exit-codes';
import { inputReader } from './input';
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
    expect(() => parseConfig('what', 'config.toml')).toThrow(CliError);
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

describe('versions', () => {
  it('compares x.y.z and says how to upgrade', () => {
    expect(isBelow('0.3.0', '0.10.0')).toBe(true);
    expect(isBelow('1.0.0', '1.0.0')).toBe(false);
    expect(upgradeHint('@example/cli')).toBe(
      'npm install -g @example/cli@latest, or npx @example/cli@latest',
    );
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
