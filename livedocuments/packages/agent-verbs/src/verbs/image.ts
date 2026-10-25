// `image ls` (docs/specs/015-api/cli.md "Commands", docs/specs/009-elements/images.md "Agents"): the shared verb
// (@liveworkspace/agent-verbs/verbs/image), its examples naming this product's CLI.
import { createImageVerbs } from '@liveworkspace/agent-verbs/verbs/image';
import { AGENT_PRODUCT } from '../agent-product';

export { sizeText } from '@liveworkspace/agent-verbs/verbs/image';

export const { imageLs } = createImageVerbs(AGENT_PRODUCT);
