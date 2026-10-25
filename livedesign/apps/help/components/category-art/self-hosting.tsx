import { SelfHostingArt as Scene } from '@liveworkspace/help-site/art/scenes/self-hosting';

// Self-Hosting: the shared scene (docs/specs/018-help/help-pages.md "Category art"), deploying livedesign's api,
// live editor and router.
export function SelfHostingArt() {
  return <Scene folder="livedesign" apps={['api', 'live', 'router']} domain="design.acme.dev" />;
}
