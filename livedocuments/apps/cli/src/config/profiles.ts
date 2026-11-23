// Which host a command talks to (docs/specs/015-api/cli.md "Profiles", blueprint CLI7): --host, else --profile,
// else LIVEDOCUMENTS_HOST, else LIVEDOCUMENTS_PROFILE, else the config's default profile, else https://www.livedocuments.app.
// @liveworkspace/cli-kit's, for livedocuments.

import type { ConfigFile } from '@liveworkspace/cli-kit/config-file';
import * as kit from '@liveworkspace/cli-kit/profiles';
import type { CliIo } from '@liveworkspace/cli-kit/io';
import { PRODUCT } from '../product';

export { DEFAULT_PROFILE, type Profile, type ProfileSource } from '@liveworkspace/cli-kit/profiles';

export const DEFAULT_HOST = kit.defaultHostOf(PRODUCT);

export const readConfig = (io: CliIo): Promise<ConfigFile> => kit.readConfig(io, PRODUCT);

export const resolveProfile = (
  flags: { host?: string; profile?: string },
  io: CliIo,
  config: ConfigFile,
): kit.Profile => kit.resolveProfile(flags, io, config, PRODUCT);
