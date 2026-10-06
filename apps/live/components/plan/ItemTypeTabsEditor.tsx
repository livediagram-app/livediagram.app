'use client';

// The type editor's tabs (docs/specs/026-plan/item-types.md "Editing a type"). Each field row of Fields
// carries a TabPicker: Details, one of the tabs, or New Tab… (a name field: Enter makes the tab and files the
// field on it). TabsList, under Fields, renames Details, and renames, moves (↑ ↓) and removes tabs (their fields
// go to Details); Overview is renamed but never removed. A tab left with no fields is dropped when the type is
// saved (withoutEmptyTabs), Overview aside. Edits a draft; the type
// editor saves it.
import { useState } from 'react';
import {
  DETAILS_LABEL_DEFAULT,
  ITEM_TYPE_TAB_LABEL_MAX,
  ITEM_TYPE_TABS_MAX,
  OVERVIEW_TAB_ID,
  newTabId,
  type ItemTypeTab,
} from '@livediagram/items';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, Select, TextInput } from '@livediagram/ui';

// The fields a tab can hold: never the title (it heads the panel) or votes (they live on the card).
export const NOT_TABBABLE = new Set(['title', 'votes']);
const NEW_TAB = '__new__';

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

// The field filed on the tab named `label` (ignoring case), made at the end when there is none.
export function fileOnNamedTab(
  tabs: readonly ItemTypeTab[],
  label: string,
  field: string,
): ItemTypeTab[] {
  const have = tabs.find((t) => t.label.trim().toLowerCase() === label.toLowerCase());
  if (have) return fileField(tabs, field, have.id);
  const id = newTabId(
    label,
    tabs.map((t) => t.id),
  );
  return [...fileField(tabs, field, null), { id, label, fields: [field] }];
}

// Overview is kept, like Details: renamed, never removed (docs/specs/026-plan/item-types.md "Tabs").
export const isKeptTab = (t: ItemTypeTab) => t.id === OVERVIEW_TAB_ID;

// What is saved: the tabs that hold a field, and Overview.
export function withoutEmptyTabs(tabs: readonly ItemTypeTab[]): ItemTypeTab[] {
  return tabs.filter((t) => t.fields.length > 0 || isKeptTab(t));
}

export function TabPicker({
  field,
  label,
  tabs,
  detailsLabel = DETAILS_LABEL_DEFAULT,
  onChange,
}: {
  field: string;
  label: string;
  tabs: readonly ItemTypeTab[];
  detailsLabel?: string;
  onChange: (tabs: ItemTypeTab[]) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const current = tabs.find((t) => t.fields.includes(field))?.id ?? '';
  if (naming) {
    const done = (commit: boolean) => {
      const n = name.trim();
      if (commit && n) onChange(fileOnNamedTab(tabs, n, field));
      setNaming(false);
      setName('');
    };
    return (
      <TextInput
        autoFocus
        aria-label={`New tab for ${label}`}
        placeholder="Tab name, then Enter"
        maxLength={ITEM_TYPE_TAB_LABEL_MAX}
        value={name}
        compact
        className="w-32 shrink-0 py-1 text-[12px]"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            done(true);
          } else if (e.key === 'Escape') {
            done(false);
          }
        }}
        onBlur={() => done(true)}
      />
    );
  }
  return (
    <Select
      aria-label={`Where ${label} shows`}
      className="w-32 shrink-0"
      size="sm"
      selectClassName="text-[12px]"
      value={current}
      onChange={(e) => {
        if (e.target.value === NEW_TAB) setNaming(true);
        else onChange(fileField(tabs, field, e.target.value || null));
      }}
    >
      <option value="">{detailsLabel || DETAILS_LABEL_DEFAULT}</option>
      {tabs.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label || 'Untitled tab'}
        </option>
      ))}
      {tabs.length < ITEM_TYPE_TABS_MAX ? <option value={NEW_TAB}>New Tab…</option> : null}
    </Select>
  );
}

export function TabsList({
  tabs,
  detailsLabel,
  onDetailsLabel,
  onChange,
}: {
  tabs: readonly ItemTypeTab[];
  // What this type calls Details: renamed here, never moved or removed.
  detailsLabel: string;
  onDetailsLabel: (label: string) => void;
  onChange: (tabs: ItemTypeTab[]) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Tabs">
      <li className="flex items-center gap-1.5">
        <TextInput
          aria-label="Details name"
          compact
          value={detailsLabel}
          maxLength={ITEM_TYPE_TAB_LABEL_MAX}
          placeholder={DETAILS_LABEL_DEFAULT}
          onChange={(e) => onDetailsLabel(e.target.value)}
        />
        <span className="w-[10.375rem] shrink-0 pr-2 text-right text-[11px] text-slate-500 dark:text-slate-400">
          Side column
        </span>
      </li>
      {tabs.map((t, i) => (
        <li key={t.id} className="flex items-center gap-1.5">
          <TextInput
            aria-label={`Tab ${i + 1} name`}
            compact
            value={t.label}
            maxLength={ITEM_TYPE_TAB_LABEL_MAX}
            placeholder="Tab name"
            onChange={(e) =>
              onChange(tabs.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))
            }
          />
          <span className="w-16 shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400">
            {t.fields.length === 0
              ? 'Empty'
              : `${t.fields.length} ${t.fields.length === 1 ? 'field' : 'fields'}`}
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
          {isKeptTab(t) ? (
            // Overview stays: the slot keeps the rows' controls lined up.
            <span aria-hidden className="h-7 w-7 shrink-0" />
          ) : (
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Remove ${t.label || 'tab'}`}
              onClick={() => onChange(tabs.filter((x) => x.id !== t.id))}
            >
              <CloseIcon size={12} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
