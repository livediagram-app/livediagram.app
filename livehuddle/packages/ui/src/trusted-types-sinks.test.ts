import { fileURLToPath } from 'node:url';
import { describeTrustedTypesSinks } from '@liveworkspace/trusted-types/sinks-suite';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// The shared sink checks (@liveworkspace/trusted-types/sinks-suite) over livediagram's apps and packages.
describeTrustedTypesSinks({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  apps: ['editor', 'marketing', 'help', 'community'],
  editorApp: 'editor',
  csp: TRUSTED_TYPES_CSP,
  domParserAllowed: ['packages/ui/src/trusted-types.ts', 'apps/editor/lib/drawio/test-support.ts'],
});
