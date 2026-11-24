import { fileURLToPath } from 'node:url';
import { categories } from '@livedesign/help-registry';
import { describeAppRouter } from '@liveworkspace/sites/app-router-testing';
import router from './index';

// The dispatch tests every app's router runs (@liveworkspace/sites/app-router-testing; docs/specs/016-platform/
// router-app.md), against this router.
describeAppRouter({
  router,
  app: 'livedesign',
  editorBinding: 'LIVE',
  apiItems: 'designs',
  pageSegment: 'design',
  signedInCookie: 'ldes_signed_in',
  // `.href` rather than the URL object: this worker's tsconfig loads BOTH @cloudflare/workers-types and node, and
  // each declares a global `URL`. A string is the one argument both agree on.
  liveAppDir: fileURLToPath(new URL('../../live/app', import.meta.url).href),
  helpCategorySlugs: categories.map((category) => category.slug),
  stagingTelemetryEnv: { TELEMETRY_DASHBOARD_URL: 'https://staging.liveworkspace.app/telemetry' },
});
