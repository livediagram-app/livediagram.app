// The Mind Map menu's row glyphs (docs/specs/009-elements/mind-node.md "The Mind Map menu"). Drawn rather than
// named, because "Balanced" and "Bubble" mean nothing until you see the arrangement: each flow glyph is the branch
// pattern its flow produces, and each spacing glyph three nodes at that spacing's gap.
import type { ReactNode } from 'react';
import type { MindFlow, MindSpacing } from '@livediagram/document';

const glyph = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
    {children}
  </svg>
);
const LINE = { stroke: 'currentColor', strokeWidth: 1.3 } as const;
const FAINT = { fill: 'currentColor', opacity: 0.55 } as const;

export const MIND_FLOW_ICON: Record<MindFlow, ReactNode> = {
  tree: glyph(
    <>
      <rect x="1.5" y="9" width="7" height="6" rx="1.5" fill="currentColor" />
      <rect x="15" y="3" width="7.5" height="5" rx="1.5" {...FAINT} />
      <rect x="15" y="16" width="7.5" height="5" rx="1.5" {...FAINT} />
      <path d="M8.5 12H12V5.5h3M12 12v6h3" {...LINE} />
    </>,
  ),
  // The tree mirrored.
  leftward: glyph(
    <>
      <rect x="15.5" y="9" width="7" height="6" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="3" width="7.5" height="5" rx="1.5" {...FAINT} />
      <rect x="1.5" y="16" width="7.5" height="5" rx="1.5" {...FAINT} />
      <path d="M15.5 12H12V5.5H9M12 12v6H9" {...LINE} />
    </>,
  ),
  balanced: glyph(
    <>
      <rect x="8.5" y="9.5" width="7" height="5" rx="1.5" fill="currentColor" />
      <rect x="0.5" y="3" width="6" height="4.5" rx="1.5" {...FAINT} />
      <rect x="0.5" y="16.5" width="6" height="4.5" rx="1.5" {...FAINT} />
      <rect x="17.5" y="3" width="6" height="4.5" rx="1.5" {...FAINT} />
      <rect x="17.5" y="16.5" width="6" height="4.5" rx="1.5" {...FAINT} />
      <path d="M8.5 12H6.5V5.25M8.5 12H6.5v6.75M15.5 12h2V5.25M15.5 12h2v6.75" {...LINE} />
    </>,
  ),
  downward: glyph(
    <>
      <rect x="8.5" y="1.5" width="7" height="5" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="16" width="7" height="5" rx="1.5" {...FAINT} />
      <rect x="15" y="16" width="7.5" height="5" rx="1.5" {...FAINT} />
      <path d="M12 6.5v5H5v4.5M12 11.5h7v4.5" {...LINE} />
    </>,
  ),
  // The downward tree mirrored.
  upward: glyph(
    <>
      <rect x="8.5" y="17.5" width="7" height="5" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="3" width="7" height="5" rx="1.5" {...FAINT} />
      <rect x="15" y="3" width="7.5" height="5" rx="1.5" {...FAINT} />
      <path d="M12 17.5v-5H5V8M12 12.5h7V8" {...LINE} />
    </>,
  ),
  bubble: glyph(
    <>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <circle cx="12" cy="3" r="2.4" {...FAINT} />
      <circle cx="20" cy="9" r="2.4" {...FAINT} />
      <circle cx="17" cy="19.5" r="2.4" {...FAINT} />
      <circle cx="4.5" cy="16" r="2.4" {...FAINT} />
      <path d="M12 8V5.4M15.7 10.2l2.2-1.6M14.2 15.3l1.9 2.4M8.7 13.6l-2.4 1.2" {...LINE} />
    </>,
  ),
};

// Three nodes in a row, the gap between them growing with the spacing.
const spacingGlyph = (gap: number) => {
  const w = 5;
  const total = w * 3 + gap * 2;
  const x0 = (24 - total) / 2;
  return glyph(
    <>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={x0 + i * (w + gap)}
          y="9"
          width={w}
          height="6"
          rx="1.2"
          fill="currentColor"
          opacity={i === 1 ? 1 : 0.55}
        />
      ))}
    </>,
  );
};

export const MIND_SPACING_ICON: Record<MindSpacing, ReactNode> = {
  tight: spacingGlyph(0.75),
  compact: spacingGlyph(1.75),
  comfortable: spacingGlyph(2.75),
  wide: spacingGlyph(4),
};

export const MIND_OUTLINE_ICON = {
  outline: glyph(
    <>
      <path d="M4 5h16M8 10h12M8 15h12M12 20h8" {...LINE} strokeLinecap="round" />
      <circle cx="4.5" cy="10" r="1" fill="currentColor" />
    </>,
  ),
  tidy: glyph(
    <>
      <rect x="2" y="9.5" width="6" height="5" rx="1.2" fill="currentColor" />
      <rect x="15" y="3" width="7" height="4.5" rx="1.2" {...FAINT} />
      <rect x="15" y="9.75" width="7" height="4.5" rx="1.2" {...FAINT} />
      <rect x="15" y="16.5" width="7" height="4.5" rx="1.2" {...FAINT} />
      <path d="M8 12h3.5M11.5 5.25V18.75M11.5 5.25H15M11.5 12H15M11.5 18.75H15" {...LINE} />
    </>,
  ),
  branch: glyph(
    <>
      <rect x="2" y="9.5" width="6" height="5" rx="1.2" {...FAINT} />
      <rect
        x="10.5"
        y="2"
        width="12"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeDasharray="2 1.6"
      />
      <rect x="13" y="5" width="7" height="4.5" rx="1.2" fill="currentColor" />
      <rect x="13" y="14.5" width="7" height="4.5" rx="1.2" fill="currentColor" />
      <path d="M8 12h2.5" {...LINE} />
    </>,
  ),
  map: glyph(
    <>
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="2.5"
        stroke="currentColor"
        strokeDasharray="2 1.6"
      />
      <rect x="4" y="9.5" width="6" height="5" rx="1.2" fill="currentColor" />
      <rect x="14" y="4.5" width="6" height="4.5" rx="1.2" fill="currentColor" />
      <rect x="14" y="15" width="6" height="4.5" rx="1.2" fill="currentColor" />
      <path d="M10 12h2v-5h2M12 12v5h2" {...LINE} />
    </>,
  ),
};
