import type { Page } from '@playwright/test';
import {
  expect,
  adoptGuest,
  dismissQuickTour,
  mintGuest,
  ownerHeaders,
  seedPlan,
  test,
} from '../fixtures';
import { runCanvasProbe } from '@liveworkspace/e2e-kit/perf/canvas-probe';
import { buildReferenceBoard } from './reference-board';

// The canvas performance probe (docs/specs/008-canvas/canvas-performance.md "Measuring";
// docs/instructions/trace-a-canvas-gesture.md): the reference board on a Plan tab, at fit and at 100%, every
// gesture traced with the CPU slowed to the reference speed, judged against the budget. It reports and never fails
// on a budget miss; a harness error (seeding, the stack, a missing element) does fail it. The runner is
// @liveworkspace/e2e-kit's (perf/canvas-probe.ts); this hands it liveplanner's seed, sign-in and editor path.
// Run with `pnpm --filter @liveplanner/editor perf:canvas`.

type Tab = 'plan';

const SHAPE_IDS = buildReferenceBoard()
  .filter((el) => el.type === 'shape')
  .map((el) => el.id);

async function seed(page: Page, baseURL: string, owner: string, tab: Tab): Promise<string> {
  const id = crypto.randomUUID();
  const elements = buildReferenceBoard();
  const res = await seedPlan(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL).origin }),
    {
      id,
      name: `Reference board (${tab})`,
      tabs: [{ id: crypto.randomUUID(), name: 'Board', elements }],
    },
  );
  expect(res.ok(), `seeding the ${tab} board`).toBe(true);
  return id;
}

test('canvas performance budget', async ({ browser, baseURL, page }) => {
  // Five runs of each gesture: a fast desktop takes about 15 minutes, a hosted runner about an hour.
  test.setTimeout(100 * 60_000);
  await runCanvasProbe<Tab>(
    { browser, baseURL, page },
    {
      tabs: ['plan'],
      shapeIds: SHAPE_IDS,
      bareExclude: '[data-element-id], [data-floating-panel], header, nav',
      strokeKey: null,
      mintGuest,
      seed,
      // The guest adopted, and a confirmed name, before the first page loads.
      signIn: async (ctx, owner) => {
        await adoptGuest(ctx, owner);
        await ctx.addInitScript(() => localStorage.setItem('liveplanner:v2:name-confirmed', '1'));
      },
      itemPath: (id) => `/project/${id}`,
      tabResponsePath: String.raw`\/projects\/[^/]+\/tabs\/[^/?]+$`,
      dismissQuickTour,
    },
  );
});
