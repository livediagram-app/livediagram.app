// Credentials (docs/specs/015-api/cli.md "Authentication"): LIVEDIAGRAM_TOKEN first, else the profile's stored
// token. credentials.json (0600 in a 0700 directory, by temporary file and rename) keeps each profile's account,
// role and expiry, and where its token is: the platform's keychain, a DPAPI blob, or, where neither works, the token
// itself (keychain.ts). A file others can read is tightened with a warning (E14).

import { isApiTokenFormat } from '@livediagram/api-schema';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { configDir } from '../config/paths';
import { eraseToken, loadToken, saveToken, type SavedToken } from './keychain';

export type CredentialDetails = {
  host: string;
  tokenId: string;
  accountName: string | null;
  role: string;
  expiresAt: number | null;
};

export type StoredCredential = CredentialDetails & SavedToken;

export type CredentialSource = 'env' | 'keychain' | 'file';
export type Credential = { token: string; source: CredentialSource };

type CredentialsFile = { version: 1; profiles: Record<string, StoredCredential> };

export const credentialsPath = (io: CliIo) => `${configDir(io)}/credentials.json`;

async function readFile(io: CliIo): Promise<CredentialsFile> {
  const path = credentialsPath(io);
  const text = await io.files.read(path);
  if (text === null) return { version: 1, profiles: {} };
  const mode = await io.files.mode(path);
  if (mode !== null && (mode & 0o077) !== 0) {
    io.stderr(`warning: ${path} was readable by others; it is now readable only by you\n`);
    await io.files.chmod(path, 0o600);
  }
  try {
    const parsed = JSON.parse(text) as CredentialsFile;
    if (parsed.version === 1 && typeof parsed.profiles === 'object' && parsed.profiles !== null)
      return parsed;
  } catch {
    // Reported below.
  }
  throw new CliError({
    exit: EXIT.usage,
    code: 'usage',
    message: `${path} does not read as livediagram credentials`,
    hint: `remove it, then livediagram auth login`,
  });
}

async function writeFile(io: CliIo, file: CredentialsFile): Promise<void> {
  await io.files.mkdir(configDir(io), 0o700);
  await io.files.write(credentialsPath(io), `${JSON.stringify(file, null, 2)}\n`, 0o600);
}

export async function storeCredential(
  io: CliIo,
  profile: string,
  details: CredentialDetails,
  token: string,
  log: DebugLog,
): Promise<void> {
  const saved = await saveToken(io, profile, token, credentialsPath(io), log);
  const file = await readFile(io);
  file.profiles[profile] = { ...details, ...saved };
  await writeFile(io, file);
  log(`credential stored ${'token' in saved ? 'file' : 'keychain'}`);
}

export async function forgetCredential(io: CliIo, profile: string): Promise<void> {
  const file = await readFile(io);
  const stored = file.profiles[profile];
  if (stored) await eraseToken(io, profile, stored);
  delete file.profiles[profile];
  await writeFile(io, file);
}

// What this profile stored, ignoring LIVEDIAGRAM_TOKEN.
export async function storedCredential(
  io: CliIo,
  profile: string,
): Promise<StoredCredential | null> {
  return (await readFile(io)).profiles[profile] ?? null;
}

// A stored credential's token, from wherever it is kept.
export async function tokenOf(
  io: CliIo,
  profile: string,
  stored: StoredCredential,
): Promise<Credential> {
  const token = await loadToken(io, profile, stored);
  if (!token)
    throw new CliError({
      exit: EXIT.auth,
      code: 'auth',
      message: `the token for profile ${profile} is no longer in this system's keychain`,
      hint: 'livediagram auth login',
    });
  return { token, source: 'token' in stored ? 'file' : 'keychain' };
}

export async function resolveCredential(io: CliIo, profile: string): Promise<Credential | null> {
  const env = io.env.LIVEDIAGRAM_TOKEN?.trim();
  if (env) {
    if (!isApiTokenFormat(env))
      throw new CliError({
        exit: EXIT.auth,
        code: 'auth',
        message: 'LIVEDIAGRAM_TOKEN is not an API token',
        hint: 'create one in Settings › API Tokens',
      });
    return { token: env, source: 'env' };
  }
  const stored = await storedCredential(io, profile);
  return stored ? tokenOf(io, profile, stored) : null;
}
