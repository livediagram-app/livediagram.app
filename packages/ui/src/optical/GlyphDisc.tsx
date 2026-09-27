import type { HTMLAttributes, ReactNode } from 'react';

// A circle holding one glyph: a letter, initials, a numeral or an icon
// (docs/specs/004-interface-design/optical-alignment.md). A text glyph centres its cap band through
// `text-optical-centre`, not its line box; an icon renders as a block so no baseline gap offsets it.
// Colour, font size and ARIA are the caller's.
export type GlyphDiscProps = {
  size: number;
  children: ReactNode;
  as?: 'span' | 'div' | 'button';
} & HTMLAttributes<HTMLElement> & { type?: 'button' | 'submit' | 'reset' };

export function GlyphDisc({
  size,
  children,
  as: Tag = 'span',
  className = '',
  style,
  ...rest
}: GlyphDiscProps) {
  const text = typeof children === 'string' || typeof children === 'number';
  return (
    <Tag
      data-optical="disc"
      className={`inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full leading-none [&>svg]:block ${className}`}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      {text ? <span className="text-optical-centre">{children}</span> : children}
    </Tag>
  );
}
