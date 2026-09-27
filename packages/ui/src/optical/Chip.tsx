import type { HTMLAttributes, ReactNode } from 'react';
import { IconSlot } from './IconSlot';

// A pill holding an optional leading icon and a label (docs/specs/004-interface-design/optical-alignment.md).
// The height is explicit, because a trimmed label no longer props a padding-sized pill open (D12). The
// label centres its cap band; a caps label also gives back the letter-space after its last letter.
export type ChipProps = {
  height: number;
  icon?: ReactNode;
  iconSize?: number;
  caps?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

export function Chip({
  height,
  icon,
  iconSize,
  caps = false,
  children,
  className = '',
  style,
  ...rest
}: ChipProps) {
  return (
    <span
      data-optical="chip"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full leading-none ${className}`}
      style={{ height, ...style }}
      {...rest}
    >
      {icon ? <IconSlot size={iconSize ?? Math.round(height / 2)}>{icon}</IconSlot> : null}
      <span className={`text-optical-centre${caps ? ' text-optical-caps' : ''}`}>{children}</span>
    </span>
  );
}
