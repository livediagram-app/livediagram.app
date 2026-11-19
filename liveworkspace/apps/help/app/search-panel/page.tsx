import { featureLanding } from '@/lib/landings';

// The search-panel landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('search-panel');

export const metadata = landing.metadata;
export default landing.Page;
