// Anonymous, first-party telemetry emitter for the help centre (spec/22).
//
// The help centre uses the public sites' shared siteTrack() from
// @livediagram/telemetry-client (the build-time NEXT_PUBLIC_TELEMETRY_ENABLED
// gate plus the editor's spec/20 opt-out, which this origin shares), the same
// instance the shared PageViewBoot reports page views through, so help runs
// one buffer. Re-exported under the app's `track` name for its call sites.
// `type` is ALWAYS a bounded reference token (the article slug, or a page
// path for a page view, spec/150), never user-generated content.

export { siteTrack as track } from '@livediagram/telemetry-client';
