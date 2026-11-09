// `design archive` and `design unarchive` (docs/specs/015-api/cli.md "Commands"): the shared Archived verbs
// (@liveworkspace/agent-verbs/verbs/archive) over this product's addressing and libraries.
import { createArchiveVerbs } from '@liveworkspace/agent-verbs/verbs/archive';
import { AGENT_PRODUCT } from '../agent-product';
import { resolveDesign } from '../addressing';
import { readLibraries, searchDesigns } from '../find-designs';

export const { archive: designArchive, unarchive: designUnarchive } = createArchiveVerbs({
  product: AGENT_PRODUCT,
  arg: 'doc',
  resolveFile: resolveDesign,
  searchFiles: searchDesigns,
  readLibraries,
});
