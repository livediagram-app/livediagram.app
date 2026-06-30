import { Tooltip } from '@/components/primitives/Tooltip';
import type { ShareLinkExpiry } from '@/lib/api-client';

// Presentational parts of the share dialog: the expiry-label lookup and
// the Role segmented button + Refresh / Link glyphs. Split out of ShareDialog.
export const EXPIRY_LABELS: Record<Exclude<ShareLinkExpiry, 'never'>, string> = {
  week: '1 week',
  month: '1 month',
  sixMonths: '6 months',
};

export function RoleButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Tooltip title={label} description={description} block>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={
          active
            ? 'w-full rounded-sm bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
            : 'w-full rounded-sm px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200'
        }
      >
        {label}
      </button>
    </Tooltip>
  );
}

export function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 5.5" />
      <path d="M13.5 2.5v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 10.5" />
      <path d="M2.5 13.5v-3h3" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
    </svg>
  );
}

// Menu-item glyphs for the Embed / Live image copy menus.
export function ImageGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.2" />
      <path d="M3 12l3.5-3.5 2.5 2.5 2-2L14 11.5" />
    </svg>
  );
}

export function CodeGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 5l-3 3 3 3M10 5l3 3-3 3" />
    </svg>
  );
}
