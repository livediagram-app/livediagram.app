import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// docs/specs/016-platform/trusted-types.md: the header livedocuments's pages send. The policies themselves, the default
// policy and the boot script are @liveworkspace/trusted-types', tested there.

describe('TRUSTED_TYPES_CSP', () => {
  it('enforces Trusted Types and names every policy the pages may create', () => {
    expect(TRUSTED_TYPES_CSP).toBe(
      "require-trusted-types-for 'script'; trusted-types liveworkspace-markup liveworkspace-inert-parse nextjs ProseMirrorClipboard default",
    );
  });
});
