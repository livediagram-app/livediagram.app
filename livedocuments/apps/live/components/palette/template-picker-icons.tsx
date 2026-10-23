import { Glyph } from '@livedocuments/ui';
// Inline SVG icons (spinner, sparkle). Pure presentational.

// Inline spinner for the Create Document button while the host commits.
export function Spinner() {
  return (
    <Glyph size={13} units={16} className="animate-spin" strokeLinejoin="miter">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </Glyph>
  );
}

export function SparkleIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M8 2.5l1.4 3.1L12.5 7l-3.1 1.4L8 11.5 6.6 8.4 3.5 7l3.1-1.4z" />
      <path d="M12.5 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </Glyph>
  );
}
