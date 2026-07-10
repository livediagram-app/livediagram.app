import { IsometricOrbitButton } from '@/components/chrome/IsometricOrbitButton';
import { ZoomMenu } from '@/components/chrome/ZoomMenu';
import { ZenExitIcon, ZenIcon } from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';

type ZoomControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (zoom: number) => void;
  onFitToScreen: () => void;
  // Isometric orbit control (spec/45). When both are set (the isometric
  // tool is active) the orbit button sits between Fit and Zen: drag to
  // orbit the camera, click to reset its angle. Omitted on every other
  // tool → no button.
  onIsoOrbit?: (clientX: number, clientY: number) => void;
  onIsoReset?: () => void;
  // Zen / focus mode (spec/26). The dock carries the EXIT button, shown
  // while zen is active (it is the only chrome left in zen). Entering
  // lives in the canvas-tool dropdown under Isometric; `zenEnterHere`
  // restores the old enter button for sessions with no palette (view-only
  // visitors), who'd otherwise have no visible way in.
  onToggleZen?: () => void;
  zenActive?: boolean;
  zenEnterHere?: boolean;
};

// Floating zoom controls, bottom-right of the canvas. Three
// controls: -10% / current % (click to fit, hover for the preset-level
// popover — see ZoomMenu) / +10%. Below `sm` the percentage button is
// hidden (and touch has no hover), so a plain Fit button stands in
// there. In zen mode it also carries the exit-zen button.
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onFitToScreen,
  onIsoOrbit,
  onIsoReset,
  onToggleZen,
  zenActive,
  zenEnterHere,
}: ZoomControlsProps) {
  return (
    <div
      data-zoom-controls
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
      <ZoomMenu zoom={zoom} onSetZoom={onSetZoom} onFitToScreen={onFitToScreen} />
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
      {/* Mobile-only Fit: below `sm` the percentage button (whose click
          is Fit on desktop) is hidden, and hover popovers don't exist on
          touch, so a plain Fit button keeps the action reachable. */}
      <span className="contents sm:hidden">
        <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <Tooltip title="Fit to screen" description="Pan and zoom so everything on the tab fits.">
          <button
            type="button"
            onClick={onFitToScreen}
            aria-label="Fit to screen"
            className="flex h-9 items-center justify-center rounded-md px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Fit
          </button>
        </Tooltip>
      </span>
      {onIsoOrbit && onIsoReset ? (
        <>
          <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          <IsometricOrbitButton onOrbit={onIsoOrbit} onReset={onIsoReset} />
        </>
      ) : null}
      {onToggleZen && (zenActive || zenEnterHere) ? (
        // Exit-only in normal sessions: entering zen moved to the
        // canvas-tool dropdown (under Isometric), so outside zen the dock
        // stays minimal. Inside zen the dock is the only chrome left, so
        // the exit button lives here. zenEnterHere (palette-less sessions)
        // keeps the old enter button too.
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
