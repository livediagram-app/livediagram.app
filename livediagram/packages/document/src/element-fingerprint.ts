// livediagram's element fingerprint (docs/specs/024-agents/agent-changesets.md "What a changeset is"): the shared one,
// @liveworkspace/element-model/element-fingerprint, over the live fields livediagram leaves out (./comments).
import { fingerprintsFor } from '@liveworkspace/element-model/element-fingerprint';
import { LIVE_ELEMENT_FIELDS } from './comments';

export {
  canonicalJson,
  ELEMENT_FINGERPRINT_LENGTH,
} from '@liveworkspace/element-model/element-fingerprint';

export const { canonicalElementJson, elementFingerprint } = fingerprintsFor(LIVE_ELEMENT_FIELDS);
