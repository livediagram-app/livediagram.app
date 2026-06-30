import { IsometricOrbitButton } from '@/components/chrome/IsometricOrbitButton';
import { ZenExitIcon, ZenIcon } from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';

type ZoomControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFitToScreen: () => void;
  // Isometric orbit control (spec/45). When both are set (the isometric
  // tool is active) the orbit button sits between Fit and Zen: drag to
  // orbit the camera, click to reset its angle. Omitted on every other
  // tool → no button.
  onIsoOrbit?: (clientX: number, clientY: number) => void;
  onIsoReset?: () => void;
  // Zen / focus mode toggle (spec/26). When set, the zoom dock carries
  // the zen button at the end: enter-zen outside zen, exit-zen inside it
  // (the zoom dock is the only chrome left in zen, so entry + exit share
  // one home). `zenActive` picks the icon / copy. Omitted → no button.
  onToggleZen?: () => void;
  zenActive?: boolean;
  // Size the dock to its content instead of the fixed `sm:min-w-64`. The
  // min-width keeps the editor dock a stable width as the iso / zen buttons
  // appear and disappear; a read-only / embed dock has none of those, so the
  // min-width just stretches its few buttons (zoom / Fit) out with odd gaps.
  compact?: boolean;
};

// Floating zoom controls, bottom-right of the canvas. Four
// actions: -10% / current % (click to reset) / +10% / Fit to
// screen. It also carries the zen-mode toggle (enter / exit).
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onFitToScreen,
  onIsoOrbit,
  onIsoReset,
  onToggleZen,
  zenActive,
  compact = false,
}: ZoomControlsProps) {
  const percent = Math.round(zoom * 100);
  return (
    <div
      data-zoom-controls
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={`pointer-events-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40${
        compact ? '' : ' sm:min-w-64'
      }`}
    >
      <Tooltip title="Zoom out" description="Zoom out by 10%.">
        <IconButton onClick={onZoomOut} label="Zoom out">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <line
              x1="3"
              y1="7"
              x2="11"
              y2="7"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </IconButton>
      </Tooltip>
      <span className="hidden sm:contents">
        <Tooltip title="Reset zoom" description="Set zoom back to 100%.">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset zoom to 100%"
            className="flex h-9 min-w-[3.5rem] items-center justify-center rounded-md px-2 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:flex-1 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {percent}%
          </button>
        </Tooltip>
      </span>
      <Tooltip title="Zoom in" description="Zoom in by 10%.">
        <IconButton onClick={onZoomIn} label="Zoom in">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <line
              x1="3"
              y1="7"
              x2="11"
              y2="7"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <line
              x1="7"
              y1="3"
              x2="7"
              y2="11"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </IconButton>
      </Tooltip>
      <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
      <Tooltip title="Fit to screen" description="Pan and zoom so everything on the tab fits.">
        <button
          type="button"
          onClick={onFitToScreen}
          aria-label="Fit to screen"
          className="flex h-9 items-center justify-center rounded-md px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:flex-1 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Fit
        </button>
      </Tooltip>
      {onIsoOrbit && onIsoReset ? (
        <>
          <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          <IsometricOrbitButton onOrbit={onIsoOrbit} onReset={onIsoReset} />
        </>
      ) : null}
      {onToggleZen ? (
        <>
          <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          <Tooltip
            title={zenActive ? 'Exit zen mode' : 'Zen mode'}
            description={
              zenActive
                ? 'Bring back the toolbars and panels (Z or Esc).'
                : 'Hide every panel and toolbar to focus on the canvas (Z).'
            }
          >
            <IconButton onClick={onToggleZen} label={zenActive ? 'Exit zen mode' : 'Zen mode'}>
              {zenActive ? <ZenExitIcon /> : <ZenIcon />}
            </IconButton>
          </Tooltip>
        </>
      ) : null}
    </div>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
    </button>
  );
}
