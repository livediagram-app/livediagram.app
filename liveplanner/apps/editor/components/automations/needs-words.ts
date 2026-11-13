// A rule's Needs Attention line as the Rules list words it (docs/specs/026-plan/automations.md "Conditions"): never an
// id, as the step panels' gone picks never show one. Each kind of thing gone is said once, counted ("A column is gone",
// "2 columns are gone", "Someone is gone"), in the order the rule names them; a field Field Changed never hears keeps
// its name. Pure.

import type { AutomationNeed } from '@liveplanner/items';

type GoneKind = Exclude<AutomationNeed['kind'], 'unheard'>;

// What one, and several, of each kind read as.
const GONE: Readonly<Record<GoneKind, readonly [one: string, many: string]>> = {
  column: ['A column', 'columns'],
  type: ['A card type', 'card types'],
  field: ['A field', 'fields'],
  person: ['Someone', 'people'],
  filter: ['A saved filter', 'saved filters'],
  form: ['A Form tab', 'Form tabs'],
  webhook: ['A webhook', 'webhooks'],
  card: ['A card', 'cards'],
};

export function needsWords(attention: readonly AutomationNeed[]): string {
  const counts = new Map<GoneKind, number>();
  const lines: ({ gone: GoneKind } | { text: string })[] = [];
  for (const need of attention) {
    if (need.kind === 'unheard') {
      lines.push({ text: `Field Changed never hears ${need.name}` });
      continue;
    }
    const n = counts.get(need.kind) ?? 0;
    if (n === 0) lines.push({ gone: need.kind });
    counts.set(need.kind, n + 1);
  }
  return lines
    .map((line) => {
      if ('text' in line) return line.text;
      const n = counts.get(line.gone)!;
      const [one, many] = GONE[line.gone];
      return n === 1 ? `${one} is gone` : `${n} ${many} are gone`;
    })
    .join(' · ');
}
