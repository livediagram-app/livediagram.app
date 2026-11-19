import { fileURLToPath } from 'node:url';
import { describeTrustedTypesSinks } from '@liveworkspace/trusted-types/sinks-suite';
import { SECURITY_HEADERS } from './help-scope';

// The shared sink checks (@liveworkspace/trusted-types/sinks-suite) over the one help centre's own sources, as every
// product runs them over its apps: the escape hatch only in a layout or a listed builder, TrustedHTML minted in the
// browser and never in a server component, and no hand-made DOMParser. The root is liveworkspace/, so the suite's
// `@/` and relative imports resolve, but only apps/help is read: the platform's other apps are not this suite's. The
// per-app boot and header checks are layout-boot.test.ts's, since the help Worker builds its header in help-scope.ts
// rather than sending a product's TRUSTED_TYPES_CSP.
describeTrustedTypesSinks({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  sources: ['apps/help'],
  apps: [],
  csp: String(SECURITY_HEADERS['Content-Security-Policy']),
  // Markup fed in unsanitised through the escape hatch: our own constants. All Apps' bindings wrap liveworkspace.app's
  // pre-paint appearance script (the products' bindings re-export theirs from each packages/ui).
  builderMarkup: ['apps/help/lib/bindings/all.tsx'],
});
