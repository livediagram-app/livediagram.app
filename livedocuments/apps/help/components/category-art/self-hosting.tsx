import { SelfHostingArt as Scene } from '@liveworkspace/help-site/art/scenes/self-hosting';

// Self-Hosting: the shared scene (docs/specs/018-help/help-pages.md "Category art"), deploying livedocuments's api,
// editor and router.
export function SelfHostingArt() {
  return <Scene folder="livedocuments" apps={['api', 'editor', 'router']} domain="docs.acme.dev" />;
}
