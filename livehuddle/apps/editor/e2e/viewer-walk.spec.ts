import type { Browser, Page } from '@playwright/test';
import {
  adoptGuest,
  documentHeaders,
  expect,
  markModeToursSeen,
  mintGuest,
  seedDocumentItem,
  test,
} from './fixtures';
import { legacyViewerLink } from './legacy-viewer';

// Always walking (docs/specs/013-workspace/share-roles.md "Always walking", owner 2026-11-06): a Viewer opens even a
// plain board (no Walk In, no pad, so nothing else opens walking) in Avatar mode, with no Edit | Walk toggle and no
// way out. The toggle is an Editor's alone (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"): Walk takes
// them in and Edit back out.

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
  });
  await markModeToursSeen(ctx);
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

const toggle = (page: Page) => page.getByRole('group', { name: 'Edit or Walk' });
const walk = (page: Page) => toggle(page).getByRole('button', { name: 'Walk', exact: true });
const edit = (page: Page) => toggle(page).getByRole('button', { name: 'Edit', exact: true });
const self = (page: Page) => page.locator('[data-avatar="self"]');

test('a Viewer is always walking with no Edit | Walk toggle; an Editor walks in and out from it', async ({
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
  // livehuddle makes no new Viewer link: a legacy one, as stored before.
  const code = await legacyViewerLink(page.request, apiBase, id, headers);

  // The Editor: the toggle on Edit, then Walk into Avatar mode and Edit back out.
  const editor = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await editor.locator(CANVAS).waitFor();
  await expect(editor.locator('[data-element-id="note"]')).toBeVisible();
  await expect(walk(editor)).toHaveAttribute('aria-pressed', 'false');
  await expect(self(editor)).toHaveCount(0);
  await walk(editor).click();
  await expect(walk(editor)).toHaveAttribute('aria-pressed', 'true');
  await expect(self(editor)).toHaveCount(1);
  // The toggle starts the avatar palette too, and there is no selection-mode picker: Edit is the way out.
  await expect(
    editor.locator('[data-avatar-palette]').getByRole('group', { name: 'Edit or Walk' }),
  ).toHaveCount(1);
  await expect(editor.getByRole('button', { name: /Selection mode/ })).toHaveCount(0);
  await edit(editor).click();
  await expect(walk(editor)).toHaveAttribute('aria-pressed', 'false');
  await expect(self(editor)).toHaveCount(0);
  // W walks again, E edits (avatar-mode.md "The Edit | Walk toggle").
  await editor.locator(CANVAS).click({ position: { x: 40, y: 400 } });
  await editor.keyboard.press('w');
  await expect(self(editor)).toHaveCount(1);
  await editor.keyboard.press('e');
  await expect(self(editor)).toHaveCount(0);

  // The Viewer: walking from the start, its avatar palette up, and no toggle.
  const viewer = await openAs(browser, baseURL!, `/document/shared?s=${code}`, null);
  await joinIfAsked(viewer);
  await expect(self(viewer)).toHaveCount(1);
  await expect(viewer.locator('[data-avatar-palette]')).toBeVisible();
  await expect(toggle(viewer)).toHaveCount(0);
  await viewer.screenshot({ path: test.info().outputPath('viewer-walking.png') });

  // No way out: the view-tool keys and Escape leave it walking.
  await viewer.locator(CANVAS).click({ position: { x: 40, y: 400 } });
  for (const key of ['e', 'v', 'Escape']) {
    await viewer.keyboard.press(key);
    await expect(self(viewer)).toHaveCount(1);
  }

  await editor.context().close();
  await viewer.context().close();
});
