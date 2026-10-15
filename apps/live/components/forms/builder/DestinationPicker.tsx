'use client';

// Responses Go To (docs/specs/030-forms/forms.md "Responses Go To and Settings"): the Board tab, the card type and the
// status every response is made in (New Board and New Card Type the last choice of each), and a sentence reading the
// choice back. A choice that no
// longer holds (its board, column or type gone) says so, and the form takes no responses until it is fixed.
import type { Tab } from '@livediagram/document';
import {
  DESTINATION_PROBLEM_TEXT,
  destinationProblem,
  type FormDestination,
} from '@livediagram/forms';
import { boardAddTypes } from '@livediagram/items';
import { Select } from '@livediagram/ui';
import { SettingsField } from '@/components/plan/settings-panel-parts';
import { boardsOf } from '@/hooks/forms/form-start';
import { patchForm } from '@/hooks/forms/form-edits';
import { useFormBuilder } from './form-builder-context';

// The value of each select's last choice, New Board or New Card Type.
const NEW = '__new';

export function DestinationPicker({ tabs }: { tabs: readonly Tab[] }) {
  const b = useFormBuilder();
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
        <Select
          className="w-full"
          selectClassName="text-[13px]"
          value={dest && takes.some((t) => t.id === dest.typeId) ? dest.typeId : ''}
          disabled={!b.canEdit || !board}
          onChange={(e) => {
            if (e.target.value === NEW) return b.actions.newCardType();
            if (dest) set({ ...dest, typeId: e.target.value });
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
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
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
