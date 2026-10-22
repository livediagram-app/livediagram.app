import { FONT } from '@/components/art-tokens';

// A collaborator's cursor in the hero art: the arrow and its name badge, drawn at the origin (the caller's <g>
// places and animates it). The badge sizes to its label: the compact one fits initials, a wider one a name.
export function CursorMark({
  colour,
  label,
  badge = 'initials',
}: {
  colour: string;
  label: string;
  badge?: 'initials' | 'name' | 'wide-name';
}) {
  const { width, height, fontSize } = BADGES[badge];
  return (
    <>
      <path
        d="M0 0 L12 7 L7 8 L9.5 12.5 L7.5 13.5 L5 9 L1.5 12.5 Z"
        fill={colour}
        stroke="white"
        strokeWidth="1"
      />
      <rect x="10" y="12" width={width} height={height} rx="3" fill={colour} />
      <text
        x={10 + width / 2}
        y={15 + height / 2}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fontSize}
        fontWeight="700"
        fill="white"
      >
        {label}
      </text>
    </>
  );
}

const BADGES = {
  initials: { width: 20, height: 12, fontSize: 7.5 },
  name: { width: 22, height: 13, fontSize: 8 },
  'wide-name': { width: 24, height: 13, fontSize: 8 },
} as const;
