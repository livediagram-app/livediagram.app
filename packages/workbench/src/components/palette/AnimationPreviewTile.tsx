import { useRef, type ComponentType } from 'react';
import { onMouseHover } from '../primitives/hover-preview';
import { useFrozenAnimations } from './useFrozenAnimations';
import type { AnimationPreviewTileProps, PaletteTileProps } from './palette-tile-types';

// One animation option in a menu (each editor's animation spec, "The menu"): a
// live miniature of the real thing above its name. The miniature is frozen on `frame` and plays
// while the tile is hovered; a desktop mouse also previews the animation on the canvas, as before.

// What an editor hands the tile: its palette tile (palette-controls' SizeButton).
export type AnimationPreviewTileDeps = { SizeButton: ComponentType<PaletteTileProps> };

/** The animation picker's tile, made once per editor at module scope. */
export function createAnimationPreviewTile({ SizeButton }: AnimationPreviewTileDeps) {
  function AnimationPreviewTile({
    active,
    label,
    frame,
    onClick,
    onPreview,
    onPreviewEnd,
    children,
  }: AnimationPreviewTileProps) {
    const stage = useRef<HTMLSpanElement>(null);
    const { play, rest } = useFrozenAnimations(stage, frame);
    return (
      <SizeButton
        active={active}
        onClick={onClick}
        onPointerEnter={(e) => {
          play();
          if (onPreview) onMouseHover(onPreview)(e);
        }}
        onPointerLeave={(e) => {
          rest();
          if (onPreviewEnd) onMouseHover(onPreviewEnd)(e);
        }}
      >
        <span className="flex flex-col items-center gap-1 py-0.5">
          <span
            ref={stage}
            aria-hidden
            className="relative flex h-[30px] w-[46px] items-center justify-center"
          >
            {children}
          </span>
          <span className="text-[9px] leading-none">{label}</span>
        </span>
      </SizeButton>
    );
  }

  return AnimationPreviewTile;
}
