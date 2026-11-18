// Placeholder rows while a panel's content loads (footer-tools-menu.md "Skeletons"): a tool's own shape, a leading
// tile or disc then two bars, so the view keeps about the height it will have and nothing jumps when the rows land.
// Pulses only where motion is allowed. Announced once as busy, under `label`.

const BAR = 'rounded bg-slate-200/80 motion-safe:animate-pulse dark:bg-slate-700/60';
const WIDTHS = [0.72, 0.5, 0.62, 0.44, 0.58];

export function SkeletonRows({
  label,
  rows = 3,
  lead = 'tile',
  className = '',
}: {
  /** What is loading, for screen readers ("Loading snapshots"). */
  label: string;
  rows?: number;
  /** What leads each row: a rounded tile (an icon plate), a disc (an avatar or pin), or nothing. */
  lead?: 'tile' | 'disc' | 'none';
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-skeleton-rows=""
      className={`flex flex-col gap-4 ${className}`}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-3">
          {lead === 'none' ? null : (
            <span
              className={`size-9 shrink-0 ${lead === 'disc' ? 'rounded-full' : 'rounded-xl'} ${BAR}`}
            />
          )}
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span
              className={`h-3.5 ${BAR}`}
              style={{ width: `${(WIDTHS[i % WIDTHS.length] ?? 0.5) * 100}%` }}
            />
            <span className={`h-3 w-1/3 ${BAR}`} />
          </span>
        </div>
      ))}
    </div>
  );
}
