import { featureLanding } from '@/lib/landings';

// The tabs landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('tabs');

export const metadata = landing.metadata;
export default landing.Page;
