import { featureLanding } from '@/lib/landings';

// The tools landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('tools');

export const metadata = landing.metadata;
export default landing.Page;
