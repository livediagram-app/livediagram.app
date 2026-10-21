import { Glyph } from '@livediagram/ui';
// The navigation chevron: points the way a tap will take you. `forward` for a
// row that pushes a screen, `back` for the control that returns from one.
//
// One component rather than two near-identical inline SVGs: the Settings
// dialog grew a right-pointing one for its category rows and a left-pointing
// one for its back button within a few minutes of each other, which is how a
// pair of glyphs ends up with different stroke weights.
export function NavChevron({
  direction = 'forward',
  className,
}: {
  direction?: 'forward' | 'back';
  className?: string;
}) {
  return (
    <Glyph size={14} units={12} className={`shrink-0${className ? ` ${className}` : ''}`}>
      <path d={direction === 'forward' ? 'M4.5 2.5 8 6l-3.5 3.5' : 'M7.5 2.5 4 6l3.5 3.5'} />
    </Glyph>
  );
}
