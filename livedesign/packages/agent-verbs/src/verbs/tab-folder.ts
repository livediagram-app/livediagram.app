// The `tab folder` verb (docs/specs/015-api/cli.md "Commands", docs/specs/006-design/tab-folders.md "Agents"): the shared
// verb (@liveworkspace/agent-verbs/verbs/tab-folder) over this product's tabs, the CLI's change_tabs.
import { createTabFolderVerb } from '@liveworkspace/agent-verbs/verbs/tab-folder';
import { AGENT_PRODUCT } from '../agent-product';
import { designOf } from './shared';

export const tabFolder = createTabFolderVerb({
  product: AGENT_PRODUCT,
  fileOf: designOf,
});
