// This CLI as @liveworkspace/cli-kit's shared modules name it: the `liveknowledge` command, its LIVEKNOWLEDGE_ environment
// variables, its npm package and version, and the OAuth client its host's sign-in server ships for it.

import { CLI_CLIENT_ID } from '@liveknowledge/api-schema';
import type { CliProduct } from '@liveworkspace/cli-kit/product';
import { CLI_VERSION, NPM_PACKAGE } from './config/version';

export const PRODUCT: CliProduct = {
  name: 'liveknowledge',
  envPrefix: 'LIVEKNOWLEDGE',
  npmPackage: NPM_PACKAGE,
  version: CLI_VERSION,
  clientId: CLI_CLIENT_ID,
};
