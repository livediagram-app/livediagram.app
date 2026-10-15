'use client';

// The form's Settings (docs/specs/030-forms/forms.md "The Form panel"): Accepting Responses (the link's switch, once
// published), Close On, Response Limit, the confirmation and closed messages, and the form colour.
import { useState } from 'react';
import {
  DEFAULT_CLOSED_MESSAGE,
  DEFAULT_CONFIRMATION,
  FORM_RESPONSE_LIMIT_MAX,
  MESSAGE_MAX,
} from '@livediagram/forms';
import { TextInput } from '@livediagram/ui';
import { SettingsField } from '@/components/plan/settings-panel-parts';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { ColourSelect } from '@/components/plan/ColourSwatches';
import { patchForm } from '@/hooks/forms/form-edits';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { DraftText } from './DraftText';
import { useFormBuilder } from './form-builder-context';

const BOX =
  'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 focus-within:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

// A time as a datetime-local field writes it, in the person's own zone.
function localValue(ms: number | undefined): string {
  if (ms === undefined) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FormSettingsTab({ link }: { link: FormLinkState }) {
  const b = useFormBuilder();
  const { form } = b;
  const set = (patch: Parameters<typeof patchForm>[1]) =>
    b.actions.changeForm((f) => patchForm(f, patch));
  const published = !!link.link?.link;
  // The clock as the tab opened: whether Close On has passed, read once.
  const [now] = useState(() => Date.now());
  const past = form.closesAt !== undefined && form.closesAt <= now;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SwitchRow
          checked={published && !!link.link?.link?.open}
          onChange={(on) => void link.setOpen(on)}
          className={`py-1 text-[13px] font-medium ${published ? '' : 'pointer-events-none opacity-50'}`}
        >
          Accepting Responses
        </SwitchRow>
        <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
          {published
            ? 'Closing keeps the link. People who open it see your closed message.'
            : 'Publish the form from Share Form to start taking responses.'}
        </p>
      </div>
      <SettingsField label="Close On">
        <div className="flex items-center gap-2">
          <TextInput
            compact
            type="datetime-local"
            className="flex-1"
            value={localValue(form.closesAt)}
            onChange={(e) => {
              const t = e.target.value ? new Date(e.target.value).getTime() : NaN;
              set({ closesAt: Number.isFinite(t) ? t : undefined });
            }}
          />
          {form.closesAt !== undefined ? (
            <button
              type="button"
              onClick={() => set({ closesAt: undefined })}
              className="cursor-pointer text-[12px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Clear
            </button>
          ) : null}
        </div>
      </SettingsField>
      {past ? (
        <p className="-mt-2 text-[12px] text-amber-700 dark:text-amber-300">
          That time has passed: the form is closed.
        </p>
      ) : null}
      <SettingsField label="Response Limit">
        <TextInput
          compact
          type="number"
          inputMode="numeric"
          min={1}
          max={FORM_RESPONSE_LIMIT_MAX}
          placeholder="No limit"
          defaultValue={form.limit ?? ''}
          key={form.limit ?? 'none'}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const n = Number(raw);
            if (raw === '') set({ limit: undefined });
            else if (Number.isInteger(n) && n >= 1 && n <= FORM_RESPONSE_LIMIT_MAX)
              set({ limit: n });
            else e.target.value = form.limit === undefined ? '' : String(form.limit);
          }}
        />
      </SettingsField>
      <SettingsField label="Confirmation Message">
        <div className={BOX}>
          <DraftText
            value={form.confirmation ?? ''}
            placeholder={DEFAULT_CONFIRMATION}
            maxLength={MESSAGE_MAX}
            multiline
            label="Confirmation message"
            onSave={(text) => set({ confirmation: text.trim() || undefined })}
          />
        </div>
      </SettingsField>
      <SettingsField label="Closed Message">
        <div className={BOX}>
          <DraftText
            value={form.closedMessage ?? ''}
            placeholder={DEFAULT_CLOSED_MESSAGE}
            maxLength={MESSAGE_MAX}
            multiline
            label="Closed message"
            onSave={(text) => set({ closedMessage: text.trim() || undefined })}
          />
        </div>
      </SettingsField>
      <div>
        <p className="mb-1.5 px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          Form Colour
        </p>
        <ColourSelect
          label="Form colour"
          value={form.accent}
          onChange={(accent) => set({ accent })}
        />
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
          Its buttons, focus and choices. None is the livediagram blue.
        </p>
      </div>
    </div>
  );
}
