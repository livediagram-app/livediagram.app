import { Glyph } from '@livehuddle/ui';

// The Office Pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to "Garden Fence"): line
// glyphs in the palette's 24-unit style, beside the office's own (palette-icons.tsx).

type IconSizeProps = { size?: number };

export function OfficePodIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M9 21H3V3h18v18h-6" />
      <path d="M3 7h18" />
      <path d="M6 10v8M18 10v8" />
      <rect x="10" y="11" width="4" height="4" rx="1" />
    </Glyph>
  );
}

export function BarIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M5 3v5M5 3h1M9 4v4M13 2.5v5.5M17 4v4" />
      <rect x="2" y="10" width="20" height="3" rx="1" />
      <path d="M3.5 13v8h17v-8M9 13v8M15 13v8" />
    </Glyph>
  );
}

export function BarStoolIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <ellipse cx="12" cy="6" rx="6" ry="2.5" />
      <path d="M12 8.5V20M8 21h8" />
      <ellipse cx="12" cy="15" rx="3.5" ry="1.25" />
    </Glyph>
  );
}

export function DrinksCabinetIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="3" y="2" width="18" height="18" rx="1.5" />
      <path d="M12 2v12M3 14h18M10.5 17h3M5 20v2M19 20v2" />
      <path d="M6.5 11V8l1-1.5L8.5 8v3M15.5 11V8l1-1.5L17.5 8v3" />
    </Glyph>
  );
}

export function DrinksFridgeIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M5 6h14M8 10.5h2M12 10.5h2M8 15h2M12 15h2M16.5 9v6" />
    </Glyph>
  );
}

export function OutdoorPlantIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M4.5 13a7.5 6.5 0 0 1 15 0z" />
      <circle cx="9" cy="9.5" r="0.75" />
      <circle cx="14.5" cy="8.5" r="0.75" />
      <path d="M5 13h14l-2 8H7z" />
    </Glyph>
  );
}

export function TreeIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <circle cx="12" cy="9" r="7" />
      <path d="M12 16v6M9 22h6M12 19l-2.5-2.5M12 18l2-2" />
    </Glyph>
  );
}

export function GardenPathIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <ellipse cx="6" cy="18.5" rx="3" ry="2" />
      <ellipse cx="12.5" cy="13" rx="3" ry="2" />
      <ellipse cx="17.5" cy="6.5" rx="3" ry="2" />
    </Glyph>
  );
}

export function GrassIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 20h20" />
      <path d="M5 20c0-3-1-5-2.5-6.5M5 20c0-4 1-7 2.5-9M5 20c.5-2.5 2-4 3.5-5" />
      <path d="M15 20c0-3.5-1.5-6-3-7.5M15 20c0-4.5 1-8 3-10.5M15 20c.5-3 2.5-5 4.5-6" />
    </Glyph>
  );
}

export function GardenFenceIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3 9l1.5-2L6 9v10H3zM9 9l1.5-2L12 9v10H9zM15 9l1.5-2L18 9v10h-3z" />
      <path d="M1.5 12h20M1.5 16h20" />
    </Glyph>
  );
}
