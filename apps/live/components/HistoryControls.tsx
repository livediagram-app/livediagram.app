import { Tooltip } from './Tooltip';

type HistoryControlsProps = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

// Floating Undo/Redo panel pinned to the bottom-right of the canvas.
// Kept separate from the main palette so history actions are always at
// the same place regardless of palette position or minimised state.
export function HistoryControls({ canUndo, canRedo, onUndo, onRedo }: HistoryControlsProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5"
    >
      <HistoryButton
        label="Undo"
        description="Revert the last change (up to 3 steps)."
        onClick={onUndo}
        disabled={!canUndo}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 8h6a4 4 0 0 1 0 8H7" />
          <path d="M5 8l3-3M5 8l3 3" />
        </svg>
      </HistoryButton>
      <HistoryButton
        label="Redo"
        description="Reapply a change you just undid."
        onClick={onRedo}
        disabled={!canRedo}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M13 8H7a4 4 0 0 0 0 8h4" />
          <path d="M13 8l-3-3M13 8l-3 3" />
        </svg>
      </HistoryButton>
    </div>
  );
}

function HistoryButton({
  label,
  description,
  onClick,
  disabled,
  children,
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
  if (disabled) return button;
  return (
    <Tooltip title={label} description={description}>
      {button}
    </Tooltip>
  );
}
