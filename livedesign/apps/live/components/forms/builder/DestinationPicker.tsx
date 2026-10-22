'use client';

// Responses Go To (docs/specs/030-forms/forms.md "Responses Go To and Settings"): the Board tab, the card type and the
// status every response is made in (New Board and New Card Type the last choice of each), and a sentence reading the
// choice back; a pencil beside Card Type opens that type's editor. A choice that no longer holds (its board, column or
// type gone) says so, and the form takes no responses until it is fixed.
import type { Tab } from '@livepages/document';
import {
  DESTINATION_PROBLEM_TEXT,
  destinationProblem,
  type FormDestination,
} from '@livepages/forms';
import { boardAddTypes } from '@livepages/items';
import { PencilIcon, Select, Tooltip } from '@livepages/ui';
import { usePlan } from '@/components/plan/PlanContext';
import { SettingsField } from '@/components/plan/settings-panel-parts';
import { boardsOf, sheetsOf } from '@livepages/templates';
import { patchForm } from '@livepages/forms';
import { useFormBuilder } from './form-builder-context';

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
  const board = destTab ? boardsOf(destTab)[0]?.setup : undefined;
  const takes = board ? boardAddTypes(board, b.types) : [];
  const problem = destinationProblem(
    dest,
    destTab ? boardsOf(destTab).map((x) => x.setup) : [],
    b.types,
  );
  const set = (next: FormDestination) =>
    b.actions.changeForm((f) => patchForm(f, { destination: next }));
  const column = board?.columns.find((c) => c.status === dest?.status);
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
            const tab = boardTabs.find((t) => t.id === e.target.value);
            const setup = tab ? boardsOf(tab)[0]?.setup : undefined;
            if (!tab || !setup) return;
            const typeId =
              dest && boardAddTypes(setup, b.types).some((t) => t.id === dest.typeId)
                ? dest.typeId
                : (boardAddTypes(setup, b.types)[0]?.id ?? dest?.typeId ?? '');
            set({ tabId: tab.id, typeId, status: setup.columns[0]!.status });
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
      <div>
        <p className="mb-1.5 px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          Column
        </p>
        <div role="radiogroup" aria-label="Column" className="flex flex-wrap gap-1.5">
          {(board?.columns ?? []).map((c) => {
            const on = c.status === dest?.status;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!b.canEdit}
                onClick={() => dest && set({ ...dest, status: c.status })}
                className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition disabled:cursor-default ${
                  on
                    ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500'
                }`}
              >
                {c.color ? (
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                ) : null}
                <span className="text-optical-centre">{c.name || 'Untitled'}</span>
              </button>
            );
          })}
          {!board ? (
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              Choose a board first.
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
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          Each response becomes a <strong>{b.type?.label}</strong> card in{' '}
          <strong>{column?.name}</strong> on <strong>{destTab?.name}</strong>.
        </p>
      )}
    </div>
  );
}
