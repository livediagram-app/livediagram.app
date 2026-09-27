import type { IconPrim } from '@livediagram/icons';

import { Glyph, type IconProps } from './Glyph';
import { Prims } from './Prims';

// A named chrome icon backed by a vendored Lucide glyph (docs/specs/004-interface-design/iconography.md):
// 24-unit grid, house weight, the caller's size (default per icon).
export function lucideGlyph(prims: readonly IconPrim[], defaultSize: number) {
  return function LucideGlyph({ size = defaultSize, ...rest }: IconProps) {
    return (
      <Glyph size={size} units={24} {...rest}>
        <Prims prims={prims} />
      </Glyph>
    );
  };
}
