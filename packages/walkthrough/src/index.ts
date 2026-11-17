// @liveworkspace/walkthrough: recorded narrations of a canvas, in all four canvas apps
// (liveworkspace/docs/specs/006-media/walkthroughs.md). An app binds a WalkthroughHost, calls useWalkthroughs with it,
// and mounts WalkthroughsTools (its row in the footer's Tools) and WalkthroughsLayer over its canvas.
export { walkthroughApi, type WalkthroughApi, type WalkthroughApiDeps } from './api';
export type { WalkthroughHost, WalkthroughSlides, WalkthroughViewport } from './host';
export { fingerprintOf } from './timeline';
export {
  useEditorWalkthroughs,
  walkthroughsFit,
  type EditorWalkthroughsInput,
} from './useEditorWalkthroughs';
export { useWalkthroughs, type Walkthroughs, type WalkthroughsMenu } from './useWalkthroughs';
export {
  slidesOfDeck,
  useWalkthroughHost,
  type EditorTab,
  type SlideDeckLike,
  type WalkthroughHostInput,
} from './useWalkthroughHost';
export { WalkthroughsPanel, WalkthroughsTools } from './ui/WalkthroughsTools';
export { WalkthroughsLayer } from './ui/WalkthroughsLayer';
