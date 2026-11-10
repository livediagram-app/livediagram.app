import { fileURLToPath } from 'node:url';
import { describeTrustedTypesSinks } from '@liveworkspace/trusted-types/sinks-suite';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// The shared sink checks (@liveworkspace/trusted-types/sinks-suite) over liveplanner's apps and packages.
describeTrustedTypesSinks({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  apps: ['editor', 'marketing', 'help'],
  editorApp: 'editor',
  csp: TRUSTED_TYPES_CSP,
  // Markup fed in unsanitised through the escape hatch (trustedConstant, builtMarkup): our own boot scripts and
  // constants, and builder markup (catalogue icons and stickers, a look's sample preview, the face-finish ink from
  // geometry and stored colours that dropUnsafeColours checked). Everything else (a plan's drawing, a thumbnail,
  // an export preview) goes through sanitizedHtml.
  builderMarkup: [
    'apps/editor/app/pre-hydration-scripts.ts',
    'apps/editor/components/canvas/marker-grid-rules.ts',
    'apps/editor/components/canvas/useFaceFinishPass.ts',
    'apps/editor/components/dialogs/LooksCarousel.tsx',
    'apps/editor/components/dialogs/TabStylePreview.tsx',
    'apps/editor/lib/stale-html-guard.ts',
    'packages/ui/src/appearance/appearance-storage.ts',
  ],
});
