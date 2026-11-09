// `project archive` and `project unarchive` (docs/specs/015-api/cli.md "Commands"): the shared Archived verbs
// (@liveworkspace/agent-verbs/verbs/archive) over this product's addressing and libraries.
import { createArchiveVerbs } from '@liveworkspace/agent-verbs/verbs/archive';
import { AGENT_PRODUCT } from '../agent-product';
import { resolveProject } from '../addressing';
import { readLibraries, searchProjects } from '../find-projects';

export const { archive: projectArchive, unarchive: projectUnarchive } = createArchiveVerbs({
  product: AGENT_PRODUCT,
  arg: 'project',
  resolveFile: resolveProject,
  searchFiles: searchProjects,
  readLibraries,
});
