import type { Locator, Page } from '@playwright/test';
import { expect, serverNewUrl } from './fixtures';

// What the knowledgebase specs share (docs/specs/003-system-architecture/e2e-smoke.md "Layout"): opening a new
// knowledgebase, the writing of the open page, the page tree and its row menu. Everything is found by role and
// accessible name where the page gives one; the writing's blocks have no role of their own, so they are found by the
// classes the article engine gives them.

export const CANVAS = '[data-canvas-a11y-root]';
/** The open page's writing: one article, its Title first. */
export const WRITING = '.article-flow';

export const writing = (page: Page): Locator => page.locator(WRITING);
export const titleOf = (page: Page): Locator =>
  page.locator(`${WRITING} > [data-article-style="title"]`);
/** The writing's body paragraphs, in order. */
export const paragraphs = (page: Page): Locator => page.locator(`${WRITING} > p.article-body`);

export const pageTree = (page: Page): Locator => page.getByRole('tree', { name: 'Pages' });
/** A row of the page tree by its page's name (and its verified state, when it has one: "Runbook, Verified"). */
export const pageRow = (page: Page, name: string | RegExp): Locator =>
  pageTree(page).getByRole('treeitem', { name, exact: true });
/** The names of the tree's rows, top to bottom, each with its level: "1 Start Here". */
export const treeShape = (page: Page): Promise<string[]> =>
  pageTree(page)
    .getByRole('treeitem')
    .evaluateAll((rows) =>
      rows.map((row) => `${row.getAttribute('aria-level')} ${row.getAttribute('aria-label')}`),
    );

/** The style of the block the caret is in ("title", "body", ...), or null when the writing does not hold it. */
export const caretBlock = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!active?.classList.contains('article-flow')) return null;
    const anchor = getSelection()?.anchorNode;
    const el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element | null);
    return el?.closest?.('[data-block-id]')?.getAttribute('data-article-style') ?? null;
  });

export async function expectCaretInTitle(page: Page): Promise<void> {
  await expect.poll(() => caretBlock(page), 'the caret is in the Title').toBe('title');
}

/** The id of the knowledgebase the page is on. */
export const knowledgebaseId = (page: Page): string =>
  new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
/** The id of the open page (the address's `#t=`). */
export const openPageId = (page: Page): string =>
  new URLSearchParams(new URL(page.url()).hash.slice(1)).get('t') ?? '';

/**
 * A new knowledgebase, open on Start Here with the caret in its Title
 * (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase"). A guest's is kept Offline; a
 * signed-in person's is saved to their account. Answers its id.
 */
export async function newKnowledgebase(page: Page, url = '/new?blank=1'): Promise<string> {
  await page.goto(url);
  await page.waitForURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await titleOf(page).waitFor({ timeout: 30_000 });
  await expectCaretInTitle(page);
  return knowledgebaseId(page);
}

/** A guest's new knowledgebase on the server (fixtures `serverNewUrl`), for a spec that watches its saves or shares it. */
export async function newServerKnowledgebase(page: Page): Promise<string> {
  return newKnowledgebase(page, await serverNewUrl(page, '/new?blank=1'));
}

/** Types the open page's name into its Title, where the caret is, and waits for the tree to follow. */
export async function nameOpenPage(page: Page, name: string): Promise<void> {
  await expectCaretInTitle(page);
  await page.keyboard.type(name);
  await expect(pageRow(page, name)).toBeVisible();
}

/** Writes lines under the Title: the caret goes to the end of the writing, and each line is a new paragraph. */
export async function writeLines(page: Page, ...lines: string[]): Promise<void> {
  await writing(page).focus();
  await page.keyboard.press('ControlOrMeta+End');
  for (const line of lines) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(line);
  }
  await expect(writing(page)).toContainText(lines[lines.length - 1]!);
}

/** New Page at the foot of the tree, named: the new page takes the caret in its Title. */
export async function addPage(page: Page, name: string): Promise<void> {
  await page.getByRole('complementary', { name: 'Pages' }).getByRole('button', { name: 'New Page' }).click();
  await expect(pageRow(page, 'Untitled Page')).toBeVisible();
  await nameOpenPage(page, name);
}

/** Opens a page from its row and waits for its Title to show. */
export async function openPage(page: Page, name: string): Promise<void> {
  await pageRow(page, name).click();
  await expect(pageRow(page, name)).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText(name);
}

/** A row's menu (its controls mount while the row is hovered or focused), ready for a verb to be pressed. */
export async function openRowMenu(page: Page, name: string): Promise<Locator> {
  const row = pageRow(page, name);
  await row.hover();
  await row.getByRole('button', { name: `Page Options for ${name}` }).click();
  const menu = page.getByRole('menu', { name: 'Page Options' });
  await expect(menu).toBeVisible();
  return menu;
}

/** Presses a verb of a row's menu. */
export async function rowVerb(page: Page, name: string, verb: string): Promise<void> {
  const menu = await openRowMenu(page, name);
  await menu.getByRole('menuitem', { name: verb, exact: true }).click();
  await expect(menu).toBeHidden();
}

/** Add Subpage from a row's menu, named. */
export async function addSubpage(page: Page, parent: string, name: string): Promise<void> {
  await rowVerb(page, parent, 'Add Subpage');
  await expect(pageRow(page, 'Untitled Page')).toBeVisible();
  await nameOpenPage(page, name);
}

/** No sideways scroll: the document is no wider than the window. */
export async function expectNoSidewaysScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where}: the page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

/** The page links in the open page's writing. */
export const pageLinks = (page: Page): Locator => page.locator(`${WRITING} a.article-page-link`);

/** What a page link reads as: its page's current title, or "Deleted Page". The words are drawn by a style rule a
 *  page (lib/knowledge/page-link-titles.ts), so they are read where the browser paints them. */
export const shownLinkText = (link: Locator): Promise<string> =>
  link.evaluate((el) => {
    const content = getComputedStyle(el, '::before').content;
    return content.replace(/^"|"$/g, '').replace(/\\"/g, '"');
  });

/** The page link picker, open while `[[` is being typed. */
export const linkPicker = (page: Page): Locator =>
  page.getByRole('listbox', { name: 'Link to a page' });

/** The knowledgebase's search dialog, opened with Cmd or Ctrl K. */
export async function openSearch(page: Page): Promise<Locator> {
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Search This Knowledgebase' });
  await expect(dialog.getByRole('combobox', { name: 'Search This Knowledgebase' })).toBeFocused();
  return dialog;
}

/**
 * Waits until this browser's Offline store holds a page of this name whose writing holds `text`
 * (docs/specs/006-document/offline-mode.md): the state a reload reads back. Typing is saved after a pause, and what
 * the page writes as it closes is best effort, so a spec that reloads waits for the save itself, never for time.
 */
export async function expectKeptOffline(page: Page, name: string, text = ''): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          async ([wantedName, wantedText]) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const open = indexedDB.open('liveknowledge-offline');
              open.onsuccess = () => resolve(open.result);
              open.onerror = () => reject(open.error);
            });
            try {
              const rows = await new Promise<{ tabs?: { name: string }[] }[]>((resolve) => {
                const all = db.transaction('documents').objectStore('documents').getAll();
                all.onsuccess = () => resolve(all.result as { tabs?: { name: string }[] }[]);
                all.onerror = () => resolve([]);
              });
              return rows.some((row) =>
                (row.tabs ?? []).some(
                  (tab) => tab.name === wantedName && JSON.stringify(tab).includes(wantedText!),
                ),
              );
            } finally {
              db.close();
            }
          },
          [name, text] as const,
        ),
      { message: `the page "${name}" is kept Offline${text ? ` with "${text}"` : ''}` },
    )
    .toBe(true);
}
