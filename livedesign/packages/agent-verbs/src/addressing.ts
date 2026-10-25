// How a command names a design and a tab (docs/specs/015-api/blueprints/cli.md "Addressing"): the shared
// addressing (@liveworkspace/agent-verbs/addressing), bound to this product's links, api and CLI.
import {
  createAddressing,
  type AddressFailure as SharedAddressFailure,
} from '@liveworkspace/agent-verbs/addressing';
import { AGENT_PRODUCT } from './agent-product';
import { listAllDesigns } from './find-designs';

export {
  AddressError,
  type AddressCandidate,
  type ResolvedFile as ResolvedDesign,
  type TabSummary,
} from '@liveworkspace/agent-verbs/addressing';

export type AddressFailure = SharedAddressFailure<'design'>;

export const {
  parseFileUrl: parseDesignUrl,
  resolveFile: resolveDesign,
  resolveTab,
} = createAddressing({ product: AGENT_PRODUCT, listAllFiles: listAllDesigns });
