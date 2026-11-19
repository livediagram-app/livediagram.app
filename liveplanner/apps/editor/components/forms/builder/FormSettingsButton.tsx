'use client';

// The form's cog (docs/specs/030-forms/forms.md "Responses Go To and Settings"), at the end of the status bar as a
// board's settings sit at the end of its header: one panel switching between Responses Go To (first) and Settings, or
// opened on the one asked for (a paused form's Fix opens Responses Go To; Tab Style's Form Settings row, Settings,
// through lib/settings-open-on.ts). An Editor's alone.
import { useState } from 'react';
import type { Tab } from '@liveplanner/project';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideRoute, lucideSettings, lucideSlidersHorizontal } from '@liveworkspace/icons/lucide';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { DestinationPicker } from './DestinationPicker';
import { FormSettingsTab } from './FormSettingsTab';
import { FormSheet } from './FormSheet';
import { requestFormTourRelaunch } from '@/lib/form-tour';
import { takeOpenOn } from '@/lib/settings-open-on';

const CogIcon = lucideGlyph(lucideSettings, 16);
const ResponsesIcon = lucideGlyph(lucideRoute, 15);
const FormIcon = lucideGlyph(lucideSlidersHorizontal, 15);
// Wide enough for Board and Card Type side by side, and a response's card drawn at the board's size.
const PANEL_W = 480;

export type FormSettingsSection = 'destination' | 'settings';

export function FormSettingsButton({
  tabs,
  link,
  open,
  onOpen,
  onClose,
}: {
  tabs: readonly Tab[];
  link: FormLinkState;
  // The section opened with it (null: both closed), or false while the cog is shut.
  open: FormSettingsSection | null | false;
  onOpen: (section: FormSettingsSection | null) => void;
  onClose: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label="Form Settings"
        aria-haspopup="dialog"
        aria-expanded={open !== false}
        data-dock-button
        onClick={() =>
          open === false ? onOpen(takeOpenOn<FormSettingsSection>('form')) : onClose()
        }
        className={`flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition ${
          open !== false
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        <CogIcon aria-hidden />
        Settings
      </button>
      {open !== false && anchor ? (
        <FormSheet anchor={anchor} name="Form Settings" width={PANEL_W} titled onClose={onClose}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
              Form Settings
            </p>
            {/* The Forms tour, again (docs/specs/030-forms/forms.md "The Forms tour"). */}
            <button
              type="button"
              onClick={() => {
                onClose();
                requestFormTourRelaunch();
              }}
              className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
            >
              Show Me Around
            </button>
          </div>
          <Sections tabs={tabs} link={link} first={open} onLeave={onClose} />
        </FormSheet>
      ) : null}
    </>
  );
}

function Sections({
  tabs,
  link,
  first,
  onLeave,
}: {
  tabs: readonly Tab[];
  link: FormLinkState;
  first: FormSettingsSection | null;
  // Closes the panel, for a choice that opens something of its own (the card type's editor).
  onLeave: () => void;
}) {
  const [shown, setShown] = useState<FormSettingsSection>(first ?? 'destination');
  const tab = (id: FormSettingsSection, name: string, icon: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={shown === id}
      onClick={() => setShown(id)}
      className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-semibold transition ${
        shown === id
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      }`}
    >
      {icon}
      {name}
    </button>
  );
  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Form Settings"
        className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
      >
        {tab('destination', 'Responses Go To', <ResponsesIcon aria-hidden />)}
        {tab('settings', 'Settings', <FormIcon aria-hidden />)}
      </div>
      <div role="tabpanel" aria-label={shown === 'destination' ? 'Responses Go To' : 'Settings'}>
        {shown === 'destination' ? (
          <DestinationPicker tabs={tabs} onLeave={onLeave} />
        ) : (
          <FormSettingsTab link={link} />
        )}
      </div>
    </div>
  );
}
