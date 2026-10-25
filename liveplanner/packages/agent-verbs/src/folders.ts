// The person's folders as paths (docs/specs/015-api/cli.md `folder ls`; blueprint CLI86, CLI87): the shared paths
// and references (@liveworkspace/agent-verbs/folders), their refusals hinting this product's CLI.
import { createFolderRefs } from '@liveworkspace/agent-verbs/folders';
import { AGENT_PRODUCT } from './agent-product';

export {
  folderChoices,
  folderLines,
  matchFolders,
  type FolderChoice,
} from '@liveworkspace/agent-verbs/folders';

// The one folder a reference names, or the refusal (exit 3) with the nearest candidates or the several it matched.
export const resolveFolderRef = createFolderRefs(AGENT_PRODUCT);
