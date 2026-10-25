// A runtime colour under white text in dark mode (docs/specs/004-interface-design/color-scheme.md, Dark palette
// rules): @liveworkspace/ui's identity fill, on this product's colour maths (@livedocuments/document's shade and contrastRatio).
import { contrastRatio, shade } from '@livedocuments/document';
import { createIdentityFill } from '@liveworkspace/ui/identity-fill';

export { IDENTITY_FILL } from '@liveworkspace/ui/identity-fill';

export const { identityDeep, identityVars } = /* @__PURE__ */ createIdentityFill({
  shade,
  contrastRatio,
});
