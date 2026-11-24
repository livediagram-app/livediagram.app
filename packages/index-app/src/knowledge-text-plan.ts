// A plan's indexable text (liveworkspace/docs/specs/004-index/knowledge-sources.md "What each app gives"): each card,
// its title, status, description, every field with a value and its comments, as one chunk that opens the card; then
// each tab's own words, as a canvas's are read. Read out of the plan's whole-item file (`liveplanner.project`), so
// liveplanner's storage gains no read of its own. Archived cards and a template's example cards are left out.

import type { KnowledgeChunk } from '@liveworkspace/index-client';
import { addCanvasTabs, ChunkBudget, fileBody, plainWords } from './knowledge-text';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Fields read as the card's own lines, not as "Name: value".
const OWN_FIELDS = new Set(['title', 'description', 'status']);
// Fields that hold no words (flags, colours, counts kept elsewhere).
const SKIPPED_FIELDS = new Set([
  'color',
  'votes',
  'comments',
  'attachments',
  'archived',
  'flagged',
  'example',
]);
// A field's name as a line says it: `dueDate` and `due_date` as "Due Date".
function fieldLabel(id: string): string {
  const spaced = id.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// A field's value as words: text as it is, a number, a date's day, a person's name, a list's items, a checklist's
// items; nothing for anything else.
function valueWords(value: unknown): string {
  if (typeof value === 'string') return plainWords(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : '';
  if (Array.isArray(value)) return value.map(valueWords).filter(Boolean).join(', ');
  if (isRecord(value)) {
    if (typeof value.name === 'string') return plainWords(value.name);
    if (typeof value.text === 'string') return plainWords(value.text);
    if (Array.isArray(value.runs))
      return valueWords(value.runs.map((r) => (isRecord(r) ? r.text : '')).join(''));
  }
  return '';
}

// The comments of each card, by card id, from the plan's threads (oldest first), resolved threads too: what was
// decided there is knowledge.
function commentsByCard(threads: unknown): Map<string, string[]> {
  const byCard = new Map<string, string[]>();
  if (!Array.isArray(threads)) return byCard;
  for (const thread of threads) {
    if (!isRecord(thread) || !Array.isArray(thread.cards) || !Array.isArray(thread.comments))
      continue;
    const texts = thread.comments
      .map((c) => (isRecord(c) && typeof c.text === 'string' ? plainWords(c.text) : ''))
      .filter(Boolean);
    if (!texts.length) continue;
    for (const card of thread.cards) {
      if (!isRecord(card) || typeof card.itemId !== 'string') continue;
      const list = byCard.get(card.itemId) ?? [];
      list.push(...texts);
      byCard.set(card.itemId, list);
    }
  }
  return byCard;
}

// One card's lines: its title, then "Status: …", its description, its other fields, then "Comments: …".
export function cardWords(fields: Record<string, unknown>, comments: readonly string[]): string {
  const lines: string[] = [];
  const title = valueWords(fields.title);
  if (title) lines.push(title);
  const status = valueWords(fields.status);
  if (status) lines.push(`Status: ${status}`);
  const description = valueWords(fields.description);
  if (description) lines.push(description);
  for (const [id, value] of Object.entries(fields)) {
    if (OWN_FIELDS.has(id) || SKIPPED_FIELDS.has(id)) continue;
    const words = valueWords(value);
    if (words) lines.push(`${fieldLabel(id)}: ${words}`);
  }
  if (comments.length) lines.push(`Comments: ${comments.join(' ')}`);
  return lines.join('\n');
}

// A plan's chunks from its whole-item file: its cards, newest change first so a capped plan keeps what moved last,
// then its tabs' own words.
export function planKnowledgeChunks(file: unknown): { name: string; chunks: KnowledgeChunk[] } {
  const read = fileBody(file);
  if (!read) return { name: '', chunks: [] };
  const budget = new ChunkBudget();
  const comments = commentsByCard(read.body.threads);
  const cards = (Array.isArray(read.body.items) ? read.body.items : [])
    .filter(isRecord)
    .filter((card) => {
      const fields = card.fields;
      return isRecord(fields) && fields.archived !== true && fields.example !== true;
    })
    .sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
  for (const card of cards) {
    if (budget.full) break;
    if (typeof card.id !== 'string') continue;
    const fields = card.fields as Record<string, unknown>;
    const text = cardWords(fields, comments.get(card.id) ?? []);
    if (!text) continue;
    const key = typeof card.key === 'number' ? `#${card.key} ` : '';
    budget.add(`card:${card.id}`, `${key}${valueWords(fields.title) || 'Card'}`, text, {
      cardId: card.id,
    });
  }
  addCanvasTabs(budget, read.body.tabs as unknown[]);
  return { name: read.name, chunks: budget.chunks };
}
