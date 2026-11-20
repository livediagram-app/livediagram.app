import { supportLanding } from '@/lib/landings';

// The supported-devices landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('supported-devices');

export const metadata = landing.metadata;
export default landing.Page;
