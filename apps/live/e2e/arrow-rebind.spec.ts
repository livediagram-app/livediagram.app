import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, startBlankDiagram, test } from './fixtures';

// The auto-rebind end to end (docs/specs/008-canvas/arrow-anchors.md): unit
// tests prove the rule; only the editor proves it runs LIVE during a drag,
// that it is on by default, and that the Settings switch turns it off.

type Seed = Record<string, unknown>[];

const square = (id: string, label: string, x: number, y: number) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 100,
  label,
});
const pinned = (elementId: string, anchor: string) => ({ kind: 'pinned', elementId, anchor });

// Write the seed into the new diagram's first tab through the api, reload.
async function seedTab(page: Page, elements: Seed): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  await page.evaluate(
    async ({ base, elements }) => {
      const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      const headers = { 'X-Owner-Id': owner, 'Content-Type': 'application/json' };
      let tab: Record<string, unknown> | null = null;
      let tabId = '';
      for (let i = 0; i < 50 && !tab; i += 1) {
        const diagram = await (await fetch(`${base}/diagrams/${id}`, { headers })).json();
        tabId = diagram.diagram?.tabs?.[0]?.id ?? '';
        if (tabId) {
          const got = await (
            await fetch(`${base}/diagrams/${id}/tabs/${tabId}`, { headers })
          ).json();
          tab = got.tab ?? null;
        }
        if (!tab) await new Promise((r) => setTimeout(r, 100));
      }
      if (!tab) throw new Error('the new diagram never saved its first tab');
      const res = await fetch(`${base}/diagrams/${id}/tabs/${tabId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ...tab, elements }),
      });
      if (!res.ok) throw new Error(`seeding failed: ${res.status}`);
    },
    { base: apiBase, elements },
  );
  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
}

// The drawn path's end points, in canvas coordinates, off the hit band.
async function pathEnds(page: Page, arrowId: string): Promise<number[]> {
  const d = await page.locator(`path[data-element-id="${arrowId}"]`).getAttribute('d');
  const nums = (d ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
  return [nums[0]!, nums[1]!, nums[nums.length - 2]!, nums[nums.length - 1]!].map(Math.round);
}

// Press on a shape, move it by (dx, dy) canvas px, and return a function
// that releases. The zoom is read off the rendered box.
async function grab(page: Page, label: string, dx: number, dy: number) {
  const el = page
    .locator('[data-canvas-a11y-root]')
    .getByRole('img', { name: new RegExp(label) })
    .first();
  const box = (await el.boundingBox())!;
  const zoom = box.width / 100;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (dx * zoom) / 2, y + (dy * zoom) / 2, { steps: 5 });
  await page.mouse.move(x + dx * zoom, y + dy * zoom, { steps: 5 });
  return () => page.mouse.up();
}

test.use({ colorScheme: 'dark' });

test.describe('Arrow auto-rebind', () => {
  test('re-anchors live while dragging, on by default', async ({ page, pageErrors }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await startBlankDiagram(page);
    await seedTab(page, [
      square('a', 'Alpha', 400, 200),
      square('b', 'Beta', 700, 200),
      { id: 'x', type: 'arrow', from: pinned('a', 'e'), to: pinned('b', 'w') },
    ]);
    expect(await pathEnds(page, 'x')).toEqual([500, 250, 700, 250]);

    // Beta to the left of Alpha: kept, the line would run through both.
    const release = await grab(page, 'Beta', -500, 0);
    // Still holding the mouse: the rebind has already run on this frame.
    expect(await pathEnds(page, 'x')).toEqual([400, 250, 300, 250]);
    await release();
    expect(await pathEnds(page, 'x')).toEqual([400, 250, 300, 250]);
    expect(logs).toContainEqual('[arrow-rebind] trigger arrow=x end=from element=a side=w e->w');
    expectNoPageErrors(pageErrors);
  });

  test('a quarter point stays a quarter point on its new side', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, [
      square('a', 'Alpha', 400, 300),
      square('b', 'Beta', 700, 100),
      { id: 'q', type: 'arrow', from: pinned('a', 'nne'), to: pinned('b', 'wsw') },
    ]);
    expect(await pathEnds(page, 'q')).toEqual([475, 300, 700, 175]);
    const release = await grab(page, 'Beta', 0, 350);
    await release();
    // nne (top edge) -> ene (right edge, upper quarter). The line first runs
    // through Alpha mid-drag, while Beta's centre is still above Alpha's, so
    // the upper quarter is the closer one at that frame; with no memory, it
    // stays once the path is clear again.
    expect(await pathEnds(page, 'q')).toEqual([500, 325, 700, 525]);
    expectNoPageErrors(pageErrors);
  });

  test('the Settings switch turns it off', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, [
      square('a', 'Alpha', 400, 200),
      square('b', 'Beta', 700, 200),
      { id: 'x', type: 'arrow', from: pinned('a', 'e'), to: pinned('b', 'w') },
    ]);
    await page.getByRole('button', { name: /^application settings$/i }).click();
    const toggle = page.getByRole('switch', { name: /auto-attach arrows/i });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await page.keyboard.press('Escape');

    const release = await grab(page, 'Beta', -500, 0);
    await release();
    expect(await pathEnds(page, 'x')).toEqual([500, 250, 200, 250]);
    expectNoPageErrors(pageErrors);
  });
});
