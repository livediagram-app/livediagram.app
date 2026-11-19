// A runtime colour under readable text in both modes (docs/specs/004-interface-design/color-scheme.md, Dark palette
// rules), for the workbench's own surfaces: @liveworkspace/ui's identity fill on the colour maths every product's
// identity-fill.ts binds it to (@liveworkspace/element-model/colour-math), so a disc drawn here matches the editor's.
import { contrastRatio, shade } from '@liveworkspace/element-model/colour-math';
import { createIdentityFill } from '@liveworkspace/ui/identity-fill';

export { IDENTITY_FILL } from '@liveworkspace/ui/identity-fill';

export const { identityDeep, identityVars } = /* @__PURE__ */ createIdentityFill({
  shade,
  contrastRatio,
});
