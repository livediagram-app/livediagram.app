import { lazyPanel } from '@livehuddle/ui';
import { loadScreenFileOverlay, loadScreenSourceDialog } from '@/lib/editor-deferred-code';

// Show on the Screen and a Screen's file opened large (docs/specs/009-elements/screen-and-room-sign.md), each drawn
// from its own chunk the first time it opens (web-performance.md "A piece's panel"); their openers preload them.
export const ScreenSourcePanel = lazyPanel('screen-source', loadScreenSourceDialog);
export const ScreenFileOverlayPanel = lazyPanel('screen-file', loadScreenFileOverlay);
