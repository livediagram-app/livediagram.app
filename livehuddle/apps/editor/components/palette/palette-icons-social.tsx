import { Glyph } from '@livehuddle/ui';

// The social pieces (docs/specs/009-elements/social-pieces.md): line glyphs in the palette's 24-unit style, beside
// the office's own (palette-icons.tsx, palette-icons-garden.tsx).

type IconSizeProps = { size?: number };

export function NoticeBoardIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h5v4H6zM13 9h5v5h-5zM7 14h4v3H7z" />
    </Glyph>
  );
}

export function WorldClockIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="1.5" y="6" width="21" height="12" rx="4" />
      <circle cx="8" cy="12" r="3.5" />
      <circle cx="16" cy="12" r="3.5" />
      <path d="M8 10.5V12h1.2M16 10.5V12l-1 1" />
    </Glyph>
  );
}

// The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md): a wall timer with its display, and a
// round stopwatch with its crown.
export function TimerPieceIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2" y="6" width="20" height="14" rx="3.5" />
      <rect x="5" y="9" width="14" height="6" rx="1.5" />
      <path d="M10 3h4v3" />
    </Glyph>
  );
}

export function StopwatchIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <circle cx="12" cy="14" r="7.5" />
      <path d="M10 2.5h4M12 2.5v4M12 14l3-3M18.5 6.5l1.5-1.5" />
    </Glyph>
  );
}

export function JukeboxIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M5 21V9a7 7 0 0 1 14 0v12z" />
      <path d="M8.5 11a3.5 3.5 0 0 1 7 0" />
      <rect x="8" y="13" width="8" height="3" rx="1" />
      <path d="M8 19h8" />
    </Glyph>
  );
}

export function PingPongTableIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2" y="8" width="20" height="8" rx="1" />
      <path d="M12 6v12M5 16v4M19 16v4" />
      <circle cx="17" cy="4.5" r="1.5" />
    </Glyph>
  );
}

export function ArcadeMachineIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M6 22V6l2-4h8l2 4v16z" />
      <rect x="8" y="6.5" width="8" height="6" rx="1" />
      <path d="M5 15h14M9.5 15v-1.5M14 16.5h.01M16 16.5h.01" />
    </Glyph>
  );
}

export function FireplaceIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 6h20M4 6v15M20 6v15M2 21h20" />
      <path d="M8 21v-6a4 4 0 0 1 8 0v6" />
      <path d="M12 19c-1.4 0-2-1-2-2 0-1.4 2-2.6 2-4 0 1.4 2 2.6 2 4 0 1-.6 2-2 2z" />
    </Glyph>
  );
}

export function CampfireIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M12 14c-2 0-3-1.4-3-3 0-2.2 3-4 3-7 0 3 3 4.8 3 7 0 1.6-1 3-3 3z" />
      <path d="M4 20l16-4M20 20L4 16" />
    </Glyph>
  );
}

export function BenchIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3 6h18M3 9.5h18M3 14h18M5 9.5V14M19 9.5V14M5 14v6M19 14v6" />
    </Glyph>
  );
}

export function PicnicTableIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 8h20M4 15h16M8 8l-3 13M16 8l3 13" />
    </Glyph>
  );
}

export function HammockIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3 4v17M21 4v17M3 7l3 4M21 7l-3 4" />
      <path d="M6 11c3 4 9 4 12 0" />
    </Glyph>
  );
}

export function GardenUmbrellaIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M2 11a10 8 0 0 1 20 0z" />
      <path d="M12 3v18M8.5 21h7M8 11l4-8 4 8" />
    </Glyph>
  );
}

export function FountainIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <ellipse cx="12" cy="17" rx="9" ry="3" />
      <path d="M3 17v2c0 1.7 4 3 9 3s9-1.3 9-3v-2" />
      <path d="M12 14V7M12 7c-2-2-4-1-5 3M12 7c2-2 4-1 5 3" />
    </Glyph>
  );
}

export function PondIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <ellipse cx="12" cy="13" rx="10" ry="7" />
      <path d="M7 12q2-1.5 4 0M13 15.5q2-1.5 4 0" />
      <path d="M15 9.5a2 1.4 0 1 0 0.01 0" />
    </Glyph>
  );
}

// The second set (docs/specs/009-elements/social-pieces.md "Pool Table, Foosball Table, Dartboard", "Vending Machine",
// "Bean Bag, Reading Nook").
export function PoolTableIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <path d="M5 17v3M19 17v3" />
      <circle cx="7.5" cy="12" r="1.3" />
      <circle cx="14.5" cy="12" r="1.2" />
      <circle cx="17.5" cy="10.3" r="1.2" />
      <circle cx="17.5" cy="13.7" r="1.2" />
    </Glyph>
  );
}

export function FoosballTableIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="2" y="8" width="20" height="8" rx="1.5" />
      <path d="M7 4v16M12 4v16M17 4v16" />
      <path d="M5.5 11h3M10.5 13h3M15.5 11h3" />
    </Glyph>
  );
}

export function DartboardIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <circle cx="11" cy="13" r="8.5" />
      <circle cx="11" cy="13" r="4.5" />
      <path d="M11 13l7.5-7.5M17 3.5v2.5h2.5" />
    </Glyph>
  );
}

export function VendingMachineIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <rect x="4.5" y="2" width="15" height="20" rx="2" />
      <rect x="7" y="5" width="7" height="10" rx="1" />
      <path d="M16.5 6v1M16.5 9v1M16.5 12v1M7.5 18.5h6" />
    </Glyph>
  );
}

export function BeanBagIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M3.5 18C2.5 12.5 6 7 12 7s9.5 5.5 8.5 11c-1 2.5-16 2.5-17 0z" />
      <path d="M8 13c2 1.5 6 1.5 8 0" />
    </Glyph>
  );
}

export function ReadingNookIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M4 12V8.5A3.5 3.5 0 0 1 7.5 5h3A3.5 3.5 0 0 1 14 8.5V12" />
      <path d="M2 12h3v3h8v-3h3v6H2zM4 18v2M14 18v2" />
      <path d="M20 20V9M17.5 9h5l-1.5-5h-2z" />
    </Glyph>
  );
}
