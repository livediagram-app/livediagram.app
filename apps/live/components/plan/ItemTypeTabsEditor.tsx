'use client';

// The type editor's Tabs (docs/specs/025-plan/item-types.md "Editing a type"): the item panel's tabs in
// order, each renamed in place, moved with ↑ and ↓, and taken off with × (its fields go to Details), with
// Add Tab; then every field of the type with a Shows In picker, Details or one of the tabs. Edits a
// draft; the type editor saves it.
import {
  ITEM_TYPE_TABS_MAX,
  ITEM_TYPE_TAB_LABEL_MAX,
  newTabId,
  type ItemTypeTab,
} from '@livediagram/items';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, PlusIcon } from '@livediagram/ui';
import { FIELD_CLASS } from './PlanModal';

// The fields a tab can hold: never the title (it heads the panel) or votes (they live on the card).
const NOT_TABBABLE = new Set(['title', 'votes']);

const ICON_BUTTON =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-800 disabled:opacity-30 dark:text-slate-400 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-100';

export function moveTab(tabs: readonly ItemTypeTab[], i: number, delta: -1 | 1): ItemTypeTab[] {
  const j = i + delta;
  if (j < 0 || j >= tabs.length) return [...tabs];
  const next = [...tabs];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

// A field filed under a tab (or Details, `null`): taken out of every tab, then added to the chosen one.
export function fileField(
  tabs: readonly ItemTypeTab[],
  field: string,
  tabId: string | null,
): ItemTypeTab[] {
  return tabs.map((t) => {
    const fields = t.fields.filter((f) => f !== field);
    return { ...t, fields: t.id === tabId ? [...fields, field] : fields };
  });
}

export function ItemTypeTabsEditor({
  tabs,
  fields,
  labelOf,
  onChange,
}: {
  tabs: readonly ItemTypeTab[];
  // The type's fields, in order.
  fields: readonly string[];
  labelOf: (field: string) => string;
  onChange: (tabs: ItemTypeTab[]) => void;
}) {
  const tabbable = fields.filter((f) => !NOT_TABBABLE.has(f));
  const tabOf = (f: string) => tabs.find((t) => t.fields.includes(f))?.id ?? '';
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5" aria-label="Tabs">
        {tabs.map((t, i) => (
          <li key={t.id} className="flex items-center gap-1.5">
            <input
              aria-label={`Tab ${i + 1} name`}
              className={FIELD_CLASS}
              value={t.label}
              maxLength={ITEM_TYPE_TAB_LABEL_MAX}
              placeholder="Tab name"
              onChange={(e) =>
                onChange(tabs.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))
              }
            />
            <span className="w-14 shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400">
              {t.fields.length} {t.fields.length === 1 ? 'field' : 'fields'}
            </span>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Move ${t.label || 'tab'} up`}
              disabled={i === 0}
              onClick={() => onChange(moveTab(tabs, i, -1))}
            >
              <ArrowUpIcon size={14} />
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Move ${t.label || 'tab'} down`}
              disabled={i === tabs.length - 1}
              onClick={() => onChange(moveTab(tabs, i, 1))}
            >
              <ArrowDownIcon size={14} />
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Remove ${t.label || 'tab'}`}
              onClick={() => onChange(tabs.filter((x) => x.id !== t.id))}
            >
              <CloseIcon size={12} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={tabs.length >= ITEM_TYPE_TABS_MAX}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 py-1.5 text-[12px] font-medium text-slate-600 transition enabled:hover:border-brand-400 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:enabled:hover:text-brand-300"
        onClick={() =>
          onChange([
            ...tabs,
            {
              id: newTabId(
                'New Tab',
                tabs.map((t) => t.id),
              ),
              label: 'New Tab',
              fields: [],
            },
          ])
        }
      >
        <PlusIcon size={14} />
        Add Tab
      </button>
      {tabbable.length > 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_10rem] border-b border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <span>Field</span>
            <span>Shows In</span>
          </div>
          {tabbable.map((f) => (
            <div
              key={f}
              className="grid grid-cols-[1fr_10rem] items-center gap-2 border-b border-slate-100 px-3 py-1.5 last:border-0 dark:border-slate-800"
            >
              <span className="truncate text-[13px]">{labelOf(f)}</span>
              <select
                aria-label={`Where ${labelOf(f)} shows`}
                className={FIELD_CLASS}
                value={tabOf(f)}
                onChange={(e) => onChange(fileField(tabs, f, e.target.value || null))}
              >
                <option value="">Details</option>
                {tabs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label || 'Untitled tab'}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
