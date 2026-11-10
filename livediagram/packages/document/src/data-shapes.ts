// The self-drawing data shapes: one copy for every product, @liveworkspace/element-model/data-shapes. livediagram's
// retired pieces (docs/specs/009-elements/retired-elements.md) are self-drawing too: each is its placeholder card,
// kept as saved, with nothing to write on, mark or morph.
import { isSelfDrawingShape as drawsItself } from '@liveworkspace/element-model/data-shapes';
import { isRetiredShapeKind } from './retired-elements';

export * from '@liveworkspace/element-model/data-shapes';

export function isSelfDrawingShape(kind: string): boolean {
  return isRetiredShapeKind(kind) || drawsItself(kind);
}
