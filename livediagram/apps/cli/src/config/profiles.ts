// Which host a command talks to (docs/specs/015-api/cli.md "Profiles and self-hosting", blueprint CLI7):
// --host, else --profile, else LIVEDIAGRAM_HOST, else LIVEDIAGRAM_PROFILE, else the config's default profile,
// else https://livediagram.app. --host and --profile together are a usage error.

import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { parseConfig, type ConfigFile } from './config-file';
import { configDir } from './paths';

export const DEFAULT_HOST = 'https://livediagram.app';
export const DEFAULT_PROFILE = 'default';

export type ProfileSource = 'flag' | 'env' | 'config' | 'default';

export type Profile = { name: string; host: string; source: ProfileSource };

export async function readConfig(io: CliIo): Promise<ConfigFile> {
  const path = `${configDir(io)}/config.toml`;
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
): Profile {
  if (flags.host && flags.profile)
    throw usage('--host and --profile choose the same thing; give one');
  if (flags.host) {
    const host = normaliseHost(flags.host);
    return { name: host, host, source: 'flag' };
  }
  if (!flags.profile && io.env.LIVEDIAGRAM_HOST) {
    const host = normaliseHost(io.env.LIVEDIAGRAM_HOST);
    return { name: host, host, source: 'env' };
  }
  const named = flags.profile ?? io.env.LIVEDIAGRAM_PROFILE;
  const name = named ?? config.defaultProfile ?? DEFAULT_PROFILE;
  const source: ProfileSource = flags.profile
    ? 'flag'
    : io.env.LIVEDIAGRAM_PROFILE
      ? 'env'
      : config.defaultProfile
        ? 'config'
        : 'default';
  const host = config.profiles[name]?.host;
  if (host) return { name, host: normaliseHost(host), source };
  if (name !== DEFAULT_PROFILE) throw usage(`no profile "${name}" in ${configDir(io)}/config.toml`);
  return { name, host: DEFAULT_HOST, source };
}
