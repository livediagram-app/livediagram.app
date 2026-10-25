// How a command names a project and a tab (docs/specs/015-api/blueprints/cli.md "Addressing"): the shared
// addressing (@liveworkspace/agent-verbs/addressing), bound to this product's links, api and CLI.
import {
  createAddressing,
  type AddressFailure as SharedAddressFailure,
} from '@liveworkspace/agent-verbs/addressing';
import { AGENT_PRODUCT } from './agent-product';
import { listAllProjects } from './find-projects';

export {
  AddressError,
  type AddressCandidate,
  type ResolvedFile as ResolvedProject,
  type TabSummary,
} from '@liveworkspace/agent-verbs/addressing';

export type AddressFailure = SharedAddressFailure<'project'>;

export const {
  parseFileUrl: parseProjectUrl,
  resolveFile: resolveProject,
  resolveTab,
} = createAddressing({ product: AGENT_PRODUCT, listAllFiles: listAllProjects });
