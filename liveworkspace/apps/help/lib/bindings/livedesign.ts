// livedesign's pieces of the one help centre's chrome (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The
// build"), re-exported for a livedesign build by lib/bindings.generated.ts: its appearance key, viewport, page-view and
// web-vitals boots, not-found card, social card and telemetry (sent as livedesign.app, the origin the page is served on). One module per
// scope, so a build bundles only its own app's.
import {
  createHelpTelemetryIds,
  HELP_TELEMETRY_OVERRIDES,
} from '@liveworkspace/help-registry/telemetry';

export {
  APPEARANCE_BOOT_SCRIPT,
  PageNotFound,
  PageViewBoot,
  PUBLIC_VIEWPORT,
  renderSocialCard,
  WebVitalsBoot,
} from '@livedesign/ui';
export {
  installClientErrorTracking as installErrorTracking,
  siteTrack as helpTrack,
} from '@livedesign/telemetry-client';

export const { helpPathTelemetryId } = createHelpTelemetryIds(HELP_TELEMETRY_OVERRIDES.livedesign);
