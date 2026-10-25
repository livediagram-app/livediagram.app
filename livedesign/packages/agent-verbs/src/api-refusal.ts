// The api's refusals as agents read them ("Errors that teach"): the shared wording
// (@liveworkspace/agent-verbs/api-refusal), naming this product's designs and tools.
import { createApiRefusal } from '@liveworkspace/agent-verbs/api-refusal';
import { AGENT_PRODUCT } from './agent-product';

export const apiRefusalOf = createApiRefusal(AGENT_PRODUCT);
