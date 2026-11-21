import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { addPage, nameOpenPage, pageRow, paragraphs, writeLines } from '../knowledgebase';
import {
  asPerson,
  openView,
  saveKey,
  savedWith,
  signedInKnowledgebase,
  type Person,
} from './knowledge-session';

// Ask (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "The Ask view"; blueprints/ask-ui.md), end to end
// through the real route, with the stack's stand-in answering for Anthropic (scripts/e2e-claude-stand-in.mjs: a
// question that finds passages is answered citing the first, one that finds none comes back as a gap). No model is
// called and no real key exists.

test.use({ viewport: { width: 1440, height: 860 } });

const KEY = 'sk-ant-e2e-not-a-real-key-0000';
const ask = (page: Page) => page.getByRole('region', { name: 'Ask' });

// Two pages with writing the room has indexed, and a key.
async function knowledgebaseWithKey(page: Page): Promise<{ who: Person; id: string }> {
  const made = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  let saved = savedWith(page, 'blue lever');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;
  await addPage(page, 'Escalation');
  saved = savedWith(page, 'duty engineer');
  await writeLines(page, 'Page the duty engineer when the queue worker stays down.');
  await saved;
  await saveKey(page, made.who, made.id, KEY);
  return made;
}

async function send(page: Page, question: string): Promise<void> {
  const field = ask(page).getByRole('textbox', { name: /^Ask a (question|follow-up)$/ });
  await field.fill(question);
  await field.press('Enter');
}

test('with no key, Ask answers on built-in AI, then Accept Answer files the chat', async ({
  page,
  pageErrors,
}) => {
  await signedInKnowledgebase(page);
  await openView(page, 'Ask');
  await expect(ask(page).locator('[data-ask-ai]')).toContainText('Uses built-in AI');
  await send(page, 'What is this knowledgebase for?');
  // No passages match a new knowledgebase: the stand-in answers it as a gap, and the chat is answered.
  const answer = ask(page).getByRole('article', { name: 'Answer' });
  await expect(answer).toHaveAttribute('aria-busy', 'false');
  await ask(page).getByRole('button', { name: 'Accept Answer' }).click();
  await expect(ask(page).getByRole('heading', { name: 'No Questions Yet' })).toBeVisible();
  const completed = page.getByRole('region', { name: 'Completed Questions' });
  await completed.getByRole('button', { name: /Completed Questions/ }).click();
  await completed.getByRole('button', { name: 'What is this knowledgebase for?' }).click();
  await ask(page).getByRole('button', { name: 'Reopen' }).click();
  await expect(ask(page).getByRole('textbox')).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('an answer streams in, and each citation chip goes to its source card', async ({
  page,
  pageErrors,
}) => {
  await knowledgebaseWithKey(page);
  await openView(page, 'Ask');
  await expect(ask(page).getByRole('heading', { name: 'No Questions Yet' })).toBeVisible();

  // Every state the streaming answer passes through is kept, to show it arrived in pieces.
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { __streamed: Set<string> }).__streamed = seen;
    new MutationObserver(() => {
      const text = document.querySelector('[data-ask-stream]')?.textContent;
      if (text) seen.add(text);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await send(page, 'How do I restart the queue worker?');

  const answer = ask(page).getByRole('article', { name: 'Answer' });
  await expect(answer).toHaveAttribute('data-status', 'done');
  const streamed = await page.evaluate(() => [
    ...(window as unknown as { __streamed: Set<string> }).__streamed,
  ]);
  expect(
    streamed.length,
    `the answer arrived in pieces: ${JSON.stringify(streamed)}`,
  ).toBeGreaterThan(1);
  // The form's own tags never show.
  expect(streamed.join('')).not.toContain('<');
  await expect(answer).toContainText('The pages answer this');
  await expect(answer).not.toContainText('<answer>');
  await expect(ask(page).getByText('You asked: How do I restart the queue worker?')).toBeVisible();

  // Chips and cards carry the same numbers; pressing a chip lights its card.
  const chips = answer.locator('[data-citation]');
  const sources = ask(page).getByRole('complementary', { name: 'Sources' });
  const numbers = await chips.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-citation')),
  );
  expect(numbers.length).toBeGreaterThan(0);
  for (const number of numbers)
    await expect(sources.locator(`[data-source="${number}"]`)).toBeVisible();
  await expect(chips.first()).toHaveAccessibleName(/^Source \d+: (Runbook|Escalation)$/);
  await chips.first().click();
  await expect(sources.locator(`[data-source="${numbers[0]}"]`)).toHaveAttribute('data-lit', '');
  await expect(answer).toContainText(/Answered From \d+ /);

  // The question is kept for the person, in this browser.
  await expect(
    ask(page)
      .getByRole('complementary', { name: 'Your Questions' })
      .getByRole('button', { name: 'How do I restart the queue worker?' }),
  ).toBeVisible();

  // A source card shows Pages at that page and passage.
  await sources.locator(`[data-source="${numbers[0]}"]`).click();
  await expect(
    pageRow(page, /^(Runbook|Escalation)$/).and(page.locator('[aria-current="page"]')),
  ).toBeVisible();
  await expect(paragraphs(page).filter({ hasText: 'queue worker' }).first()).toBeInViewport();
  expectNoPageErrors(pageErrors);
});

test('what the pages do not cover shows as a Knowledge Gap and is listed under AI Knowledge', async ({
  page,
  pageErrors,
}) => {
  await knowledgebaseWithKey(page);
  await openView(page, 'Ask');
  const question = 'Where is the zeppelin hangar?';
  await send(page, question);

  const answer = ask(page).getByRole('article', { name: 'Answer' });
  await expect(answer).toHaveAttribute('data-status', 'done');
  await expect(answer).toContainText('The pages do not cover this.');
  await expect(answer.getByRole('note')).toContainText(
    'One thing the knowledgebase does not cover.',
  );
  const gap = ask(page).getByRole('region', { name: 'Knowledge Gap' });
  await expect(gap).toContainText(question);

  await openView(page, 'AI Knowledge');
  const questions = page.getByRole('region', { name: 'Questions Nobody Could Answer' });
  await expect(questions.locator('[data-question]')).toHaveCount(1);
  await expect(questions).toContainText(question);
  expectNoPageErrors(pageErrors);
});

test('past the hourly limit Ask refuses in words', async ({ page }) => {
  test.setTimeout(90_000);
  const { who, id } = await knowledgebaseWithKey(page);
  const headers = await asPerson(page, who, id);
  // Twenty questions this hour, asked through the route: the person's limit.
  for (let batch = 0; batch < 4; batch += 1) {
    const answers = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        page.request.post(`/api/documents/${id}/ask`, {
          headers,
          data: { question: `Question ${batch * 5 + i + 1} about the queue worker?` },
        }),
      ),
    );
    for (const res of answers) expect(res.status()).toBe(200);
  }
  await openView(page, 'Ask');
  await send(page, 'One more about the queue worker?');
  const refusal = ask(page).getByRole('alert');
  await expect(refusal).toContainText('You Have Asked 20 Questions This Hour');
  await expect(refusal).toContainText(
    'That is the most one person may ask in an hour. Ask again later; search works in the meantime.',
  );
  await expect(ask(page)).not.toContainText('person-limit');
  await expect(ask(page)).not.toContainText('429');
});

test('a key Claude does not accept is said in words', async ({ page }) => {
  const { who, id } = await knowledgebaseWithKey(page);
  // The stand-in refuses a key that says so, as Anthropic refuses one it does not know.
  await saveKey(page, who, id, 'sk-ant-e2e-refused-key-0000');
  await openView(page, 'Ask');
  await send(page, 'How do I restart the queue worker?');
  await expect(ask(page).getByRole('alert')).toContainText('Claude Did Not Accept the Key');
});
