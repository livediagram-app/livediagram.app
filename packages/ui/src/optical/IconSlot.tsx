import type { HTMLAttributes, ReactNode } from 'react';

// A fixed square that centres whatever it holds (docs/specs/004-interface-design/optical-alignment.md):
// an icon, an avatar, a spinner. Stacks put their glyph in one so every label in a row shares a line.
export type IconSlotProps = { size: number; children: ReactNode } & HTMLAttributes<HTMLSpanElement>;

export function IconSlot({ size, children, className = '', style, ...rest }: IconSlotProps) {
  return (
    <span
      data-optical="slot"
      className={`inline-flex shrink-0 items-center justify-center [&>svg]:block ${className}`}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}
