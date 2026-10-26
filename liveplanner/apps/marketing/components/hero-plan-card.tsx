import { capBandBaselineY } from '@liveworkspace/icons';
import { FONT } from '@/components/art-tokens';

// One Plan card face as the hero's Plan window draws it (hero-plan-board.tsx), after the board's
// Detailed face (docs/specs/026-plan/plan-board.md "Card shows"): a header of the type chip (its
// glyph and name on a tint of its colour), the number, and the priority as signal bars; the title;
// then a footer of label chips and pills (due date, checklist progress) with the assignee's avatar
// at the end. A narrow (phone) card keeps the header, the title, one label and the avatar.

// Item types (docs/specs/026-plan/item-types.md): Task, Bug, Idea, each in its colour.
export const TYPE = {
  task: { name: 'Task', colour: '#0ea5e9' },
  bug: { name: 'Bug', colour: '#ef4444' },
  idea: { name: 'Idea', colour: '#f59e0b' },
} as const;
export type TypeKey = keyof typeof TYPE;

export type Person = { initials: string; colour: string };

// Labels keep their colour everywhere: a tint behind, the colour's ink on it.
const LABEL: Record<string, { fill: string; ink: string; dark: string }> = {
  web: { fill: 'fill-sky-100', ink: 'fill-sky-700', dark: 'dark:fill-sky-500/20' },
  docs: { fill: 'fill-violet-100', ink: 'fill-violet-700', dark: 'dark:fill-violet-500/20' },
  growth: { fill: 'fill-emerald-100', ink: 'fill-emerald-700', dark: 'dark:fill-emerald-500/20' },
  design: { fill: 'fill-pink-100', ink: 'fill-pink-700', dark: 'dark:fill-pink-500/20' },
  press: { fill: 'fill-amber-100', ink: 'fill-amber-800', dark: 'dark:fill-amber-500/20' },
};
export type LabelKey = keyof typeof LABEL;

// Low one bar, Medium two, High three, Urgent three in its red.
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
const BARS: Record<Priority, number> = { low: 1, medium: 2, high: 3, urgent: 3 };

export type CardDef = {
  title: string;
  type: TypeKey;
  n: number;
  who: Person;
  priority: Priority;
  label?: LabelKey;
  due?: { text: string; soon?: boolean };
  checklist?: { done: number; of: number };
};

export const CARD_H = 70;

export function Avatar({ x, y, who, r = 7 }: { x: number; y: number; who: Person; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 1.2} className="fill-white dark:fill-slate-800" />
      <circle cx={x} cy={y} r={r} fill={who.colour} />
      <text
        x={x}
        // The initials centre on their cap band (optical-alignment.md "SVG text centres on its cap band too").
        y={capBandBaselineY(y, r * 0.9)}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={r * 0.9}
        fontWeight="700"
        fill="white"
      >
        {who.initials}
      </text>
    </g>
  );
}

// The type's glyph, drawn small in its colour: a ticked circle, a bug, a bulb.
function TypeGlyph({ type, x, y }: { type: TypeKey; x: number; y: number }) {
  const c = TYPE[type].colour;
  const line = { fill: 'none', stroke: c, strokeWidth: 1.1, strokeLinecap: 'round' } as const;
  if (type === 'bug')
    return (
      <g {...line}>
        <rect x={x - 2} y={y - 2.4} width="4" height="5.4" rx="2" />
        <path
          d={`M${x - 3.6} ${y - 1}h1.6M${x + 2} ${y - 1}h1.6M${x - 3.6} ${y + 1.6}h1.6M${x + 2} ${y + 1.6}h1.6`}
        />
      </g>
    );
  if (type === 'idea')
    return (
      <g {...line}>
        <path d={`M${x - 1.3} ${y + 1.8}a2.7 2.7 0 1 1 2.6 0v0.9h-2.6z`} />
        <path d={`M${x - 1} ${y + 3.6}h2`} />
      </g>
    );
  return (
    <g {...line}>
      <circle cx={x} cy={y} r="2.9" />
      <path d={`M${x - 1.3} ${y}l0.9 0.9 1.7-1.8`} />
    </g>
  );
}

function SignalBars({ x, y, level }: { x: number; y: number; level: Priority }) {
  const on = BARS[level];
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={x + i * 3}
          y={y - 2.5 - i * 1.6}
          width="2"
          height={2.5 + i * 1.6}
          rx="0.5"
          className={
            i >= on
              ? 'fill-slate-200 dark:fill-slate-700'
              : level === 'urgent'
                ? 'fill-red-500'
                : 'fill-slate-500 dark:fill-slate-400'
          }
        />
      ))}
    </g>
  );
}

// A chip of text on a rounded tint; returns its width so the next can follow it.
function chipWidth(text: string, size: number) {
  return text.length * size * 0.56 + 8;
}

function Chip({
  x,
  y,
  text,
  fill,
  ink,
  size,
}: {
  x: number;
  y: number;
  text: string;
  fill: string;
  ink: string;
  size: number;
}) {
  return (
    <g>
      <rect x={x} y={y - 6.5} width={chipWidth(text, size)} height="13" rx="3.5" className={fill} />
      <text
        x={x + 4}
        y={y + size * 0.36}
        fontFamily={FONT}
        fontSize={size}
        fontWeight="600"
        className={ink}
      >
        {text}
      </text>
    </g>
  );
}

// The card's title and footer, without its body: also used for the quick-added card, whose
// footer lands a beat after its title.
export function CardFace({
  card,
  x,
  y,
  w,
  narrow = false,
}: {
  card: CardDef;
  x: number;
  y: number;
  w: number;
  narrow?: boolean;
}) {
  const t = TYPE[card.type];
  const meta = 7.6;
  const typeW = chipWidth(t.name, meta) + 8;
  const key = `#${card.n}`;
  const footY = y + CARD_H - 14;
  let fx = x + 8;
  const pills: { text: string; fill: string; ink: string }[] = [];
  if (card.label) {
    const l = LABEL[card.label]!;
    pills.push({
      text: card.label,
      fill: `${l.fill} ${l.dark}`,
      ink: `${l.ink} dark:fill-slate-100`,
    });
  }
  if (!narrow && card.due)
    pills.push({
      text: `Due ${card.due.text}`,
      fill: card.due.soon
        ? 'fill-amber-50 dark:fill-amber-500/15'
        : 'fill-slate-100 dark:fill-slate-700/60',
      ink: card.due.soon
        ? 'fill-amber-700 dark:fill-amber-300'
        : 'fill-slate-500 dark:fill-slate-300',
    });
  if (!narrow && card.checklist) {
    const full = card.checklist.done === card.checklist.of;
    pills.push({
      text: `✓ ${card.checklist.done}/${card.checklist.of}`,
      fill: full
        ? 'fill-emerald-50 dark:fill-emerald-500/15'
        : 'fill-slate-100 dark:fill-slate-700/60',
      ink: full ? 'fill-emerald-700 dark:fill-emerald-300' : 'fill-slate-500 dark:fill-slate-300',
    });
  }
  return (
    <g>
      {/* The card: a soft shadow under a white face with a hairline edge. */}
      <rect x={x} y={y + 1.5} width={w} height={CARD_H} rx="7" fill="#0f172a" opacity="0.07" />
      <rect
        x={x}
        y={y}
        width={w}
        height={CARD_H}
        rx="7"
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        strokeWidth="0.8"
      />
      {/* Header: the type chip, the number, the priority. */}
      <rect x={x + 8} y={y + 7} width={typeW} height="13" rx="3.5" fill={t.colour} opacity="0.13" />
      <TypeGlyph type={card.type} x={x + 14} y={y + 13.5} />
      <text
        x={x + 19.5}
        y={y + 16.3}
        fontFamily={FONT}
        fontSize={meta}
        fontWeight="600"
        className="fill-slate-600 dark:fill-slate-300"
      >
        {t.name}
      </text>
      <rect
        x={x + 11 + typeW}
        y={y + 7}
        width={chipWidth(key, meta)}
        height="13"
        rx="3.5"
        className="fill-slate-600 dark:fill-slate-500"
      />
      <text
        x={x + 15 + typeW}
        y={y + 16.3}
        fontFamily={FONT}
        fontSize={meta}
        fontWeight="700"
        fill="white"
      >
        {key}
      </text>
      <SignalBars x={x + w - 17} y={y + 18} level={card.priority} />
      <text
        x={x + 8}
        y={y + 37}
        fontFamily={FONT}
        fontSize={narrow ? 10 : 11.5}
        fontWeight="700"
        className="fill-(--art-text) dark:fill-slate-100"
      >
        {card.title}
      </text>
      {/* Footer: labels and pills, the assignee at the end. */}
      {pills.map((p) => {
        const cx = fx;
        fx += chipWidth(p.text, meta) + 4;
        return (
          <Chip key={p.text} x={cx} y={footY} text={p.text} fill={p.fill} ink={p.ink} size={meta} />
        );
      })}
      <Avatar x={x + w - 14} y={footY} who={card.who} r={7.5} />
    </g>
  );
}

// A column head's sliders, the cog that opens the column's own settings.
export function Sliders({ x, y }: { x: number; y: number }) {
  return (
    <g
      className="stroke-slate-400 dark:stroke-slate-500"
      strokeWidth="1"
      strokeLinecap="round"
      fill="none"
    >
      <path d={`M${x} ${y - 3}h8M${x} ${y}h8M${x} ${y + 3}h8`} />
      <circle cx={x + 5.5} cy={y - 3} r="1.2" className="fill-white dark:fill-slate-800" />
      <circle cx={x + 2.5} cy={y} r="1.2" className="fill-white dark:fill-slate-800" />
      <circle cx={x + 6} cy={y + 3} r="1.2" className="fill-white dark:fill-slate-800" />
    </g>
  );
}
