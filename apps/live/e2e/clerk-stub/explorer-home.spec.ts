import type { Page } from '@playwright/test';
import { test, expect, expectNoPageErrors } from '../fixtures';
import { freshUserId, installClerkStub, type StubUser } from './clerk-stub';

// Explorer Home signed in (docs/specs/013-workspace/explorer-home.md), against the Clerk-enabled
// export: a team member's Home names what a teammate did on a team document, where it lives, and
// opens it; the person's own Jump back in and Timeline hold the document they opened.

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

function member(id: string, firstName: string): StubUser {
  return {
    id,
    firstName,
    lastName: 'Tester',
    email: `${id}@example.com`,
    hasImage: false,
    imageUrl: '',
    externalAccounts: [],
  };
}

async function api(
  page: Page,
  userId: string,
  method: 'POST' | 'PUT' | 'GET',
  path: string,
  data?: unknown,
  extra: Record<string, string> = {},
) {
  const token = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  const res = await page.request.fetch(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...extra },
    ...(data === undefined ? {} : { data }),
  });
  expect(res.ok(), `${method} ${path} failed: ${res.status()}`).toBe(true);
  return res;
}

test('a teammate’s work on a team document reaches Home, named and placed', async ({
  page,
  pageErrors,
}) => {
  const ann = freshUserId('ann');
  const bob = freshUserId('bob');
  const team = crypto.randomUUID();
  await api(page, ann, 'POST', '/teams', { id: team, name: 'Platform team' });
  const link = (await (await api(page, ann, 'POST', `/teams/${team}/invite-link`)).json()) as {
    inviteLink: { token: string };
  };
  await api(page, bob, 'POST', `/teams/invite-link/${link.inviteLink.token}/join`);
  await api(page, bob, 'PUT', `/participants/${bob}`, { name: 'Bob', color: '#f59e0b' });

  const doc = crypto.randomUUID();
  const tab = crypto.randomUUID();
  const shape = { id: 'a', type: 'shape', shape: 'square', x: 40, y: 40, width: 200, height: 100 };
  await api(page, ann, 'POST', '/documents', {
    id: doc,
    name: 'Payments architecture',
    teamId: team,
    tabs: [{ id: tab, name: 'Tab 1', elements: [{ ...shape, label: 'Ledger' }] }],
  });
  await api(page, ann, 'GET', `/documents/${doc}/tabs/${tab}`, undefined, {
    'X-Document-Open': '1',
  });
  await api(page, bob, 'PUT', `/documents/${doc}/tabs/${tab}`, {
    id: tab,
    name: 'Tab 1',
    elements: [
      {
        ...shape,
        label: 'Ledger service',
        commentThread: {
          resolved: false,
          comments: [
            {
              id: crypto.randomUUID(),
              text: 'Split this out?',
              createdAt: Date.now(),
              authorName: 'Bob',
              authorColor: '#f59e0b',
            },
          ],
        },
      },
    ],
  });

  await installClerkStub(page, member(ann, 'Ann'));
  await page.goto('/explorer');
  await expect(page).toHaveURL(/\/explorer\/home\/?$/, { timeout: 30_000 });
  const nav = page.getByRole('navigation', { name: 'Explorer' }).first();
  await expect(nav.getByRole('treeitem', { name: 'Home' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const recent = page.getByRole('region', { name: 'Recent' });
  await expect(
    recent
      .getByRole('list', { name: 'Jump back in' })
      .getByRole('link', { name: 'Payments architecture' }),
  ).toHaveAttribute('href', `/document/${doc}`);

  // One teammate: each action its own entry, naming who, what, which document and where.
  const comment = recent.getByRole('link', { name: /^Bob commented on Payments architecture/ });
  await expect(comment).toContainText('“Split this out?”');
  await expect(comment).toContainText('Platform team');
  await expect(recent.getByRole('link', { name: /^Bob edited Payments architecture/ })).toBeVisible();

  await expect(
    page
      .getByRole('region', { name: 'Timeline' })
      .getByRole('link', { name: /^Payments architecture, created at / }),
  ).toBeVisible();

  await comment.click();
  await expect(page).toHaveURL(new RegExp(`/document/${doc}`));
  expectNoPageErrors(pageErrors);
});
