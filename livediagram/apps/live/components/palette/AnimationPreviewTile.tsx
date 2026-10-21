import { useRef, type ReactNode } from 'react';
import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { useFrozenAnimations } from '@/components/palette/useFrozenAnimations';

// One animation option in a menu (docs/specs/028-animation/element-animations.md "The menu"): a
// live miniature of the real thing above its name. The miniature is frozen on `frame` and plays
// while the tile is hovered; a desktop mouse also previews the animation on the canvas, as before.
export function AnimationPreviewTile({
  active,
  label,
  frame,
  onClick,
  onPreview,
  onPreviewEnd,
  children,
}: {
  active: boolean;
  label: string;
  // The moment of the cycle the miniature rests on, 0 to 1.
  frame: number;
  onClick: () => void;
  onPreview?: () => void;
  onPreviewEnd?: () => void;
  children: ReactNode;
}) {
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
