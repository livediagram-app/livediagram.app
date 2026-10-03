import type { Browser, Page } from '@playwright/test';
import { expect, guestSigFor, ownerHeaders, test } from './fixtures';
import { openDocument } from './home-seed';

// Screens the dark-mode audits (contrast, optical alignment) open: a seeded diagram shaped like a real one,
// a dark visitor, a share link, and a fresh identity-less visitor.

export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
export const CANVAS = '[data-canvas-a11y-root]';

// A minted guest (mintSignedGuest) brings its signature, so the browser keeps the identity across
// page loads; a hand-made id is upgraded to a new one on each.
export async function darkVisitor(page: Page, owner?: string): Promise<void> {
  await page.addInitScript(
    ({ id, sig }) => {
      localStorage.setItem('livediagram:v2:ui-mode', 'dark');
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
      if (id) localStorage.setItem('livediagram:v2:self-id', id);
      if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
    },
    { id: owner ?? null, sig: owner ? guestSigFor(owner) : null },
  );
}

// A diagram shaped like a real one: an actor, boxes, and solid and dashed labelled arrows, on the
// Default scheme, so the canvas ink is the palette's own.
export async function seedDocument(page: Page, owner: string, origin: string): Promise<string> {
  return (await seedDrawnDocument(page, owner, origin)).id;
}

// The seeded diagram as a returning owner left it: opened once, as the editor opens it, so it is
// in Home's Jump back in (docs/specs/013-workspace/explorer-home.md: a document made but never
// opened is not, D133).
export async function seedOpenedDocument(
  page: Page,
  owner: string,
  origin: string,
): Promise<string> {
  const doc = await seedDrawnDocument(page, owner, origin);
  await openDocument(page.request, owner, doc);
  return doc.id;
}

// The opened document's thumbnail in Home's Jump back in, and its row on a listing view.
export const jumpBackIn = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Jump back in' }).getByRole('link', { name });
export const documentRow = (page: Page, name: string) =>
  page.locator('main section').getByRole('link', { name, exact: true });

async function seedDrawnDocument(
  page: Page,
  owner: string,
  origin: string,
): Promise<{ id: string; tabId: string }> {
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const box = (bid: string, label: string, x: number, y: number) => ({
    id: bid,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 200,
    height: 100,
    label,
  });
  const arrow = (aid: string, from: string, to: string, label: string, dashed = false) => ({
    id: aid,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 's' },
    to: { kind: 'pinned', elementId: to, anchor: 'n' },
    label,
    ...(dashed ? { strokeStyle: 'dashed' } : {}),
  });
  const elements = [
    {
      id: 'actor',
      type: 'shape',
      shape: 'actor',
      x: 470,
      y: 20,
      width: 60,
      height: 100,
      label: 'Webber',
    },
    box('a', 'Assistant', 180, 240),
    box('s', 'Spinner', 440, 240),
    box('r', 'Runa (Backend)', 280, 480),
    arrow('x1', 'actor', 'a', 'UI'),
    arrow('x2', 'actor', 's', 'UI'),
    arrow('x3', 'a', 'r', 'Use personal assistant', true),
  ];
  const res = await page.request.post(`${apiBase}/documents`, {
    headers: ownerHeaders(owner, { Origin: origin }),
    data: { id, name: 'Contrast', tabs: [{ id: tabId, name: 'Runa', elements }] },
  });
  expect(res.ok(), `seeding failed: ${res.status()}`).toBe(true);
  return { id, tabId };
}

export async function shareLink(
  page: Page,
  owner: string,
  origin: string,
  id: string,
): Promise<string> {
  const res = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers: ownerHeaders(owner, { Origin: origin, 'Content-Type': 'application/json' }),
    data: {},
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { link: { code: string } }).link.code;
}

// A visitor with no identity yet, so the share link greets them with the Join dialog.
export async function freshDarkPage(browser: Browser, deviceScaleFactor = 1): Promise<Page> {
  const context = await browser.newContext({
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor,
    baseURL: test.info().project.use.baseURL,
  });
  await context.addInitScript(() => localStorage.setItem('livediagram:v2:ui-mode', 'dark'));
  return context.newPage();
}
