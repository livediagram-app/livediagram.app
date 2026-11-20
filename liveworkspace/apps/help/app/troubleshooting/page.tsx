import { supportLanding } from '@/lib/landings';

// The troubleshooting landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('troubleshooting');

export const metadata = landing.metadata;
export default landing.Page;
