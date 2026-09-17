// Browser entry for the visual detection demo. Bundled by esbuild into
// sticky-vision.bundle.js; imports by relative path so the bundle does not
// need the workspace package names to resolve from the repo root.
import { detectStickies } from '../../packages/sticky-vision/src/detect';
import { EVENT_STORMING_NOTES } from '../../packages/diagram/src/event-storming';

declare global {
  interface Window {
    StickyVisionDemo: {
      detectStickies: typeof detectStickies;
      EVENT_STORMING_NOTES: typeof EVENT_STORMING_NOTES;
    };
  }
}

window.StickyVisionDemo = { detectStickies, EVENT_STORMING_NOTES };
