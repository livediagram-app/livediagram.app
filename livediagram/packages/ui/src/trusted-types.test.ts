import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP, isAllowedScriptUrl, trustedScriptOrigins } from './trusted-types';

// docs/specs/016-platform/trusted-types.md: the header livediagram's pages send. The policies themselves, the default
// policy and the boot script are @liveworkspace/trusted-types', tested there.

describe('TRUSTED_TYPES_CSP', () => {
  it('enforces Trusted Types and names every policy the pages may create', () => {
    expect(TRUSTED_TYPES_CSP).toBe(
      "require-trusted-types-for 'script'; trusted-types liveworkspace-markup liveworkspace-inert-parse nextjs ProseMirrorClipboard default",
    );
  });
});

describe('trustedScriptOrigins', () => {
  // docs/specs/022-drive-mirror/drive-mirror.md: the Drive mirror's Google libraries, only for a build that offers it.
  it("lets Google's Drive libraries load where the build offers the Drive mirror, and only there", () => {
    const page = 'https://www.livediagram.app';
    const withDrive = trustedScriptOrigins({
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: '123456789012-abc.apps.googleusercontent.com',
    });
    for (const src of [
      'https://apis.google.com/js/api.js',
      'https://accounts.google.com/gsi/client',
    ])
      expect(isAllowedScriptUrl(src, page, '/live', withDrive), src).toBe(true);
    expect(isAllowedScriptUrl('https://evil.google.com/x.js', page, '/live', withDrive)).toBe(
      false,
    );
    const without = trustedScriptOrigins({});
    expect(without).toEqual([]);
    expect(isAllowedScriptUrl('https://apis.google.com/js/api.js', page, '/live', without)).toBe(
      false,
    );
  });
});
