import { supportLanding } from '@/lib/landings';

// The account-and-data landing in the build's scope (lib/landings.tsx).
const landing = supportLanding('account-and-data');

export const metadata = landing.metadata;
export default landing.Page;
