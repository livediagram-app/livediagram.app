// Where a product's CLI keeps its files (blueprint "Data and persistence"): config under XDG_CONFIG_HOME, caches under
// XDG_CACHE_HOME, each defaulting under the home directory, in a directory named for the product.

import type { CliIo } from './io';
import type { CliProduct } from './product';

export function configDir(io: CliIo, product: Pick<CliProduct, 'name'>): string {
  return `${io.env.XDG_CONFIG_HOME || `${io.homedir}/.config`}/${product.name}`;
}

export function cacheDir(io: CliIo, product: Pick<CliProduct, 'name'>): string {
  return `${io.env.XDG_CACHE_HOME || `${io.homedir}/.cache`}/${product.name}`;
}
