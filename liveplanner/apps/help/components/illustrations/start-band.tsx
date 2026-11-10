// Start Planning's header band (docs/specs/007-editor/start-panel.md "The header band"), as the help figures draw
// it: the Explorer hero's board lanes behind the header, and the title mark (three lanes) before the title.

/** Four lanes across the header, alternate ones a shade deeper. */
export function StartBandLanes({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const gap = 3;
  const laneW = (w - gap * 3) / 4;
  return (
    <g aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={x + i * (laneW + gap)}
          y={y}
          width={laneW}
          height={h}
          rx={6}
          className={i % 2 ? 'fill-brand-100/70' : 'fill-brand-50'}
        />
      ))}
    </g>
  );
}

/** The title mark: a tile holding three lanes, as full as a board midweek. */
export function StartTitleMarkLanes({ x, y, size = 18 }: { x: number; y: number; size?: number }) {
  const s = size / 20;
  return (
    <g aria-hidden transform={`translate(${x} ${y}) scale(${s})`}>
      <rect width={20} height={20} rx={5.5} className="fill-brand-100 stroke-brand-200" />
      <g className="fill-brand-600">
        <rect x={4} y={4.5} width={3.4} height={11} rx={1.2} />
        <rect x={8.3} y={4.5} width={3.4} height={6.5} rx={1.2} opacity={0.6} />
        <rect x={12.6} y={4.5} width={3.4} height={9} rx={1.2} opacity={0.6} />
      </g>
    </g>
  );
}
