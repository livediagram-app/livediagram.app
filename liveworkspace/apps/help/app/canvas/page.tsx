import { featureLanding } from '@/lib/landings';

// The canvas landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('canvas');

export const metadata = landing.metadata;
export default landing.Page;
