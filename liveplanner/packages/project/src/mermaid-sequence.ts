// Mermaid sequenceDiagram, read into a sequence (docs/specs/020-import-export/mermaid.md "Sequence text"): participants, messages, activations, notes and fragments, in order, for sequence-layout.ts to draw.
// Pure and linear: one pass over the lines, each matched by anchored, non-backtracking patterns, since the text is
// untrusted (any API token's changeset reaches it).

export type SequenceParticipant = { id: string; label: string; actor?: boolean; icon?: string };
export type SequenceMessageKind = 'call' | 'async' | 'reply';
export type SequenceItem =
  | {
      kind: 'message';
      from: string;
      to: string;
      label: string;
      style: SequenceMessageKind;
      // `+` activates the target, `-` deactivates the sender, as Mermaid's markers.
      activate?: boolean;
      deactivate?: boolean;
    }
  | { kind: 'note'; placement: 'over' | 'left' | 'right'; who: string[]; text: string }
  | { kind: 'activate' | 'deactivate'; who: string }
  | { kind: 'fragment'; op: string; label: string }
  | { kind: 'else'; label: string }
  | { kind: 'end' };
export type SequenceDiagram = {
  title?: string;
  autonumber?: boolean;
  participants: SequenceParticipant[];
  items: SequenceItem[];
};

export const SEQUENCE_MAX_PARTICIPANTS = 30;
export const SEQUENCE_MAX_ITEMS = 300;
// A participant's or note's text past this is cut, as graph labels are capped.
const TEXT_MAX = 200;

const FRAGMENTS = new Set(['loop', 'alt', 'opt', 'par', 'critical', 'break']);
const SECTIONS = new Set(['else', 'and', 'option']);
// The arrows, longest first so `-->>` is not read as `->`.
const ARROWS: readonly [string, SequenceMessageKind][] = [
  ['-->>', 'reply'],
  ['->>', 'call'],
  ['--)', 'async'],
  ['-)', 'async'],
  ['--x', 'reply'],
  ['-x', 'call'],
  ['-->', 'reply'],
  ['->', 'call'],
];

const clip = (t: string) => t.trim().slice(0, TEXT_MAX);

// Each line is read by prefixes and indexOf, never a backtracking pattern, so a long run of spaces in an agent's text
// costs a line's length (CodeQL "polynomial regular expression").

// The text after `word` and a separator (a colon or white space), trimmed; null when the line does not start so.
export function afterWord(line: string, word: string, separators = ': \t'): string | null {
  if (!line.startsWith(word) || line.length === word.length) return null;
  return separators.includes(line[word.length]!) ? line.slice(word.length + 1).trim() : null;
}

// The first white-space-separated word and what follows it, trimmed.
function splitWord(text: string): [string, string] {
  const t = text.trim();
  const at = t.search(/\s/);
  return at < 0 ? [t, ''] : [t.slice(0, at), t.slice(at).trim()];
}

// A participant or actor line: its name, and its alias after "as".
function readDeclared(line: string): { actor: boolean; name: string; alias?: string } | null {
  const [kind, rest] = splitWord(line);
  if ((kind !== 'participant' && kind !== 'actor') || !rest) return null;
  const [name, tail] = splitWord(rest);
  if (!tail) return { actor: kind === 'actor', name };
  const [as, alias] = splitWord(tail);
  return as === 'as' && alias ? { actor: kind === 'actor', name, alias } : null;
}

const NOTE_PLACES = [
  ['over ', 'over'],
  ['left of ', 'left'],
  ['right of ', 'right'],
] as const;

// A note line: where it sits, over whom, and its text.
function readNote(
  line: string,
): { placement: 'over' | 'left' | 'right'; who: string; text: string } | null {
  const lower = line.toLowerCase();
  if (!lower.startsWith('note ')) return null;
  const rest = line.slice(5).trimStart();
  const place = NOTE_PLACES.find(([p]) => rest.toLowerCase().startsWith(p));
  if (!place) return null;
  const after = rest.slice(place[0].length);
  const colon = after.indexOf(':');
  if (colon <= 0) return null;
  const who = after.slice(0, colon).trim();
  return who ? { placement: place[1], who, text: after.slice(colon + 1).trim() } : null;
}

export function isSequenceDiagram(text: string): boolean {
  return /^\s*(?:---[\s\S]*?---\s*)?sequenceDiagram\b/.test(text);
}

export function parseSequenceDiagram(
  text: string,
): { ok: true; diagram: SequenceDiagram } | { ok: false; error: string } {
  const participants: SequenceParticipant[] = [];
  const known = new Map<string, SequenceParticipant>();
  const meet = (id: string, label?: string, actor?: boolean): string => {
    const key = id.trim();
    const had = known.get(key);
    if (had) {
      if (label) had.label = clip(label);
      if (actor) had.actor = true;
      return key;
    }
    const p: SequenceParticipant = {
      id: key,
      label: clip(label ?? key),
      ...(actor ? { actor } : {}),
    };
    known.set(key, p);
    participants.push(p);
    return key;
  };
  const items: SequenceItem[] = [];
  let title: string | undefined;
  let autonumber = false;
  let started = false;
  let inFrontMatter = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line === '---') {
      inFrontMatter = !inFrontMatter;
      continue;
    }
    if (inFrontMatter) {
      const t = afterWord(line, 'title', ':');
      if (t) title = clip(t.replace(/^["']|["']$/g, ''));
      continue;
    }
    if (!started) {
      if (/^sequenceDiagram\b/.test(line)) started = true;
      continue;
    }
    if (line === 'autonumber' || line.startsWith('autonumber ')) {
      autonumber = true;
      continue;
    }
    const titled = afterWord(line, 'title');
    if (titled) {
      title = clip(titled);
      continue;
    }
    const declared = readDeclared(line);
    if (declared) {
      meet(declared.name, declared.alias, declared.actor);
      continue;
    }
    const activation = /^(activate|deactivate)\s+([^\s]+)$/.exec(line);
    if (activation) {
      items.push({ kind: activation[1] as 'activate' | 'deactivate', who: meet(activation[2]!) });
      continue;
    }
    const note = readNote(line);
    if (note) {
      const who = note.who.split(',').map((w) => meet(w));
      items.push({
        kind: 'note',
        placement: note.placement,
        who,
        text: clip(note.text.replace(/<br\s*\/?>/gi, '\n')),
      });
      continue;
    }
    const word = line.split(/\s+/, 1)[0]!.toLowerCase();
    if (word === 'end') {
      items.push({ kind: 'end' });
      continue;
    }
    if (FRAGMENTS.has(word)) {
      items.push({ kind: 'fragment', op: word, label: clip(line.slice(word.length)) });
      continue;
    }
    if (SECTIONS.has(word)) {
      items.push({ kind: 'else', label: clip(line.slice(word.length)) });
      continue;
    }
    // A grouping or styling the drawing does not take: read and skipped.
    if (
      word === 'rect' ||
      word === 'box' ||
      word === 'link' ||
      word === 'links' ||
      word === 'create' ||
      word === 'destroy'
    )
      continue;
    const message = readMessage(line);
    if (message) {
      items.push({
        kind: 'message',
        from: meet(message.from),
        to: meet(message.to),
        label: clip(message.label),
        style: message.style,
        ...(message.activate ? { activate: true } : {}),
        ...(message.deactivate ? { deactivate: true } : {}),
      });
      continue;
    }
    return {
      ok: false,
      error: `line "${line.slice(0, 60)}" is not sequence diagram syntax this reads`,
    };
  }
  if (!started) return { ok: false, error: 'expected a sequenceDiagram header' };
  if (participants.length === 0)
    return { ok: false, error: 'the sequence diagram names no participants' };
  if (participants.length > SEQUENCE_MAX_PARTICIPANTS || items.length > SEQUENCE_MAX_ITEMS)
    return {
      ok: false,
      error: `the sequence diagram is too large: up to ${SEQUENCE_MAX_PARTICIPANTS} participants and ${SEQUENCE_MAX_ITEMS} lines`,
    };
  return {
    ok: true,
    diagram: {
      ...(title ? { title } : {}),
      ...(autonumber ? { autonumber } : {}),
      participants,
      items,
    },
  };
}

// `A->>+B: text`: the first arrow in the line splits it into sender and the rest.
function readMessage(line: string): {
  from: string;
  to: string;
  label: string;
  style: SequenceMessageKind;
  activate: boolean;
  deactivate: boolean;
} | null {
  const colon = line.indexOf(':');
  const head = colon === -1 ? line : line.slice(0, colon);
  const label = colon === -1 ? '' : line.slice(colon + 1);
  let best: { at: number; arrow: string; style: SequenceMessageKind } | null = null;
  for (const [arrow, style] of ARROWS) {
    const at = head.indexOf(arrow);
    if (at > 0 && (!best || at < best.at || (at === best.at && arrow.length > best.arrow.length)))
      best = { at, arrow, style };
  }
  if (!best) return null;
  const from = head.slice(0, best.at).trim();
  let to = head.slice(best.at + best.arrow.length).trim();
  let activate = false;
  let deactivate = false;
  if (to.startsWith('+')) {
    activate = true;
    to = to.slice(1).trim();
  } else if (to.startsWith('-')) {
    deactivate = true;
    to = to.slice(1).trim();
  }
  if (!from || !to || /\s/.test(from) || /\s/.test(to)) return null;
  return { from, to, label, style: best.style, activate, deactivate };
}
