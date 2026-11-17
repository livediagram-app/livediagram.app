'use client';

// Publish as Roadmap's settings (docs/specs/026-plan/public-roadmap.md "The settings"): the Title, the board's Columns
// and Card Types and the allowlisted Fields as chips that flip, Voting, and the Suggest an Idea form. The dialog
// decides what a change does: the settings to publish with, or a save that keeps the link. The title is handed up
// when the field is left (or Enter), so typing does not save on every key.
import { useEffect, useId, useState } from 'react';
import {
  ROADMAP_FIELDS,
  ROADMAP_FIELD_LABELS,
  ROADMAP_TITLE_MAX,
  type RoadmapBoard,
  type RoadmapField,
  type RoadmapForm,
  type RoadmapSettings,
} from '@liveplanner/api-schema';
import { Button, Select, SettingsToggleRow, TextInput, lucideGlyph } from '@liveplanner/ui';
import {
  lucideCalendarCheck,
  lucideCalendarClock,
  lucideCircleCheck,
  lucideHash,
  lucideLayers,
  lucideTag,
  lucideTextQuote,
} from '@liveworkspace/icons/lucide';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { ToggleList } from '@/components/primitives/ToggleList';
import { formFits, toggled, withColumnToggled } from './roadmap-defaults';

const DoneIcon = lucideGlyph(lucideCircleCheck, 14);

/** Add Votes under the Voting toggle: offered for the chosen types whose cards would not show a vote, or said once
 *  it is done (public-roadmap.md "The settings"). */
export type RoadmapVotesNote =
  { kind: 'offer'; names: string; add: () => void } | { kind: 'added'; names: string };

// No suggestion form, and the option that makes one when the roadmap is published.
const NO_FORM = '';
export const CREATE_FORM = '__create__';

// Each field's glyph on a soft tile, in the brand's tint.
const FIELD_ICONS: Readonly<Record<RoadmapField, ReturnType<typeof lucideGlyph>>> = {
  description: lucideGlyph(lucideTextQuote, 15),
  number: lucideGlyph(lucideHash, 15),
  type: lucideGlyph(lucideLayers, 15),
  labels: lucideGlyph(lucideTag, 15),
  start: lucideGlyph(lucideCalendarClock, 15),
  due: lucideGlyph(lucideCalendarCheck, 15),
};
const FIELD_DETAIL: Readonly<Record<RoadmapField, string>> = {
  description: 'The first lines of the card’s description',
  number: 'Its number on the board, like #42',
  type: 'Bug, Feature and the like, with its glyph',
  labels: 'Its labels, as coloured tags',
  start: 'When work on it starts',
  due: 'When it is due',
};
const TILE = 'flex size-7 items-center justify-center rounded-lg';

function ColumnDot({ color }: { color: string | null }) {
  return (
    <span className={`${TILE} bg-slate-100 dark:bg-slate-800`}>
      <span
        className="size-2.5 rounded-full ring-2 ring-white dark:ring-slate-900"
        style={{ backgroundColor: color ?? 'rgb(148 163 184)' }}
      />
    </span>
  );
}

export function RoadmapSettingsForm({
  board,
  forms,
  settings,
  disabled,
  onChange,
  votes = null,
  createForm,
}: {
  board: RoadmapBoard;
  forms: readonly RoadmapForm[];
  settings: RoadmapSettings;
  disabled: boolean;
  onChange: (next: RoadmapSettings) => void;
  votes?: RoadmapVotesNote | null;
  // Create a Suggestion Form, where the editor can make one: the dropdown's last option. Chosen, the form is made when
  // the roadmap is published (or at once on one already out). `hiddenColumn` is where its cards wait (null: none is
  // hidden yet, so it can't be offered).
  createForm?:
    | {
        pending: boolean;
        choose: (on: boolean) => void;
        busy: boolean;
        problem: string | null;
        hiddenColumn: string | null;
      }
    | undefined;
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
  // Columns, Card Types and Fields start closed; one open at a time keeps the page short (owner, 2026-11-17).
  const [openList, setOpenList] = useState<string | null>(null);
  const accordion = (key: string) => ({
    open: openList === key,
    onOpenChange: (o: boolean) => setOpenList(o ? key : null),
  });
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
      <ToggleList
        title="Columns"
        hint="Only cards in shown columns appear. Keep triage hidden."
        noun="shown"
        data="roadmap-columns"
        {...accordion('roadmap-columns')}
        disabled={disabled}
        rows={board.columns.map((c) => ({
          id: c.status,
          label: c.name || 'Untitled',
          icon: <ColumnDot color={c.color} />,
          locked: lastColumn ? 'A roadmap shows at least one column.' : undefined,
        }))}
        on={(status) => settings.columns.includes(status)}
        onToggle={(status) => onChange(withColumnToggled(settings, status, board, forms))}
        onAll={(show) => {
          const columns = show
            ? board.columns.map((c) => c.status)
            : board.columns.slice(0, 1).map((c) => c.status);
          const form = forms.find((f) => f.code === settings.formCode);
          onChange({
            ...settings,
            columns,
            formCode: form && !formFits(form, columns) ? null : settings.formCode,
          });
        }}
      />
      {board.types.length > 1 ? (
        <ToggleList
          title="Card Types"
          hint="The types this board takes."
          noun="shown"
          data="roadmap-types"
          {...accordion('roadmap-types')}
          disabled={disabled}
          rows={board.types.map((t) => ({
            id: t.id,
            label: t.name,
            icon: <PlanTypeGlyph glyph={t.glyph} color={t.color} size={16} />,
            locked: lastType ? 'A roadmap shows at least one card type.' : undefined,
          }))}
          on={(id) => settings.types.includes(id)}
          onToggle={(id) =>
            onChange({ ...settings, types: toggled(settings.types, id, typeOrder) })
          }
          onAll={(show) =>
            onChange({ ...settings, types: show ? [...typeOrder] : typeOrder.slice(0, 1) })
          }
        />
      ) : null}
      <ToggleList
        title="Fields"
        hint="The title always shows. People and comments never do."
        noun="shown"
        data="roadmap-fields"
        {...accordion('roadmap-fields')}
        disabled={disabled}
        rows={ROADMAP_FIELDS.map((f) => {
          const Icon = FIELD_ICONS[f];
          return {
            id: f,
            label: ROADMAP_FIELD_LABELS[f],
            detail: FIELD_DETAIL[f],
            icon: (
              <span
                className={`${TILE} bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300`}
              >
                <Icon />
              </span>
            ),
          };
        })}
        on={(f) => settings.fields.includes(f as RoadmapField)}
        onToggle={(f) =>
          onChange({
            ...settings,
            fields: ROADMAP_FIELDS.filter((x) =>
              x === f ? !settings.fields.includes(x) : settings.fields.includes(x),
            ),
          })
        }
        onAll={(show) => onChange({ ...settings, fields: show ? [...ROADMAP_FIELDS] : [] })}
      />
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
          value={createForm?.pending ? CREATE_FORM : (settings.formCode ?? NO_FORM)}
          disabled={
            disabled || createForm?.busy || (forms.length === 0 && !createForm?.hiddenColumn)
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === CREATE_FORM) {
              createForm?.choose(true);
              return;
            }
            createForm?.choose(false);
            onChange({ ...settings, formCode: v === NO_FORM ? null : v });
          }}
          selectClassName="w-full truncate"
          data-roadmap-form=""
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
          {createForm?.hiddenColumn ? (
            <option value={CREATE_FORM}>＋ Create a Suggestion Form</option>
          ) : null}
        </Select>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {createForm?.busy
            ? 'Making the form…'
            : createForm?.pending
              ? `A new form is made as you publish; its cards wait in ${createForm.hiddenColumn} until you move them.`
              : chosenForm
                ? 'Suggestions land in a hidden column until you move them.'
                : createForm?.hiddenColumn
                  ? 'Pick a form, or create one: its cards wait in a hidden column.'
                  : 'Hide a column above to take suggestions: they wait there until you move them.'}
        </p>
        {createForm?.problem ? (
          <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
            {createForm.problem}
          </p>
        ) : null}
      </div>
    </div>
  );
}
