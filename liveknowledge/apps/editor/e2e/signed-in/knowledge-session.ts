import type { Browser, Locator, Page } from '@playwright/test';
import { documentHeaders, enableDebugLogs, expect, markModeToursSeen } from '../fixtures';
import { newKnowledgebase, openPageId, titleOf } from '../knowledgebase';
import { freshUserId, installSession, type StubUser } from './session';

// What the signed-in knowledgebase specs share (docs/specs/003-system-architecture/e2e-smoke.md "Signed-in specs"): a
// person signed in on a fresh account with a new knowledgebase saved to it, the api called as that person or as
// their agent, a second person arriving through a share link, and the three views.

export type Person = Required<StubUser>;

export const person = (firstName: string, lastName: string): Person => ({
  id: freshUserId(firstName),
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}@example.com`,
});

/** Signs the page in as a fresh account and opens a new knowledgebase, saved to that account. */
export async function signedInKnowledgebase(
  page: Page,
  who: Person = person('Ada', 'Lovelace'),
): Promise<{ who: Person; id: string }> {
  await installSession(page, who);
  const id = await newKnowledgebase(page);
  // Saved to the account, in Private (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase"). On
  // a phone the caret in the Title gives the top row to the writing bar and Share steps aside (page-surface.md "The
  // footer"), so there the api answers for it to the account instead.
  if ((page.viewportSize()?.width ?? 1280) >= 640) {
    await expect(page.getByRole('button', { name: 'Share, Private' })).toBeVisible();
  } else {
    await expect
      .poll(async () =>
        (
          await page.request.get(`/api/documents/${id}`, { headers: await asPerson(page, who, id) })
        ).status(),
      )
      .toBe(200);
  }
  return { who, id };
}

/** Headers for an api call as the account the page is signed in as, with its grant on the knowledgebase. */
export const asPerson = (page: Page, who: Person, id: string): Promise<Record<string, string>> =>
  documentHeaders(page.request, who.id, id, {
    Origin: new URL(page.url()).origin,
    'Content-Type': 'application/json',
  });

/** The save of the open page that carries `text`: the room indexes a page's passages and links when it is saved. */
export const savedWith = (page: Page, text: string) =>
  page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      /\/api\/documents\/[^/]+\/tabs\//.test(r.url()) &&
      (r.request().postData() ?? '').includes(text),
  );

/** A share link of the knowledgebase at a role, made as its owner through the index, as Share makes one: its code. */
export async function shareCode(
  page: Page,
  who: Person,
  id: string,
  role: 'view' | 'participate' | 'edit',
): Promise<string> {
  const res = await page.request.post(`/api/index/items/${encodeURIComponent(id)}/share`, {
    headers: await asPerson(page, who, id),
    data: { level: role },
  });
  expect(res.ok(), `share link: ${res.status()}`).toBe(true);
  return ((await res.json()) as { link: { code: string } }).link.code;
}

/** A second person, signed in on their own account in their own browser context, opening `path`. */
export async function secondPerson(
  browser: Browser,
  baseURL: string,
  path: string,
  who: Person,
): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  await enableDebugLogs(context);
  await markModeToursSeen(context);
  await context.addInitScript(() => localStorage.setItem('liveknowledge:v2:name-confirmed', '1'));
  const page = await context.newPage();
  await installSession(page, who);
  await page.goto(path);
  await titleOf(page).waitFor({ timeout: 30_000 });
  return page;
}

/** One of the three views, from the switch (Pages, Ask, Insights). */
export async function openView(page: Page, view: 'Pages' | 'Ask' | 'Insights'): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Knowledgebase Views' })
    .getByRole('link', { name: view, exact: true })
    .click();
  const param = view === 'Ask' ? 'ask' : view === 'Insights' ? 'ai' : null;
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe(param);
}

/** The AI Settings dialog, opened from the Ask view's head, once its settings have loaded: an Editor's Which AI choice
 *  is made, or anyone else's line says which AI is in use. */
export async function openAiSettings(page: Page): Promise<Locator> {
  await page
    .getByRole('region', { name: 'Ask' })
    .getByRole('button', { name: 'AI Settings', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'AI Settings' });
  const which = dialog.getByRole('region', { name: 'Which AI' });
  await expect(
    which
      .getByRole('radio', { checked: true })
      .or(which.locator('[data-ai-source-name]:not(:empty)')),
  ).toHaveCount(1);
  return dialog;
}

/** Saves a Claude key for the knowledgebase through the api, as the person. Never a real key: the stack's stand-in
 *  answers for Anthropic (scripts/e2e-claude-stand-in.mjs). */
export async function saveKey(
  page: Page,
  who: Person,
  id: string,
  key: string,
  provider?: 'anthropic' | 'openai',
): Promise<void> {
  const res = await page.request.put(`/api/documents/${id}/ai/key`, {
    headers: await asPerson(page, who, id),
    data: provider ? { provider, key } : { key },
  });
  expect(res.ok(), `saving the key: ${res.status()}`).toBe(true);
}

export { openPageId };
