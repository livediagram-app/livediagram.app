// How a command names a document and a tab (docs/specs/015-api/blueprints/cli.md "Addressing"): the shared
// addressing (@liveworkspace/agent-verbs/addressing), bound to this product's links, api and CLI.
import {
  createAddressing,
  type AddressFailure as SharedAddressFailure,
} from '@liveworkspace/agent-verbs/addressing';
import { AGENT_PRODUCT } from './agent-product';
import { listAllDocuments } from './find-documents';

export {
  AddressError,
  type AddressCandidate,
  type ResolvedFile as ResolvedDocument,
  type TabSummary,
} from '@liveworkspace/agent-verbs/addressing';

export type AddressFailure = SharedAddressFailure<'document'>;

export const {
  parseFileUrl: parseDocumentUrl,
  resolveFile: resolveDocument,
  resolveTab,
} = createAddressing({ product: AGENT_PRODUCT, listAllFiles: listAllDocuments });
