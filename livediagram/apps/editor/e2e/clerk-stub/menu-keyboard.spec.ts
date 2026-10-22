import { test, expect, expectNoPageErrors } from '../fixtures';
import { freshUserId, installClerkStub } from './clerk-stub';

// The account menu by keyboard, signed in (docs/specs/004-interface-design/menus.md): a menu button
// whose menu is named by the account's name, takes focus on open, and gives it back on Escape.

test.use({ colorScheme: 'dark' });

test('the account menu walks by keyboard and returns focus', async ({ page, pageErrors }) => {
  await installClerkStub(page, {
    id: freshUserId('menu-keys'),
    firstName: 'Ariel',
    lastName: 'Keys',
    email: 'ariel@example.com',
    hasImage: false,
    imageUrl: '',
    externalAccounts: [],
  });
  await page.goto('/explorer/timeline');
  const trigger = page.getByRole('button', { name: 'Account menu' });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAccessibleName(/Ariel Keys/);
  await expect(trigger).toHaveAttribute('aria-controls', (await menu.getAttribute('id'))!);
  await expect(menu.getByRole('menuitem', { name: 'Account' })).toBeFocused();
  await page.keyboard.press('s');
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expectNoPageErrors(pageErrors);
});
