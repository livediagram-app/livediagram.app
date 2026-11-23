import { elementFingerprint, mergeIncomingElement, type Element } from '@livediagram/document';
import {
  createChangesetPlans,
  type BaseOutcome as PlanBaseOutcome,
} from '@liveworkspace/api-kit/changeset-plans';

// The base check, the merge on save and the revert plan (docs/specs/024-agents/agent-changesets.md "Conflicts",
// "The write path" step 8, "Revert"): @liveworkspace/api-kit's, bound once to this product's elements, their
// fingerprint and their whole-element merge.
export type BaseOutcome = PlanBaseOutcome<Element>;

export const { checkBase, mergeChangesetsIntoSave, planRevert } = createChangesetPlans<Element>({
  elementFingerprint,
  mergeIncomingElement,
});
