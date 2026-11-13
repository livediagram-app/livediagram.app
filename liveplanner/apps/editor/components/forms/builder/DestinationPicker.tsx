'use client';

// Responses Go To (docs/specs/030-forms/forms.md "Responses Go To and Settings"): the Board tab, the card type and the
// status every response is made in (New Board and New Card Type the last choice of each), and a sentence reading the
// choice back; a pencil beside Card Type opens that type's editor. A choice that no longer holds (its board, column or
// type gone) says so, and the form takes no responses until it is fixed. Column offers only the columns the card type
// uses ("Columns follow the card type"); Add Questions for {Type}'s Fields, Add Fields for Questions, Card Type by
// Answer and Set Automatically sit with it.
import type { Tab } from '@liveplanner/project';
import {
  DESTINATION_PROBLEM_TEXT,
  destinationProblem,
  destinationWarning,
  destinationWarningText,
  questionsWantingFields,
  typeColumns,
  typeQuestionsToAdd,
  typeRuleProblem,
  type FormDestination,
} from '@liveplanner/forms';
import { boardAddTypes, ITEM_TYPE_CUSTOM_MAX, typeFieldLabel } from '@liveplanner/items';
import { PencilIcon, PlusIcon, Select, Tooltip } from '@liveplanner/ui';
import { usePlan } from '@/components/plan/PlanContext';
import { SettingsField } from '@/components/plan/settings-panel-parts';
import { boardsOf, sheetsOf } from '@liveplanner/templates';
import { patchForm } from '@liveplanner/forms';
import { useFormBuilder } from './form-builder-context';
import { ExtraColumns } from './ExtraColumns';
import { SetAutomatically } from './SetAutomatically';
import { CardResponsePreview, SheetResponsePreview } from './ResponsePreview';
import { CardTypeRules } from './CardTypeRules';
import { ColumnChips } from './ChoiceChip';

// The value of each select's last choice, New Board or New Card Type.
const NEW = '__new';

// `onLeave` closes the panel holding it: the card type's editor is a dialog of its own, never under the panel.
export function DestinationPicker({
  tabs,
  onLeave,
}: {
  tabs: readonly Tab[];
  onLeave?: () => void;
}) {
  const b = useFormBuilder();
  const sheets = sheetsOf(tabs);
  const toSheet = !!b.form.sheet;
  const tab = (on: boolean, label: string, pick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={!b.canEdit}
      onClick={pick}
      className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md text-[12px] font-semibold transition disabled:cursor-default ${
        on
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-3">
      {b.locked ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Locked while the form takes responses: Edit Form unlocks it.
        </p>
      ) : null}
      {/* A board makes a card per response, its answers mapped to fields; a Sheet a row, a column per question. */}
      <div
        role="radiogroup"
        aria-label="Responses become"
        className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
      >
        {tab(!toSheet, 'Cards on a Board', () => b.actions.setResponsesTo({ kind: 'board' }))}
        {tab(toSheet, 'Rows in a Sheet', () => {
          const first = sheets[0];
          if (first) b.actions.setResponsesTo({ kind: 'sheet', ...first });
          else b.actions.newResponsesSheet();
        })}
      </div>
      {toSheet ? (
        <SheetDestination tabs={tabs} />
      ) : (
        <BoardDestination tabs={tabs} onLeave={onLeave} />
      )}
    </div>
  );
}

// Rows in a Sheet: which sheet (New Sheet the last choice), and a sentence reading it back.
function SheetDestination({ tabs }: { tabs: readonly Tab[] }) {
  const b = useFormBuilder();
  const sheets = sheetsOf(tabs);
  const at = b.form.sheet;
  const current = sheets.find((s) => s.sheetId === at?.sheetId && s.tabId === at?.tabId);
  return (
    <div className="flex flex-col gap-3">
      <SettingsField label="Sheet">
        <Select
          className="w-full"
          selectClassName="text-[13px]"
          value={current?.sheetId ?? ''}
          disabled={!b.canEdit}
          onChange={(e) => {
            if (e.target.value === NEW) return b.actions.newResponsesSheet();
            const s = sheets.find((x) => x.sheetId === e.target.value);
            if (s) b.actions.setResponsesTo({ kind: 'sheet', tabId: s.tabId, sheetId: s.sheetId });
          }}
        >
          <option value="" disabled>
            {sheets.length ? 'Choose a sheet…' : 'No sheets yet'}
          </option>
          {sheets.map((s) => (
            <option key={s.sheetId} value={s.sheetId}>
              {s.name}
            </option>
          ))}
          {b.canEdit ? <option value={NEW}>+ New Sheet</option> : null}
        </Select>
      </SettingsField>
      {current ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          Each response becomes a row on <strong>{current.name}</strong>, a column per question. No
          mapping needed.
        </p>
      ) : (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
        >
          {DESTINATION_PROBLEM_TEXT.sheet_missing}
        </p>
      )}
      {current ? <ExtraColumns /> : null}
      {current ? <SheetResponsePreview form={b.form} /> : null}
    </div>
  );
}

// Cards on a Board: the board, the card type (with its editor) and the column, and a sentence reading it back.
function BoardDestination({ tabs, onLeave }: { tabs: readonly Tab[]; onLeave?: () => void }) {
  const b = useFormBuilder();
  const plan = usePlan();
  const dest = b.form.destination;
  const boardTabs = tabs.filter((t) => t.kind === 'board');
  const destTab = boardTabs.find((t) => t.id === dest?.tabId);
  const destBoard = destTab ? boardsOf(destTab)[0] : undefined;
  const board = destBoard?.setup;
  const takes = board ? boardAddTypes(board, b.types) : [];
  const problem = destinationProblem(
    dest,
    destTab ? boardsOf(destTab).map((x) => x.setup) : [],
    b.types,
  );
  const set = (next: FormDestination) =>
    b.actions.changeForm((f) => patchForm(f, { destination: next }));
  const setups = destTab ? boardsOf(destTab).map((x) => x.setup) : [];
  // The card type rules that hold, each with its type, for the sentence and the preview's chips.
  const ruled = (dest?.typeRules ?? []).flatMap((rule) => {
    const t = b.types.find((x) => x.id === rule.typeId);
    return t && !typeRuleProblem(rule, b.form, { types: b.types, boards: setups })
      ? [{ rule, type: t }]
      : [];
  });
  const column = board?.columns.find((c) => c.status === dest?.status);
  // Only the columns the card type uses (forms.md "Columns follow the card type").
  const columns = board ? typeColumns(board.columns, b.type) : [];
  const warning = problem
    ? null
    : destinationWarning(dest, destTab ? boardsOf(destTab).map((x) => x.setup) : [], b.type);
  // The fields no question asks yet, offered as questions (forms.md "Questions from the card type's fields").
  const type = b.type;
  const toAsk = type && !problem ? typeQuestionsToAdd(b.form, type) : [];
  const askNames = toAsk.map((f) =>
    f.kind === 'field' ? f.field.label : typeFieldLabel(type, f.kind),
  );
  // The other way: questions whose answer lands in Description for want of a field (forms.md "Fields from the
  // form's questions"), as many as the type has room for.
  const room = type ? ITEM_TYPE_CUSTOM_MAX - (type.custom?.length ?? 0) : 0;
  const wanting =
    type && !problem && !b.locked
      ? questionsWantingFields(b.form, type).slice(0, Math.max(0, room))
      : [];
  return (
    <div className="flex flex-col gap-3">
      <SettingsField label="Board">
        <Select
          className="w-full"
          selectClassName="text-[13px]"
          value={destTab?.id ?? ''}
          disabled={!b.canEdit}
          onChange={(e) => {
            if (e.target.value === NEW) return b.actions.newResponsesBoard();
            // Its type, column and set values; an empty form then takes the type's questions, a step of its own.
            b.actions.setDestinationBoard(e.target.value);
          }}
        >
          <option value="" disabled>
            {boardTabs.length ? 'Choose a board…' : 'No boards yet'}
          </option>
          {boardTabs.map((t) => (
            <option key={t.id} value={t.id} disabled={boardsOf(t).length === 0}>
              {t.name}
            </option>
          ))}
          {b.canEdit ? <option value={NEW}>+ New Board</option> : null}
        </Select>
      </SettingsField>
      <SettingsField label="Card Type">
        <div className="flex items-center gap-1">
          <Select
            className="min-w-0 flex-1"
            selectClassName="text-[13px]"
            value={dest && takes.some((t) => t.id === dest.typeId) ? dest.typeId : ''}
            disabled={!b.canEdit || !board}
            onChange={(e) => {
              if (e.target.value === NEW) return b.actions.newCardType();
              b.actions.setDestinationType(e.target.value);
            }}
          >
            <option value="" disabled>
              Choose a card type…
            </option>
            {takes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
            {b.canEdit ? <option value={NEW}>+ New Card Type</option> : null}
          </Select>
          {/* The card type's own editor (its fields, display and tabs), to shape it before mapping answers. */}
          {b.canEdit && plan && b.type ? (
            <Tooltip label={`Edit ${b.type.label}`}>
              <button
                type="button"
                aria-label={`Edit card type ${b.type.label}`}
                onClick={() => {
                  onLeave?.();
                  plan.editType({ id: b.type!.id });
                }}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <PencilIcon />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </SettingsField>
      {b.canEdit && type && toAsk.length ? (
        <DashedAdd
          label={`Add Questions for ${type.label}’s Fields`}
          count={toAsk.length}
          tip={askNames.join(', ')}
          onClick={() => b.actions.addTypeQuestions()}
        />
      ) : null}
      {b.canEdit && type && wanting.length ? (
        <DashedAdd
          label="Add Fields for Questions"
          count={wanting.length}
          tip={wanting.map((q) => q.prompt.trim() || 'Untitled question').join(', ')}
          onClick={() => b.actions.addQuestionFields()}
        />
      ) : null}
      <div>
        <p className="mb-1.5 px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          Column
        </p>
        <div role="radiogroup" aria-label="Column" className="flex flex-wrap gap-1.5">
          <ColumnChips
            columns={columns}
            status={dest?.status}
            disabled={!b.canEdit}
            onPick={(status) => dest && set({ ...dest, status })}
          />
          {!board ? (
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              Choose a board first.
            </span>
          ) : columns.length === 0 && type && warning !== 'no_type_column' ? (
            // The warning under the chips says it when it shows, so it is said once.
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              None of these columns is a {type.label} state.
            </span>
          ) : null}
        </div>
      </div>
      {problem ? (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
        >
          {DESTINATION_PROBLEM_TEXT[problem]}
        </p>
      ) : warning && type ? (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
        >
          {destinationWarningText(warning, type.label, destTab?.name ?? 'the board')}
        </p>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          {ruled.length ? 'Otherwise, each' : 'Each'} response becomes a{' '}
          <strong>{b.type?.label}</strong> card in <strong>{column?.name}</strong> on{' '}
          <strong>{destTab?.name}</strong>.
        </p>
      )}
      {/* Other card types by an answer (forms.md "Choosing the card type by an answer"). */}
      {!problem && type ? <CardTypeRules boards={setups} takes={takes} /> : null}
      {/* The card one response makes, as this board draws it (forms.md "What a Response Makes"). */}
      {!problem && type && board && destBoard ? (
        <CardResponsePreview
          form={b.form}
          type={type}
          board={board}
          element={destBoard.element}
          rules={ruled}
        />
      ) : null}
      {!problem ? <SetAutomatically /> : null}
    </div>
  );
}

// A dashed button under Card Type that brings one side to the other (questions for fields, or fields for questions),
// its count beside it and a tooltip naming what it adds.
function DashedAdd({
  label,
  count,
  tip,
  onClick,
}: {
  label: string;
  count: number;
  tip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={tip}>
      <button
        type="button"
        onClick={onClick}
        className="-mt-1 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-[13px] font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
      >
        <PlusIcon size={13} />
        <span className="truncate">{label}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </span>
      </button>
    </Tooltip>
  );
}
