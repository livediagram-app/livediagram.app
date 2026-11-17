'use client';

// Publish as Roadmap's settings (docs/specs/026-plan/public-roadmap.md "The settings"): the Title, the board's Columns
// and Card Types and the allowlisted Fields as chips that flip, Voting, and the Suggest an Idea form. The dialog
// decides what a change does: the settings to publish with, or a save that keeps the link. The title is handed up
// when the field is left (or Enter), so typing does not save on every key.
import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  ROADMAP_FIELDS,
  ROADMAP_FIELD_LABELS,
  ROADMAP_TITLE_MAX,
  type RoadmapBoard,
  type RoadmapForm,
  type RoadmapSettings,
} from '@liveplanner/api-schema';
import {
  Button,
  Select,
  SettingsToggleRow,
  SwitchChip,
  TextInput,
  lucideGlyph,
} from '@liveplanner/ui';
import { lucideCheck, lucideCircleCheck } from '@liveworkspace/icons/lucide';
import { formFits, toggled, withColumnToggled } from './roadmap-defaults';

const CheckIcon = lucideGlyph(lucideCheck, 12);
const DoneIcon = lucideGlyph(lucideCircleCheck, 14);

/** Add Votes under the Voting toggle: offered for the chosen types whose cards would not show a vote, or said once
 *  it is done (public-roadmap.md "The settings"). */
export type RoadmapVotesNote =
  { kind: 'offer'; names: string; add: () => void } | { kind: 'added'; names: string };

// No suggestion form.
const NO_FORM = '';

const CHIP =
  'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors';
const CHIP_ON =
  'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-100';
const CHIP_OFF =
  'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100';

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div>
        <h3
          id={id}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          {title}
        </h3>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Chip({
  on,
  label,
  disabled,
  onFlip,
}: {
  on: boolean;
  label: string;
  disabled: boolean;
  onFlip: () => void;
}) {
  return (
    <SwitchChip
      checked={on}
      onChange={onFlip}
      disabled={disabled}
      className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {on ? <CheckIcon /> : null}
        {label}
      </span>
    </SwitchChip>
  );
}

export function RoadmapSettingsForm({
  board,
  forms,
  settings,
  disabled,
  onChange,
  votes = null,
}: {
  board: RoadmapBoard;
  forms: readonly RoadmapForm[];
  settings: RoadmapSettings;
  disabled: boolean;
  onChange: (next: RoadmapSettings) => void;
  votes?: RoadmapVotesNote | null;
}) {
  const titleId = useId();
  const formId = useId();
  const [title, setTitle] = useState(settings.title);
  // oxlint-disable-next-line react/set-state-in-effect -- the field follows a title that changed outside it (a failed save going back)
  useEffect(() => setTitle(settings.title), [settings.title]);
  const commitTitle = () => {
    const next = title.trim();
    if (!next) {
      setTitle(settings.title);
      return;
    }
    if (next !== settings.title) onChange({ ...settings, title: next });
  };
  const typeOrder = board.types.map((t) => t.id);
  const lastColumn = settings.columns.length === 1;
  const lastType = settings.types.length === 1;
  const chosenForm = forms.find((f) => f.code === settings.formCode);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={titleId}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Title
        </label>
        <TextInput
          id={titleId}
          value={title}
          maxLength={ROADMAP_TITLE_MAX}
          disabled={disabled}
          invalid={title.trim() === ''}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTitle();
          }}
        />
      </div>
      <Group title="Columns" hint="Only cards in these columns show. Keep triage columns hidden.">
        <div className="flex flex-wrap gap-1.5">
          {board.columns.map((c) => {
            const on = settings.columns.includes(c.status);
            return (
              <Chip
                key={c.status}
                on={on}
                label={c.name || 'Untitled'}
                disabled={disabled || (on && lastColumn)}
                onFlip={() => onChange(withColumnToggled(settings, c.status, board, forms))}
              />
            );
          })}
        </div>
      </Group>
      {board.types.length > 1 ? (
        <Group title="Card Types">
          <div className="flex flex-wrap gap-1.5">
            {board.types.map((t) => {
              const on = settings.types.includes(t.id);
              return (
                <Chip
                  key={t.id}
                  on={on}
                  label={t.name}
                  disabled={disabled || (on && lastType)}
                  onFlip={() =>
                    onChange({ ...settings, types: toggled(settings.types, t.id, typeOrder) })
                  }
                />
              );
            })}
          </div>
        </Group>
      ) : null}
      <Group
        title="Fields"
        hint="Title always shows. People, comments and other fields are never shown."
      >
        <div className="flex flex-wrap gap-1.5">
          {ROADMAP_FIELDS.map((f) => {
            const on = settings.fields.includes(f);
            return (
              <Chip
                key={f}
                on={on}
                label={ROADMAP_FIELD_LABELS[f]}
                disabled={disabled}
                onFlip={() =>
                  onChange({
                    ...settings,
                    fields: ROADMAP_FIELDS.filter((x) =>
                      x === f ? !on : settings.fields.includes(x),
                    ),
                  })
                }
              />
            );
          })}
        </div>
      </Group>
      <div className="-mx-2 flex flex-col">
        <SettingsToggleRow
          label="Voting"
          hint="Visitors may upvote a card, once per browser."
          checked={settings.voting}
          disabled={disabled}
          onToggle={() => onChange({ ...settings, voting: !settings.voting })}
        />
        {votes?.kind === 'offer' ? (
          <div
            className="mx-2 mt-1 flex flex-col gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:bg-slate-800/60 dark:ring-slate-700"
            data-roadmap-votes-offer=""
          >
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {votes.names} cards don’t show votes yet.
              </span>{' '}
              Add Votes so your team sees each card’s count and can sort by it.
            </p>
            <Button
              size="xs"
              variant="secondary"
              disabled={disabled}
              onClick={votes.add}
              className="shrink-0 self-start sm:self-auto"
            >
              Add Votes
            </Button>
          </div>
        ) : null}
        <p role="status" className="mx-2 empty:hidden">
          {votes?.kind === 'added' ? (
            <span className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <DoneIcon />
              {votes.names} cards now show their votes.
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={formId}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Suggest an Idea
        </label>
        <Select
          id={formId}
          value={settings.formCode ?? NO_FORM}
          disabled={disabled || forms.length === 0}
          onChange={(e) =>
            onChange({ ...settings, formCode: e.target.value === NO_FORM ? null : e.target.value })
          }
          selectClassName="w-full truncate"
        >
          <option value={NO_FORM}>None</option>
          {forms.map((f) => (
            <option key={f.code} value={f.code} disabled={!formFits(f, settings.columns)}>
              {f.heading || f.tabName}
              {formFits(f, settings.columns)
                ? ''
                : ' (its cards would show on the roadmap at once)'}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {forms.length === 0
            ? 'Publish a form whose cards land in a hidden column to take suggestions.'
            : chosenForm
              ? 'Suggestions land in a hidden column until you move them.'
              : 'A published form whose cards land in a hidden column.'}
        </p>
      </div>
    </div>
  );
}
