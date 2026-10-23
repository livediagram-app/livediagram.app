import type { Page } from '@playwright/test';
import { test, expect, expectNoPageErrors } from '../fixtures';
import { freshUserId, installSession, type StubUser } from './session';

// Explorer Home signed in (docs/specs/013-workspace/explorer-home.md), against the signed-in
// export: a team member's Home names what a teammate did on a team design, where it lives, and
// opens it; the person's own Jump Back In holds the design they opened, on a desktop and on a
// phone, and See More leads to Recent.

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

function member(id: string, firstName: string): StubUser {
  return {
    id,
    firstName,
    lastName: 'Tester',
    email: `${id}@example.com`,
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

test('a teammate’s work on a team design reaches Home, named and placed', async ({
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
  await api(page, ann, 'POST', '/designs', {
    id: doc,
    name: 'Payments architecture',
    teamId: team,
    tabs: [{ id: tab, name: 'Tab 1', elements: [{ ...shape, label: 'Ledger' }] }],
  });
  await api(page, ann, 'GET', `/designs/${doc}/tabs/${tab}`, undefined, {
    'X-Design-Open': '1',
  });
  await api(page, bob, 'PUT', `/designs/${doc}/tabs/${tab}`, {
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

  await installSession(page, member(ann, 'Ann'));
  await page.goto('/explorer');
  await expect(page).toHaveURL(/\/explorer\/home\/?$/, { timeout: 30_000 });
  const nav = page.getByRole('navigation', { name: 'Explorer' }).first();
  await expect(nav.getByRole('treeitem', { name: 'Home' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await expect(
    page
      .getByRole('region', { name: 'Jump Back In' })
      .getByRole('link', { name: 'Payments architecture' }),
  ).toHaveAttribute('href', `/design/${doc}`);
  const happened = page.getByRole('region', { name: 'What Happened' });

  // One teammate: each action its own entry, naming who, what, which design and where.
  const comment = happened.getByRole('link', { name: /^Bob commented on Payments architecture/ });
  await expect(comment).toContainText('“Split this out?”');
  await expect(comment).toContainText('Platform team');
  await expect(
    happened.getByRole('link', { name: /^Bob edited Payments architecture/ }),
  ).toBeVisible();

  // Home has no Timeline of its own.
  await expect(page.getByRole('region', { name: 'Timeline' })).toHaveCount(0);

  // A phone: the same design in the strip, which ends in See More.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByRole('region', { name: 'Jump Back In' })
      .getByRole('link', { name: 'Payments architecture' }),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Jump Back In' })
    .getByRole('link', { name: 'See More' })
    .click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
  await page.goBack();
  await page.setViewportSize({ width: 1280, height: 800 });

  await comment.click();
  await expect(page).toHaveURL(new RegExp(`/design/${doc}`));
  expectNoPageErrors(pageErrors);
});
