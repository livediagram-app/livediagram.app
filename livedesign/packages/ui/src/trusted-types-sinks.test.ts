import { fileURLToPath } from 'node:url';
import { describeTrustedTypesSinks } from '@liveworkspace/trusted-types/sinks-suite';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// The shared sink checks (@liveworkspace/trusted-types/sinks-suite) over livedesign's apps and packages.
describeTrustedTypesSinks({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  apps: ['live', 'marketing', 'help'],
  editorApp: 'live',
  csp: TRUSTED_TYPES_CSP,
  // Markup fed in unsanitised through the escape hatch (trustedConstant, builtMarkup): our own boot scripts and
  // constants, and builder markup (catalogue icons and stickers, a look's sample preview, the face-finish ink from
  // geometry and stored colours that dropUnsafeColours checked). Everything else (a design's drawing, a thumbnail,
  // an export preview) goes through sanitizedHtml.
  builderMarkup: [
    'apps/live/app/pre-hydration-scripts.ts',
    'apps/live/components/canvas/StickerView.tsx',
    'apps/live/components/canvas/WireframeDeviceOverlays.tsx',
    'apps/live/components/canvas/WireframeDeviceSheet.tsx',
    'apps/live/components/canvas/layout-render-thumb.tsx',
    'apps/live/components/canvas/useFaceFinishPass.ts',
    'apps/live/components/canvas/wireframe/DeviceMiniature.tsx',
    'apps/live/components/dialogs/LooksCarousel.tsx',
    'apps/live/components/dialogs/TabStylePreview.tsx',
    'apps/live/components/primitives/tech-icon-glyph.tsx',
    'apps/live/lib/stale-html-guard.ts',
    'packages/ui/src/appearance/appearance-storage.ts',
  ],
});
