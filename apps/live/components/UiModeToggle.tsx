import { useUiMode } from '@/hooks/ui/useUiMode';
import { Tooltip } from './Tooltip';

// Light / dark chrome toggle. A self-contained feature (its own hook +
// icons) that the tab bar happens to host in its trailing controls; kept
// in its own module so it isn't buried in TabBar. Flips only the editor
// chrome - diagram canvas themes are independent.
export function UiModeToggle() {
  const { mode, toggle } = useUiMode();
  const isDark = mode === 'dark';
  return (
    <Tooltip
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      description="Flips the editor chrome. Diagram canvas themes are unaffected."
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={isDark}
        className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </Tooltip>
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </svg>
  );
}
