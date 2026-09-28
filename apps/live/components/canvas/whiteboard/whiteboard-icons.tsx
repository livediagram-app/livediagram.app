// Glyphs for the whiteboard dock (docs/specs/023-whiteboard/whiteboard.md). 20px line art in
// currentColor, the weight of the palette's icons, so the dock reads as part
// of the same editor.

const svg = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

// A marker seen from the side: the body in the dock's ink, the nib and the
// band below in the pen's own colour at the pen's own weight.
export function PenGlyph({ colour, width }: { colour: string; width: number }) {
  return (
    <svg {...svg} width={22} height={22} viewBox="0 0 22 22">
      <path d="M6 14 L14 6 L16.5 8.5 L8.5 16.5 L5.5 16.9 Z" />
      <path d="M5.5 16.9 L6 14 L8.5 16.5 Z" fill={colour} stroke={colour} />
      <path d="M4 20 H18" stroke={colour} strokeWidth={Math.min(1 + width / 2, 5)} />
    </svg>
  );
}

export function StickyGlyph() {
  return (
    <svg {...svg}>
      <path d="M4 4 H16 V12 L12 16 H4 Z" />
      <path d="M12 16 V12 H16" />
    </svg>
  );
}

export function TextGlyph() {
  return (
    <svg {...svg}>
      <path d="M5 5 H15 M10 5 V16 M8 16 H12" />
    </svg>
  );
}

export function ShapesGlyph() {
  return (
    <svg {...svg}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <circle cx="13.5" cy="13.5" r="3.5" />
    </svg>
  );
}

// Shape recognition: a rough stroke beside the clean shape it becomes.
export function RecogniseGlyph() {
  return (
    <svg {...svg}>
      <path d="M3 12 C3 7 8 5 9 9 S5 15 3 12" />
      <path d="M10.5 10 H12.5 M11.8 8.8 L13 10 L11.8 11.2" strokeWidth={1.3} />
      <circle cx="16" cy="10" r="2.6" />
    </svg>
  );
}

export function MoreGlyph() {
  return (
    <svg {...svg} fill="currentColor" stroke="none">
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15" cy="10" r="1.5" />
    </svg>
  );
}

export function ShapeGlyph({ id }: { id: string }) {
  switch (id) {
    case 'rectangle':
      return (
        <svg {...svg}>
          <rect x="3" y="5" width="14" height="10" rx="1" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg {...svg}>
          <ellipse cx="10" cy="10" rx="7" ry="5" />
        </svg>
      );
    case 'triangle':
      return (
        <svg {...svg}>
          <path d="M10 3.5 L17 16 H3 Z" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...svg}>
          <path d="M10 2.5 L17.5 10 L10 17.5 L2.5 10 Z" />
        </svg>
      );
    case 'line':
      return (
        <svg {...svg}>
          <path d="M4 16 L16 4" />
        </svg>
      );
    default:
      return (
        <svg {...svg}>
          <path d="M4 16 L16 4 M9.5 4 H16 V10.5" />
        </svg>
      );
  }
}

// The three board backgrounds, drawn as small swatches of themselves.
export function BackgroundGlyph({ id }: { id: string }) {
  return (
    <svg {...svg} strokeWidth={1.2}>
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" />
      {id === 'dots'
        ? [6.5, 10, 13.5].flatMap((x) =>
            [6.5, 10, 13.5].map((y) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.8" fill="currentColor" stroke="none" />
            )),
          )
        : null}
      {id === 'grid' ? (
        <path d="M7.5 2.5 V17.5 M12.5 2.5 V17.5 M2.5 7.5 H17.5 M2.5 12.5 H17.5" />
      ) : null}
    </svg>
  );
}
