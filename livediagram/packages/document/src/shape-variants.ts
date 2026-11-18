// One copy for every product: @liveworkspace/element-model/shape-variants. livediagram adds its C4 tiles' variants
// (docs/specs/010-palette/build-category.md "The C4 model") and its BPMN tiles' (docs/specs/009-elements/bpmn.md) on top: the two functions below shadow the shared ones of
// the same name (an explicit export wins over `export *`), so every placement path in the editor reaches them as it
// always did.
import {
  applyShapeVariant as applySharedVariant,
  withVariantColours as withSharedVariantColours,
} from '@liveworkspace/element-model/shape-variants';
import type { ShapeElement } from '@liveworkspace/element-model/element';
import { applyC4Variant, withC4VariantColours } from './c4-look';
import { applyBpmnVariant } from './bpmn';

export * from '@liveworkspace/element-model/shape-variants';

/** `el` placed as `variant` (a C4 tile's, or any shared one), or `el` itself when the kind has no such variant. */
export function applyShapeVariant<E extends ShapeElement>(el: E, variant: string | undefined): E {
  return (
    applyC4Variant(el, variant) ?? applyBpmnVariant(el, variant) ?? applySharedVariant(el, variant)
  );
}

/** `el` with the colours its variant fixes put back (a C4 tile's palette, the Warning badge's rose). */
export function withVariantColours<T extends ShapeElement>(el: T, variant: string | undefined): T {
  return withC4VariantColours(el, variant) ?? withSharedVariantColours(el, variant);
}
