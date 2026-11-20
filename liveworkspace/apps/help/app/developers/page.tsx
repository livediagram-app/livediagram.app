import { supportLanding } from '@/lib/landings';

// The developers landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('developers');

export const metadata = landing.metadata;
export default landing.Page;
