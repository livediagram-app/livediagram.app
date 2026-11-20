// Anonymous, first-party telemetry emitter for the help centre (docs/specs/017-telemetry/telemetry.md).
//
// The help centre uses the public sites' shared siteTrack() from
// @livediagram/telemetry-client (the build-time NEXT_PUBLIC_TELEMETRY_ENABLED
// gate plus the editor's docs/specs/007-editor/user-preferences.md opt-out, which this origin shares), the same
// instance the shared PageViewBoot reports page views through, so help runs
// one buffer. Re-exported under the app's `track` name for its call sites.
// `type` is ALWAYS a bounded reference token (the article slug, or a page
// path for a page view, docs/specs/017-telemetry/page-view-telemetry.md), never user-generated content.

export { siteTrack as track } from '@livediagram/telemetry-client';
