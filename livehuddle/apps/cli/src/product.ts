// This CLI as @liveworkspace/cli-kit's shared modules name it: the `livehuddle` command, its LIVEHUDDLE_ environment
// variables, its npm package and version, and the OAuth client its host's sign-in server ships for it.

import { CLI_CLIENT_ID } from '@livehuddle/api-schema';
import type { CliProduct } from '@liveworkspace/cli-kit/product';
import { CLI_VERSION, NPM_PACKAGE } from './config/version';

export const PRODUCT: CliProduct = {
  name: 'livehuddle',
  envPrefix: 'LIVEHUDDLE',
  npmPackage: NPM_PACKAGE,
  version: CLI_VERSION,
  clientId: CLI_CLIENT_ID,
};
