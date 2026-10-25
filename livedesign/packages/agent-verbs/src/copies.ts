// Read copies (docs/specs/015-api/blueprints/cli.md "Read copies"): the shared store
// (@liveworkspace/agent-verbs/copies), bound to this product's tabs, element fingerprint and collection.

import {
  createReadCopies,
  type ReadCopies as SharedReadCopies,
  type ReadCopy as SharedReadCopy,
} from '@liveworkspace/agent-verbs/copies';
import { revOfEtag } from '@livedesign/api-schema';
import { elementFingerprint, type Tab } from '@livedesign/design';
import { AGENT_PRODUCT } from './agent-product';

export type ReadCopy = SharedReadCopy<Tab>;
export type ReadCopies = SharedReadCopies<Tab>;

export const { baseFromCopy, readPlainTab, recordCopy } = createReadCopies<Tab>({
  product: AGENT_PRODUCT,
  fingerprint: elementFingerprint,
  revOfEtag,
});
