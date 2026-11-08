import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  expect,
  guestTokenFor,
  mintGuest,
  ownerHeaders,
  seedDocumentItem,
  test,
} from '../fixtures';
import {
  buildLargeSelectionBoard,
  LARGE_CAPTION_COUNT,
  LARGE_NODE_COUNT,
  largeNodeId,
} from './large-selection-board';

// The large-selection drag bench (docs/specs/008-canvas/canvas-performance.md "Dragging a very large
// selection"): the 1,770-element board, its whole selection and a typical five-element one dragged, each
// pointer move timed in the page. Every move is one frame: a rAF registered before the move marks its
// start, the drag's own frame callback runs, React's update flushes in the microtasks after it, and a rAF
// registered after marks the end of the move's script; a task posted from there runs after the frame's
// style, layout and paint, which ends the move's frame. Reports medians; never fails on a number (the
// CPU-time tests hold the budget), only on a harness error.
// Run with `E2E_PERF=1 pnpm exec playwright test --project=perf large-selection-drag`.

const OUT = 'test-results/perf';
const VIEW = { width: 1440, height: 900 };
const MOVES = 40;
const RUNS = 3;
// CPU throttles measured: the machine as it is, and the probe's reference slowdown.
const THROTTLES = [1, 4];

type Point = { x: number; y: number };
type MoveTimes = { scriptMs: number[]; frameMs: number[] };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

async function centreOf(page: Page, id: string): Promise<Point> {
  const box = await page.locator(`[data-element-id="${id}"]`).first().boundingBox();
  if (!box) throw new Error(`${id} is not drawn`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// One drag from `from`, MOVES synthetic pointer moves (the drag reads the window's pointermove), each
// timed; released with the real mouse where the last move went.
async function timedDrag(page: Page, from: Point): Promise<MoveTimes> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const times = await page.evaluate(
    async ({ from, moves }) => {
      const scriptMs: number[] = [];
      const frameMs: number[] = [];
      const move = (x: number, y: number) =>
        window.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: x,
            clientY: y,
            bubbles: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            buttons: 1,
          }),
        );
      // Past the engage threshold first, untimed: the press becoming a drag is not a move.
      move(from.x + 10, from.y + 5);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      for (let k = 1; k <= moves; k++) {
        await new Promise<void>((resolve) => {
          let start = 0;
          requestAnimationFrame(() => {
            start = performance.now();
            performance.mark('drag-move-start');
          });
          move(from.x + 10 + k * 6, from.y + 5 + k * 3);
          requestAnimationFrame(() => {
            performance.mark('drag-move-script-end');
            scriptMs.push(performance.now() - start);
            setTimeout(() => {
              frameMs.push(performance.now() - start);
              performance.measure('drag-move', 'drag-move-start');
              resolve();
            }, 0);
          });
        });
      }
      return { scriptMs, frameMs };
    },
    { from, moves: MOVES },
  );
  await page.mouse.move(from.x + 10 + MOVES * 6, from.y + 5 + MOVES * 3);
  await page.mouse.up();
  await page.waitForTimeout(600);
  return times;
}

test('large selection drag', async ({ browser, baseURL, page }) => {
  test.setTimeout(30 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const elements = buildLargeSelectionBoard();
  expect(elements).toHaveLength(LARGE_NODE_COUNT + LARGE_CAPTION_COUNT);
  const res = await seedDocumentItem(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL!).origin }),
    { id, name: 'Large selection', tabs: [{ id: crypto.randomUUID(), name: 'Board', elements }] },
  );
  expect(res.ok(), 'seeding the board').toBe(true);

  const rows: string[] = [];
  const report: Record<string, unknown>[] = [];
  for (const throttle of THROTTLES) {
    const ctx = await browser.newContext({ viewport: VIEW, colorScheme: 'dark' });
    await ctx.addInitScript(
      ({ token }) => {
        if (token) localStorage.setItem('livehuddle:v2:guest-token', token);
        localStorage.setItem('livehuddle:v2:name-confirmed', '1');
      },
      { token: guestTokenFor(owner) },
    );
    const p = await ctx.newPage();
    await p.goto(`/document/${id}`);
    await p
      .locator(`[data-element-id="${largeNodeId(0, 0)}"]`)
      .first()
      .waitFor({ timeout: 90_000 });
    await p.waitForTimeout(3000);
    await p.keyboard.press('Escape');
    await p.keyboard.press('v');
    await p.keyboard.press('Shift+1');
    await p.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

    const cases: { name: string; select: () => Promise<Point> }[] = [
      {
        name: `all ${LARGE_NODE_COUNT + LARGE_CAPTION_COUNT}`,
        select: async () => {
          await p.keyboard.press('Escape');
          await p.keyboard.press('ControlOrMeta+a');
          await p.waitForTimeout(1500);
          return centreOf(p, largeNodeId(15, 15));
        },
      },
      {
        name: 'typical 5',
        select: async () => {
          await p.keyboard.press('Escape');
          await p.waitForTimeout(300);
          const ids = [0, 1, 2, 3, 4].map((c) => largeNodeId(15, 13 + c));
          for (const [i, nodeId] of ids.entries()) {
            const at = await centreOf(p, nodeId);
            if (i > 0) await p.keyboard.down('Shift');
            await p.mouse.click(at.x, at.y);
            if (i > 0) await p.keyboard.up('Shift');
          }
          await p.waitForTimeout(800);
          return centreOf(p, ids[2]!);
        },
      },
    ];
    for (const c of cases) {
      const script: number[] = [];
      const frame: number[] = [];
      for (let r = 0; r < RUNS; r++) {
        const from = await c.select();
        const t = await timedDrag(p, from);
        script.push(median(t.scriptMs));
        frame.push(median(t.frameMs));
        // One undo puts the board back: the drag was one step.
        await p.keyboard.press('ControlOrMeta+z');
        await p.waitForTimeout(1500);
      }
      if (throttle === 1) await p.screenshot({ path: `${OUT}/large-selection-${c.name}.png` });
      const row = {
        throttle,
        selection: c.name,
        medianScriptMs: Number(median(script).toFixed(1)),
        medianFrameMs: Number(median(frame).toFixed(1)),
        runs: script.map((s, i) => [Number(s.toFixed(1)), Number(frame[i]!.toFixed(1))]),
      };
      report.push(row);
      rows.push(
        `| ${throttle}× | ${c.name} | ${row.medianScriptMs} | ${row.medianFrameMs} | ${JSON.stringify(row.runs)} |`,
      );
    }
    await ctx.close();
  }
  writeFileSync(`${OUT}/large-selection-drag.json`, JSON.stringify(report, null, 2));
  console.log(
    [
      '| CPU | Selection | Script per move (median ms) | Frame per move (median ms) | Runs [script, frame] |',
      '| --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n'),
  );
});
