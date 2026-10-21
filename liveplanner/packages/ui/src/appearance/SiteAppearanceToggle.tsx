'use client';

import { Tooltip } from '../Tooltip';
import { APPEARANCE_LABEL, appearanceToggleName } from './appearance-cycle';
import { AppearanceIcon } from './AppearanceIcon';
import { useAppearance } from './useAppearance';

// The public sites' Appearance control (docs/specs/004-interface-design/appearance.md): a
// quiet icon button that cycles Light → Dark → System, on its own rail under the share rail
// (`rail`) on wide screens, in the SiteHeader (`header`) everywhere else. No telemetry: the
// public sites report page views only.
const LOOK = {
  header:
    'h-9 w-9 rounded-lg hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  // The share rail's icon buttons, so the two rails read as one set.
  rail: 'h-8 w-8 rounded-md hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
} as const;

export function SiteAppearanceToggle({
  look = 'header',
  className = '',
}: {
  look?: keyof typeof LOOK;
  className?: string;
}) {
  const { setting, cycle } = useAppearance();
  return (
    <Tooltip label={`Appearance: ${APPEARANCE_LABEL[setting]}`}>
      <button
        type="button"
        onClick={cycle}
        aria-label={appearanceToggleName(setting)}
        className={`inline-flex shrink-0 items-center justify-center text-slate-500 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-400 ${LOOK[look]} ${className}`}
      >
        <AppearanceIcon setting={setting} size={16} />
      </button>
    </Tooltip>
  );
}
