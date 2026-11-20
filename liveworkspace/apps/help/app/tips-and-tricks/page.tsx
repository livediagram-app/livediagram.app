import { supportLanding } from '@/lib/landings';

// The tips-and-tricks landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('tips-and-tricks');

export const metadata = landing.metadata;
export default landing.Page;
