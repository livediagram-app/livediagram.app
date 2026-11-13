// A picture's upload ring (docs/specs/026-plan/item-types.md "Image fields"): a soft track with an arc that fills
// from the top, clockwise, by the share of the bytes sent. Before the browser first says how far it has got
// (`progress` undefined) a short arc turns instead; `progress` 0 is a still, empty track (a file waiting its turn).

// The arc's radius in the 24-unit box, and its whole length.
const R = 9;
const LENGTH = 2 * Math.PI * R;

/** The share sent as whole percents, for the words beside a ring ("Uploading 40%"). */
export const uploadPercent = (progress: number) =>
  Math.round(Math.min(1, Math.max(0, progress)) * 100);

/** The words beside a ring: "Uploading…" until the share sent is known, then "Uploading 40%". */
export const uploadingWords = (progress: number | undefined) =>
  progress === undefined ? 'Uploading…' : `Uploading ${uploadPercent(progress)}%`;

export function UploadRing({
  progress,
  className = 'h-6 w-6',
}: {
  // 0 to 1, or undefined while the share sent is not known yet.
  progress?: number | undefined;
  className?: string;
}) {
  const turning = progress === undefined;
  const shown = turning ? 16 : (uploadPercent(progress) / 100) * LENGTH;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      data-upload-ring={turning ? 'turning' : uploadPercent(progress)}
      className={`${className} shrink-0 ${turning ? 'animate-spin motion-reduce:animate-none' : '-rotate-90'}`}
    >
      <circle
        cx="12"
        cy="12"
        r={R}
        fill="none"
        strokeWidth="3"
        className="stroke-slate-200 dark:stroke-slate-700"
      />
      {shown > 0 ? (
        <circle
          cx="12"
          cy="12"
          r={R}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${shown} ${LENGTH}`}
          className="stroke-brand-600 transition-[stroke-dasharray] duration-200 ease-out motion-reduce:transition-none dark:stroke-brand-400"
        />
      ) : null}
    </svg>
  );
}
