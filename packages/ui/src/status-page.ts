import { PLATFORM_SITE } from '@liveworkspace/sites';

// liveworkspace's one status page, for the platform and every app (liveworkspace/docs/site.md "Status"). The apps
// keep no status page of their own: their footers and FAQs link here, the local site's on a dev server.
export const STATUS_PAGE_URL = `${PLATFORM_SITE.url}/status`;
