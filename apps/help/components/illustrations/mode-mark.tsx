// Each editor mode's mark, shared by the scenes that draw the mode switch, its menu and the tab menu's
// mode rows, so every figure shows the app's own icons.

export type Mode = 'Diagram' | 'Draw' | 'Illustrate' | 'Plan';

/** Each mode's mark (packages/ui EDITOR_MODE_ICONS) on its 24-unit grid, centred on (0, 0) and
 *  drawn at `scale`: a flowchart, a marker, a page with a chart over two lines, a board. */
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
      case 'Illustrate':
        return (
          <>
            <rect x={4.5} y={2.5} width={15} height={19} rx={2} {...common} />
            <path d="M8.5 11V8.5M12 11V6M15.5 11V9" {...common} />
            <path d="M8.5 15H15.5M8.5 18H13" {...common} />
          </>
        );
      default:
        return (
          <>
            <rect x={2.5} y={4} width={19} height={16} rx={2} {...common} />
            <path d="M8.83 4V20M15.17 4V20" {...common} />
            <rect x={10.2} y={6} width={3.6} height={5} rx={0.8} {...common} />
          </>
        );
    }
  })();
  return <g transform={`scale(${scale}) translate(-12 -12)`}>{body}</g>;
}
