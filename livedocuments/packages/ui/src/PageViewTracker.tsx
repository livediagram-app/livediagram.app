'use client';

import { pageViewPath } from '@livedocuments/api-schema';
import { createPageViewTracker } from '@liveworkspace/ui/page-view-tracker';

// Page view telemetry (docs/specs/017-telemetry/page-view-telemetry.md): one `Page·View·<path>` per path change,
// shared by every frontend. @liveworkspace/ui's tracker, on this product's page-view paths. Mounted once in each
// app's root layout through a small client adapter that hands it the app's own policy-wrapped track(), so the
// build gate and the docs/specs/007-editor/user-preferences.md opt-out stay app-owned.
export const { PageViewTracker, reportPageView, resetPageViewTrackerForTests } =
  /* @__PURE__ */ createPageViewTracker(pageViewPath);
