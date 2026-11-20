import { featureLanding } from '@/lib/landings';

// The palette landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('palette');

export const metadata = landing.metadata;
export default landing.Page;
