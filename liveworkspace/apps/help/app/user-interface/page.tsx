import { featureLanding } from '@/lib/landings';

// The user-interface landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('user-interface');

export const metadata = landing.metadata;
export default landing.Page;
