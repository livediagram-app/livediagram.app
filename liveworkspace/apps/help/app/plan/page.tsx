import { featureLanding } from '@/lib/landings';

// The plan landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('plan');

export const metadata = landing.metadata;
export default landing.Page;
