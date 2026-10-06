// The token in the operating system's own store (docs/specs/015-api/cli.md "Authentication", blueprint CLI4), through
// the system's own tool and never native code: the macOS Keychain (`security`), the Secret Service (`secret-tool`),
// and on Windows a blob sealed for the user with DPAPI (PowerShell), kept in the credentials file. The token always
// travels on the tool's stdin: its arguments, which any process can read, carry only the profile name.

import type { CliIo } from '../io';

export const KEYCHAIN_SERVICE = 'livediagram';

// Where a profile's token is: in the file itself, sealed in the file, or in the platform's keychain.
export type SavedToken = { token: string } | { sealed: string } | { keychain: true };

const POWERSHELL = ['-NoProfile', '-NonInteractive', '-Command'];
const SEAL =
  '$t = [Console]::In.ReadToEnd().Trim(); ConvertFrom-SecureString (ConvertTo-SecureString $t -AsPlainText -Force)';
const UNSEAL =
  '$s = ConvertTo-SecureString ([Console]::In.ReadToEnd().Trim()); ' +
  '[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))';

// `security -i` reads its commands from stdin; an argument is a double-quoted string there.
const quoted = (value: string) => `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;

type Store = {
  put(profile: string, token: string): Promise<SavedToken | null>;
  get(profile: string, saved: SavedToken): Promise<string | null>;
  erase(profile: string): Promise<void>;
};

function storeFor(io: CliIo): Store | null {
  const run = async (command: string, args: readonly string[], input = '') => {
    const result = await io.runTool(command, args, input);
    return result && result.code === 0 ? result.stdout : null;
  };
  switch (io.platform) {
    case 'darwin':
      return {
        put: async (profile, token) =>
          (await run(
            'security',
            ['-i'],
            `add-generic-password -U -s ${KEYCHAIN_SERVICE} -a ${quoted(profile)} -w ${quoted(token)}\n`,
          )) === null
            ? null
            : { keychain: true },
        get: (profile) =>
          run('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', profile, '-w']),
        erase: async (profile) =>
          void (await run('security', [
            'delete-generic-password',
            '-s',
            KEYCHAIN_SERVICE,
            '-a',
            profile,
          ])),
      };
    case 'linux':
      return {
        put: async (profile, token) =>
          (await run(
            'secret-tool',
            [
              'store',
              '--label',
              `livediagram CLI (${profile})`,
              'service',
              KEYCHAIN_SERVICE,
              'account',
              profile,
            ],
            token,
          )) === null
            ? null
            : { keychain: true },
        get: (profile) =>
          run('secret-tool', ['lookup', 'service', KEYCHAIN_SERVICE, 'account', profile]),
        erase: async (profile) =>
          void (await run('secret-tool', [
            'clear',
            'service',
            KEYCHAIN_SERVICE,
            'account',
            profile,
          ])),
      };
    case 'win32':
      return {
        put: async (_profile, token) => {
          const sealed = (await run('powershell.exe', [...POWERSHELL, SEAL], token))?.trim();
          return sealed ? { sealed } : null;
        },
        get: (_profile, saved) =>
          'sealed' in saved
            ? run('powershell.exe', [...POWERSHELL, UNSEAL], saved.sealed)
            : Promise.resolve(null),
        // The sealed blob lives in the file and goes with its entry.
        erase: async () => {},
      };
    default:
      return null;
  }
}

// Saves the token in the platform's store; the file keeps it, with a notice, where there is none or it refuses.
export async function saveToken(
  io: CliIo,
  profile: string,
  token: string,
  filePath: string,
  log: (line: string) => void,
): Promise<SavedToken> {
  const store = storeFor(io);
  const saved = store ? await store.put(profile, token) : null;
  if (saved) return saved;
  log(`keychain unavailable ${store ? 'refused' : `none on ${io.platform}`}`);
  io.stderr(`no keychain here; the token is stored in ${filePath} (readable only by you)\n`);
  return { token };
}

// The token a profile saved, or null when its store no longer has it.
export async function loadToken(
  io: CliIo,
  profile: string,
  saved: SavedToken,
): Promise<string | null> {
  if ('token' in saved) return saved.token;
  const token = (await storeFor(io)?.get(profile, saved))?.trim();
  return token || null;
}

export async function eraseToken(io: CliIo, profile: string, saved: SavedToken): Promise<void> {
  if ('keychain' in saved) await storeFor(io)?.erase(profile);
}
