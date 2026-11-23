import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import {
  openAiSettings,
  openView,
  person,
  saveKey,
  secondPerson,
  shareCode,
  signedInKnowledgebase,
} from './knowledge-session';

// AI Settings (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Share roles"; blueprints/ask-ui.md): the
// knowledgebase's Claude key is sent once and never comes back. After it is saved the page holds its last four
// characters and nothing else of it, and only an Editor is offered the key's controls. The key here is made up: the
// stack's stand-in answers for Anthropic.

const KEY = 'sk-ant-e2e-not-a-real-key-7Qx2Lm9f3c';

// Everywhere a page could keep a secret: its markup, every field's value, and both storages.
const heldByThePage = (page: Page) =>
  page.evaluate(() => {
    const fields = [...document.querySelectorAll('input, textarea')].map(
      (el) => (el as HTMLInputElement).value,
    );
    const stores = [localStorage, sessionStorage].map((s) =>
      Object.keys(s)
        .map((k) => `${k}=${s.getItem(k) ?? ''}`)
        .join('\n'),
    );
    return [document.documentElement.outerHTML, ...fields, ...stores].join('\n');
  });

test('a saved key shows only its last four characters, is kept nowhere on the page, and can be removed', async ({
  page,
  pageErrors,
}) => {
  await signedInKnowledgebase(page);
  await openView(page, 'Ask');
  const dialog = await openAiSettings(page);
  // Built-In AI is chosen while there is no key: the key's field is behind Your Own Key.
  const which = dialog.getByRole('radiogroup', { name: 'Which AI' });
  await expect(which.getByRole('radio', { name: /^Built-In AI/ })).toBeChecked();
  await expect(dialog.getByRole('region', { name: 'Claude API Key' })).toHaveCount(0);
  // The radio is drawn as its card: the card's words are what a person presses.
  await which.getByText('Your Own Key', { exact: true }).click();
  await expect(which.getByRole('radio', { name: /^Your Own Key/ })).toBeChecked();
  const keyRegion = dialog.getByRole('region', { name: 'Claude API Key' });
  await expect(keyRegion.getByRole('status')).toHaveText('No Key Yet');

  const field = keyRegion.getByRole('textbox', { name: 'Add a Claude Key' });
  await expect(field).toHaveAttribute('type', 'password');
  await field.fill(KEY);
  const stored = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/ai\/key$/.test(new URL(r.url()).pathname),
  );
  await keyRegion.getByRole('button', { name: 'Save Key' }).click();
  const response = await stored;
  expect(response.ok()).toBe(true);
  // The api's answer holds the hint, never the key.
  expect(await response.text()).not.toContain(KEY);

  await expect(keyRegion.getByRole('status')).toHaveText(`Key Ending ${KEY.slice(-4)}`);
  // The field is the Replace field now, and empty.
  const replace = keyRegion.getByRole('textbox', { name: 'Replace the Key' });
  await expect(replace).toHaveValue('');
  await expect(keyRegion.getByRole('button', { name: 'Replace' })).toBeDisabled();
  expect(await heldByThePage(page)).not.toContain(KEY);
  expect(await heldByThePage(page)).not.toContain(KEY.slice(0, -4));

  // Reopened after a reload: still only the hint.
  await page.reload();
  const again = await openAiSettings(page);
  await expect(
    again.getByRole('region', { name: 'Claude API Key' }).getByRole('status'),
  ).toHaveText(`Key Ending ${KEY.slice(-4)}`);
  expect(await heldByThePage(page)).not.toContain(KEY);

  // Remove asks once, then the knowledgebase has no key and is back on built-in AI.
  await again.getByRole('button', { name: 'Remove', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Remove the Key?' });
  await confirm.getByRole('button', { name: /^Remove/ }).click();
  await expect(again.getByRole('radio', { name: /^Built-In AI/ })).toBeChecked();
  await expect(again.getByRole('region', { name: 'Claude API Key' })).toHaveCount(0);
  await again.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('[data-ask-ai]')).toContainText('Built-in AI');
  expectNoPageErrors(pageErrors);
});

for (const role of ['view', 'participate'] as const) {
  test(`someone with a ${role} link sees that a key is set and none of its controls`, async ({
    page,
    browser,
    baseURL,
  }) => {
    const { who, id } = await signedInKnowledgebase(page);
    await saveKey(page, who, id, KEY);
    const code = await shareCode(page, who, id, role);

    const visitor = await secondPerson(
      browser,
      baseURL!,
      `/document/${id}?s=${code}&view=ask`,
      person('Grace', 'Hopper'),
    );
    const dialog = await openAiSettings(visitor);
    const keyRegion = dialog.getByRole('region', { name: 'Claude API Key' });
    await expect(dialog.locator('[data-ai-settings-read-only]')).toHaveText(
      'Only an Editor of this knowledgebase can change these.',
    );
    await expect(keyRegion.getByRole('textbox')).toHaveCount(0);
    for (const name of ['Save Key', 'Replace', 'Remove'])
      await expect(dialog.getByRole('button', { name, exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Model' })).toHaveCount(0);
    // The hint is an Editor's: a reader is not told the key's last characters.
    await expect(dialog).not.toContainText(KEY.slice(-4));
    expect(await heldByThePage(visitor)).not.toContain(KEY.slice(-4));
    await visitor.context().close();
  });
}
