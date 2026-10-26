import { test, expect, expectNoPageErrors } from '../fixtures';
import { freshUserId, installSession } from './session';

// The account menu by keyboard, signed in (docs/specs/004-interface-design/menus.md): a menu button named by the
// account's name ("<name>, account menu") whose menu is named "Account" (@liveworkspace/account-menu, pinned by its
// AppAccountMenu.test.tsx), takes focus on open on Settings, and gives it back on Escape.

test.use({ colorScheme: 'dark' });

test('the account menu walks by keyboard and returns focus', async ({ page, pageErrors }) => {
  await installSession(page, {
    id: freshUserId('menu-keys'),
    firstName: 'Ariel',
    lastName: 'Keys',
    email: 'ariel@example.com',
  });
  await page.goto('/explorer/timeline');
  const trigger = page.getByRole('button', { name: 'Account menu' });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAccessibleName(/^Ariel.*, account menu$/);
  await expect(menu).toHaveAccessibleName('Account');
  await expect(trigger).toHaveAttribute('aria-controls', (await menu.getAttribute('id'))!);
  await expect(menu.getByRole('menuitem', { name: /^Settings/ })).toBeFocused();
  await page.keyboard.press('s');
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expectNoPageErrors(pageErrors);
});
