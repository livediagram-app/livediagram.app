import { ZoomMenu } from '@/components/chrome/ZoomMenu';
import { HoverCard, Glyph } from '@livehuddle/ui';

type ZoomControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (zoom: number) => void;
  onFitToScreen: () => void;
  // A phone (docs/specs/007-editor/editor-app.md): the cluster also carries Activity + Layers there, so
  // the step buttons go (pinch zooms) and Fit stays.
  pinchOnly?: boolean;
};

// Floating zoom controls, bottom-right of the canvas. Three
// controls: -10% / current % (click to fit, hover for the preset-level
// popover — see ZoomMenu) / +10%. Below `sm` the percentage button is
// hidden (and touch has no hover), so a plain Fit button stands in
// there.
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onFitToScreen,
  pinchOnly = false,
}: ZoomControlsProps) {
  return (
    <div
      data-zoom-controls
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      {pinchOnly ? null : (
        <HoverCard title="Zoom out" description="Zoom out by 10%.">
          <IconButton onClick={onZoomOut} label="Zoom out">
            <Glyph size={14} units={14}>
              <line x1="3" y1="7" x2="11" y2="7" />
            </Glyph>
          </IconButton>
        </HoverCard>
      )}
      <ZoomMenu zoom={zoom} onSetZoom={onSetZoom} onFitToScreen={onFitToScreen} />
      {pinchOnly ? null : (
        <HoverCard title="Zoom in" description="Zoom in by 10%.">
          <IconButton onClick={onZoomIn} label="Zoom in">
            <Glyph size={14} units={14}>
              <line x1="3" y1="7" x2="11" y2="7" />
              <line x1="7" y1="3" x2="7" y2="11" />
            </Glyph>
          </IconButton>
        </HoverCard>
      )}
      {/* Mobile-only Fit: below `sm` the percentage button (whose click
          is Fit on desktop) is hidden, and hover popovers don't exist on
          touch, so a plain Fit button keeps the action reachable. */}
      <span className="contents sm:hidden">
        {pinchOnly ? null : (
          <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        )}
        <HoverCard title="Fit to screen" description="Pan and zoom so everything on the tab fits.">
          <button
            type="button"
            onClick={onFitToScreen}
            aria-label="Fit to screen"
            className="flex h-9 items-center justify-center rounded-md px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Fit
          </button>
        </HoverCard>
      </span>
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
