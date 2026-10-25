// A scripted api for the verb suites (@liveworkspace/agent-verbs/testing/fake-api), on this product's host and
// collection.

import { createFakeApi } from '@liveworkspace/agent-verbs/testing/fake-api';
import { AGENT_PRODUCT } from '../agent-product';

export const { fakeApi, contextOf, library, tabsOfA } = createFakeApi(
  AGENT_PRODUCT,
  'https://livediagram-router.liveworkspace-easing509.workers.dev',
);
export { DOC_A, DOC_B, DOC_C } from '@liveworkspace/agent-verbs/testing/fake-api';
