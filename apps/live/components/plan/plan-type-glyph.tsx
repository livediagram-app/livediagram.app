// A glyph per item type (docs/specs/025-plan/items.md "Item types"), drawn inline on a 16-unit grid
// so a card never waits for the icon catalogue. Stroked in the type's colour by the caller.

const PATHS: Record<string, string> = {
  task: 'M5.2 8.2 7 10l3.8-4M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  story: 'M2.5 3.5h4a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5h-4.5ZM13.5 3.5h-4a2 2 0 0 0-1 2',
  bug: 'M5.5 6.5h5v5a2.5 2.5 0 0 1-5 0ZM6 6.5a2 2 0 0 1 4 0M3 8.5h2.5M10.5 8.5H13M3.5 12l2-1M12.5 12l-2-1M8 6.5v7',
  epic: 'M8 2 14 5 8 8 2 5ZM2 8l6 3 6-3M2 11l6 3 6-3',
  note: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z',
  idea: 'M9 1.5 4 9h4l-1 5.5L12 7H8Z',
  action: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  risk: 'M8 2 14.5 13.5h-13ZM8 6.5v3.2M8 11.6v.1',
};

const FALLBACK = 'M3 3h10v10H3Z';

export function PlanTypeGlyph({
  type,
  color,
  size = 12,
}: {
  type: string;
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[type] ?? FALLBACK} />
    </svg>
  );
}
