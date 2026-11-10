import { fileURLToPath } from 'node:url';
import { describeTrustedTypesSinks } from '@liveworkspace/trusted-types/sinks-suite';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// The shared sink checks (@liveworkspace/trusted-types/sinks-suite) over livedocuments's apps and packages.
describeTrustedTypesSinks({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  apps: ['editor', 'marketing', 'help'],
  editorApp: 'editor',
  csp: TRUSTED_TYPES_CSP,
  // Static or builder markup, fed through the trustedHtml escape hatch unsanitised (catalogue icons and stickers,
  // a look's sample preview, the face-finish ink from geometry and stored colours that dropUnsafeColours checked).
  // Everything else (a document's drawing, a thumbnail, an export preview) goes through sanitizedHtml.
  builderMarkup: [
    'apps/editor/components/canvas/StickerView.tsx',
    'apps/editor/components/canvas/layout-render-thumb.tsx',
    'apps/editor/components/canvas/useFaceFinishPass.ts',
    'apps/editor/components/dialogs/LooksCarousel.tsx',
    'apps/editor/components/dialogs/TabStylePreview.tsx',
    'apps/editor/components/palette/palette-tile-art.tsx',
    'apps/editor/components/primitives/tech-icon-glyph.tsx',
  ],
});
