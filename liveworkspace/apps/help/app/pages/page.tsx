import { featureLanding } from '@/lib/landings';

// The pages landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('pages');

export const metadata = landing.metadata;
export default landing.Page;
