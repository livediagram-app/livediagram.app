// @liveworkspace/walkthrough: recorded narrations of a canvas, in all four canvas apps
// (liveworkspace/docs/specs/006-media/walkthroughs.md). An app binds a WalkthroughHost, calls useWalkthroughs with it,
// and mounts WalkthroughsButton in its header and WalkthroughsLayer over its canvas.
export { walkthroughApi, type WalkthroughApi, type WalkthroughApiDeps } from './api';
export type { WalkthroughHost, WalkthroughSlides, WalkthroughViewport } from './host';
export { fingerprintOf } from './timeline';
export { useWalkthroughs, type Walkthroughs, type WalkthroughsMenu } from './useWalkthroughs';
export {
  slidesOfDeck,
  useWalkthroughHost,
  type EditorTab,
  type SlideDeckLike,
  type WalkthroughHostInput,
} from './useWalkthroughHost';
export { WalkthroughsButton } from './ui/WalkthroughsButton';
export { WalkthroughsLayer } from './ui/WalkthroughsLayer';
