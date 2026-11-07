import { Glyph } from '@livehuddle/ui';

// The team pieces (docs/specs/009-elements/team-pieces.md): line glyphs in the palette's 24-unit style, beside the
// social pieces' and the workday pieces'.

type IconSizeProps = { size?: number };

export function CalendarWallIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <path d="M7 13h2M11 13h2M15 13h2M7 16.5h2M11 16.5h2" />
      <circle cx="16" cy="16.5" r="1.6" />
    </Glyph>
  );
}

export function SuggestionBoxIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M10 8.5 10.5 3h4l-.5 5.5" />
      <rect x="4" y="8.5" width="16" height="9" rx="1.5" />
      <path d="M9 8.5h6M12 17.5v4M9 21.5h6" />
      <circle cx="12" cy="13" r="1.8" />
    </Glyph>
  );
}

export function SignpostIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M12 2.5v19M8 21.5h8" />
      <path d="M12 5h7l2 2-2 2h-7" />
      <path d="M12 11H5l-2 2 2 2h7" />
    </Glyph>
  );
}

export function PhotoWallIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2.5" y="4" width="8" height="7" rx="1" />
      <rect x="13.5" y="4" width="8" height="7" rx="1" />
      <rect x="2.5" y="13" width="8" height="7" rx="1" />
      <rect x="13.5" y="13" width="8" height="7" rx="1" />
      <circle cx="6.5" cy="7" r="1.3" />
      <path d="M4.5 11a2 2 0 0 1 4 0" />
    </Glyph>
  );
}
