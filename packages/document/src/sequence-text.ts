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

const WRITE: Record<SequenceMessageKindName, string> = { call: '->', async: '~>', reply: '-->' };
// A line longer than this is not read (named, not lost), so a pasted wall of text costs nothing.
export const SEQ_TEXT_LINE_MAX = 400;

const tidy = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const keyOf = (name: string) => name.toLowerCase();

/** Each participant's name in the text, by id: its label (its id when blank), or with the first free ` <n>` from 2
 *  when an earlier participant already has that name. */
function writtenNames(participants: readonly SequenceElementParticipant[]): Map<string, string> {
  const taken = new Set<string>();
  const name = new Map<string, string>();
  for (const p of participants) {
    const base = p.label || p.id;
    let written = base;
    for (let n = 2; taken.has(keyOf(written)); n++) written = `${base} ${n}`;
    taken.add(keyOf(written));
    name.set(p.id, written);
  }
  return name;
}

/** The sequence written as lines: every participant declared, in order, then a line per message. Each participant is
 *  written under a name of its own: a name already taken (two `API`s) takes the first free ` <n>`, so reading the text
 *  back never merges two participants into one. */
export function sequenceToText(
  participants: readonly SequenceElementParticipant[],
  messages: readonly SequenceElementMessage[],
): string {
  const name = writtenNames(participants);
  const head = participants.map((p) => `${p.actor ? 'actor' : 'participant'} ${name.get(p.id)}`);
  const body = messages
    .filter((m) => name.has(m.from) && name.has(m.to))
    .map(
      (m) =>
        `${name.get(m.from)} ${WRITE[m.kind]} ${name.get(m.to)}${m.label ? `: ${m.label}` : ':'}`,
    );
  return [...head, ...(head.length && body.length ? [''] : []), ...body].join('\n');
}

/** Where a line's arrow is, and which, scanning left to right; null when it has none. The arrows are `-->>` and
 *  `-->` (reply), `->>` and `->` (call), `~>` and `-)` (async), the longest at a position winning, so `-->>` is not
 *  read as `-->` then `>`. Each position reads at most four characters, so a line of dashes stays cheap. */
function findArrow(
  line: string,
): { at: number; token: string; kind: SequenceMessageKindName } | null {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '~') {
      if (line[i + 1] === '>') return { at: i, token: '~>', kind: 'async' };
      continue;
    }
    if (c !== '-') continue;
    const n = line[i + 1];
    if (n === '>')
      return line[i + 2] === '>'
        ? { at: i, token: '->>', kind: 'call' }
        : { at: i, token: '->', kind: 'call' };
    if (n === ')') return { at: i, token: '-)', kind: 'async' };
    if (n === '-' && line[i + 2] === '>')
      return line[i + 3] === '>'
        ? { at: i, token: '-->>', kind: 'reply' }
        : { at: i, token: '-->', kind: 'reply' };
  }
  return null;
}

export type ParsedSequenceText = {
  participants: SequenceElementParticipant[];
  messages: SequenceElementMessage[];
  // 1-based numbers of the lines that were not read.
  unread: number[];
};

/** The lines read into rows. A participant keeps its id from `known` when its name matches the one `sequenceToText`
 *  writes for it (case-insensitively), so
 *  a round trip leaves its messages its own; a new one takes the next free `p<n>`. Past 12 participants or 60
 *  messages, the lines that would add more are named as unread. */
export function parseSequenceText(
  text: string,
  known: readonly SequenceElementParticipant[] = [],
): ParsedSequenceText {
  const written = writtenNames(known);
  const knownByName = new Map(known.map((p) => [keyOf(written.get(p.id)!), p]));
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
  // The longest participant named so far that `rest` starts with, then `:` or nothing: so a name holding a colon
  // (`DB: Postgres`) is read whole after an arrow. At most 12 names, each compared once.
  const namedAt = (rest: string): { label: string; words: string } | null => {
    const head = rest.trimStart();
    const lower = head.toLowerCase();
    let best: SequenceElementParticipant | null = null;
    for (const p of participants) {
      if (!lower.startsWith(keyOf(p.label))) continue;
      const after = head.slice(p.label.length).trimStart();
      if (after !== '' && !after.startsWith(':')) continue;
      if (!best || p.label.length > best.label.length) best = p;
    }
    if (!best) return null;
    return { label: best.label, words: head.slice(best.label.length).trimStart().slice(1) };
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
    // A Mermaid activation marker (`->>+API`) is not part of the name.
    const rest = line.slice(arrow.at + arrow.token.length).replace(/^\s*[+-]/, '');
    const named = namedAt(rest);
    const colon = named ? -1 : rest.indexOf(':');
    const toName = named ? named.label : colon === -1 ? rest : rest.slice(0, colon);
    const words = named ? named.words : colon === -1 ? '' : rest.slice(colon + 1);
    // Dashes the arrow did not take (`A ---> B`) are a long arrow, not part of the name. Trimmed by a walk back, not a
    // `[\s-]+$` pattern, which backtracks on a long run of them that does not reach the end.
    let fromEnd = arrow.at;
    while (fromEnd > 0 && (line[fromEnd - 1] === '-' || /\s/.test(line[fromEnd - 1]!))) fromEnd--;
    const from = participant(line.slice(0, fromEnd));
    const to = participant(toName);
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
