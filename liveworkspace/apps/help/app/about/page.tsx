import { supportLanding } from '@/lib/landings';

// The about landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('about');

export const metadata = landing.metadata;
export default landing.Page;
