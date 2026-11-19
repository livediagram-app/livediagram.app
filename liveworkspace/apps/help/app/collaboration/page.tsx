import { featureLanding } from '@/lib/landings';

// The collaboration landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('collaboration');

export const metadata = landing.metadata;
export default landing.Page;
