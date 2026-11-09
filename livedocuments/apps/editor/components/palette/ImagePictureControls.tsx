'use client';

// The Image section's picture controls (docs/specs/009-elements/picture-crop-and-mask.md): the Mask tiles and the
// Greyscale toggle, through the menu's style ops so a hover previews and a press is one undo step on every
// selected image. Crop Image sits with Change Image and Remove Image (ElementContentSections).
import {
  IMAGE_MASKS,
  imageMaskPath,
  isImageMask,
  type Element,
  type ImageElement,
  type ImageMask,
} from '@livedocuments/document';
import { lucideCrop, lucideSquareDashed } from '@liveworkspace/icons/lucide';
import { Glyph, lucideGlyph, Prims } from '@livedocuments/ui';
import type { IconPrim } from '@liveworkspace/icons';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import { MENU_ICON_PX } from '@liveworkspace/workbench/components/palette/menu-icon-base';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import type { ElementStyleOps } from '@/lib/element-style-ops';

export const CropGlyph = lucideGlyph(lucideCrop, MENU_ICON_PX);
// A mask tile's shape: a little larger than a row icon, as the tile is the preview.
const MASK_GLYPH_PX = 18;

export const MASK_LABEL: Record<ImageMask, string> = {
  circle: 'Circle',
  rounded: 'Rounded',
  arch: 'Arch',
  hexagon: 'Hexagon',
  diamond: 'Diamond',
  triangle: 'Triangle',
  star: 'Star',
  blob: 'Blob',
};

/** The mask set on an image (or removed, `null`), every other field and kind left as it is. */
export function withImageMask(el: Element, mask: ImageMask | null): Element {
  if (el.type !== 'image') return el;
  const { mask: _old, ...rest } = el;
  void _old;
  return mask ? { ...rest, mask } : rest;
}

/** Greyscale turned on or off on an image; other kinds left as they are. */
export function withImageGreyscale(el: Element, on: boolean): Element {
  if (el.type !== 'image') return el;
  const { greyscale: _old, ...rest } = el;
  void _old;
  return on ? { ...rest, greyscale: true } : rest;
}

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
    // Pressing the chosen mask again takes it off.
    const next = mask === current ? null : mask;
    return (
      <SizeButton
        key={mask ?? 'none'}
        active={mask === current}
        label={label}
        onClick={() => ops.commit((el) => withImageMask(el, next), 'ImageMask')}
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
