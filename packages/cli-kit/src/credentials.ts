// Credentials (each product's docs/specs/015-api/cli.md "Authentication"): <PREFIX>_TOKEN first, else the profile's stored
// token. credentials.json (0600 in a 0700 directory, by temporary file and rename) keeps each profile's account,
// role and expiry, and where its token is: the platform's keychain, a DPAPI blob, or, where neither works, the token
// itself (keychain.ts). A file others can read is tightened with a warning (E14).

import { isApiTokenFormat } from '@liveworkspace/api-kit/api-token';
import type { DebugLog } from './debug';
import type { CliIo } from './io';
import { CliError } from './cli-error';
import { EXIT } from './exit-codes';
import { configDir } from './paths';
import type { CliProduct } from './product';
import { eraseToken, loadToken, saveToken, type SavedToken } from './keychain';

// What the credentials need of a product: its command and its environment variables' prefix.
type Product = Pick<CliProduct, 'name' | 'envPrefix'>;

export type CredentialDetails = {
  host: string;
  tokenId: string;
  accountName: string | null;
  role: string;
  expiresAt: number | null;
};

export type StoredCredential = CredentialDetails & SavedToken;

export type CredentialSource = 'env' | 'keychain' | 'file';
type Credential = { token: string; source: CredentialSource };

type CredentialsFile = { version: 1; profiles: Record<string, StoredCredential> };

const credentialsPath = (io: CliIo, product: Product) =>
  `${configDir(io, product)}/credentials.json`;

async function readFile(io: CliIo, product: Product): Promise<CredentialsFile> {
  const path = credentialsPath(io, product);
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
    message: `${path} does not read as ${product.name} credentials`,
    hint: `remove it, then ${product.name} auth login`,
  });
}

async function writeFile(io: CliIo, product: Product, file: CredentialsFile): Promise<void> {
  await io.files.mkdir(configDir(io, product), 0o700);
  await io.files.write(credentialsPath(io, product), `${JSON.stringify(file, null, 2)}\n`, 0o600);
}

export async function storeCredential(
  io: CliIo,
  product: Product,
  profile: string,
  details: CredentialDetails,
  token: string,
  log: DebugLog,
): Promise<void> {
  const saved = await saveToken(
    io,
    product.name,
    profile,
    token,
    credentialsPath(io, product),
    log,
  );
  const file = await readFile(io, product);
  file.profiles[profile] = { ...details, ...saved };
  await writeFile(io, product, file);
  log(`credential stored ${'token' in saved ? 'file' : 'keychain'}`);
}

export async function forgetCredential(
  io: CliIo,
  product: Product,
  profile: string,
): Promise<void> {
  const file = await readFile(io, product);
  const stored = file.profiles[profile];
  if (stored) await eraseToken(io, product.name, profile, stored);
  delete file.profiles[profile];
  await writeFile(io, product, file);
}

// What this profile stored, ignoring <PREFIX>_TOKEN.
export async function storedCredential(
  io: CliIo,
  product: Product,
  profile: string,
): Promise<StoredCredential | null> {
  return (await readFile(io, product)).profiles[profile] ?? null;
}

// A stored credential's token, from wherever it is kept.
export async function tokenOf(
  io: CliIo,
  product: Product,
  profile: string,
  stored: StoredCredential,
): Promise<Credential> {
  const token = await loadToken(io, product.name, profile, stored);
  if (!token)
    throw new CliError({
      exit: EXIT.auth,
      code: 'auth',
      message: `the token for profile ${profile} is no longer in this system's keychain`,
      hint: `${product.name} auth login`,
    });
  return { token, source: 'token' in stored ? 'file' : 'keychain' };
}

export async function resolveCredential(
  io: CliIo,
  product: Product,
  profile: string,
): Promise<Credential | null> {
  const variable = `${product.envPrefix}_TOKEN`;
  const env = io.env[variable]?.trim();
  if (env) {
    if (!isApiTokenFormat(env))
      throw new CliError({
        exit: EXIT.auth,
        code: 'auth',
        message: `${variable} is not an API token`,
        hint: 'create one in Settings › API Tokens',
      });
    return { token: env, source: 'env' };
  }
  const stored = await storedCredential(io, product, profile);
  return stored ? tokenOf(io, product, profile, stored) : null;
}
