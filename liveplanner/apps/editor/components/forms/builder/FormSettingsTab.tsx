'use client';

// The form's Settings (docs/specs/030-forms/forms.md "Responses Go To and Settings"), in three groups: Taking Responses
// (Accepting Responses, the link's switch once published, then Close On and Response Limit side by side), Layout (the
// form's Width, Narrow or Wide) and Messages (the confirmation and closed messages).
import { useState } from 'react';
import {
  DEFAULT_CLOSED_MESSAGE,
  DEFAULT_CONFIRMATION,
  FORM_RESPONSE_LIMIT_MAX,
  MESSAGE_MAX,
} from '@liveplanner/forms';
import { TextInput, SwitchRow } from '@liveplanner/ui';
import { SettingsField } from '@/components/plan/settings-panel-parts';
import { patchForm } from '@liveplanner/forms';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { DraftText } from './DraftText';
import { useFormBuilder } from './form-builder-context';
import { FormMonth } from '../FormMonth';

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
  const open = published && !!link.link?.link?.open;
  // A form with problems can't start taking responses again (forms.md "A live form is locked"); closing always works.
  const blocked = published && !open && !!b.problemCount;
  // The clock as the tab opened: whether Close On has passed, read once.
  const [now] = useState(() => Date.now());
  const past = form.closesAt !== undefined && form.closesAt <= now;
  return (
    <div className="flex flex-col gap-5">
      <Group title="Taking Responses">
        <div>
          <SwitchRow
            checked={open}
            onChange={(on) => void link.setOpen(on)}
            disabled={!published || blocked}
            className="py-1 text-[13px] font-medium"
          >
            Accepting Responses
          </SwitchRow>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            {blocked
              ? 'Fix this form’s problems first: Share Form lists them.'
              : published
                ? open
                  ? 'Closing keeps the link. People who open it see your closed message.'
                  : 'Taking responses again locks the form, so it can’t change under anyone.'
                : 'Publish the form from Share Form to start taking responses.'}
          </p>
        </div>
        {/* With Pro on: the month's responses against the owner's tier (forms.md "Tiers"). */}
        {published ? <FormMonth link={link.link} /> : null}
        <div className="grid grid-cols-[1fr_8.5rem] gap-2 [&>*]:min-w-0">
          <SettingsField label="Close On">
            <div className="flex items-center gap-2">
              <TextInput
                compact
                type="datetime-local"
                className="min-w-0 flex-1"
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
          <SettingsField label="Response Limit">
            <TextInput
              compact
              type="number"
              inputMode="numeric"
              className="w-full"
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
        </div>
        {past ? (
          <p className="-mt-2 text-[12px] text-amber-700 dark:text-amber-300">
            That time has passed: the form is closed.
          </p>
        ) : null}
      </Group>
      <Group title="Layout">
        <div role="radiogroup" aria-label="Width" className="grid grid-cols-2 gap-2">
          <WidthTile
            on={form.width !== 'wide'}
            name="Narrow"
            detail="Easy to read, best for most forms"
            column={0.5}
            onPick={() => set({ width: undefined })}
          />
          <WidthTile
            on={form.width === 'wide'}
            name="Wide"
            detail="Room for long choices and pictures"
            column={0.8}
            onPick={() => set({ width: 'wide' })}
          />
        </div>
      </Group>
      <Group title="Messages">
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
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

// Narrow or Wide: a tile each, a little page whose column is as wide as the form's.
function WidthTile({
  on,
  name,
  detail,
  column,
  onPick,
}: {
  on: boolean;
  name: string;
  detail: string;
  // The column's share of the page drawn.
  column: number;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition ${
        on
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/10 dark:ring-brand-400'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800'
      }`}
    >
      <span
        aria-hidden
        className="flex h-12 w-full justify-center rounded-md bg-slate-100 px-2 pt-2 dark:bg-slate-800"
      >
        <span
          className={`flex flex-col gap-1 rounded-t-sm bg-white px-1.5 pt-1.5 shadow-sm transition-[width] duration-200 motion-reduce:transition-none dark:bg-slate-900 ${on ? 'ring-1 ring-brand-400/60' : ''}`}
          style={{ width: `${column * 100}%` }}
        >
          <span
            className={`h-1 w-2/3 rounded-full ${on ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          />
          <span className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
          <span className="h-1 w-5/6 rounded-full bg-slate-200 dark:bg-slate-700" />
        </span>
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-50">
          {name}
        </span>
        <span className="block text-[12px] leading-snug text-slate-500 dark:text-slate-400">
          {detail}
        </span>
      </span>
    </button>
  );
}
