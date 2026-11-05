import { Glyph } from '@livehuddle/ui';

// The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md): line glyphs in the palette's 24-unit style,
// beside the office's own (palette-icons.tsx, palette-icons-garden.tsx). The Screen's doubles as the Meeting
// category's glyph.

type IconSizeProps = { size?: number };

export function ScreenIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2.5" y="4" width="19" height="12.5" rx="1.5" />
      <path d="M6 13l3.5-3.5 2.5 2.5 2-2 4 3" />
      <path d="M12 16.5V20M8.5 20h7" />
    </Glyph>
  );
}

export function RoomSignIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M6 6v12" />
      <path d="M9.5 10.5h8" />
      <circle cx="10.5" cy="14.5" r="1" />
      <path d="M13 14.5h4.5" />
    </Glyph>
  );
}
