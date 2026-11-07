import { Glyph } from '@livehuddle/ui';

// The venue pieces (docs/specs/009-elements/venue-pieces.md): line glyphs in the palette's 24-unit style, beside the
// office's own (palette-icons.tsx), the social pieces' and the amenities'.

type IconSizeProps = { size?: number };

// --- Structure ------------------------------------------------------------------------------------------------------

export function PillarIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="6" y="2.5" width="12" height="3" rx="0.75" />
      <rect x="8" y="5.5" width="8" height="13" />
      <path d="M13.5 5.5v13" />
      <rect x="6" y="18.5" width="12" height="3" rx="0.75" />
    </Glyph>
  );
}

export function ColumnIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M5 3h14M7.5 3c-2 0-2.5 3.5 0 3.5h9c2.5 0 2-3.5 0-3.5" />
      <path d="M8.5 6.5 9 18M15.5 6.5 15 18M12 7.5v10" />
      <path d="M7 18h10M5 21h14M6 18v3M18 18v3" />
    </Glyph>
  );
}

// --- Arrivals -------------------------------------------------------------------------------------------------------

export function CarParkIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2.5 4v16M21.5 4v16" />
      <path d="M6 12.5 7.5 8h9l1.5 4.5" />
      <rect x="5" y="12.5" width="14" height="5" rx="1.5" />
      <path d="M7 17.5V20M17 17.5V20M8 15h.01M16 15h.01" />
    </Glyph>
  );
}

export function BikeRackIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <circle cx="6" cy="16" r="4" />
      <circle cx="18" cy="16" r="4" />
      <path d="M6 16 9.5 9h6L18 16M11.5 16 9.5 9M12 16l3.5-7M8 7.5h3M15.5 9 16 6.5h2" />
    </Glyph>
  );
}

// --- Water ----------------------------------------------------------------------------------------------------------

export function SwimmingPoolIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M6 12q1.5-1.5 3 0t3 0 3 0 3 0" />
      <path d="M16 5V2.5M19 5V2.5M16 3.5h3" />
    </Glyph>
  );
}

// --- The stage's pieces ---------------------------------------------------------------------------------------------

export function StageCurtainsIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 3h20M2 6h20" />
      <path d="M3 6v15h4c-1-3-1.5-5 0-8.5C5 10 4.5 8 4.5 6M21 6v15h-4c1-3 1.5-5 0-8.5C19 10 19.5 8 19.5 6" />
      <path d="M3 12.5h4M21 12.5h-4" />
    </Glyph>
  );
}

export function PodiumIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M4 10h16" />
      <path d="M7 10l1 10h8l1-10" />
      <path d="M6 21h12M15 10c0-3 1-5 3-6.5" />
      <circle cx="12" cy="14.5" r="1.5" />
    </Glyph>
  );
}
