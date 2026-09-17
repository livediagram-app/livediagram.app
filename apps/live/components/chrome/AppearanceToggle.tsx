import { useAppearance, nextAppearanceSetting } from '@/hooks/ui/useAppearance';
import type { AppearanceSetting } from '@/hooks/ui/appearance-store';
import { Tooltip } from '@/components/primitives/Tooltip';

// The Appearance control: one button that CYCLES Light → Dark → System.
// A self-contained feature (its own hook + icons) that the tab bar
// happens to host in its trailing controls; kept in its own module so
// it isn't buried in TabBar. Flips only the editor chrome — a tab's
// colour scheme is its own setting, except for Default, which follows
// this one (spec/07).
//
// The glyph shows the CURRENT setting, not the next one. As a two-state
// toggle it could get away with showing the target (a moon meaning "go
// dark"); with three states, and one of them deferring to the OS, the
// only readable thing is where you are — so the tooltip carries where
// the next click takes you.

const LABEL: Record<AppearanceSetting, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const DESCRIPTION: Record<AppearanceSetting, string> = {
  light: 'The editor chrome is light.',
  dark: 'The editor chrome is dark.',
  system: 'The editor chrome follows your device setting.',
};

export function AppearanceToggle() {
  const { setting, cycle } = useAppearance();
  const next = nextAppearanceSetting(setting);
  const label = `Appearance: ${LABEL[setting]}. Switch to ${LABEL[next]}.`;
  return (
    <Tooltip title={`Appearance: ${LABEL[setting]}`} description={DESCRIPTION[setting]}>
      <button
        type="button"
        onClick={cycle}
        aria-label={label}
        className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        {setting === 'dark' ? <MoonIcon /> : setting === 'system' ? <SystemIcon /> : <SunIcon />}
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

// A monitor: the device deciding, rather than the editor. Deliberately
// not a half-sun/half-moon — that reads as "in between light and dark",
// which is the one thing System never is.
function SystemIcon() {
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
      <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.25" />
      <path d="M6 14h4" />
    </svg>
  );
}
