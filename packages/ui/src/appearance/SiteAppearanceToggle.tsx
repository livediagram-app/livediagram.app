'use client';

import { Tooltip } from '../Tooltip';
import { APPEARANCE_LABEL, appearanceToggleName } from './appearance-cycle';
import { AppearanceIcon } from './AppearanceIcon';
import { useAppearance } from './useAppearance';

// The public sites' Appearance control (docs/specs/004-interface-design/appearance.md): a
// quiet icon button in the SiteHeader that cycles Light → Dark → System. No telemetry:
// the public sites report page views only.
export function SiteAppearanceToggle() {
  const { setting, cycle } = useAppearance();
  return (
    <Tooltip label={`Appearance: ${APPEARANCE_LABEL[setting]}`}>
      <button
        type="button"
        onClick={cycle}
        aria-label={appearanceToggleName(setting)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <AppearanceIcon setting={setting} size={16} />
      </button>
    </Tooltip>
  );
}
