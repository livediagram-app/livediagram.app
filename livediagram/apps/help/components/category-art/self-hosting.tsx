import { SelfHostingArt as Scene } from '@liveworkspace/help-site/art/scenes/self-hosting';

// Self-Hosting: the shared scene (docs/specs/018-help/help-pages.md "Category art"), deploying livediagram's api,
// editor and router.
export function SelfHostingArt() {
  return (
    <Scene folder="livediagram" apps={['api', 'editor', 'router']} domain="diagrams.acme.dev" />
  );
}
