import { expect, test } from '@playwright/test';
import {
  apiJson,
  mintTicket,
  newPerson,
  received,
  seedDocumentAndToken,
  serveFakeWorkbench,
  signIn,
  ticketOf,
  type FakeWorkbench,
} from './workbench-support';

// The workbench embed end to end (docs/specs/013-workspace/blueprints/workbench-embeds.md, "Testing"):
// a fake workbench on http://127.0.0.1:<port> frames the live app on http://localhost:<port>. Opt-in
// (E2E_WORKBENCH=1, `pnpm test:e2e:workbench`): it needs the NEXT_PUBLIC_E2E_AUTH build and the stack
// acting as Clerk for the signed-in pairing page.

let workbench: FakeWorkbench;
let elsewhere: FakeWorkbench;

test.beforeAll(async () => {
  workbench = await serveFakeWorkbench();
  elsewhere = await serveFakeWorkbench();
});

test.afterAll(async () => {
  await workbench.close();
  await elsewhere.close();
});

test('a paired workbench frames the editor, hears the selection, renews, and ends on Unpair', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const person = await newPerson(request, 'Webber');
  await signIn(context, person, new URL(baseURL!).origin);
  const seeded = await seedDocumentAndToken(request, person);

  // Unpaired: the mint asks for a pairing, and the person allows it in their own browser.
  const unpaired = await mintTicket(request, seeded, workbench.origin);
  expect(unpaired.status).toBe(428);
  await page.goto(unpaired.body.pairingUrl!);
  await expect(page.getByRole('heading', { name: 'Allow this workbench?' })).toBeVisible();
  await expect(page.getByText(workbench.origin)).toBeVisible();
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workbench allowed' })).toBeVisible();

  // Paired: the mint answers a frame URL, and the workbench frames it.
  const minted = await mintTicket(request, seeded, workbench.origin);
  expect(minted.status).toBe(201);
  const sessionCalls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/workbench/sessions')) sessionCalls.push(req.method());
  });
  await workbench.open(page, minted.body.url!);
  const frame = page.frameLocator('#frame');
  await frame.locator('[data-canvas-a11y-root]').waitFor();
  await expect(frame.locator('[data-element-id="el-play"]').first()).toBeVisible();

  // The workbench chrome: no app header, Explorer or Share; the tab bar and Open in livediagram stay.
  await expect(
    frame.getByRole('link', { name: 'Open in livediagram (opens in a new tab)' }),
  ).toBeVisible();
  await expect(frame.getByRole('button', { name: /^Share/ })).toHaveCount(0);
  await expect(frame.getByText('Explorer', { exact: true })).toHaveCount(0);
  await expect(frame.getByText('Wireframe').first()).toBeVisible();
  await expect
    .poll(async () => (await received(page)).map((m) => m.type))
    .toEqual(expect.arrayContaining(['livediagram:hello', 'livediagram:ready']));
  const ready = (await received(page)).find((m) => m.type === 'livediagram:ready');
  expect(ready).toMatchObject({
    documentId: seeded.documentId,
    documentName: 'Home screen',
    role: 'edit',
  });

  // Drawing saves through the session.
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2 + 200, viewport.height / 2);
  await page.keyboard.press('r');
  await page.mouse.move(viewport.width / 2 + 150, viewport.height / 2 - 40);
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 + 300, viewport.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.type('Scores');
  await page.keyboard.press('Escape');
  await expect
    .poll(
      async () => {
        const tab = await apiJson<{ tab: { elements: unknown[] } }>(
          request,
          'GET',
          `/documents/${seeded.documentId}/tabs/${seeded.tabId}`,
          person.jwt,
        );
        return tab.body.tab.elements.length;
      },
      { timeout: 15_000 },
    )
    .toBe(2);

  // A selection arrives once it settles, as the selection reference.
  // The drawn square stays selected, so its reference arrives first; then the click on Play.
  const selectionOf = async (label: string) =>
    (await received(page)).find(
      (m) =>
        m.type === 'livediagram:selection' &&
        m.count === 1 &&
        String(m.reference).includes(`"${label}"`),
    );
  await frame.locator('[data-element-id="el-play"]').first().click();
  await expect.poll(() => selectionOf('Play')).toBeTruthy();
  const selection = (await selectionOf('Play'))!;
  expect(selection.reference).toMatch(/^\[livediagram\] "Home screen" › tab "Wireframe" \(doc /);
  expect(selection.reference).toContain('"Play"');
  expect(selection.reference).toContain(`read: livediagram tab view ${seeded.documentId}`);

  // Reveal outlines the element; the theme follows the workbench.
  await page.evaluate(() =>
    (window as unknown as { post: (m: unknown) => void }).post({
      type: 'livediagram:reveal',
      v: 1,
      refs: ['el-play'],
    }),
  );
  await expect(frame.locator('[data-changeset-reveal]')).not.toHaveCount(0);
  const isDark = () => frame.locator('html').evaluate((html) => html.classList.contains('dark'));
  for (const colourScheme of ['light', 'dark'] as const) {
    await page.evaluate(
      (scheme) =>
        (window as unknown as { post: (m: unknown) => void }).post({
          type: 'livediagram:theme',
          v: 1,
          colourScheme: scheme,
        }),
      colourScheme,
    );
    await expect.poll(isDark).toBe(colourScheme === 'dark');
  }

  // Renewal: a fresh ticket swaps the session and ends the old one.
  const renewal = await mintTicket(request, seeded, workbench.origin);
  await page.evaluate(
    (ticket) =>
      (window as unknown as { post: (m: unknown) => void }).post({
        type: 'livediagram:ticket',
        v: 1,
        ticket,
      }),
    ticketOf(renewal.body.url!),
  );
  await expect.poll(() => sessionCalls).toEqual(['POST', 'POST', 'DELETE']);

  // Unpair: the room closes the frame's socket, the frame turns read-only and says how to edit again.
  const pairings = await apiJson<{ pairings: { id: string; origin: string }[] }>(
    request,
    'GET',
    '/workbench/pairings',
    person.jwt,
  );
  const pairing = pairings.body.pairings.find((p) => p.origin === workbench.origin)!;
  const unpaired204 = await apiJson(
    request,
    'DELETE',
    `/workbench/pairings/${pairing.id}`,
    person.jwt,
  );
  expect(unpaired204.status).toBe(204);
  await expect(
    frame.getByRole('status').filter({ hasText: 'Reconnect in Fake Workbench to keep editing.' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await received(page)).find((m) => m.type === 'livediagram:ended'))
    .toMatchObject({ reason: 'revoked' });
});

test('a page of another origin framing the URL mounts nothing', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const person = await newPerson(request, 'Webber');
  await signIn(context, person, new URL(baseURL!).origin);
  const seeded = await seedDocumentAndToken(request, person);
  const unpaired = await mintTicket(request, seeded, workbench.origin);
  await page.goto(unpaired.body.pairingUrl!);
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workbench allowed' })).toBeVisible();
  const minted = await mintTicket(request, seeded, workbench.origin);

  // The URL minted for `workbench` lands in a page of `elsewhere`'s origin.
  await elsewhere.open(page, minted.body.url!);
  const frame = page.frameLocator('#frame');

  await expect(
    frame.getByRole('heading', { name: `This view opens only inside ${workbench.origin}.` }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(frame.locator('[data-canvas-a11y-root]')).toHaveCount(0);
  expect(await received(page)).toEqual([]);
});

test('the fake workbench frames only an http(s) loopback address', async ({ page }) => {
  await page.goto(`${workbench.origin}/`);
  const open = (url: string) =>
    page.evaluate(
      (u) => (window as unknown as { openFrame: (v: string) => boolean }).openFrame(u),
      url,
    );

  for (const url of ['javascript:alert(1)', 'https://example.com/embed/workbench', 'not a url']) {
    expect(await open(url)).toBe(false);
  }
  await expect(page.getByRole('alert')).toHaveText(
    'Refused: the fake workbench frames only an http(s) loopback address.',
  );
  expect(await page.locator('#frame').getAttribute('src')).toBeNull();
});
