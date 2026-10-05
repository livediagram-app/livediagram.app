// `config.toml` (blueprint CLI5): the subset it uses, read by hand: top-level `key = value` lines and
// `[profiles.<name>]` tables of the same. Strings in double quotes, booleans bare. A line that does not
// read is a usage error naming the file and the line.

import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';

export type ConfigFile = {
  defaultProfile?: string;
  telemetry?: boolean;
  profiles: Record<string, { host?: string }>;
};

const VALUE = /^("(?:[^"\\]|\\.)*"|true|false)$/;

export function parseConfig(text: string, path: string): ConfigFile {
  const config: ConfigFile = { profiles: {} };
  let table: string | null = null;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (line === '' || line.startsWith('#')) return;
    const fail = () =>
      new CliError({
        exit: EXIT.usage,
        code: 'usage',
        message: `${path} line ${index + 1} does not read: ${raw.trim()}`,
      });
    const header = /^\[profiles\.([A-Za-z0-9_-]+)\]$/.exec(line);
    if (header) {
      table = header[1]!;
      config.profiles[table] ??= {};
      return;
    }
    const pair = /^([a-z_]+)\s*=\s*(.+)$/.exec(line);
    if (!pair || !VALUE.test(pair[2]!)) throw fail();
    const [, key, rawValue] = pair;
    const value: unknown = JSON.parse(rawValue!);
    if (table !== null) {
      if (key === 'host' && typeof value === 'string') config.profiles[table]!.host = value;
      return;
    }
    if (key === 'default_profile' && typeof value === 'string') config.defaultProfile = value;
    if (key === 'telemetry' && typeof value === 'boolean') config.telemetry = value;
  });
  return config;
}
