import { featureLanding } from '@/lib/landings';

// The knowledgebase landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('knowledgebase');

export const metadata = landing.metadata;
export default landing.Page;
