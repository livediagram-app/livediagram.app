import { fileURLToPath } from 'node:url';
import { describeTrustedTypesSinks } from '@liveworkspace/trusted-types/sinks-suite';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// The shared sink checks (@liveworkspace/trusted-types/sinks-suite) over livediagram's apps and packages.
describeTrustedTypesSinks({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  apps: ['editor', 'marketing', 'help'],
  editorApp: 'editor',
  csp: TRUSTED_TYPES_CSP,
  domParserAllowed: ['packages/ui/src/trusted-types.ts', 'apps/editor/lib/drawio/test-support.ts'],
  // Markup fed in unsanitised through the escape hatch (trustedConstant, builtMarkup): our own boot scripts and
  // constants, and builder markup (catalogue icons and stickers, a look's sample preview, the face-finish ink from
  // geometry and stored colours that dropUnsafeColours checked). Everything else (a document's drawing, a thumbnail,
  // an export preview) goes through sanitizedHtml.
  builderMarkup: [
    'apps/editor/app/new/early-mode-choice.ts',
    'apps/editor/app/pre-hydration-scripts.ts',
    'apps/editor/components/canvas/StickerView.tsx',
    'apps/editor/components/dialogs/LooksCarousel.tsx',
    'apps/editor/components/dialogs/TabStylePreview.tsx',
    'apps/editor/components/primitives/tech-icon-glyph.tsx',
    'apps/editor/lib/stale-html-guard.ts',
    'apps/marketing/components/hero-draw-marks.tsx',
    'apps/marketing/components/hero-townhall-parts.tsx',
    'packages/ui/src/appearance/appearance-storage.ts',
  ],
});
