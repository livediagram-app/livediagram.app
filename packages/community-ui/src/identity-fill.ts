// An author's colour under the white initial in dark mode: @liveworkspace/ui's identity fill on the shared colour
// maths (@liveworkspace/brand), so the Community's pieces depend on no app's document model.
import { contrastRatio, shade } from '@liveworkspace/brand/colour';
import { createIdentityFill } from '@liveworkspace/ui/identity-fill';

export { IDENTITY_FILL } from '@liveworkspace/ui/identity-fill';

export const { identityVars } = /* @__PURE__ */ createIdentityFill({ shade, contrastRatio });
