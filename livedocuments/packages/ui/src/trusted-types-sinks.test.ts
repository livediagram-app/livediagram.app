import { fileURLToPath } from 'node:url';
import { describeTrustedTypesSinks } from '@liveworkspace/trusted-types/sinks-suite';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// The shared sink checks (@liveworkspace/trusted-types/sinks-suite) over livedocuments's apps and packages.
describeTrustedTypesSinks({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  apps: ['editor', 'marketing', 'help'],
  editorApp: 'editor',
  csp: TRUSTED_TYPES_CSP,
});
