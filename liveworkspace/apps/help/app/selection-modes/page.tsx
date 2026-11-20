import { featureLanding } from '@/lib/landings';

// The selection-modes landing in the build's scope (lib/landings.tsx).
const landing = featureLanding('selection-modes');

export const metadata = landing.metadata;
export default landing.Page;
