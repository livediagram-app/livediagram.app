import { Glyph } from '@livehuddle/ui';

// The workday pieces (docs/specs/009-elements/workday-pieces.md): line glyphs in the palette's 24-unit style, beside
// the office's own (palette-icons.tsx), the social pieces', the amenities' and the venue's.

type IconSizeProps = { size?: number };

// --- Rooms ----------------------------------------------------------------------------------------------------------

export function PhoneBoothIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="6" y="2.5" width="12" height="19" rx="1.5" />
      <path d="M9 4.5h6" />
      <rect x="8.5" y="7.5" width="7" height="8" rx="1" />
      <path d="M10.5 18.5h3" />
    </Glyph>
  );
}

export function NapPodIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3 18V12a9 7 0 0 1 18 0v6" />
      <path d="M3 18h18M6.5 18v-4.5a5.5 4 0 0 1 11 0V18" />
      <path d="M15.5 5.5h2l-2 2h2" />
    </Glyph>
  );
}

export function ReceptionDeskIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2.5 13h19v7.5h-19z" />
      <path d="M2.5 16h19" />
      <path d="M8 13a4 4 0 0 1 8 0M12 9V7.5M10.5 7.5h3" />
    </Glyph>
  );
}

// --- Seating --------------------------------------------------------------------------------------------------------

export function HotDeskIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3 10.5h18M5 10.5V20M19 10.5V20" />
      <path d="M7 10.5 8 5h8l1 5.5" />
      <rect x="13" y="12.5" width="6" height="3" rx="0.5" />
    </Glyph>
  );
}

export function StandingDeskIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3 7h18M12 7v12M7 21h10" />
      <path d="M8 7V3.5h8V7" />
      <path d="m10 13 2-2 2 2M10 16l2 2 2-2" />
    </Glyph>
  );
}

// --- Recreation -----------------------------------------------------------------------------------------------------

export function TreadmillIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3 19h15.5a2.5 2.5 0 0 0 0-5H8" />
      <path d="M8 14 15 4M12.5 4h5" />
      <path d="M6 22h.01M12 22h.01M18 22h.01" />
    </Glyph>
  );
}

export function WeightBenchIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M5 8h14" />
      <rect x="2.5" y="5" width="2.5" height="6" rx="0.5" />
      <rect x="19" y="5" width="2.5" height="6" rx="0.5" />
      <path d="M6 15h12M8 15v5M16 15v5M9 8v7M15 8v7" />
    </Glyph>
  );
}

export function PetBedIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2.5 14a9.5 5 0 0 0 19 0" />
      <path d="M2.5 14c0-2 1.5-3 3-3h13c1.5 0 3 1 3 3" />
      <circle cx="9" cy="5" r="1.2" />
      <circle cx="15" cy="5" r="1.2" />
      <circle cx="6.5" cy="7.5" r="1" />
      <circle cx="17.5" cy="7.5" r="1" />
      <path d="M10 9.5a2.5 1.8 0 0 0 4 0" />
    </Glyph>
  );
}
