import { featureLanding } from '@/lib/landings';

// The explorer landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('explorer');

export const metadata = landing.metadata;
export default landing.Page;
