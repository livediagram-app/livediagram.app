import { supportLanding } from '@/lib/landings';

// The privacy-and-security landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('privacy-and-security');

export const metadata = landing.metadata;
export default landing.Page;
