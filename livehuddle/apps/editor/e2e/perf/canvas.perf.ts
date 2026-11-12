import type { Page } from '@playwright/test';
import {
  expect,
  dismissQuickTour,
  guestTokenFor,
  mintGuest,
  ownerHeaders,
  seedDocumentItem,
  test,
} from '../fixtures';
import { runCanvasProbe } from '@liveworkspace/e2e-kit/perf/canvas-probe';
import { buildReferenceBoard } from './reference-board';

// The canvas performance probe (docs/specs/008-canvas/canvas-performance.md "Measuring";
// docs/instructions/trace-a-canvas-gesture.md): the reference board on a whiteboard and a diagram, at fit and at 100%, every
// gesture traced with the CPU slowed to the reference speed, judged against the budget. It reports and never fails
// on a budget miss; a harness error (seeding, the stack, a missing element) does fail it. The runner is
// @liveworkspace/e2e-kit's (perf/canvas-probe.ts); this hands it livehuddle's seed, sign-in and editor path.
// Run with `pnpm --filter @livehuddle/editor perf:canvas`.

type Tab = 'whiteboard' | 'diagram';

const SHAPE_IDS = buildReferenceBoard()
  .filter((el) => el.type === 'shape')
  .map((el) => el.id);

async function seed(page: Page, baseURL: string, owner: string, tab: Tab): Promise<string> {
  const id = crypto.randomUUID();
  const elements = buildReferenceBoard();
  const res = await seedDocumentItem(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL).origin }),
    {
      id,
      name: `Reference board (${tab})`,
      // The whiteboard series is a general tab opening in Draw mode (docs/specs/007-editor/editor-modes.md).
      tabs: [
        {
          id: crypto.randomUUID(),
          name: 'Board',
          ...(tab === 'whiteboard' ? { opensIn: 'draw' } : {}),
          elements,
        },
      ],
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
      tabs: ['whiteboard', 'diagram'],
      shapeIds: SHAPE_IDS,
      bareExclude: '[data-element-id], [data-floating-panel], header, nav',
      strokeKey: (tab) => (tab === 'whiteboard' ? '1' : 'p'),
      mintGuest,
      seed,
      // The guest's token and a confirmed name, before the first page loads.
      signIn: (ctx, owner) =>
        ctx.addInitScript(
          ({ token }) => {
            if (token) localStorage.setItem('livehuddle:v2:guest-token', token);
            localStorage.setItem('livehuddle:v2:name-confirmed', '1');
          },
          { token: guestTokenFor(owner) },
        ),
      itemPath: (id) => `/document/${id}`,
      tabResponsePath: String.raw`\/documents\/[^/]+\/tabs\/[^/?]+$`,
      dismissQuickTour,
    },
  );
});
