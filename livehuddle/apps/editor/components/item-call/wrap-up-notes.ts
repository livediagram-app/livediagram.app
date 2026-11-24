// Wrap Up's first draft (docs/specs/012-collaboration/calls-from-items.md "Wrap Up"): the call's facts, then the notes
// people left on the Space's floors, so the host edits a summary rather than writes one. Pure, linear in the elements.
import type { SpaceCall } from '@liveworkspace/index-client';

/** The most note lines a draft carries. */
export const WRAP_UP_NOTES_MAX = 200;

export type NoteElement = { id: string; type: string; label?: unknown; x?: number; y?: number };
export type NoteTab = { id: string; name: string; elements: readonly NoteElement[] };

const NOTE_TYPES = new Set(['sticky', 'text']);

/** Each floor's stickies and texts in reading order (top to bottom, then left to right), their first lines. */
export function wrapUpNotes(tabs: readonly NoteTab[]): { tab: string; lines: string[] }[] {
  const out: { tab: string; lines: string[] }[] = [];
  let left = WRAP_UP_NOTES_MAX;
  for (const tab of tabs) {
    if (left <= 0) break;
    const lines = tab.elements
      .filter((e) => NOTE_TYPES.has(e.type) && typeof e.label === 'string' && e.label.trim())
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
      .map((e) => (e.label as string).trim().split('\n', 1)[0]!.trim())
      .filter(Boolean)
      .slice(0, left);
    left -= lines.length;
    if (lines.length > 0) out.push({ tab: tab.name || 'Floor', lines });
  }
  return out;
}

const day = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** The summary's title and body to start from: "<item>, 23 Nov 2026" over the facts and the notes, in Markdown. */
export function summaryDraft(
  call: Pick<SpaceCall, 'item' | 'startedAt'>,
  names: readonly string[],
  tabs: readonly NoteTab[],
): { title: string; body: string } {
  const title = `${call.item.title || 'Untitled'}, ${day(call.startedAt)}`;
  const facts = [
    `A call about [${call.item.title || 'Untitled'}](${call.item.link}) on ${day(call.startedAt)}.`,
    names.length > 0 ? `With ${names.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const notes = wrapUpNotes(tabs);
  const parts = [facts, '## Notes'];
  if (notes.length === 0) parts.push('Nothing was written down on the floors.');
  for (const { tab, lines } of notes) {
    if (notes.length > 1) parts.push(`### ${tab}`);
    parts.push(lines.map((l) => `- ${l}`).join('\n'));
  }
  parts.push('## Decisions', '- ', '## Actions', '- ');
  return { title, body: parts.join('\n\n') };
}

/** What Write With AI asks for. */
export const SUMMARY_QUESTION =
  'Write a short meeting summary of these notes, in Markdown: two or three sentences on what the call covered, then ' +
  'Decisions and Actions as bullet lists, each action with its owner where the notes name one. Use only what the ' +
  'notes say.';
