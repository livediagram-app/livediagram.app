'use client';

// The form's cog (docs/specs/030-forms/forms.md "Responses Go To and Settings"), at the end of the status bar as a
// board's settings sit at the end of its header: Responses Go To and Settings, each a section closed until opened
// (or opened to the one asked for: a paused form's Fix opens Responses Go To). An Editor's alone.
import { useState } from 'react';
import type { Tab } from '@livediagram/document';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import {
  lucideSettings,
  lucideSlidersHorizontal,
  lucideSquareKanban,
} from '@livediagram/icons/lucide';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { DestinationPicker } from './DestinationPicker';
import { FormSettingsTab } from './FormSettingsTab';
import { FormSheet } from './FormSheet';

const CogIcon = lucideGlyph(lucideSettings, 16);
const BoardIcon = lucideGlyph(lucideSquareKanban, 13);
const SlidersIcon = lucideGlyph(lucideSlidersHorizontal, 13);

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
      <Tooltip label="Form Settings">
        <button
          ref={setAnchor}
          type="button"
          aria-label="Form Settings"
          aria-haspopup="dialog"
          aria-expanded={open !== false}
          data-dock-button
          onClick={() => (open === false ? onOpen(null) : onClose())}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <CogIcon aria-hidden />
        </button>
      </Tooltip>
      {open !== false && anchor ? (
        <FormSheet anchor={anchor} name="Form Settings" width={360} onClose={onClose}>
          <Sections tabs={tabs} link={link} first={open} />
        </FormSheet>
      ) : null}
    </>
  );
}

function Sections({
  tabs,
  link,
  first,
}: {
  tabs: readonly Tab[];
  link: FormLinkState;
  first: FormSettingsSection | null;
}) {
  const [shown, setShown] = useState<FormSettingsSection | null>(first);
  const toggle = (s: FormSettingsSection) => setShown((o) => (o === s ? null : s));
  return (
    <div className="-mx-3 -mb-3 flex flex-col">
      <MenuAccordionSection
        title="Responses Go To"
        icon={<BoardIcon aria-hidden />}
        open={shown === 'destination'}
        onToggle={() => toggle('destination')}
      >
        <div className="px-3 py-1.5">
          <DestinationPicker tabs={tabs} />
        </div>
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Settings"
        icon={<SlidersIcon aria-hidden />}
        open={shown === 'settings'}
        onToggle={() => toggle('settings')}
      >
        <div className="px-3 py-1.5">
          <FormSettingsTab link={link} />
        </div>
      </MenuAccordionSection>
      <div className="flex justify-end border-t border-slate-100 px-2 pt-1 dark:border-slate-800">
        <HelpArticleLink article="planForms" />
      </div>
    </div>
  );
}
