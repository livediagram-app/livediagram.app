'use client';

// The item panels' own small parts (blueprint item-ui.md "Panels"): a tab's select, with Any Tab where the pick is
// optional and a tab the item no longer has kept as "(No Longer Here)" until another is picked. Built on
// step-panels/panel-parts.

import { useTabWords } from '../tab-words';
import type { ReactNode } from 'react';
import { PanelField, PanelSelect } from '../../step-panels/panel-parts';
import { goneLabel } from '../words';

export function TabSelect({
  label,
  value,
  tabs,
  onChange,
  any,
  hint,
  invalid = false,
}: {
  label: string;
  /** The picked tab's id; '' for none. */
  value: string;
  tabs: readonly { id: string; name: string }[];
  onChange: (tab: string) => void;
  /** The choice that names no tab ("Any Tab"); absent where one must be picked. */
  any?: string;
  hint?: ReactNode;
  invalid?: boolean;
}) {
  const known = tabs.some((t) => t.id === value);
  // The panels' fixed words, in the item's word for a tab: a knowledgebase's "Any Page".
  const words = useTabWords();
  return (
    <PanelField label={words(label)} hint={typeof hint === 'string' ? words(hint) : hint}>
      {(id, hintId) => (
        <PanelSelect
          id={id}
          value={value}
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
        >
          {any ? <option value="">{words(any)}</option> : null}
          {!any && !value ? <option value="">{words('Pick a tab')}</option> : null}
          {value && !known ? <option value={value}>{words(goneLabel('tab'))}</option> : null}
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </PanelSelect>
      )}
    </PanelField>
  );
}

/** A part with its optional tab set, or taken off for none. */
export function withTab<T extends { tab?: string }>(part: T, tab: string): T {
  const { tab: _tab, ...rest } = part;
  return (tab ? { ...rest, tab } : rest) as T;
}
