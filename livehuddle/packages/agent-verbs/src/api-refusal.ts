// The api's refusals as agents read them ("Errors that teach"): the shared wording
// (@liveworkspace/agent-verbs/api-refusal), naming this product's documents and tools.
import { createApiRefusal, createDeleteRefusal } from '@liveworkspace/agent-verbs/api-refusal';
import { AGENT_PRODUCT } from './agent-product';

export const apiRefusalOf = createApiRefusal(AGENT_PRODUCT);
export const deleteRefusal = createDeleteRefusal(AGENT_PRODUCT);
