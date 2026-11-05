import type { Browser, Page } from '@playwright/test';
import { adoptGuest, documentHeaders, expect, mintGuest, seedDocumentItem, test } from './fixtures';

// The Viewer's Walk button (docs/specs/008-canvas/avatar-mode.md "The Walk button", Work Tracker #486): a Viewer has
// no palette strip and so no picker, so the bottom-right cluster gives them Walk. On a plain board (no Walk In, no
// pad, so nothing opens walking) it takes them into Avatar mode and back out; an Editor, who has the picker, has none.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

async function openAs(
  browser: Browser,
  baseURL: string,
  url: string,
  owner: string | null,
): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(() => {
    localStorage.setItem('livehuddle:v2:name-confirmed', '1');
    localStorage.setItem(
      'livehuddle:user-preferences:v1',
      JSON.stringify({ workshopTourSeen: true }),
    );
  });
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

// A shared link may ask a newcomer's name first.
async function joinIfAsked(page: Page): Promise<void> {
  const join = page.getByRole('button', { name: /^join$/i });
  await Promise.race([join.waitFor().catch(() => {}), page.locator(CANVAS).waitFor()]);
  if (await join.isVisible()) await join.click();
  await page.locator(CANVAS).waitFor();
}

const walk = (page: Page) => page.getByRole('button', { name: 'Walk', exact: true });
const self = (page: Page) => page.locator('[data-avatar="self"]');

test('a Viewer walks in and out from the Walk button; an Editor has none', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedDocumentItem(page.request, owner, {
    id,
    name: 'Plain Board',
    tabs: [
      {
        id: crypto.randomUUID(),
        name: 'Board',
        elements: [
          { id: 'note', type: 'sticky', x: 200, y: 160, width: 160, height: 160, label: 'Hello' },
        ],
      },
    ],
  });
  expect(seeded.ok(), `seed: ${seeded.status()}`).toBe(true);
  const headers = await documentHeaders(page.request, owner, id, {
    Origin: new URL(baseURL!).origin,
  });
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'view' },
  });
  expect(share.ok(), `share: ${share.status()}`).toBe(true);
  const code = ((await share.json()) as { link: { code: string } }).link.code;

  // The Editor: the picker is their way in, so the cluster has no Walk.
  const editor = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await editor.locator(CANVAS).waitFor();
  await expect(editor.locator('[data-element-id="note"]')).toBeVisible();
  await expect(walk(editor)).toHaveCount(0);

  // The Viewer: the board opens on the plain view, Walk off.
  const viewer = await openAs(browser, baseURL!, `/document/shared?s=${code}`, null);
  await joinIfAsked(viewer);
  await expect(walk(viewer)).toBeVisible();
  await expect(walk(viewer)).toHaveAttribute('aria-pressed', 'false');
  await expect(self(viewer)).toHaveCount(0);

  // Walk: into Avatar mode, the character on the board and the button pressed.
  await walk(viewer).click();
  await expect(walk(viewer)).toHaveAttribute('aria-pressed', 'true');
  await expect(self(viewer)).toHaveCount(1);
  await viewer.screenshot({ path: test.info().outputPath('viewer-walking.png') });

  // Again: back out, the character gone.
  await walk(viewer).click();
  await expect(walk(viewer)).toHaveAttribute('aria-pressed', 'false');
  await expect(self(viewer)).toHaveCount(0);

  await editor.context().close();
  await viewer.context().close();
});
