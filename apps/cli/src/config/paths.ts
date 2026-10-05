// Where the CLI keeps its files (blueprint "Data and persistence"): config under XDG_CONFIG_HOME, caches under
// XDG_CACHE_HOME, each defaulting under the home directory.

import type { CliIo } from '../io';

export function configDir(io: CliIo): string {
  return `${io.env.XDG_CONFIG_HOME || `${io.homedir}/.config`}/livediagram`;
}

export function cacheDir(io: CliIo): string {
  return `${io.env.XDG_CACHE_HOME || `${io.homedir}/.cache`}/livediagram`;
}
