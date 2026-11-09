// `document archive` and `document unarchive` (docs/specs/015-api/cli.md "Commands"): the shared Archived verbs
// (@liveworkspace/agent-verbs/verbs/archive) over this product's addressing and libraries.
import { createArchiveVerbs } from '@liveworkspace/agent-verbs/verbs/archive';
import { AGENT_PRODUCT } from '../agent-product';
import { resolveDocument } from '../addressing';
import { readLibraries, searchDocuments } from '../find-documents';

export const { archive: documentArchive, unarchive: documentUnarchive } = createArchiveVerbs({
  product: AGENT_PRODUCT,
  arg: 'doc',
  resolveFile: resolveDocument,
  searchFiles: searchDocuments,
  readLibraries,
});
