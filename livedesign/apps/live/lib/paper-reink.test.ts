import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livedesign/design';
import {
  REINK_MAX_CHANGED,
  REINK_MAX_SUB,
  inkedOnPaper,
  reinkOnPaper,
  type InkedBoard,
} from './paper-reink';
import { createStockColourProjector, plainPaper } from './stock-colour-projector';

// docs/specs/011-theme/light-and-dark.md "Ink marks on the plain paper stay seen": an edit, a remote one included,
// re-inks only what it changed and what that could sink or lift, and draws what a whole re-ink draws. Blueprint
// docs/specs/011-theme/blueprints/paper-label-ink.md "Re-inking only what an edit changed" (Work Tracker 963).

const PAPER = plainPaper('dark');
const SLATE = '#0f172a';

type Fields = Record<string, unknown>;
const el = (fields: Fields): Element => fields as unknown as Element;
const part = (id: string, x: number, y: number, fillColor = SLATE, over: Fields = {}) =>
  el({ id, type: 'shape', shape: 'rectangle', x, y, width: 80, height: 40, fillColor, ...over });
const glyph = (id: string, x: number, y: number, strokeColor = SLATE) =>
  el({
    id,
    type: 'shape',
    shape: 'icon',
    iconId: 'home',
    x,
    y,
    width: 24,
    height: 24,
    strokeColor,
  });
const words = (id: string, x: number, y: number, textColor = '#334155') =>
  el({ id, type: 'text', x, y, width: 120, height: 24, label: 'Words', textColor });
const card = (id: string, x: number, y: number, fillColor = '#ffffff', over: Fields = {}) =>
  el({ id, type: 'shape', shape: 'rectangle', x, y, width: 600, height: 400, fillColor, ...over });
const moved = (e: Element, dx: number, dy = 0): Element => {
  const b = e as unknown as { x: number; y: number };
  return el({ ...(e as unknown as Fields), x: b.x + dx, y: b.y + dy });
};

/** The run after `stored` (drawn as stored), from `prev`, checked against a whole re-ink. */
function step(prev: InkedBoard | null, stored: readonly Element[]): InkedBoard {
  const run = reinkOnPaper(prev, stored, stored, PAPER);
  expect(run.inked).toEqual(inkedOnPaper(stored, stored, PAPER));
  return run;
}

// A small seeded generator, so a failing board can be replayed.
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILLS = [SLATE, '#1e293b', '#334155', '#ffffff', '#e2e8f0', '#2563eb', '#0b0b0b', '#64748b'];

function randomElement(rnd: () => number, id: string): Element {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)]!;
  const x = Math.floor(rnd() * 1200);
  const y = Math.floor(rnd() * 900);
  const size = () => 16 + Math.floor(rnd() * 500);
  const kind = rnd();
  if (kind < 0.35)
    return el({
      id,
      type: 'shape',
      shape: pick(['rectangle', 'ellipse', 'cycle']),
      x,
      y,
      width: size(),
      height: size(),
      fillColor: pick(FILLS),
      ...(rnd() < 0.2 ? { opacity: 0.5 } : {}),
      ...(rnd() < 0.4 ? { label: 'Go', textColor: pick(FILLS) } : {}),
      ...(rnd() < 0.3 ? { strokeColor: pick(FILLS) } : {}),
    });
  if (kind < 0.5)
    return el({ id, type: 'sticky', x, y, width: size(), height: size(), fillColor: pick(FILLS) });
  if (kind < 0.75) return glyph(id, x, y, pick(FILLS));
  if (kind < 0.95) return words(id, x, y, pick(FILLS));
  return el({ id, type: 'arrow', x, y });
}

function randomEdit(rnd: () => number, board: Element[], next: () => string): Element[] {
  const out = [...board];
  const i = Math.floor(rnd() * out.length);
  const kind = rnd();
  if (kind < 0.35)
    out[i] = moved(out[i]!, Math.floor(rnd() * 400 - 200), Math.floor(rnd() * 300 - 150));
  else if (kind < 0.5)
    out[i] = el({
      ...(out[i] as unknown as Fields),
      fillColor: FILLS[Math.floor(rnd() * FILLS.length)],
    });
  else if (kind < 0.6)
    out[i] = el({ ...(out[i] as unknown as Fields), width: 16 + Math.floor(rnd() * 800) });
  else if (kind < 0.75) out.splice(i, 0, randomElement(rnd, next()));
  else if (kind < 0.9) out.splice(i, 1);
  else if (kind < 0.95) out[i] = el({ ...(out[i] as unknown as Fields), textColor: '#111827' });
  else if (out.length > 1) {
    // A bring to front: the kept elements' paint order moves.
    const [taken] = out.splice(i, 1);
    out.push(taken!);
  }
  return out;
}

describe('reinkOnPaper', () => {
  it('draws what a whole re-ink draws, edit after edit, on random boards', () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const rnd = random(seed);
      let n = 0;
      const next = () => `e${(n += 1)}`;
      let board = Array.from({ length: 60 }, () => randomElement(rnd, next()));
      let run = step(null, board);
      for (let edit = 0; edit < 40; edit += 1) {
        board = randomEdit(rnd, board, next);
        run = step(run, board);
      }
    }
  });

  it('re-inks only the part a remote edit moved, keeping every other walked part’s object', () => {
    const board = [
      ...Array.from({ length: 20 }, (_, i) => part(`p${i}`, i * 200, 0)),
      ...Array.from({ length: 20 }, (_, i) => glyph(`g${i}`, i * 200, 200)),
    ];
    const first = step(null, board);
    const edited = [...board];
    edited[3] = moved(board[3]!, 5);
    const second = step(first, edited);
    second.inked.forEach((out, i) => {
      if (i === 3) expect(out).not.toBe(first.inked[3]);
      else expect(out).toBe(first.inked[i]);
    });
  });

  it('re-inks the label a moved part now sits under, and the label it left', () => {
    // Dark words read on the white button; left straight on the slate paper, they are walked.
    const button = part('button', 0, 0, '#ffffff', { width: 200, height: 80 });
    const label = words('w', 40, 28, SLATE);
    const far = words('far', 2000, 0, '#0f172a');
    const first = step(null, [button, label, far]);
    const away = step(first, [moved(button, 1000), label, far]);
    expect(first.inked[1]).toBe(label);
    expect(away.inked[1]).not.toBe(label);
    expect(away.inked[2]).toBe(first.inked[2]);
    expect(step(away, [button, label, far]).inked[1]).toBe(label);
  });

  it('reads a label against a card a moved card now carries it onto', () => {
    // Chain: the moved card holds the dark card's centre, so the dark card's walked fill, and the words on it, change.
    const back = card('back', 0, 0, '#ffffff', { width: 2000, height: 2000 });
    const dark = card('dark', 1200, 1200, SLATE, { width: 200, height: 100 });
    const label = words('w', 1240, 1238, '#ffffff');
    const first = step(null, [back, dark, label]);
    step(first, [moved(back, 3000), dark, label]);
  });

  it('re-inks an element whose drawn object alone changed', () => {
    const a = part('a', 0, 0);
    const first = reinkOnPaper(null, [a], [a], PAPER);
    const drawn = part('a', 0, 0, '#1e293b');
    const second = reinkOnPaper(first, [a], [drawn], PAPER);
    expect(second.inked).toEqual(inkedOnPaper([a], [drawn], PAPER));
    expect(second.inked[0]).not.toBe(first.inked[0]);
  });

  it('hands back the drawn board when nothing is walked', () => {
    const light = [part('a', 0, 0, '#e2e8f0'), words('w', 300, 0, '#e2e8f0')];
    const first = reinkOnPaper(null, light, light, PAPER);
    expect(first.inked).toBe(light);
    const next = [light[0]!, moved(light[1]!, 10)];
    expect(reinkOnPaper(first, next, next, PAPER).inked).toBe(next);
  });

  it('keeps every object when the board is handed in again unchanged', () => {
    const board = [part('a', 0, 0), glyph('g', 300, 0)];
    const first = step(null, board);
    const again = step(first, [...board]);
    expect(again.inked[0]).toBe(first.inked[0]);
    expect(again.inked[1]).toBe(first.inked[1]);
  });

  it('re-inks the whole board on another paper, a repeated id or past its limits', () => {
    const board = Array.from({ length: REINK_MAX_CHANGED + 2 }, (_, i) =>
      part(`p${i}`, i * 100, 0),
    );
    const first = step(null, board);
    // Another paper.
    const light = reinkOnPaper(first, board, board, { stored: '#ffffff', drawn: '#ffffff' });
    expect(light.inked).toBe(board);
    // A repeated id.
    const twice = [...board, board[0]!];
    expect(reinkOnPaper(first, twice, twice, PAPER).inked).toEqual(
      inkedOnPaper(twice, twice, PAPER),
    );
    // Too many changed, or too many gone.
    step(
      first,
      board.map((p) => moved(p, 1)),
    );
    step(first, [board[0]!]);
    // A part gone and a new one, under the limit.
    step(first, [...board.slice(1), part('new', 0, 500)]);
  });

  it('re-inks the whole board when a moved panel touches more than the sub-board holds', () => {
    const many = Array.from({ length: REINK_MAX_SUB + 10 }, (_, i) =>
      glyph(`g${i}`, (i % 40) * 30, Math.floor(i / 40) * 30),
    );
    const back = card('back', 5000, 5000, '#ffffff', { width: 2000, height: 2000 });
    const board = [back, ...many];
    const first = step(null, board);
    step(first, [moved(back, -5000, -5000), ...many]);
  });

  it('re-inks the whole board when the supports behind a part pass the limit', () => {
    // Nested panels, each holding the next one's centre: the moved word needs every one of them.
    const nest = Array.from({ length: REINK_MAX_SUB + 10 }, (_, i) =>
      el({
        id: `n${i}`,
        type: 'shape',
        shape: 'rectangle',
        x: i,
        y: i,
        width: 4000 - 2 * i,
        height: 4000 - 2 * i,
        fillColor: i % 2 ? '#ffffff' : SLATE,
      }),
    );
    const w = words('w', 1980, 1990, SLATE);
    const first = step(null, [...nest, w]);
    step(first, [...nest, moved(w, 1)]);
  });

  it('re-inks a 4,000-part board after one remote edit within a frame', () => {
    const board: Element[] = [];
    for (let c = 0; c < 40; c += 1)
      board.push(
        card(`card${c}`, (c % 8) * 2000, Math.floor(c / 8) * 2000, '#ffffff', {
          width: 1800,
          height: 1800,
        }),
        words(`w${c}`, (c % 8) * 2000 + 20, Math.floor(c / 8) * 2000 + 20),
      );
    for (let i = 0; i < 4000; i += 1) {
      const x = (i % 80) * 200;
      const y = 12000 + Math.floor(i / 80) * 60;
      board.push(
        i % 2
          ? glyph(`g${i}`, x, y)
          : part(`p${i}`, x, y, SLATE, i % 4 ? {} : { label: 'Go', textColor: '#ffffff' }),
      );
    }
    let run = reinkOnPaper(null, board, board, PAPER);
    let current = board;
    const spent: number[] = [];
    for (let r = 0; r < 9; r += 1) {
      const edited = [...current];
      const i = 100 + r * 37;
      edited[i] = moved(edited[i]!, 5);
      current = edited;
      spent.push(cpuMsOf(() => (run = reinkOnPaper(run, edited, edited, PAPER))));
    }
    expect(run.inked).toEqual(inkedOnPaper(current, current, PAPER));
    spent.sort((a, b) => a - b);
    // Measured 0.5 to 0.6 ms (median of 40 edits) here, against 10 ms for a whole re-ink of the same board: 16 ms at a
    // 4x CPU throttle is 4 ms here.
    expect(spent[4]!).toBeLessThan(cpuBudgetMs(4));
  });
});

describe('the projector after a remote edit', () => {
  it('draws what a fresh projector draws, keeping the untouched parts’ objects', () => {
    const board = [
      card('c', 0, 0, '#ffffff', { width: 400, height: 300 }),
      words('w', 20, 20),
      ...Array.from({ length: 12 }, (_, i) => part(`p${i}`, 600 + i * 100, 0)),
      ...Array.from({ length: 12 }, (_, i) => glyph(`g${i}`, 600 + i * 100, 200)),
    ];
    const project = createStockColourProjector();
    const first = project(board, 'dark', undefined, PAPER);
    const edited = [...board];
    edited[5] = moved(board[5]!, 7);
    const second = project(edited, 'dark', undefined, PAPER);
    expect(second).toEqual(createStockColourProjector()(edited, 'dark', undefined, PAPER));
    second.forEach((out, i) => {
      if (i !== 5) expect(out).toBe(first[i]);
    });
    // A light board after it reads nothing off the paper, and a dark one after that re-inks whole.
    const lightPaper = plainPaper('light');
    expect(project(edited, 'light', undefined, lightPaper)).toBe(edited);
    expect(project(board, 'dark', undefined, PAPER)).toEqual(first);
  });
});
