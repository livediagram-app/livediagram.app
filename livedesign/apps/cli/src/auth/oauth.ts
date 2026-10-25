// The CLI's OAuth client (docs/specs/015-api/blueprints/cli.md "The CLI's OAuth client", CLI34 to CLI36):
// @liveworkspace/cli-kit's browser and device sign-in, as livedesign's CLI client.

import type { CliIo } from '../io';
import type { DebugLog } from '../debug';
import * as kit from '@liveworkspace/cli-kit/oauth';
import { PRODUCT } from '../product';

export { discover, LOGIN_TIMEOUT_MS } from '@liveworkspace/cli-kit/oauth';

type AuthServer = Awaited<ReturnType<typeof kit.discover>>;

export const loginWithBrowser = (io: CliIo, server: AuthServer, log: DebugLog): Promise<string> =>
  kit.loginWithBrowser(io, server, log, PRODUCT);

export const loginWithDevice = (io: CliIo, server: AuthServer, log: DebugLog): Promise<string> =>
  kit.loginWithDevice(io, server, log, PRODUCT);
