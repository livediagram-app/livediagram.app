'use client';

// The Image section's picture controls (docs/specs/009-elements/picture-crop-and-mask.md): the Mask tiles and the
// Greyscale toggle, through the menu's style ops so a hover previews and a press is one undo step on every
// selected image. Crop Image sits with Change Image and Remove Image (ElementContentSections).
import {
  IMAGE_MASKS,
  MASK_LABEL,
  imageMaskPath,
  isImageMask,
  withImageGreyscale,
  withImageMask,
  type ImageElement,
  type ImageMask,
} from '@liveknowledge/document';
import { lucideCrop, lucideSquareDashed } from '@liveworkspace/icons/lucide';
import { Glyph, lucideGlyph, Prims } from '@liveknowledge/ui';
import type { IconPrim } from '@liveworkspace/icons';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import { MENU_ICON_PX } from '@liveworkspace/workbench/components/palette/menu-icon-base';
import { BorderGrid } from '@liveworkspace/workbench/components/palette/BorderGrid';
import { MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@liveworkspace/workbench/components/palette/palette-buttons';
import type { ElementStyleOps } from '@/lib/element-style-ops';

export const CropGlyph = lucideGlyph(lucideCrop, MENU_ICON_PX);
// A mask tile's shape: a little larger than a row icon, as the tile is the preview.
const MASK_GLYPH_PX = 18;

// A mask's tile: its shape on the icons' 24-unit grid, drawn as every menu glyph is; No Mask a dashed square.
const NoMaskGlyph = lucideGlyph(lucideSquareDashed, MASK_GLYPH_PX);
const maskPrims = new Map<ImageMask, IconPrim[]>(
  IMAGE_MASKS.map((m) => [m, [{ t: 'path', d: imageMaskPath(m, 18, 18, 3, 3) }]]),
);
function MaskGlyph({ mask }: { mask: ImageMask | null }) {
  if (!mask) return <NoMaskGlyph />;
  return (
    <Glyph size={MASK_GLYPH_PX} units={24}>
      <Prims prims={maskPrims.get(mask)!} />
    </Glyph>
  );
}

export function ImagePictureControls({
  target,
  ops,
}: {
  target: ImageElement;
  ops: ElementStyleOps;
}) {
  const current = isImageMask(target.mask) ? target.mask : null;
  const tile = (mask: ImageMask | null) => {
    const label = mask ? MASK_LABEL[mask] : 'No Mask';
    return (
      <SizeButton
        key={mask ?? 'none'}
        active={mask === current}
        label={label}
        // Always the tile's own mask: under a hover preview `target` already shows it, so a toggle would read it as
        // set and take it off. No Mask removes one.
        onClick={() => ops.commit((el) => withImageMask(el, mask), 'ImageMask')}
        onPointerEnter={onMouseHover(() => ops.preview((el) => withImageMask(el, mask)))}
        onPointerLeave={onMouseHover(ops.end)}
      >
        <MaskGlyph mask={mask} />
      </SizeButton>
    );
  };
  return (
    <>
      <div className="px-2 pt-1.5 pb-1">
        <BorderGrid label="Mask" cols={5}>
          {tile(null)}
          {IMAGE_MASKS.map((m) => tile(m))}
        </BorderGrid>
      </div>
      <MenuToggleRow
        label="Greyscale"
        description="Draw the picture in shades of grey."
        checked={target.greyscale === true}
        onToggle={() =>
          ops.commit((el) => withImageGreyscale(el, target.greyscale !== true), 'ImageGreyscale')
        }
      />
    </>
  );
}
