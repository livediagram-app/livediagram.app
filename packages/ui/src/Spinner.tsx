import { Glyph } from './icons/Glyph';

// The inline spinner a button or a row shows while its work runs (the new-file wizard's Create, a project kit's
// parts). Still when motion is reduced.
export function Spinner({ size = 13 }: { size?: number }) {
  return (
    <Glyph
      size={size}
      units={16}
      className="animate-spin motion-reduce:animate-none"
      strokeLinejoin="miter"
    >
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </Glyph>
  );
}
