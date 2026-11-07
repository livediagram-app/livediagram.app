import { Glyph } from '@livehuddle/ui';

// The office amenities (docs/specs/009-elements/office-amenities.md): line glyphs in the palette's 24-unit style,
// beside the office's own (palette-icons.tsx) and the social pieces' (palette-icons-social.tsx).

type IconSizeProps = { size?: number };

// --- Office ---------------------------------------------------------------------------------------------------------

export function PrinterIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M7 8V3h10v5" />
      <rect x="3" y="8" width="18" height="9" rx="2" />
      <path d="M7 14h10v7H7z" />
      <path d="M17 11h1" />
    </Glyph>
  );
}

export function CopierIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="3" y="3" width="15" height="4" rx="1" />
      <rect x="3" y="7" width="18" height="6" rx="1.5" />
      <rect x="4" y="13" width="16" height="8" rx="1" />
      <path d="M10 17h4M6 10h6" />
    </Glyph>
  );
}

export function LockersIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="3" y="2.5" width="18" height="19" rx="1.5" />
      <path d="M9 2.5v19M15 2.5v19M5 6h2M11 6h2M17 6h2M7 12v2M13 12v2M19 12v2" />
    </Glyph>
  );
}

export function CoatRackIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M12 3v18M7 21l5-3 5 3M12 6c-3 0-5 1-5 3M12 6c3 0 5 1 5 3" />
      <path d="M7 9l-2 8h4zM17 9l2 7h-4z" />
    </Glyph>
  );
}

export function UmbrellaStandIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="6" y="12" width="12" height="9" rx="2" />
      <path d="M9 12L7 4c-.5-2-3-1.5-2.5.5M15 12l2-8c.5-2 3-1.5 2.5.5M12 12V5" />
    </Glyph>
  );
}

// --- Kitchen --------------------------------------------------------------------------------------------------------

export function KitchenCounterIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 9h20" />
      <rect x="3" y="9" width="18" height="11" rx="1" />
      <path d="M12 9v11M3 13h18M10 16v2M14 16v2" />
    </Glyph>
  );
}

export function KitchenSinkIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 11h20M8 11c0 2 1 3 4 3s4-1 4-3M12 11V5c0-2 3-2 3 0v1" />
      <rect x="3" y="11" width="18" height="10" rx="1" />
    </Glyph>
  );
}

export function FridgeIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M5 9h14M8 5v2M8 12v4" />
    </Glyph>
  );
}

export function MicrowaveIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <rect x="5" y="8" width="10" height="8" rx="1" />
      <path d="M18 9v1M18 12v1M18 15v1" />
    </Glyph>
  );
}

export function KettleIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M7 19L8 8h8l1 11zM8 9L4 6M16 9c3 0 3 7 0.5 7M10 5h4" />
      <path d="M5 21h14" />
    </Glyph>
  );
}

// --- Restroom -------------------------------------------------------------------------------------------------------

// The Restroom preset: a room's outline with a door sign's figures.
export function RestroomIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <circle cx="7.5" cy="4.5" r="2" />
      <circle cx="16.5" cy="4.5" r="2" />
      <path d="M7.5 8v13M5 9h5l1 6M12 2v20M14 21l1-6h3l1 6M14.5 15l1.5-6h1l1.5 6" />
    </Glyph>
  );
}

export function ToiletCubicleIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 3h20M3 3v18M21 3v18M16 4l4 1v15l-4-1z" />
      <path d="M7 8h5v3H7zM6 13h7c0 3-1.5 4-3.5 4S6 16 6 13zM8.5 17v3" />
    </Glyph>
  );
}

export function WashbasinIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="6" y="2" width="12" height="8" rx="1.5" />
      <path d="M4 13h16c0 3-3 5-8 5s-8-2-8-5zM10 18l-.5 4h5l-.5-4M12 13v-1.5h2" />
    </Glyph>
  );
}

export function HandDryerIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="4" y="3" width="16" height="12" rx="3" />
      <path d="M9 15h6l-1 3h-4zM8 7h8M9 21c1-1 1-2 0-3M12 22c1-1 1-2 0-3M15 21c1-1 1-2 0-3" />
    </Glyph>
  );
}
