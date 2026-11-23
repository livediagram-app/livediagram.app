import {
  diffToElementOps,
  elementFingerprint,
  invertElementOps,
  type Element,
} from '@livedesign/design';
import { describeChangesetPlans } from '@liveworkspace/api-kit/testing/changeset-plans-suite';
import * as plans from './plans';

// docs/specs/024-agents/agent-changesets.md "Conflicts", "The write path" step 8 and "Revert": the suite every
// product's api runs, over the plans bound to this product's elements.
describeChangesetPlans<Element>({
  plans,
  elementFingerprint,
  diffToElementOps,
  invertElementOps,
  box: (id, label, over) => ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    label,
    ...over,
  }),
});
