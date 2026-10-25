// The folder verbs (docs/specs/015-api/cli.md "Commands": `folder ls`, `folder create`; blueprint CLI86, CLI87):
// the shared verbs (@liveworkspace/agent-verbs/verbs/folder) over this product's libraries.
import { createFolderVerbs } from '@liveworkspace/agent-verbs/verbs/folder';
import { AGENT_PRODUCT } from '../agent-product';
import { readLibraries } from '../find-designs';

export const { folderLs, folderCreate } = createFolderVerbs({
  product: AGENT_PRODUCT,
  readLibraries,
});
