import { SITE_URL } from '@livediagram/ui';

// The help centre's `/help` base on the shared site origin. The app is served
// under /help by the router, so HELP_URL is the prefix every absolute help URL
// builds on (robots, sitemap, breadcrumb JSON-LD, the structured-data
// builders). The origin itself is SITE_URL in @livediagram/ui, shared with
// every other app.
export const HELP_URL = `${SITE_URL}/help`;
