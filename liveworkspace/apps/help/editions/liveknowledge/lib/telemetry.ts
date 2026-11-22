// Anonymous, first-party telemetry for liveknowledge's help (liveworkspace/docs/specs/017-help/help-centre.md
// "Telemetry"): the public sites' shared siteTrack() from @liveknowledge/telemetry-client, the same instance the
// shared PageViewBoot reports page views through, so help runs one buffer and the editor's opt-out (which this origin
// shares) holds. `type` is always a bounded token (an article's telemetry id, or a page path), never anything a
// person typed.

export { siteTrack as track } from '@liveknowledge/telemetry-client';
