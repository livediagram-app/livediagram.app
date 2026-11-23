'use client';

// Responses Go To (docs/specs/030-forms/forms.md "Responses Go To and Settings"): what every response makes, a card
// of a type in a column (New Card Type the type's last choice), never a board. A sentence reads the choice back with
// the boards its cards show on, worked out from every board of the plan. The card type itself is edited from its
// board, never here. A choice no board shows (or whose column or type is gone) says so and offers Add a Board for {Type}, and the
// form takes no responses until it is fixed, so nobody's cards are made where nobody sees them. Column offers only
// the columns the card type uses on the boards that take it ("Columns follow the card type"); Add Questions for
// {Type}'s Fields, Add Fields for Questions, Card Type by Answer and Set Automatically sit with it.
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
import {
  boardNamesText,
  ITEM_TYPE_CUSTOM_MAX,
  targetColumns,
  typeFieldLabel,
} from '@liveplanner/items';
import { Chip, PlusIcon, Select, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideArrowRight, lucideSquareKanban, lucideTable } from '@liveworkspace/icons/lucide';
import { SettingsField } from '@/components/plan/settings-panel-parts';
import { sheetsOf } from '@liveplanner/templates';
import { boardsShowingOf, planBoardsOf } from '../form-destination';
import { patchForm } from '@liveplanner/forms';
import { useFormBuilder } from './form-builder-context';
import { ExtraColumns } from './ExtraColumns';
import { SetAutomatically } from './SetAutomatically';
import { CardResponsePreview, SheetResponsePreview } from './ResponsePreview';
import { CardTypeRules } from './CardTypeRules';
import { ColumnChips } from './ChoiceChip';
import { Callout } from '@liveworkspace/ui/callout';

const BoardIcon = lucideGlyph(lucideSquareKanban, 18);
const SheetIcon = lucideGlyph(lucideTable, 18);
const ArrowIcon = lucideGlyph(lucideArrowRight, 14);
const ShowsIcon = lucideGlyph(lucideSquareKanban, 13);

// The value of each select's last choice, New Sheet or New Card Type.
const NEW = '__new';

export function DestinationPicker({ tabs }: { tabs: readonly Tab[] }) {
  const b = useFormBuilder();
  const sheets = sheetsOf(tabs);
  const toSheet = !!b.form.sheet;
  return (
    <div className="flex flex-col gap-4">
      {b.locked ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Locked while the form takes responses: Edit Form unlocks it.
        </p>
      ) : null}
      {/* A board makes a card per response, its answers mapped to fields; a Sheet a row, a column per question. */}
      <div role="radiogroup" aria-label="Responses become" className="grid grid-cols-2 gap-2">
        <KindTile
          on={!toSheet}
          disabled={!b.canEdit}
          icon={<BoardIcon aria-hidden />}
          name="Cards on a Board"
          detail="A card per response, answers in its fields"
          onPick={() => b.actions.setResponsesTo({ kind: 'board' })}
        />
        <KindTile
          on={toSheet}
          disabled={!b.canEdit}
          icon={<SheetIcon aria-hidden />}
          name="Rows in a Sheet"
          detail="A row per response, a column per question"
          onPick={() => {
            const first = sheets[0];
            if (first) b.actions.setResponsesTo({ kind: 'sheet', ...first });
            else b.actions.newResponsesSheet();
          }}
        />
      </div>
      {toSheet ? <SheetDestination tabs={tabs} /> : <BoardDestination tabs={tabs} />}
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
    <div className="flex flex-col gap-4">
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
        <Flow
          lead="Each response"
          steps={['A row', current.name]}
          read={`Each response becomes a row on ${current.name}, a column per question. No mapping needed.`}
        />
      ) : (
        <Callout tone="warning" size="md" role="status">
          {DESTINATION_PROBLEM_TEXT.sheet_missing}
        </Callout>
      )}
      {current ? <ExtraColumns /> : null}
      {current ? <SheetResponsePreview form={b.form} /> : null}
    </div>
  );
}

// Cards on a Board: the card type and the column, a sentence reading them back, and the boards the
// cards show on.
function BoardDestination({ tabs }: { tabs: readonly Tab[] }) {
  const b = useFormBuilder();
  const dest = b.form.destination;
  const boards = planBoardsOf(tabs);
  const setups = boards.map((x) => x.setup);
  const problem = destinationProblem(dest, setups, b.types);
  // The boards its cards show on, the one its buttons open and the preview draws first.
  const shows = boardsShowingOf(dest, boards, b.types);
  const home = shows[0];
  const showsOn = [...new Set(shows.map((x) => x.tab.name))];
  // The types some board shows: what a card type rule may make.
  const takes = b.types.filter((t) => targetColumns(setups, b.types, t.id).length > 0);
  const set = (next: FormDestination) =>
    b.actions.changeForm((f) => patchForm(f, { destination: next }));
  // The card type rules that hold, each with its type, for the sentence and the preview's chips.
  const ruled = (dest?.typeRules ?? []).flatMap((rule) => {
    const t = b.types.find((x) => x.id === rule.typeId);
    return t && !typeRuleProblem(rule, b.form, { types: b.types, boards: setups })
      ? [{ rule, type: t }]
      : [];
  });
  const type = b.type;
  // Every column a card of the type can be seen in, across the boards that take it; only those the type uses
  // (forms.md "Columns follow the card type").
  const reach = type ? targetColumns(setups, b.types, type.id) : [];
  const columns = typeColumns(reach, type);
  const column = reach.find((c) => c.status === dest?.status);
  const warning = problem ? null : destinationWarning(dest, setups, type);
  // The fields no question asks yet, offered as questions (forms.md "Questions from the card type's fields").
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
  // A type no board shows (or none in its column): the cards would be made and never seen, so a board is offered.
  const unseen =
    !!type &&
    (problem === 'type_not_on_board' ||
      problem === 'board_missing' ||
      problem === 'status_missing');
  return (
    <div className="flex flex-col gap-4">
      <SettingsField label="Card Type">
        <Select
          className="w-full"
          selectClassName="text-[13px]"
          value={type ? type.id : ''}
          disabled={!b.canEdit}
          onChange={(e) => {
            if (e.target.value === NEW) return b.actions.newCardType();
            // Its column and set values; an empty form then takes the type's questions, a step of its own. A type
            // no board has a column for gets its board at once, as there is no column to choose.
            if (!b.actions.setDestinationType(e.target.value))
              b.actions.newResponsesBoard(e.target.value);
          }}
        >
          <option value="" disabled>
            {b.types.length ? 'Choose a card type…' : 'No card types yet'}
          </option>
          {b.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          {b.canEdit && dest ? <option value={NEW}>+ New Card Type</option> : null}
        </Select>
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
      {/* No board takes the type: there is no column to offer, and the callout below says so. */}
      {type && reach.length > 0 ? (
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
            {columns.length === 0 && warning !== 'no_type_column' ? (
              // The warning under the chips says it when it shows, so it is said once.
              <span className="text-[12px] text-slate-500 dark:text-slate-400">
                None of these columns is a {type.label} state.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {problem ? (
        <Callout
          tone="warning"
          size="md"
          role="status"
          {...(unseen && b.canEdit
            ? {
                action: {
                  label: `Add a Board for ${type.label}`,
                  onSelect: () => b.actions.newResponsesBoard(type.id),
                },
              }
            : {})}
        >
          {/* No board takes the type, or none taking it has the column: said as what it means. A column gone from
              boards that still take the type keeps its own words. */}
          {unseen && problem !== 'status_missing'
            ? `No board shows ${type.label} cards${column ? ` in ${column.name}` : ''}, so nobody would see them.`
            : DESTINATION_PROBLEM_TEXT[problem]}
        </Callout>
      ) : warning && type ? (
        <Callout tone="warning" size="md" role="status">
          {destinationWarningText(warning, type.label, home?.tab.name ?? 'the board')}
        </Callout>
      ) : (
        <Flow
          lead={ruled.length ? 'Otherwise, each response' : 'Each response'}
          steps={[`${type?.label ?? ''} card`, column?.name ?? '']}
          read={`${ruled.length ? 'Otherwise, each' : 'Each'} response becomes a ${type?.label} card in ${column?.name}. It shows on ${boardNamesText(showsOn)}.`}
          showsOn={showsOn}
        />
      )}
      {/* Other card types by an answer (forms.md "Choosing the card type by an answer"). */}
      {!problem && type ? <CardTypeRules boards={setups} takes={takes} /> : null}
      {/* The card one response makes, as its board draws it (forms.md "What a Response Makes"). */}
      {!problem && type && home ? (
        <CardResponsePreview
          form={b.form}
          type={type}
          board={home.setup}
          element={home.element}
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
        <Chip className="bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </Chip>
      </button>
    </Tooltip>
  );
}

// Cards on a Board or Rows in a Sheet: a tile each, its icon, name and what it makes.
function KindTile({
  on,
  disabled,
  icon,
  name,
  detail,
  onPick,
}: {
  on: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  name: string;
  detail: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onPick}
      className={`flex min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition disabled:cursor-default ${
        on
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/10 dark:ring-brand-400'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800'
      }`}
    >
      <span
        className={`grid size-8 place-items-center rounded-lg ${
          on
            ? 'bg-brand-700 text-white dark:bg-brand-600'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {icon}
      </span>
      <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">{name}</span>
      <span className="text-[12px] leading-snug text-slate-500 dark:text-slate-400">{detail}</span>
    </button>
  );
}

// What a response makes, read as a path: "Each response → Bug card → New", and under it the boards the card shows on
// ("Shows on Bugs and Triage"), which follow the plan's boards and are never chosen. `read` is the sentence a screen
// reader hears in its place.
function Flow({
  lead,
  steps,
  read,
  showsOn,
}: {
  lead: string;
  steps: readonly string[];
  read: string;
  showsOn?: readonly string[];
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <p className="sr-only">{read}</p>
      <p
        aria-hidden
        className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-300"
      >
        <span>{lead}</span>
        {steps.filter(Boolean).map((step, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-slate-400">
              <ArrowIcon />
            </span>
            <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-50 dark:ring-slate-700">
              {step}
            </span>
          </span>
        ))}
      </p>
      {showsOn?.length ? (
        <p
          aria-hidden
          data-shows-on=""
          className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 pt-2 text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          <span className="text-slate-400">
            <ShowsIcon />
          </span>
          <span>
            Shows on{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {boardNamesText(showsOn)}
            </span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
