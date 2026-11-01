// Each editor mode's mark, shared by the scenes that draw the mode switch and its menu, so every figure
// shows the app's own icons.

export type Mode = 'Diagram' | 'Draw' | 'Workshop';

/** Each mode's mark (packages/ui EDITOR_MODE_ICONS) on its 24-unit grid, centred on (0, 0) and
 *  drawn at `scale`: a flowchart, a marker and a flipchart on an easel. */
export function ModeMark({
  mode,
  className = 'stroke-slate-500',
  scale = 0.6,
}: {
  mode: Mode;
  className?: string;
  scale?: number;
}) {
  const common = {
    fill: 'none',
    className,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const body = (() => {
    switch (mode) {
      case 'Diagram':
        return (
          <>
            <rect x={3} y={3} width={8} height={8} rx={2} {...common} />
            <path d="M7 11v4a2 2 0 0 0 2 2h4" {...common} />
            <rect x={13} y={13} width={8} height={8} rx={2} {...common} />
          </>
        );
      case 'Draw':
        return (
          <>
            <path d="M7 13 L15.5 4.5 L18 7 L9.5 15.5 L6.4 16 Z" {...common} />
            <path d="M4 19.5 H20" {...common} />
          </>
        );
      default:
        return (
          <>
            <path d="M3 3.5H21" {...common} />
            <rect x={4.5} y={3.5} width={15} height={12} rx={1} {...common} />
            <path d="M8 8H16M8 11.5H13" {...common} />
            <path d="M12 15.5V21M8 15.5L5.5 21M16 15.5L18.5 21" {...common} />
          </>
        );
    }
  })();
  return <g transform={`scale(${scale}) translate(-12 -12)`}>{body}</g>;
}
