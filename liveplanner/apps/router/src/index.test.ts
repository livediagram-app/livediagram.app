import { fileURLToPath } from 'node:url';
import { categories } from '@liveplanner/help-registry';
import { describeAppRouter } from '@liveworkspace/sites/app-router-testing';
import router from './index';

// The dispatch tests every app's router runs (@liveworkspace/sites/app-router-testing; docs/specs/016-platform/
// router-app.md), against this router.
describeAppRouter({
  router,
  app: 'liveplanner',
  editorBinding: 'EDITOR',
  apiItems: 'projects',
  pageSegment: 'project',
  signedInCookie: 'lp_signed_in',
  // `.href` rather than the URL object: this worker's tsconfig loads BOTH @cloudflare/workers-types and node, and
  // each declares a global `URL`. A string is the one argument both agree on.
  liveAppDir: fileURLToPath(new URL('../../editor/app', import.meta.url).href),
  helpCategorySlugs: categories.map((category) => category.slug),
  stagingTelemetryEnv: { TELEMETRY_DASHBOARD_URL: 'https://staging.liveworkspace.app/telemetry' },
});
