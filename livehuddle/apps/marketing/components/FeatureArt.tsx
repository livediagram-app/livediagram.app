// Per-card mini illustrations for the landing-page feature grids.
//
// Each export is a small, self-contained, animated picture of what its card describes. Every card that shows the
// board shows a real Space in use (./feature-art/spaces and ./feature-art/spaces-notes: the product's own rooms,
// characters and notes); the rest are the platform's panels (sharing, teams, the timeline, the API). Motion is pure
// CSS (fa-* classes + keyframes in app/feature-art/*.css) so it survives the static export with no JS and settles
// under prefers-reduced-motion. This barrel re-exports them so callers keep importing from '@/components/FeatureArt'.
export * from './feature-art/spaces';
export * from './feature-art/spaces-notes';
// The meeting tools: the Timer and Stopwatch pieces, the facilitator baton and Bring Focus.
export { SessionToolsArt } from './feature-art/features-more';
export { BringFocusArt, FacilitatorArt } from './feature-art/room';
// Being in the Space together, and sharing it.
export { PresenceArt, RealtimeArt } from './feature-art/together';
export { ExpiryArt, RevokeArt, ShareLinksArt, TeamsArt } from './feature-art/sharing';
export { ApiArt } from './feature-art/foundations';
