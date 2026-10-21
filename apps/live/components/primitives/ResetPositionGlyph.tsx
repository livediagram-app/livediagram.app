import { Glyph } from '@livediagram/ui';
// A diagonal arrow tucking back into a corner: the "snap back to the
// default corner" glyph shared by the panel settings popovers (Palette,
// Map) and the MovablePanel header reset button, so the reset affordances
// can't drift. `className` is overridable so a host can let it inherit the
// button's currentColor (the header button) instead of the fixed slate.
export function ResetPositionGlyph({
  size = 14,
  className = 'shrink-0 text-slate-500 dark:text-slate-400',
}: {
  size?: number;
  className?: string;
} = {}) {
  return (
    <Glyph size={size} units={12} className={className}>
      <path d="M6.5 3H9v2.5" />
      <path d="M9 3L5 7" />
      <path d="M3 7v2h6" />
    </Glyph>
  );
}
