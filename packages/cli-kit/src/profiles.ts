// Which host a command talks to (each product's docs/specs/015-api/cli.md "Profiles", blueprint CLI7):
// --host, else --profile, else <PREFIX>_HOST, else <PREFIX>_PROFILE, else the config's default profile, else the
// product's own site. --host and --profile together are a usage error.

import { CliError } from './cli-error';
import { parseConfig, type ConfigFile } from './config-file';
import { EXIT } from './exit-codes';
import type { CliIo } from './io';
import { configDir } from './paths';
import type { CliProduct } from './product';

export const DEFAULT_PROFILE = 'default';

export type ProfileSource = 'flag' | 'env' | 'config' | 'default';

export type Profile = { name: string; host: string; source: ProfileSource };

type Named = Pick<CliProduct, 'name' | 'envPrefix'>;

/** The host a product's CLI talks to when nothing names another: its own site. */
export const defaultHostOf = (product: Pick<CliProduct, 'name'>): string =>
  `https://www.${product.name}.app`;

export async function readConfig(
  io: CliIo,
  product: Pick<CliProduct, 'name'>,
): Promise<ConfigFile> {
  const path = `${configDir(io, product)}/config.toml`;
  const text = await io.files.read(path);
  return text === null ? { profiles: {} } : parseConfig(text, path);
}

const usage = (message: string) => new CliError({ exit: EXIT.usage, code: 'usage', message });

function normaliseHost(host: string): string {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    throw usage(`${host} is not a host URL; use https://<host>`);
  }
  return url.origin;
}

export function resolveProfile(
  flags: { host?: string; profile?: string },
  io: CliIo,
  config: ConfigFile,
  product: Named,
): Profile {
  if (flags.host && flags.profile)
    throw usage('--host and --profile choose the same thing; give one');
  if (flags.host) {
    const host = normaliseHost(flags.host);
    return { name: host, host, source: 'flag' };
  }
  const envHost = io.env[`${product.envPrefix}_HOST`];
  if (!flags.profile && envHost) {
    const host = normaliseHost(envHost);
    return { name: host, host, source: 'env' };
  }
  const envProfile = io.env[`${product.envPrefix}_PROFILE`];
  const named = flags.profile ?? envProfile;
  const name = named ?? config.defaultProfile ?? DEFAULT_PROFILE;
  const source: ProfileSource = flags.profile
    ? 'flag'
    : envProfile
      ? 'env'
      : config.defaultProfile
        ? 'config'
        : 'default';
  const host = config.profiles[name]?.host;
  if (host) return { name, host: normaliseHost(host), source };
  if (name !== DEFAULT_PROFILE)
    throw usage(`no profile "${name}" in ${configDir(io, product)}/config.toml`);
  return { name, host: defaultHostOf(product), source };
}
