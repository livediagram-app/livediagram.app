import type { Browser, Page } from '@playwright/test';
import {
  adoptGuest,
  documentHeaders,
  expect,
  ownerHeaders,
  seedDocumentItem,
  test,
} from './fixtures';

// Screens the dark-mode audits (contrast, optical alignment) open: a seeded diagram shaped like a real one,
// a dark visitor, a share link, and a fresh identity-less visitor.

export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
export const CANVAS = '[data-canvas-a11y-root]';

// A minted guest (mintGuest) brings its guest token, so the browser is that guest on every page load.
export async function darkVisitor(page: Page, owner?: string): Promise<void> {
  if (owner) await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('livehuddle:v2:ui-mode', 'dark');
    localStorage.setItem('livehuddle:v2:name-confirmed', '1');
  });
}

// A board shaped like a real one: an actor, boxes and a caption, on the Default scheme, so the canvas
// ink is the palette's own. Only kinds livehuddle makes (docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine").
export async function seedDocument(page: Page, owner: string, origin: string): Promise<string> {
  return (await seedDrawnDocument(page, owner, origin)).id;
}

// The seeded document's row on an Explorer listing.
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
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 100,
    label,
  });
  const elements = [
    {
      id: 'actor',
      type: 'sticky',
      x: 440,
      y: 20,
      width: 120,
      height: 100,
      label: 'Webber',
    },
    box('a', 'Assistant', 180, 240),
    box('s', 'Spinner', 440, 240),
    box('r', 'Runa (Backend)', 280, 480),
    {
      id: 'x3',
      type: 'text',
      x: 240,
      y: 380,
      width: 220,
      height: 30,
      label: 'Use personal assistant',
    },
  ];
  const res = await seedDocumentItem(page.request, ownerHeaders(owner, { Origin: origin }), {
    id,
    name: 'Contrast',
    tabs: [{ id: tabId, name: 'Runa', elements }],
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
    headers: await documentHeaders(page.request, owner, id, {
      Origin: origin,
      'Content-Type': 'application/json',
    }),
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
  await context.addInitScript(() => localStorage.setItem('livehuddle:v2:ui-mode', 'dark'));
  return context.newPage();
}
