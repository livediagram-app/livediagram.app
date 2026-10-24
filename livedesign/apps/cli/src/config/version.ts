// The CLI's own version, and the host's floor for writes (blueprint CLI13).

import { upgradeHint } from '@liveworkspace/cli-kit/version';

export { isBelow } from '@liveworkspace/cli-kit/version';

export const CLI_VERSION = '0.3.0';

// The name npm publishes the CLI under (blueprint CLI1); its command is `livedesign`.
export const NPM_PACKAGE = '@livedesign/cli';

export const UPGRADE_HINT = upgradeHint(NPM_PACKAGE);
