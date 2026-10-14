// A sequence diagram drawn the way the sequence diagram template draws one (docs/specs/020-import-export/mermaid.md
// "Sequence diagrams (agents)"): participants in a row of headed boxes over dashed lifelines, a row per message from
// activation bar to activation bar, self-calls looping out and back, notes as stickies, fragments as frames across
// every lifeline. Pure: a parsed sequence in, elements out.

import { createArrow, createShape, createSticky, createText } from './factories';
import { glyphWidth } from './graph-authoring';
import { arrowLabelFontSize } from './arrow-label';
import { wrapBalanced } from './arrow-label-wrap';
import { LABEL_LINE_HEIGHT, labelMeasure } from './svg-render-primitives';
import { GRAPH_MUTED, withHeaderAndKey } from './graph-header';
import type { SequenceDiagram, SequenceItem, SequenceMessageKind } from './mermaid-sequence';
import type { ArrowheadShape, Element } from './index';

// The template's geometry: head box, activation bar, row pitches, self-call loop, note and fragment bands.
const HEAD_H = 60;
const HEAD_MIN_W = 160;
const PITCH_MIN = 220;
const BAR = 14;
const STEP = 52;
const SELF_DROP = 40;
const SELF_LOOP = 56;
const FRAGMENT_BAND = 40;
// How far a guard sits right of its fragment's first lifeline and bar.
const GUARD_GAP = 10;
// How far a fragment nested in another, on the same first lifeline, sits inside it on each side.
const FRAGMENT_INSET = 12;
const DIVIDER_BAND = 36;
const FRAGMENT_END = 24;
const NOTE_LINE = 18;
const LABEL_PX = 14;
// The widest a lifeline gap grows for its labels, the room a message label leaves either end of its gap, and how far
// a label keeps off its line.
const PITCH_MAX = 520;
const MESSAGE_LABEL_MARGIN = 40;
const MESSAGE_LABEL_GAP = 4.5;
const HEAD_PX = 22;
const ACTOR_W = 44;
const ACTOR_H = 60;

const HEAD: Readonly<Record<SequenceMessageKind, ArrowheadShape>> = {
  call: 'triangle',
  async: 'line',
  reply: 'line',
};

type Bar = { who: string; depth: number; y0: number; y1: number };

let nextId = 0;
const freshId = (base: string, makeId?: () => string) =>
  makeId ? makeId() : `${base}-${(nextId++).toString(36)}`;

export function layoutSequence(
  diagram: SequenceDiagram,
  opts: { subtitle?: string; makeId?: () => string } = {},
): Element[] {
  const { participants, items } = diagram;
  const index = new Map(participants.map((p, i) => [p.id, i]));
  const longestHead = Math.max(0, ...participants.map((p) => glyphWidth(p.label, HEAD_PX)));
  const headW = Math.round(Math.max(HEAD_MIN_W, longestHead + 48));
  // The pitch: the head box, or the longest message label in one gap, as a message keeps its label in its first gap
  // (spread over the whole span, a long label wrapped narrow in that first gap and its plate cut its own line).
  let pitch = Math.max(PITCH_MIN, headW + 40);
  for (const it of items) {
    if (it.kind !== 'message' || it.from === it.to) continue;
    pitch = Math.max(pitch, Math.ceil(glyphWidth(it.label, LABEL_PX) + 60));
  }
  pitch = Math.round(Math.min(pitch, PITCH_MAX));
  // A message label wraps to its gap, and sits clear above (or below) its line however many lines it takes.
  const labelWidth = pitch - MESSAGE_LABEL_MARGIN;
  const measure = labelMeasure(arrowLabelFontSize(undefined), false, false);
  const lift = (label: string) => {
    const lines = wrapBalanced(label, labelWidth, measure).lines.length;
    const fontPx = arrowLabelFontSize(undefined);
    return (lines * fontPx * LABEL_LINE_HEIGHT + 4) / 2 + MESSAGE_LABEL_GAP;
  };
  const px = (id: string) => index.get(id)! * pitch + headW / 2;
  const out: Element[] = [];
  const headTop = 0;
  const lifeTop = headTop + HEAD_H;

  // Rows: walk the items, giving each its y, and track activations.
  let y = lifeTop + 48;
  let number = 0;
  const open = new Map<string, Bar[]>();
  const bars: Bar[] = [];
  const lastRow = new Map<string, number>();
  const depthOf = (who: string) => open.get(who)?.length ?? 0;
  const activate = (who: string, at: number) => {
    const stack = open.get(who) ?? open.set(who, []).get(who)!;
    stack.push({ who, depth: stack.length, y0: at - 6, y1: at + 6 });
  };
  const deactivate = (who: string, at: number) => {
    const stack = open.get(who);
    const bar = stack?.pop();
    if (bar) bars.push({ ...bar, y1: Math.max(bar.y1, at + 6) });
  };
  // A plain call activates its callee only when a reply comes back to the caller later (before the caller calls
  // that callee again): then the bar runs from the call to that reply. A call nothing answers opens no bar, as Mermaid
  // draws one only when told (`+`, `activate`).
  const answered = new Set<number>();
  items.forEach((it, i) => {
    if (it.kind !== 'message' || it.style !== 'call' || it.from === it.to) return;
    for (let j = i + 1; j < items.length; j++) {
      const later = items[j]!;
      if (later.kind !== 'message') continue;
      if (later.from === it.from && later.to === it.to && later.style === 'call') return;
      if (later.from === it.to && later.to === it.from && later.style === 'reply') {
        answered.add(i);
        return;
      }
    }
  });
  // A diagram that activates anything itself (`activate`, `+`, `-`) draws its bars as told, as Mermaid does: answered
  // calls add none of their own, which would stack a second bar on each the author drew.
  const explicit = items.some(
    (it) =>
      it.kind === 'activate' ||
      it.kind === 'deactivate' ||
      (it.kind === 'message' && (!!it.activate || !!it.deactivate)),
  );
  // The calls still waiting on a reply, so a reply ends the activation its call began.
  const waiting: { caller: string; callee: string; auto: boolean }[] = [];
  const messages: {
    item: Extract<SequenceItem, { kind: 'message' }>;
    y: number;
    fromX: number;
    toX: number;
    // Whether it runs to the right, for re-placing its end on a bar an `activate` line starts.
    right: boolean;
  }[] = [];
  // Each fragment's participants: those its messages and notes touch, so its frame spans their lifelines alone.
  const fragments: {
    op: string;
    label: string;
    top: number;
    dividers: { y: number; label: string }[];
    who: Set<string>;
  }[] = [];
  const closed: {
    op: string;
    label: string;
    top: number;
    bottom: number;
    dividers: { y: number; label: string }[];
    who: Set<string>;
  }[] = [];
  const involve = (...who: string[]) => {
    for (const f of fragments) for (const w of who) f.who.add(w);
  };
  const notes: { item: Extract<SequenceItem, { kind: 'note' }>; y: number; h: number }[] = [];
  // Where a message meets a lifeline: the near edge of its outermost open bar, or the lifeline itself.
  const edge = (who: string, towardRight: boolean) => {
    const d = depthOf(who);
    if (d === 0) return px(who);
    return px(who) + ((d - 1) * BAR) / 2 + (towardRight ? -BAR / 2 : BAR / 2);
  };

  // The row of the last message: an `activate` or `deactivate` line acts at it, as Mermaid starts a bar at the call
  // that precedes the line, not a row later.
  let messageY: number | undefined;
  for (const [i, it] of items.entries()) {
    if (it.kind === 'message') {
      const label = diagram.autonumber ? `${++number}: ${it.label}` : it.label;
      const self = it.from === it.to;
      // A plain call to another participant that is answered activates it until the answer.
      const auto =
        !explicit &&
        !self &&
        it.style === 'call' &&
        !it.activate &&
        !it.deactivate &&
        answered.has(i);
      if (it.style === 'reply' && !it.deactivate) {
        const w = [...waiting].reverse().find((c) => c.callee === it.from && c.caller === it.to);
        if (w) {
          waiting.splice(waiting.lastIndexOf(w), 1);
          if (w.auto) deactivate(it.from, y);
        }
      }
      const right = index.get(it.to)! >= index.get(it.from)!;
      if (it.activate || auto) activate(it.to, y);
      const fromX = edge(it.from, !right);
      const toX = self ? fromX : edge(it.to, right);
      if (it.deactivate) deactivate(it.from, y);
      if (!self && it.style === 'call')
        // Only an activation the layout opened itself closes at the reply; one the author opened (`+`) stays open
        // until its `-`, as Mermaid draws it.
        waiting.push({ caller: it.from, callee: it.to, auto });
      messages.push({ item: { ...it, label }, y, fromX, toX, right });
      if (self) {
        activate(it.from, y + SELF_DROP);
        deactivate(it.from, y + SELF_DROP + 20);
      }
      for (const who of [it.from, it.to]) lastRow.set(who, y);
      messageY = y;
      involve(it.from, it.to);
      y += self ? SELF_DROP + 36 : STEP;
    } else if (it.kind === 'activate') {
      activate(it.who, messageY ?? y - STEP / 2);
      // The message this line follows, into the participant it activates, ends on the bar it starts: its end was
      // worked out before the bar existed, on the lifeline inside it.
      const last = messages.at(-1);
      if (last && last.y === messageY && last.item.to === it.who && last.item.from !== it.who)
        last.toX = edge(it.who, last.right);
    } else if (it.kind === 'deactivate') deactivate(it.who, messageY ?? y - STEP / 2);
    else if (it.kind === 'note') {
      const width = noteWidth(it, pitch, headW);
      const lines = Math.max(1, Math.ceil(glyphWidth(it.text, 13) / Math.max(40, width - 28)));
      const h = lines * NOTE_LINE + 30;
      notes.push({ item: it, y: y - 14, h });
      involve(...it.who);
      y += h + 16;
    } else if (it.kind === 'fragment') {
      fragments.push({ op: it.op, label: it.label, top: y - 22, dividers: [], who: new Set() });
      y += FRAGMENT_BAND;
    } else if (it.kind === 'else') {
      const frag = fragments.at(-1);
      if (frag) frag.dividers.push({ y: y - 18, label: it.label });
      y += DIVIDER_BAND;
    } else if (it.kind === 'end') {
      const frag = fragments.pop();
      if (frag) closed.push({ ...frag, bottom: y - STEP / 2 + 18 });
      y += FRAGMENT_END;
    }
  }
  // Activations never closed end after their participant's last message.
  for (const [who, stack] of open) while (stack.length) deactivate(who, lastRow.get(who) ?? y);
  for (const frag of fragments) closed.push({ ...frag, bottom: y });
  const lifeBottom = y + 24;

  // Participants and lifelines.
  for (const p of participants) {
    const x = px(p.id);
    if (p.actor) {
      out.push(
        {
          ...createShape('actor', x - ACTOR_W / 2, headTop + HEAD_H - 24 - ACTOR_H),
          id: freshId(`actor-${p.id}`, opts.makeId),
          width: ACTOR_W,
          height: ACTOR_H,
          label: '',
        },
        {
          ...createText(x - headW / 2, headTop + HEAD_H - 24),
          id: p.id,
          width: headW,
          height: 24,
          label: p.label,
          textSize: 'md',
          textBold: true,
        },
      );
    } else {
      out.push({
        ...createShape('square', x - headW / 2, headTop),
        id: p.id,
        width: headW,
        height: HEAD_H,
        label: p.label,
        textSize: 'md',
        textBold: true,
        ...(p.icon ? { iconId: p.icon, iconPosition: 'left' as const } : {}),
      });
    }
    out.push({
      ...createArrow(x, lifeTop, x, lifeBottom),
      id: freshId(`life-${p.id}`, opts.makeId),
      arrowEnds: 'none',
      strokeStyle: 'dashed',
      // A lifeline runs under the bars and notes on it, whole: the bar covers it where it is busy.
      routeBehind: false,
    });
  }

  // Fragments behind everything that happens in them, across the lifelines of the participants they involve (every
  // lifeline when they involve none), nested ones a step inside those they sit in.
  const columns = (f: { who: Set<string> }): [number, number] => {
    const cols = [...f.who].flatMap((w) => (index.has(w) ? [index.get(w)!] : []));
    return cols.length ? [Math.min(...cols), Math.max(...cols)] : [0, participants.length - 1];
  };
  for (const f of closed) {
    const [first, last] = columns(f);
    const depth = closed.filter(
      (o) => o !== f && o.top < f.top && o.bottom > f.bottom && columns(o)[0] === first,
    ).length;
    const left = first * pitch - 40 + depth * FRAGMENT_INSET;
    const rightEdge = last * pitch + headW + 40 - depth * FRAGMENT_INSET;
    out.push({
      ...createShape('frame', left, f.top),
      id: freshId('fragment', opts.makeId),
      width: rightEdge - left,
      height: f.bottom - f.top,
      label: f.op,
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
    });
    // A guard reads in the gap right of the fragment's first lifeline and its bar, never across a lifeline.
    const guardX = Math.max(left + 64, px(participants[first]!.id) + BAR + GUARD_GAP);
    if (f.label) out.push(guard(guardX, f.top + 6, f.label, opts.makeId));
    for (const d of f.dividers) {
      out.push({
        ...createArrow(left + 12, d.y, rightEdge - 12, d.y),
        id: freshId('divider', opts.makeId),
        arrowEnds: 'none',
        strokeStyle: 'dashed',
        routeBehind: false,
      });
      if (d.label) out.push(guard(guardX, d.y + 4, d.label, opts.makeId));
    }
  }

  // Activation bars, then the messages over them.
  for (const b of bars)
    out.push({
      ...createShape('square', px(b.who) - BAR / 2 + (b.depth * BAR) / 2, b.y0),
      id: freshId(`bar-${b.who}`, opts.makeId),
      width: BAR,
      height: Math.max(12, b.y1 - b.y0),
      label: '',
      borderRadius: 'none',
    });
  for (const m of messages) {
    const style = m.item.style;
    if (m.item.from === m.item.to) {
      const sx = m.fromX + BAR / 2;
      out.push({
        ...createArrow(sx, m.y, sx + BAR / 2, m.y + SELF_DROP),
        id: freshId('self', opts.makeId),
        routeBehind: false,
        arrowStyle: 'angled',
        curvePoints: [
          { dx: SELF_LOOP - BAR / 4, dy: -SELF_DROP / 2 },
          { dx: SELF_LOOP - BAR / 4, dy: SELF_DROP / 2 },
        ],
        ...(m.item.label
          ? { label: m.item.label, labelOffset: { t: 0.5, offset: -SELF_LOOP - 20 } }
          : {}),
        arrowheadShape: HEAD[style],
        ...(style === 'reply' ? { strokeStyle: 'dashed' as const } : {}),
      });
      continue;
    }
    const right = m.toX > m.fromX;
    // A message over several lifelines keeps its label in the first gap, off the lifelines it passes.
    const span = Math.abs(index.get(m.item.to)! - index.get(m.item.from)!);
    const t = span > 1 ? 0.5 / span : 0.5;
    out.push({
      ...createArrow(m.fromX, m.y, m.toX, m.y),
      id: freshId('message', opts.makeId),
      // A message is drawn over the bars and lifelines it passes, as UML draws it.
      routeBehind: false,
      ...(m.item.label
        ? {
            label: m.item.label,
            labelOffset: { t, offset: (right ? -1 : 1) * lift(m.item.label) },
            labelMaxWidth: labelWidth,
          }
        : {}),
      arrowheadShape: HEAD[style],
      ...(style === 'reply' ? { strokeStyle: 'dashed' as const } : {}),
    });
  }

  // Notes as stickies, over or beside their participants.
  for (const n of notes) {
    const width = noteWidth(n.item, pitch, headW);
    const xs = n.item.who.map(px);
    const x =
      n.item.placement === 'over'
        ? (Math.min(...xs) + Math.max(...xs)) / 2 - width / 2
        : n.item.placement === 'right'
          ? xs[0]! + 24
          : xs[0]! - 24 - width;
    out.push({
      ...createSticky(x, n.y),
      id: freshId('note', opts.makeId),
      width,
      height: n.h,
      label: n.item.text,
      textSize: 'sm',
      // Centred in a note sized to its text: top-left in a taller box it read as unfinished.
      textAlignX: 'center',
      textAlignY: 'middle',
    });
  }

  return withHeaderAndKey(out, {
    ...(diagram.title ? { title: diagram.title } : {}),
    ...(opts.subtitle ? { subtitle: opts.subtitle } : {}),
    ...(opts.makeId ? { makeId: opts.makeId } : {}),
  });
}

function noteWidth(
  note: Extract<SequenceItem, { kind: 'note' }>,
  pitch: number,
  headW: number,
): number {
  if (note.placement === 'over' && note.who.length > 1) return pitch * 0.8 + headW;
  return Math.max(160, Math.min(pitch - 48, glyphWidth(note.text, 13) + 28));
}

function guard(x: number, y: number, label: string, makeId?: () => string): Element {
  const text = label.startsWith('[') ? label : `[${label}]`;
  return {
    ...createText(x, y),
    id: freshId('guard', makeId),
    width: Math.max(120, glyphWidth(text, 14) + 16),
    height: 26,
    label: text,
    textSize: 'sm',
    textColor: GRAPH_MUTED,
    textAlignX: 'left',
  };
}
