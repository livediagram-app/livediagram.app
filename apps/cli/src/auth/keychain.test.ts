import { describe, expect, it } from 'vitest';
import type { ToolRun } from '../io';
import { fakeIo, TOKEN } from '../testing/fake-io';
import {
  forgetCredential,
  resolveCredential,
  storeCredential,
  storedCredential,
} from './credentials';

// The token in the platform's own store (docs/specs/015-api/cli.md "Authentication", blueprint CLI4, E13): each
// platform's tool, the token only ever on stdin, and the file with a notice where there is no store.

type Call = { command: string; args: readonly string[]; input: string };
const details = {
  host: 'https://livediagram.app',
  tokenId: 't1',
  accountName: 'Ada',
  role: 'full',
  expiresAt: null,
};
const FILE = '/home/agent/.config/livediagram/credentials.json';

// A system with a keychain the suite plays: entries by account, answers scripted per command.
function system(
  platform: string,
  script: (call: Call, kept: Map<string, string>) => ToolRun | null = keep,
) {
  const calls: Call[] = [];
  const kept = new Map<string, string>();
  const io = fakeIo();
  io.platform = platform;
  io.runTool = async (command, args, input) => {
    const call = { command, args, input };
    calls.push(call);
    return script(call, kept);
  };
  return { io, calls, kept };
}

// A working keychain for each tool.
function keep({ command, args, input }: Call, kept: Map<string, string>): ToolRun | null {
  const flag = args.includes('-a') ? '-a' : 'account';
  const account = args[args.indexOf(flag) + 1]!;
  if (command === 'security' && args[0] === '-i') {
    const m = /-a "((?:[^"\\]|\\.)*)" -w "([^"]*)"/.exec(input)!;
    kept.set(m[1]!.replace(/\\(.)/g, '$1'), m[2]!);
    return { code: 0, stdout: '' };
  }
  if (command === 'security' && args[0] === 'find-generic-password')
    return kept.has(account)
      ? { code: 0, stdout: `${kept.get(account)}\n` }
      : { code: 44, stdout: '' };
  if (command === 'security' || (command === 'secret-tool' && args[0] === 'clear')) {
    kept.delete(account);
    return { code: 0, stdout: '' };
  }
  if (command === 'secret-tool' && args[0] === 'store') {
    kept.set(account, input);
    return { code: 0, stdout: '' };
  }
  if (command === 'secret-tool')
    return { code: kept.has(account) ? 0 : 1, stdout: kept.get(account) ?? '' };
  // powershell.exe: sealing reverses the token; unsealing reverses it back.
  return { code: 0, stdout: `${[...input.trim()].reverse().join('')}\r\n` };
}

const tokenNeverInArgs = (calls: Call[]) =>
  expect(calls.every((c) => !c.args.join(' ').includes(TOKEN))).toBe(true);

describe('the keychain on macOS', () => {
  it('adds the token through security on stdin, reads it back, and deletes it on forget', async () => {
    const { io, calls, kept } = system('darwin');
    await storeCredential(io, 'work "q"', details, TOKEN, () => {});
    expect(calls[0]).toEqual({
      command: 'security',
      args: ['-i'],
      input: `add-generic-password -U -s livediagram -a "work \\"q\\"" -w "${TOKEN}"\n`,
    });
    expect(kept.get('work "q"')).toBe(TOKEN);
    expect(await storedCredential(io, 'work "q"')).toEqual({ ...details, keychain: true });
    expect(io.fileMap.get(FILE)!.data).not.toContain(TOKEN);
    expect(await resolveCredential(io, 'work "q"')).toEqual({ token: TOKEN, source: 'keychain' });
    await forgetCredential(io, 'work "q"');
    expect(kept.size).toBe(0);
    tokenNeverInArgs(calls);
    expect(io.err()).toBe('');
  });
});

describe('the keychain on Linux', () => {
  it('stores through secret-tool on stdin and reads it back', async () => {
    const { io, calls, kept } = system('linux');
    await storeCredential(io, 'default', details, TOKEN, () => {});
    expect(calls[0]).toEqual({
      command: 'secret-tool',
      args: [
        'store',
        '--label',
        'livediagram CLI (default)',
        'service',
        'livediagram',
        'account',
        'default',
      ],
      input: TOKEN,
    });
    expect(await resolveCredential(io, 'default')).toEqual({ token: TOKEN, source: 'keychain' });
    await forgetCredential(io, 'default');
    expect(kept.size).toBe(0);
    tokenNeverInArgs(calls);
  });

  it('says so when the token is gone from the keychain', async () => {
    const { io, kept } = system('linux');
    await storeCredential(io, 'default', details, TOKEN, () => {});
    kept.clear();
    await expect(resolveCredential(io, 'default')).rejects.toMatchObject({
      failure: {
        exit: 4,
        message: 'the token for profile default is no longer in this system’s keychain'.replace(
          '’',
          "'",
        ),
      },
    });
  });
});

describe('DPAPI on Windows', () => {
  it('keeps the sealed blob in the file and unseals it on stdin', async () => {
    const { io, calls } = system('win32');
    await storeCredential(io, 'default', details, TOKEN, () => {});
    const saved = await storedCredential(io, 'default');
    expect(saved).toEqual({ ...details, sealed: [...TOKEN].reverse().join('') });
    expect(await resolveCredential(io, 'default')).toEqual({ token: TOKEN, source: 'keychain' });
    expect(calls.map((c) => c.command)).toEqual(['powershell.exe', 'powershell.exe']);
    expect(calls[0]!.args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command']);
    expect(calls[0]!.input).toBe(TOKEN);
    await forgetCredential(io, 'default');
    expect(await storedCredential(io, 'default')).toBeNull();
    tokenNeverInArgs(calls);
  });
});

describe('without a store', () => {
  it('keeps the token in the file with one notice when the tool is missing, refuses, or seals nothing', async () => {
    for (const [platform, answer] of [
      ['linux', null],
      ['darwin', { code: 1, stdout: '' }],
      ['win32', { code: 0, stdout: '  ' }],
      ['freebsd', null],
    ] as const) {
      const logs: string[] = [];
      const { io } = system(platform, () => answer);
      await storeCredential(io, 'default', details, TOKEN, (l) => void logs.push(l));
      expect(await storedCredential(io, 'default')).toEqual({ ...details, token: TOKEN });
      expect(await resolveCredential(io, 'default')).toEqual({ token: TOKEN, source: 'file' });
      expect(io.err()).toBe(
        `no keychain here; the token is stored in ${FILE} (readable only by you)\n`,
      );
      expect(logs[0]).toMatch(/^keychain unavailable (refused|none on freebsd)$/);
    }
  });

  it('cannot unseal a blob the tool will not open', async () => {
    const { io } = system('win32');
    await storeCredential(io, 'default', details, TOKEN, () => {});
    io.runTool = async () => ({ code: 1, stdout: '' });
    await expect(resolveCredential(io, 'default')).rejects.toMatchObject({ failure: { exit: 4 } });
  });
});

describe('stores across systems and logins', () => {
  it('refuses a keychain entry on a system that has none, and still forgets it', async () => {
    const { io } = system('linux');
    await storeCredential(io, 'default', details, TOKEN, () => {});
    // The same credentials file, read on Windows (dotfiles synced across machines).
    io.platform = 'win32';
    await expect(resolveCredential(io, 'default')).rejects.toMatchObject({ failure: { exit: 4 } });
    await forgetCredential(io, 'default');
    await forgetCredential(io, 'never-stored');
    expect(await storedCredential(io, 'default')).toBeNull();
  });

  it('signs in again when the old token has gone from the keychain, saying it could not revoke it', async () => {
    const { io, kept } = system('linux');
    const NEW = `lvd_${'c'.repeat(43)}`;
    io.readStdin = async () => NEW;
    const route = (_request: Request, url: URL) =>
      url.pathname === '/api/capabilities'
        ? Response.json({ apiBase: 'https://livediagram.app/api', authEnabled: true })
        : url.pathname === '/api/tokens/current'
          ? Response.json({
              accountId: 'u1',
              accountName: 'Ada',
              tokenId: 'tok_new',
              role: 'full',
              expiresAt: null,
            })
          : undefined;
    const routed = fakeIo({ routes: [route] });
    Object.assign(routed, { platform: io.platform, runTool: io.runTool, readStdin: io.readStdin });
    await storeCredential(routed, 'default', details, TOKEN, () => {});
    kept.clear();
    const { run } = await import('../main');
    expect(await run(['auth', 'login', '--with-token'], routed)).toBe(0);
    expect(routed.err()).toContain('the previous token could not be revoked');
    expect(kept.get('default')).toBe(NEW);
  });
});
