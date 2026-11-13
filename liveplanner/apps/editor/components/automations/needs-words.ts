// A rule's Needs Attention line as the Rules list words it (docs/specs/026-plan/automations.md "Conditions"): never an
// id, as the step panels' gone picks never show one. Each kind of thing gone is said once, counted ("A column is gone",
// "2 columns are gone", "Someone is gone"), in the order the rule names them; a field Field Changed never hears keeps
// its name. Pure.

import type { AutomationGone, AutomationNeed } from '@liveplanner/items';

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

// What a gone thing reads as inside a line, as the rule's sentence reads a gone pick ("a column no longer here").
const INLINE: Readonly<Record<AutomationGone['kind'], string>> = {
  column: 'a column no longer here',
  type: 'a card type no longer here',
  field: 'a field no longer here',
  person: 'Someone No Longer Here',
  filter: 'a saved filter no longer here',
};

// The start a failed step's line or a run's reason keeps: a related card's number, or the branch's failed cards.
const KEPT = /^(?:#\d+ |Failed on [^:]*: )?/;

const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A failed step's line, an unheld condition's or a run's reason, as the Audit Trail words it: never an id. What is
 *  gone (`gone`, kept beside the text) reads as Needs Attention says it ("#12 A column is gone", "Failed on #12, #14: A
 *  field is gone"); a condition keeps its words, the id read as the sentence reads a gone pick ("Column is Done or a
 *  column no longer here (a column is gone)"). A line without it (a run from before) reads as stored. */
export function goneText(text: string, gone: AutomationGone | undefined): string {
  if (!gone) return text;
  const one = GONE[gone.kind][0];
  const tail = `(${gone.id} is gone)`;
  if (!text.endsWith(tail)) return `${KEPT.exec(text)![0]}${one} is gone`;
  const id = new RegExp(`(?<![\\w-])${escaped(gone.id)}(?![\\w-])`, 'g');
  return `${text.slice(0, -tail.length).replace(id, INLINE[gone.kind])}(${one.toLowerCase()} is gone)`;
}
