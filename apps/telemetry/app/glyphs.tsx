// Inline SVG glyph set used by the telemetry dashboard's per-row icons
// (mapped from category / action / type by EventIcon in page.tsx). All
// glyphs share a frame so the row layout stays stable regardless of
// which icon resolves: 14x14, currentColor, no fill (or a subtle fill
// on shapes that need it). Intentionally minimalist line art so a row
// of 20+ icons doesn't get visually noisy.
//
// Lifted out of apps/telemetry/app/page.tsx (was 1296 lines) so the
// dashboard file reads as dashboard layout + chart logic, and these
// stay as pure-render presentational markup. Adding a new glyph means
// appending one function here and one branch in EventIcon.

const SVG_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
export function RectGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="3" width="9" height="8" rx="0.8" />
    </svg>
  );
}
export function CircleGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="4" />
    </svg>
  );
}
export function TriangleGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2.5 L12 11.5 L2 11.5 Z" />
    </svg>
  );
}
export function DiamondGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L12 7 L7 12 L2 7 Z" />
    </svg>
  );
}
export function StarGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L8.5 5.5 L12 6 L9.4 8.4 L10 12 L7 10.2 L4 12 L4.6 8.4 L2 6 L5.5 5.5 Z" />
    </svg>
  );
}
export function PolyGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L11.5 4.5 L11.5 9.5 L7 12 L2.5 9.5 L2.5 4.5 Z" />
    </svg>
  );
}
export function HeartGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 11.5 C 3 9 2 6.5 3.5 4.5 C 5 2.8 6.5 3.5 7 5 C 7.5 3.5 9 2.8 10.5 4.5 C 12 6.5 11 9 7 11.5 Z" />
    </svg>
  );
}
export function CloudGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3.5 9.5 C 1.8 9.5 1.5 7 3.5 6.5 C 3.5 4.5 6 4 7 5.5 C 8 4 11 5 10.5 7 C 12.5 7.2 12.5 9.5 10.5 9.5 Z" />
    </svg>
  );
}
export function CylinderGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <ellipse cx="7" cy="3.5" rx="4" ry="1.3" />
      <path d="M3 3.5 L3 10.5 C 3 11.5 11 11.5 11 10.5 L11 3.5" />
    </svg>
  );
}
export function ArrowGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 7 L11 7" />
      <path d="M8 4 L11 7 L8 10" />
    </svg>
  );
}
export function TextGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 4 L11 4" />
      <path d="M7 4 L7 11" />
    </svg>
  );
}
export function StickyGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 3 L11.5 3 L11.5 9 L8 12 L2.5 12 Z" />
      <path d="M8 12 L8 9 L11.5 9" />
    </svg>
  );
}
export function ImageGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="10" height="8" rx="0.8" />
      <circle cx="5" cy="6" r="0.9" />
      <path d="M2.5 10.5 L5.5 7.5 L8.5 10 L10.5 8.5 L11.5 9.5" />
    </svg>
  );
}
export function MoonGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M11 8.5 A 4.5 4.5 0 1 1 5.5 3 A 3.5 3.5 0 0 0 11 8.5 Z" />
    </svg>
  );
}
export function SunGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="2.5" />
      <path d="M7 1.5 L7 3 M7 11 L7 12.5 M1.5 7 L3 7 M11 7 L12.5 7 M3 3 L4 4 M10 10 L11 11 M3 11 L4 10 M10 4 L11 3" />
    </svg>
  );
}
export function GearGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1.5 L7 3 M7 11 L7 12.5 M1.5 7 L3 7 M11 7 L12.5 7 M3 3 L4.2 4.2 M9.8 9.8 L11 11 M3 11 L4.2 9.8 M9.8 4.2 L11 3" />
    </svg>
  );
}
export function KeyboardGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="4" width="11" height="6" rx="0.8" />
      <path d="M4 6.5 L4 6.5 M6 6.5 L6 6.5 M8 6.5 L8 6.5 M10 6.5 L10 6.5 M4.5 8.5 L9.5 8.5" />
    </svg>
  );
}
export function ShareGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="3" cy="7" r="1.6" />
      <circle cx="11" cy="3.5" r="1.6" />
      <circle cx="11" cy="10.5" r="1.6" />
      <path d="M4.4 6.2 L9.6 4 M4.4 7.8 L9.6 10" />
    </svg>
  );
}
export function ActivityGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 7 L4 7 L5.5 3.5 L8.5 10.5 L10 7 L12.5 7" />
    </svg>
  );
}
export function SparkGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L7.8 6.2 L12 7 L7.8 7.8 L7 12 L6.2 7.8 L2 7 L6.2 6.2 Z" />
    </svg>
  );
}
export function SearchGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="4" />
      <path d="M9 9 L12.5 12.5" />
    </svg>
  );
}
export function ListGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 4 L12 4 M2 7 L12 7 M2 10 L12 10" />
    </svg>
  );
}
export function LinkGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 8 L8 6" />
      <path d="M4.5 9.5 A 2 2 0 0 1 4.5 6.5 L6 5" />
      <path d="M9.5 4.5 A 2 2 0 0 1 9.5 7.5 L8 9" />
    </svg>
  );
}
export function ZoomInGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="3.2" />
      <path d="M8.4 8.4 L11.5 11.5" />
      <path d="M4.5 6 L7.5 6 M6 4.5 L6 7.5" />
    </svg>
  );
}
export function ZoomOutGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="3.2" />
      <path d="M8.4 8.4 L11.5 11.5" />
      <path d="M4.5 6 L7.5 6" />
    </svg>
  );
}
export function FitGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 5 L2 2 L5 2 M9 2 L12 2 L12 5 M12 9 L12 12 L9 12 M5 12 L2 12 L2 9" />
    </svg>
  );
}
export function ResetGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M11.5 7 A 4.5 4.5 0 1 1 7 2.5" />
      <path d="M7 1.5 L7 3.5 L9 3.5" />
    </svg>
  );
}
export function PencilGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 11.5 L4.5 11 L11 4.5 L9.5 3 L3 9.5 Z" />
      <path d="M8 5 L9.5 6.5" />
    </svg>
  );
}
export function EyeGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 7 C 3.5 3.5 10.5 3.5 12.5 7 C 10.5 10.5 3.5 10.5 1.5 7 Z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}
export function FileGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 1.5 L8.5 1.5 L11 4 L11 12.5 L3 12.5 Z" />
      <path d="M8.5 1.5 L8.5 4 L11 4" />
    </svg>
  );
}
export function LayersGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L12 5 L7 8 L2 5 Z" />
      <path d="M2 8 L7 11 L12 8" />
    </svg>
  );
}
export function BrushGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 12 C 3 9 5 9 6 10 L8 8 L6 6 L4 8 C 5 9 5 11 2 12 Z" />
      <path d="M6 6 L11 1.5 L12.5 3 L8 8" />
    </svg>
  );
}
export function TrashGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 4 L11.5 4 M4 4 L4 2.5 L10 2.5 L10 4 M3.5 4 L4.5 12 L9.5 12 L10.5 4" />
    </svg>
  );
}
export function PlusGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2.5 L7 11.5 M2.5 7 L11.5 7" />
    </svg>
  );
}
export function CopyGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="0.8" />
      <path d="M3 9.5 L3 3 C 3 2.5 3.5 2 4 2 L9.5 2" />
    </svg>
  );
}
export function LockGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="6.5" width="8" height="5.5" rx="0.8" />
      <path d="M4.5 6.5 L4.5 4.5 A 2.5 2.5 0 0 1 9.5 4.5 L9.5 6.5" />
    </svg>
  );
}
export function UnlockGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="6.5" width="8" height="5.5" rx="0.8" />
      <path d="M4.5 6.5 L4.5 4.5 A 2.5 2.5 0 0 1 9.5 4.5" />
    </svg>
  );
}
export function UndoGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M4 4 L1.5 6.5 L4 9" />
      <path d="M1.5 6.5 L8.5 6.5 A 3.5 3.5 0 0 1 8.5 12" />
    </svg>
  );
}
export function RedoGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M10 4 L12.5 6.5 L10 9" />
      <path d="M12.5 6.5 L5.5 6.5 A 3.5 3.5 0 0 0 5.5 12" />
    </svg>
  );
}
export function GroupGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="2" width="5" height="5" rx="0.6" />
      <rect x="7" y="7" width="5" height="5" rx="0.6" />
    </svg>
  );
}
export function MoveGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 1.5 L7 12.5 M1.5 7 L12.5 7" />
      <path d="M5 3.5 L7 1.5 L9 3.5 M5 10.5 L7 12.5 L9 10.5 M3.5 5 L1.5 7 L3.5 9 M10.5 5 L12.5 7 L10.5 9" />
    </svg>
  );
}
export function RevertGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 7 L4.5 4.5 L7 7" />
      <path d="M4.5 4.5 L4.5 9 A 3.5 3.5 0 0 0 8 12.5" />
    </svg>
  );
}
export function AlignGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 3 L12 3 M2 7 L9 7 M2 11 L11 11" />
    </svg>
  );
}
export function ClearGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="2.5" width="9" height="9" rx="0.8" />
      <path d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5" />
    </svg>
  );
}
export function CheckGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="5" />
      <path d="M4.5 7 L6.3 8.8 L9.5 5.5" />
    </svg>
  );
}
export function MagnifierGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="3.2" />
      <path d="M8.4 8.4 L11.5 11.5" />
    </svg>
  );
}
export function PointerGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 2 L3 11 L5.5 8.5 L7.5 12 L9 11 L7 8 L11 8 Z" />
    </svg>
  );
}
export function OpenGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 4 L7 4 L7 1.5 L12.5 6.5 L7 11.5 L7 9 L2.5 9 Z" />
    </svg>
  );
}
export function CloseGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="5" />
      <path d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5" />
    </svg>
  );
}
export function ClipboardGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="8" height="9.5" rx="0.8" />
      <rect x="5" y="1.5" width="4" height="2.5" rx="0.5" />
    </svg>
  );
}
export function DownloadGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 1.5 L7 9" />
      <path d="M4 6 L7 9 L10 6" />
      <path d="M2 12 L12 12" />
    </svg>
  );
}
export function UploadGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 12.5 L7 5" />
      <path d="M4 8 L7 5 L10 8" />
      <path d="M2 2 L12 2" />
    </svg>
  );
}
export function PersonGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="5" r="2.2" />
      <path d="M2.5 12 C 3 9 11 9 11.5 12" />
    </svg>
  );
}
export function PersonAddGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="5.5" cy="5" r="2.2" />
      <path d="M1.5 12 C 2 9 9 9 9.5 12" />
      <path d="M11 2 L11 6 M9 4 L13 4" />
    </svg>
  );
}
export function SignInGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 1.5 L12.5 1.5 L12.5 12.5 L8 12.5" />
      <path d="M2 7 L9 7" />
      <path d="M6 4 L9 7 L6 10" />
    </svg>
  );
}
export function SignOutGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 1.5 L1.5 1.5 L1.5 12.5 L6 12.5" />
      <path d="M5 7 L12 7" />
      <path d="M9 4 L12 7 L9 10" />
    </svg>
  );
}
export function ToggleGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="4.5" width="11" height="5" rx="2.5" />
      <circle cx="9.5" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}
export function DiagramGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="2.5" width="9" height="9" rx="0.8" />
      <path d="M2.5 6 L11.5 6" />
    </svg>
  );
}
export function ElementGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="8" height="8" rx="0.8" />
    </svg>
  );
}
export function TabGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 6 L4 6 L5 4 L9.5 4 L9.5 12 L1.5 12 Z" />
    </svg>
  );
}
export function PaletteGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 1.5 C 3.5 1.5 1.5 4 1.5 7 C 1.5 10 4 12.5 7 12.5 C 7.5 12.5 8 12 8 11.5 L8 10.5 C 8 10 8.5 9.5 9 9.5 L10.5 9.5 C 11.5 9.5 12.5 9 12.5 7.5 C 12.5 4 10 1.5 7 1.5 Z" />
      <circle cx="4" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="7" cy="3.5" r="0.8" fill="currentColor" />
      <circle cx="10" cy="5.5" r="0.8" fill="currentColor" />
    </svg>
  );
}
export function CanvasGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="2.5" width="11" height="9" rx="0.5" />
      <path
        d="M1.5 5.5 L12.5 5.5 M1.5 8.5 L12.5 8.5 M4.5 2.5 L4.5 11.5 M8 2.5 L8 11.5"
        strokeWidth="0.6"
      />
    </svg>
  );
}
export function TemplateGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="2" width="10" height="3" rx="0.4" />
      <rect x="2" y="6" width="4" height="6" rx="0.4" />
      <rect x="7" y="6" width="5" height="6" rx="0.4" />
    </svg>
  );
}
export function CommentGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 3 L12.5 3 L12.5 9.5 L7 9.5 L4 12 L4 9.5 L1.5 9.5 Z" />
    </svg>
  );
}
export function NoteGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 1.5 L11.5 1.5 L11.5 12.5 L2.5 12.5 Z" />
      <path d="M4.5 4.5 L9.5 4.5 M4.5 7 L9.5 7 M4.5 9.5 L7.5 9.5" strokeWidth="0.7" />
    </svg>
  );
}
export function FolderGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 4 L5 4 L6.5 5.5 L12.5 5.5 L12.5 11.5 L1.5 11.5 Z" />
    </svg>
  );
}
export function WindowGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="2.5" width="11" height="9" rx="0.8" />
      <path d="M1.5 5 L12.5 5" />
      <circle cx="3" cy="3.7" r="0.3" fill="currentColor" />
      <circle cx="4.2" cy="3.7" r="0.3" fill="currentColor" />
    </svg>
  );
}
export function DotGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function AlertGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M8 2.2 14.4 13H1.6L8 2.2Z" strokeLinejoin="round" />
      <path d="M8 6.6v3" strokeLinecap="round" />
      <path d="M8 11.6h.01" strokeLinecap="round" />
    </svg>
  );
}
