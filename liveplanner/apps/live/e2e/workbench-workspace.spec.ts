import { expect, test } from '@playwright/test';
import {
  apiJson,
  createFolder,
  mintTicket,
  mintWorkspaceTicket,
  newPerson,
  received,
  seedProjectAndToken,
  serveFakeWorkbench,
  signIn,
  type FakeWorkbench,
} from './workbench-support';

// The workspace scope end to end (docs/specs/013-workspace/blueprints/workbench-embeds.md "Testing"): a fake
// workbench on http://127.0.0.1:<port> frames the Explorer of the live app on http://localhost:<port>. A project
// pairing does not reach the workspace: the workspace is its own approval, asked in its own words. Then the frame
// shows the Explorer without the app's surroundings, opens projects in place with Back, makes a new project in
// place, tells the workbench where it is, and moves when the workbench asks. Opt-in like workbench-embed.spec.ts.

let workbench: FakeWorkbench;

test.beforeAll(async () => {
  workbench = await serveFakeWorkbench();
});

test.afterAll(async () => {
  await workbench.close();
});

type Place = { type: string; view?: string; projectId?: string | null; [k: string]: unknown };
const places = async (page: Parameters<typeof received>[0]) =>
  (await received(page)).filter((m): m is Place => m.type === 'liveplanner:place');

test('a workspace frame is its own approval, browses the Explorer, and opens projects in place', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const person = await newPerson(request, 'Webber');
  await signIn(context, person, new URL(baseURL!).origin);
  const seeded = await seedProjectAndToken(request, person);
  const folderId = await createFolder(request, person, 'Minigames');

  // A project pairing first.
  const unpaired = await mintTicket(request, seeded, workbench.origin);
  expect(unpaired.status).toBe(428);
  await page.goto(unpaired.body.pairingUrl!);
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workbench allowed' })).toBeVisible();

  // The workspace is a second approval, asked in its own words.
  const widening = await mintWorkspaceTicket(request, seeded, workbench.origin);
  expect(widening.status).toBe(428);
  await page.goto(widening.body.pairingUrl!);
  await expect(page.getByRole('heading', { name: 'Allow this workbench?' })).toBeVisible();
  await expect(
    page.getByText(/and to create, move, share and trash projects and folders in it/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workbench allowed' })).toBeVisible();

  // Home, inside the frame: the Explorer, without the app header, the account menu or Settings.
  const minted = await mintWorkspaceTicket(request, seeded, workbench.origin);
  expect(minted.status).toBe(201);
  expect(minted.body.url).toMatch(/\/embed\/workbench\/explorer#ticket=/);
  await workbench.open(page, minted.body.url!);
  const frame = page.frameLocator('#frame');
  await expect(frame.getByRole('complementary', { name: 'Sections' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(frame.getByRole('banner')).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Settings' })).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'New Team' })).toHaveCount(0);
  await expect(
    frame.getByRole('link', { name: 'Open in liveplanner (opens in a new tab)' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await received(page)).find((m) => m.type === 'liveplanner:ready'))
    .toMatchObject({ scope: 'workspace', role: 'edit' });
  await expect.poll(async () => (await places(page)).at(-1)?.view).toBe('home');

  // A sidebar row moves the frame; a project opens in it, with Back to where it was opened from.
  await frame.getByText('My Projects', { exact: true }).first().click();
  await expect.poll(async () => (await places(page)).at(-1)?.view).toBe('all');
  await frame.getByText('Home screen', { exact: true }).first().click();
  await frame.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect(frame.locator('[data-element-id="el-play"]').first()).toBeVisible();
  await expect
    .poll(async () => (await places(page)).at(-1))
    .toMatchObject({
      view: 'project',
      projectId: seeded.projectId,
      projectName: 'Home screen',
      role: 'edit',
    });
  await frame.getByRole('button', { name: /^Back to / }).click();
  await expect(frame.getByRole('complementary', { name: 'Sections' })).toBeVisible();
  await expect.poll(async () => (await places(page)).at(-1)?.view).toBe('all');

  // The workbench moves the frame: to the empty folder, which says so.
  await page.evaluate(
    (id) =>
      (window as unknown as { post: (m: unknown) => void }).post({
        type: 'liveplanner:open',
        v: 1,
        to: { folderId: id },
      }),
    folderId,
  );
  await expect
    .poll(async () => (await places(page)).at(-1))
    .toMatchObject({ view: 'folder', folderId, folderName: 'Minigames', projectCount: 0 });

  // New project makes the project in place, in the folder shown, and opens it in the frame.
  await frame.getByRole('link', { name: 'New Project' }).first().click();
  await frame.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect.poll(async () => (await places(page)).at(-1)?.view).toBe('project');
  const made = (await places(page)).at(-1)!.projectId as string;
  const doc = await apiJson<{ project: { folderId: string | null } }>(
    request,
    'GET',
    `/projects/${made}`,
    person.jwt,
  );
  expect(doc.status).toBe(200);
  expect(doc.body.project.folderId).toBe(folderId);
  // The frame never left its page: its address is the frame's own.
  expect(page.frames().some((f) => f.url().includes(`/embed/workbench/project/${made}`))).toBe(
    true,
  );
});

test('a workspace ticket on a folder starts the frame there', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const person = await newPerson(request, 'Webber');
  await signIn(context, person, new URL(baseURL!).origin);
  const seeded = await seedProjectAndToken(request, person);
  const folderId = await createFolder(request, person, 'Minigames');
  const unpaired = await mintWorkspaceTicket(request, seeded, workbench.origin, folderId);
  expect(unpaired.status).toBe(428);
  await page.goto(unpaired.body.pairingUrl!);
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workbench allowed' })).toBeVisible();

  const minted = await mintWorkspaceTicket(request, seeded, workbench.origin, folderId);
  expect(minted.status).toBe(201);
  expect(minted.body.url).toContain(`/embed/workbench/explorer/folder/${folderId}#ticket=`);
  await workbench.open(page, minted.body.url!);

  await expect
    .poll(async () => (await places(page)).at(-1), { timeout: 30_000 })
    .toMatchObject({ view: 'folder', folderId, folderName: 'Minigames', projectCount: 0 });
  await expect(
    page.frameLocator('#frame').getByRole('link', { name: 'New Project' }).first(),
  ).toBeVisible();
});
