// A sequence diagram as lines (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog", Text): declarations
// (`participant API`, `actor Customer`) and messages (`From -> To: words`; `~>` async, `-->` reply), read back into
// rows. Linear: each line is scanned once for its arrow, no backtracking pattern, since the text is typed or pasted.

import {
  SEQ_MESSAGES_MAX,
  SEQ_MESSAGE_LABEL_MAX,
  SEQ_PARTICIPANTS_MAX,
  SEQ_PARTICIPANT_LABEL_MAX,
  type SequenceElementMessage,
  type SequenceElementParticipant,
  type SequenceMessageKindName,
} from './sequence-element';

// Longest first at a position, so `-->>` is not read as `-->` then `>`.
const ARROWS: readonly [string, SequenceMessageKindName][] = [
  ['-->>', 'reply'],
  ['-->', 'reply'],
  ['->>', 'call'],
  ['->', 'call'],
  ['~>', 'async'],
  ['-)', 'async'],
];
const WRITE: Record<SequenceMessageKindName, string> = { call: '->', async: '~>', reply: '-->' };
// A line longer than this is not read (named, not lost), so a pasted wall of text costs nothing.
export const SEQ_TEXT_LINE_MAX = 400;

const tidy = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const keyOf = (name: string) => name.toLowerCase();

/** The sequence written as lines: every participant declared, in order, then a line per message. */
export function sequenceToText(
  participants: readonly SequenceElementParticipant[],
  messages: readonly SequenceElementMessage[],
): string {
  const name = new Map(participants.map((p) => [p.id, p.label || p.id]));
  const head = participants.map((p) => `${p.actor ? 'actor' : 'participant'} ${p.label || p.id}`);
  const body = messages
    .filter((m) => name.has(m.from) && name.has(m.to))
    .map(
      (m) =>
        `${name.get(m.from)} ${WRITE[m.kind]} ${name.get(m.to)}${m.label ? `: ${m.label}` : ':'}`,
    );
  return [...head, ...(head.length && body.length ? [''] : []), ...body].join('\n');
}

/** Where a line's arrow is, and which, scanning left to right; null when it has none. */
function findArrow(
  line: string,
): { at: number; token: string; kind: SequenceMessageKindName } | null {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c !== '-' && c !== '~') continue;
    for (const [token, kind] of ARROWS)
      if (line.startsWith(token, i)) return { at: i, token, kind };
  }
  return null;
}

export type ParsedSequenceText = {
  participants: SequenceElementParticipant[];
  messages: SequenceElementMessage[];
  // 1-based numbers of the lines that were not read.
  unread: number[];
};

/** The lines read into rows. A participant keeps its id from `known` when its name matches (case-insensitively), so
 *  a round trip leaves its messages its own; a new one takes the next free `p<n>`. Past 12 participants or 60
 *  messages, the lines that would add more are named as unread. */
export function parseSequenceText(
  text: string,
  known: readonly SequenceElementParticipant[] = [],
): ParsedSequenceText {
  const knownByName = new Map(known.map((p) => [keyOf(p.label || p.id), p]));
  const used = new Set<string>();
  let next = 1;
  const freshId = () => {
    const taken = (id: string) => used.has(id) || known.some((p) => p.id === id);
    while (taken(`p${next}`)) next++;
    return `p${next++}`;
  };
  const participants: SequenceElementParticipant[] = [];
  const byName = new Map<string, SequenceElementParticipant>();
  const participant = (raw: string, actor?: boolean): SequenceElementParticipant | null => {
    const label = tidy(raw, SEQ_PARTICIPANT_LABEL_MAX);
    if (!label) return null;
    const key = keyOf(label);
    const have = byName.get(key);
    if (have) {
      if (actor) have.actor = true;
      return have;
    }
    if (participants.length >= SEQ_PARTICIPANTS_MAX) return null;
    const prior = knownByName.get(key);
    const id = prior && !used.has(prior.id) ? prior.id : freshId();
    used.add(id);
    const p: SequenceElementParticipant = { id, label, ...(actor ? { actor: true } : {}) };
    participants.push(p);
    byName.set(key, p);
    return p;
  };
  const messages: SequenceElementMessage[] = [];
  const unread: number[] = [];
  text.split('\n').forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) return;
    if (line.length > SEQ_TEXT_LINE_MAX) return void unread.push(i + 1);
    const decl = /^(participant|actor)\s+(.+)$/i.exec(line);
    if (decl) {
      if (!participant(decl[2]!, decl[1]!.toLowerCase() === 'actor')) unread.push(i + 1);
      return;
    }
    const arrow = findArrow(line);
    if (!arrow || messages.length >= SEQ_MESSAGES_MAX) return void unread.push(i + 1);
    const rest = line.slice(arrow.at + arrow.token.length);
    const colon = rest.indexOf(':');
    const fromName = line.slice(0, arrow.at);
    const toName = colon === -1 ? rest : rest.slice(0, colon);
    const words = colon === -1 ? '' : rest.slice(colon + 1);
    // A Mermaid activation marker (`->>+API`) is not part of the name.
    const from = participant(fromName);
    const to = participant(toName.replace(/^\s*[+-]/, ''));
    if (!from || !to) return void unread.push(i + 1);
    messages.push({
      from: from.id,
      to: to.id,
      label: tidy(words, SEQ_MESSAGE_LABEL_MAX),
      kind: arrow.kind,
    });
  });
  return { participants, messages, unread };
}
