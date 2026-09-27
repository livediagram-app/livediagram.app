import type { HTMLAttributes, ReactNode } from 'react';
import { IconSlot } from './IconSlot';

// A pill (or a rectangular badge) holding an optional leading icon and a label
// (docs/specs/004-interface-design/optical-alignment.md). The label centres its cap band through
// `text-optical-line`, which keeps a full line box, so the chip keeps the height its padding gives it; pin
// `height` only where a fixed size is part of the design. A caps label gives back the letter-space after
// its last letter; set `--optical-tracking` on the chip when its tracking is not the default 0.05em.
export type ChipProps = {
  height?: number;
  icon?: ReactNode;
  // The icon's slot, in px; half the pinned height, else 10.
  iconSize?: number;
  caps?: boolean;
  // A pill by default; 'sm' is a rectangular badge (4px corners).
  radius?: 'full' | 'sm';
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

export function Chip({
  height,
  icon,
  iconSize,
  caps = false,
  radius = 'full',
  children,
  className = '',
  style,
  ...rest
}: ChipProps) {
  return (
    <span
      data-optical="chip"
      className={`optical-edges inline-flex shrink-0 items-center gap-1 ${radius === 'full' ? 'rounded-full' : 'rounded'} ${className}`}
      style={height === undefined ? style : { height, ...style }}
      {...rest}
    >
      {icon ? (
        <IconSlot size={iconSize ?? (height === undefined ? 10 : Math.round(height / 2))}>
          {icon}
        </IconSlot>
      ) : null}
      <span className={`text-optical-line${caps ? ' text-optical-caps' : ''}`}>{children}</span>
    </span>
  );
}
