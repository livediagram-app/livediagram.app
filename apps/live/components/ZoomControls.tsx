import { ZenExitIcon } from './palette-icons';
import { Tooltip } from './Tooltip';

type ZoomControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFitToScreen: () => void;
  // When set, the editor is in zen / focus mode (spec/26): the zoom
  // dock is the only visible chrome, so it carries the way out. Renders
  // an exit button at the end; omitted (undefined) outside zen mode.
  onExitZen?: () => void;
};

// Floating zoom controls, bottom-right of the canvas. Four
// actions: -10% / current % (click to reset) / +10% / Fit to
// screen. In zen mode it also carries the exit-zen button.
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onFitToScreen,
  onExitZen,
}: ZoomControlsProps) {
  const percent = Math.round(zoom * 100);
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
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
            className="flex h-9 min-w-[3.5rem] items-center justify-center rounded-md px-2 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
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
          className="flex h-9 items-center rounded-md px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Fit
        </button>
      </Tooltip>
      {onExitZen ? (
        <>
          <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          <Tooltip
            title="Exit zen mode"
            description="Bring back the toolbars and panels (Z or Esc)."
          >
            <IconButton onClick={onExitZen} label="Exit zen mode">
              <ZenExitIcon />
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
