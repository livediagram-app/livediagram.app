import { site } from './help-site';

// Every article's and page's metadata: the shared pageMetadata rule, its own social card, `<name> Help` as the site
// name, and the canonical the one help centre sets (an article for several apps on www.liveworkspace.app, for one on
// its app's address; @liveworkspace/help-site site.ts). Kept at this path because every article imports it.
export const helpMetadata = site.helpMetadata;
