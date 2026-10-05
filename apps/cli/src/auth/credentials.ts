// Credentials (docs/specs/015-api/cli.md "Authentication"): LIVEDIAGRAM_TOKEN first, else the profile's stored
// token. Stored in credentials.json at 0600 in a 0700 directory, by temporary file and rename; a file others
// can read is tightened with a warning (E14).

import { isApiTokenFormat } from '@livediagram/api-schema';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { configDir } from '../config/paths';

export type StoredCredential = {
  host: string;
  token: string;
  tokenId: string;
  accountName: string | null;
  role: string;
  expiresAt: number | null;
};

export type Credential = { token: string; source: 'env' | 'file' };

type CredentialsFile = { version: 1; profiles: Record<string, StoredCredential> };

const pathOf = (io: CliIo) => `${configDir(io)}/credentials.json`;

async function readFile(io: CliIo): Promise<CredentialsFile> {
  const path = pathOf(io);
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

export async function storeCredential(
  io: CliIo,
  profile: string,
  credential: StoredCredential,
): Promise<void> {
  const file = await readFile(io);
  file.profiles[profile] = credential;
  await io.files.mkdir(configDir(io), 0o700);
  await io.files.write(pathOf(io), `${JSON.stringify(file, null, 2)}\n`, 0o600);
}

export async function forgetCredential(io: CliIo, profile: string): Promise<void> {
  const file = await readFile(io);
  delete file.profiles[profile];
  await io.files.write(pathOf(io), `${JSON.stringify(file, null, 2)}\n`, 0o600);
}

// The token this profile stored, ignoring LIVEDIAGRAM_TOKEN.
export async function storedCredential(
  io: CliIo,
  profile: string,
): Promise<StoredCredential | null> {
  return (await readFile(io)).profiles[profile] ?? null;
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
  return stored ? { token: stored.token, source: 'file' } : null;
}
