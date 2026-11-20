import { supportLanding } from '@/lib/landings';

// The policies landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('policies');

export const metadata = landing.metadata;
export default landing.Page;
