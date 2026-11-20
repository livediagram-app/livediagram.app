// A character as Avatar mode draws one, seen from above at a card's size: a head over a shirt in its own colour.
// Shared by the About and Getting Started scenes.
export function Character({ x, y, shirt }: { x: number; y: number; shirt: string }) {
  return (
    <g>
      <rect x={x - 5} y={y + 2} width={10} height={9} rx={3} className={shirt} />
      <circle cx={x} cy={y} r={4} className="fill-amber-200 stroke-amber-700" strokeWidth={0.8} />
    </g>
  );
}
