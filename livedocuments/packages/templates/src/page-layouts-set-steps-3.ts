// Steps and Time layouts, part 3 (docs/specs/007-editor/pages-mode.md "Layouts"): a project
// plan (a Gantt chart) and a decision flow. Same contract as page-layouts.ts: the page's content
// box in, uncoloured elements out, a tall page stacking and a wide one setting side by side.
import { createPinnedArrow, type Element, type ShapeElement } from '@livedocuments/document';
import { heading, type Kit } from './page-layout-kit';
import { rule } from './page-layouts-set-steps-2';

const WEEKS = ['5 Oct', '12 Oct', '19 Oct', '26 Oct', '2 Nov', '9 Nov'] as const;
// Each workstream: its name, its owner, the weeks it starts and ends (0 the plan's first day,
// 6 its last) and how much of it is done.
const TASKS = [
  ['Research', 'Priya', 0, 2, 100],
  ['Design', 'Leo', 1, 3.5, 80],
  ['Build', 'Sam', 2, 5.5, 45],
  ['Content', 'Ana', 3, 5, 30],
  ['Testing', 'Kit', 4.5, 6, 0],
] as const;
// Where today falls, in weeks from the start.
const TODAY = 2.5;
const DONE = Math.round(TASKS.reduce((sum, t) => sum + t[4], 0) / TASKS.length);

// Not clearly taller than wide (a square too), the summary sits beside the chart; taller, under it.
const PLAN_BESIDE_FROM = 0.9;

export function projectPlan(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const beside = W >= H * PLAN_BESIDE_FROM;
  const head = beside
    ? heading(k, 'Website relaunch plan')
    : heading(k, 'Website relaunch plan', 'Six weeks from kick-off to launch day.');
  // Wide: a summary column at the right. Tall: a stat row under the chart.
  const sideW = beside ? W * 0.2 : 0;
  const gridW = beside ? W - sideW - u * 7 : W;
  const statH = u * 18;
  const nameW = gridW * (beside ? 0.24 : 0.25);
  const weekW = (gridW - nameW) / WEEKS.length;
  const atWeek = (w: number) => nameW + w * weekW;
  const headerH = u * 12;
  const rowsTop = head.top + headerH + u * 2;
  const todayH = u * 6;
  const rowsBottom = H - todayH - u * 3 - (beside ? 0 : statH + u * 6);
  const rows = TASKS.length + 1;
  const rowH = (rowsBottom - rowsTop) / rows;
  const hair = Math.max(1, u * 0.25);
  const els: Element[] = [...head.els];
  // The weeks across the top, a faint line at each week's start.
  WEEKS.forEach((date, i) => {
    const x = atWeek(i);
    els.push(
      k.text(x + u * 1.5, head.top, weekW - u * 2, u * 6, `Wk ${i + 1}`, { textBold: true }),
      k.text(x + u * 1.5, head.top + u * 6, weekW - u * 2, u * 6, date),
      rule(k, x, head.top, hair, rowsBottom - head.top),
    );
  });
  els.push(rule(k, 0, rowsTop - u, gridW, hair));
  const nameH = Math.min(u * 7, rowH * 0.55);
  const ownerH = Math.min(u * 6, rowH - nameH);
  const barH = Math.min(u * 6, rowH * 0.42);
  const row = (i: number, name: string, owner: string) => {
    const y = rowsTop + i * rowH;
    const ty = y + (rowH - nameH - ownerH) / 2;
    els.push(
      k.text(0, ty, nameW - u * 2, nameH, name, { textSize: 'lg', textBold: true }),
      k.text(0, ty + nameH, nameW - u * 2, ownerH, owner),
      rule(k, 0, y + rowH, gridW, hair),
    );
    return y;
  };
  TASKS.forEach(([name, owner, from, to, done], i) => {
    const y = row(i, name, owner);
    els.push(
      k.shape(
        'progress-bar',
        atWeek(from) + u,
        y + (rowH - barH) / 2,
        (to - from) * weekW - u * 2,
        barH,
        {
          progress: done,
        },
      ),
    );
  });
  // Launch day: a milestone diamond at the plan's end.
  const ly = row(TASKS.length, 'Launch', '9 November');
  const dd = Math.min(rowH * 0.7, u * 10);
  els.push(
    k.shape('diamond', atWeek(WEEKS.length) - dd, ly + (rowH - dd) / 2, dd, dd, { label: '' }),
  );
  // Today: a firm line through the rows and a tag under them.
  const tx = atWeek(TODAY);
  const tagW = u * 16;
  els.push(
    k.shape('square', tx - u * 0.4, rowsTop - u, u * 0.8, rowsBottom - rowsTop + u, { label: '' }),
    k.shape('square', tx - tagW / 2, rowsBottom + u * 2, tagW, todayH, {
      label: 'Today',
      textBold: true,
      borderRadius: 'full',
    }),
  );
  const facts = [
    ['6', 'Weeks'],
    ['5', 'Workstreams'],
    ['1', 'Launch day'],
  ] as const;
  if (!beside) {
    els.push(
      k.shape('stat-row', 0, H - statH, W, statH, {
        borderRadius: 'md',
        stats: [...facts.slice(0, 2), [`${DONE}%`, 'Done so far'] as const].map(
          ([value, caption]) => ({
            value,
            caption,
          }),
        ),
      }),
    );
    return els;
  }
  // The summary: how much is done as a ring, then the plan's size in figures.
  const sx = W - sideW;
  const ring = Math.min(sideW, (H - head.top) * 0.42);
  els.push(
    k.shape('progress-ring', sx + (sideW - ring) / 2, head.top, ring, ring, {
      progress: DONE,
      label: `${DONE}%`,
      textSize: 'lg',
    }),
    k.text(sx, head.top + ring + u * 2, sideW, u * 7, 'Done so far', {
      textAlignX: 'center',
      textBold: true,
    }),
  );
  const factsTop = head.top + ring + u * 13;
  const factH = (H - factsTop) / 2;
  facts.slice(0, 2).forEach(([value, caption], i) => {
    const y = factsTop + i * factH;
    els.push(
      rule(k, sx, y - u * 2, sideW, hair),
      k.title(sx, y, sideW, Math.min(u * 12, factH * 0.6), value),
      k.text(sx, y + Math.min(u * 12, factH * 0.6) + u, sideW, u * 6, caption),
    );
  });
  return els;
}

// Three yes-or-no questions an idea passes on its way to being built; a No at any of them ends in
// its own outcome.
const QUESTIONS = [
  ['Do users ask for it?', 'Park it in the backlog'],
  ['Can we ship it in a month?', 'Cut it to a first slice'],
  ['Does it fit our goals?', 'Bring it to planning'],
] as const;
const FLOW_TITLE = 'Should we build it?';
const FLOW_LEAD = 'Three questions for every new idea.';
const START = 'New idea';
const END = 'Build it';

// Not clearly taller than wide, the flow runs across the page; taller, it runs down it.
const FLOW_ACROSS_FROM = 0.9;

export function decisionFlow(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  return W >= H * FLOW_ACROSS_FROM ? flowAcross(k) : flowDown(k);
}

const yes = (from: ShapeElement, a: 'e' | 's', to: ShapeElement, b: 'w' | 'n'): Element => ({
  ...createPinnedArrow(from.id, a, to.id, b),
  label: 'Yes',
});
const no = (from: ShapeElement, a: 'e' | 's', to: ShapeElement, b: 'w' | 'n'): Element => ({
  ...createPinnedArrow(from.id, a, to.id, b),
  label: 'No',
});

// Start, the three questions and the end across the middle, each question set above its diamond
// and its No outcome under it.
function flowAcross(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, FLOW_TITLE, FLOW_LEAD);
  const colW = W / 5;
  const nodeW = colW - u * 9;
  const qH = u * 13;
  const dH = Math.min(nodeW * 0.8, u * 20);
  const armH = u * 12;
  const outH = u * 16;
  const blockH = qH + u * 3 + dH + armH + outH;
  const top = head.top + Math.max(0, (H - head.top - blockH) / 2);
  const dY = top + qH + u * 3;
  const midY = dY + dH / 2;
  const outY = dY + dH + armH;
  const cx = (i: number) => i * colW + colW / 2;
  const startH = u * 11;
  const start = k.shape('stadium', cx(0) - nodeW / 2, midY - startH / 2, nodeW, startH, {
    label: START,
    textBold: true,
  });
  const endH = u * 14;
  const end = k.shape('square', cx(4) - nodeW / 2, midY - endH / 2, nodeW, endH, {
    label: END,
    textBold: true,
    textSize: 'lg',
    borderRadius: 'lg',
  });
  const els: Element[] = [...head.els, start, end];
  const nodes: ShapeElement[] = [start];
  QUESTIONS.forEach(([q, out], i) => {
    const x = cx(i + 1);
    const d = k.shape('diamond', x - nodeW / 2, dY, nodeW, dH, {
      label: `${i + 1}`,
      textBold: true,
      textSize: 'lg',
    });
    const card = k.shape('square', (i + 1) * colW + u * 2, outY, colW - u * 4, outH, {
      label: out,
      borderRadius: 'md',
    });
    nodes.push(d);
    els.push(
      k.text((i + 1) * colW + u, top, colW - u * 2, qH, q, {
        textBold: true,
        textAlignX: 'center',
        textAlignY: 'bottom',
      }),
      d,
      card,
      no(d, 's', card, 'n'),
    );
  });
  nodes.push(end);
  els.push(createPinnedArrow(start.id, 'e', nodes[1]!.id, 'w'));
  for (let i = 2; i < nodes.length; i += 1) els.push(yes(nodes[i - 1]!, 'e', nodes[i]!, 'w'));
  // Under the two ends, a line each, level with the outcomes.
  els.push(
    k.text(u, outY, colW - u * 2, outH, 'Every idea, every time.', { textAlignX: 'center' }),
    k.text(4 * colW + u, outY, colW - u * 2, outH, 'Ship the smallest slice, then measure.', {
      textAlignX: 'center',
    }),
  );
  return els;
}

// Start, the three questions and the end down the middle: each question to the left of its
// diamond and its No outcome to the right.
function flowDown(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, FLOW_TITLE, FLOW_LEAD);
  const cx = W / 2;
  const dW = Math.min(W * 0.2, u * 22);
  const dH = dW * 0.85;
  const startW = W * 0.36;
  const startH = u * 10;
  const endW = W * 0.42;
  const endH = u * 14;
  const nodesH = startH + dH * 3 + endH;
  const avail = H - head.top;
  const gap = Math.min((avail - nodesH) / 4, u * 18);
  const top = head.top + (avail - nodesH - gap * 4) / 2;
  const start = k.shape('stadium', cx - startW / 2, top, startW, startH, {
    label: START,
    textBold: true,
    textSize: 'lg',
  });
  const els: Element[] = [...head.els, start];
  const nodes: ShapeElement[] = [start];
  const sideW = cx - dW / 2 - u * 6;
  const outX = cx + dW / 2 + u * 10;
  QUESTIONS.forEach(([q, out], i) => {
    const y = top + startH + gap + i * (dH + gap);
    const d = k.shape('diamond', cx - dW / 2, y, dW, dH, {
      label: `${i + 1}`,
      textBold: true,
      textSize: 'lg',
    });
    const cardH = Math.min(dH, u * 16);
    const card = k.shape('square', outX, y + (dH - cardH) / 2, W - outX, cardH, {
      label: out,
      borderRadius: 'md',
    });
    nodes.push(d);
    els.push(
      k.text(0, y, sideW, dH, q, {
        textSize: 'lg',
        textBold: true,
        textAlignX: 'right',
        textAlignY: 'middle',
      }),
      d,
      card,
      no(d, 'e', card, 'w'),
    );
  });
  const endY = top + startH + 3 * dH + 4 * gap;
  const end = k.shape('square', cx - endW / 2, endY, endW, endH, {
    label: END,
    iconId: 'check-circle',
    textBold: true,
    textSize: 'lg',
    borderRadius: 'lg',
  });
  nodes.push(end);
  els.push(end, createPinnedArrow(start.id, 's', nodes[1]!.id, 'n'));
  for (let i = 2; i < nodes.length; i += 1) els.push(yes(nodes[i - 1]!, 's', nodes[i]!, 'n'));
  return els;
}
