import { supportLanding } from '@/lib/landings';

// The getting-started landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('getting-started', { numbered: true });

export const metadata = landing.metadata;
export default landing.Page;
