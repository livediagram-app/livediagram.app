import type { Page, TestInfo } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { freshUserId, installSession } from './session';

// Ask AI in the footer's Tools (docs/specs/013-workspace/ask-ai.md; liveworkspace/docs/specs/019-ask/ask.md), signed
// in, against the signed-in export. The tool's answers come from a stand-in for `POST /api/ask` that streams as the
// route does, so what is asserted never depends on a model; the route itself is called once, for its shape. No real
// key exists.

test.use({ viewport: { width: 1440, height: 900 } });

const TAB = 'tab-flow';
const shape = (id: string, label: string, x: number) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 300,
  width: 180,
  height: 90,
  fillColor: '#ffffff',
  label,
});
const SHAPES = [
  shape('payment', 'Payment Service', 200),
  shape('queue', 'Retry Queue', 480),
  shape('email', 'Customer Email', 760),
];
const source = (number: number, at: number) => ({
  number,
  id: `${TAB}:${SHAPES[at]!.id}`,
  tabId: TAB,
  tabName: 'Checkout Flow',
  elementId: SHAPES[at]!.id,
  kind: 'Shape',
  title: SHAPES[at]!.label,
  text: SHAPES[at]!.label,
});

const sse = (...events: object[]) =>
  events
    .map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
    .join('');

// A signed-in person on a canvas of three labelled shapes, made through the api.
async function canvas(page: Page): Promise<string> {
  const userId = freshUserId('askai');
  await page.addInitScript(() => {
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:user-preferences:v1', JSON.stringify({ tourSeen: true }));
  });
  await installSession(page, {
    id: userId,
    firstName: 'Ada',
    lastName: 'Asker',
    email: `${userId}@example.com`,
  });
  const token = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  const id = crypto.randomUUID();
  const made = await page.request.post('/api/documents', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      id,
      name: 'Checkout Architecture',
      tabs: [{ id: TAB, name: 'Checkout Flow', elements: SHAPES }],
    },
  });
  expect(made.status(), 'create the canvas').toBe(201);
  await page.goto(`/document/${id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  return token;
}

async function openAskAi(page: Page) {
  await page.locator('[data-tools-button]').click();
  const row = page.locator('[data-tools-item="ask-ai"]');
  await expect(row).toContainText('Ask AI');
  await expect(row).toContainText('Ask a question, get an answer from this canvas.');
  return row;
}

// A picture of the state, kept with the run's results.
async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}

test('Ask AI answers in Tools, shows its sources beside it, and goes to one on the canvas', async ({
  page,
  pageErrors,
}, info) => {
  const asked: { question: string; passages: { title: string }[]; ai?: string }[] = [];
  await page.route('**/api/ask', async (route) => {
    asked.push(route.request().postDataJSON() as (typeof asked)[number]);
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: sse(
        {
          type: 'delta',
          text: 'The **Payment Service** hands a failed payment to the Retry Queue',
        },
        {
          type: 'done',
          text: 'The **Payment Service** hands a failed payment to the Retry Queue [1][2]. When retries run out, the customer is emailed [3].',
          sources: [source(1, 0), source(2, 1), source(3, 2)],
          provider: 'built-in',
          model: 'stand-in',
        },
      ),
    });
  });
  await canvas(page);
  const row = await openAskAi(page);
  await shot(page, info, 'tools-list');
  await row.click();

  const tool = page.locator('[data-ask-tool]');
  await expect(tool.getByText('Ask About This Canvas')).toBeVisible();
  // The AI pill says which AI the next question runs on.
  await expect(tool.locator('[data-ask-ai]')).toContainText('Built-In AI');
  const field = tool.getByRole('textbox', { name: 'Ask this canvas a question' });
  await expect(field).toBeFocused();
  await shot(page, info, 'first-open');

  await field.fill('What happens when a payment fails?');
  await field.press('Enter');
  const answer = tool.getByRole('article', { name: 'Answer' });
  await expect(answer).toHaveAttribute('aria-busy', 'false');
  await expect(answer.getByText('Payment Service')).toBeVisible();
  await expect(answer.getByRole('button', { name: /3 Sources/ })).toBeVisible();
  // The whole canvas went with the question: every labelled shape, as a passage.
  expect(asked[0]!.question).toBe('What happens when a payment fails?');
  expect(asked[0]!.passages.map((p) => p.title)).toEqual(SHAPES.map((s) => s.label));
  await shot(page, info, 'answer');

  // A citation opens Sources beside Tools, its own card lit.
  await answer.getByRole('button', { name: 'Source 2: Retry Queue' }).click();
  const sources = page.getByRole('dialog', { name: 'Sources' });
  await expect(sources.locator('[data-source]')).toHaveCount(3);
  await expect(sources.locator('[data-source="2"]')).toHaveAttribute('data-lit', '');
  const [toolsBox, sourcesBox] = await Promise.all([
    page.locator('[data-tools-popover]').boundingBox(),
    sources.boundingBox(),
  ]);
  // Beside Tools, never over it.
  expect(
    sourcesBox!.x + sourcesBox!.width <= toolsBox!.x ||
      sourcesBox!.x >= toolsBox!.x + toolsBox!.width,
  ).toBe(true);
  // Past its fade in, for the picture.
  await expect(sources).toHaveCSS('opacity', '1');
  await shot(page, info, 'sources');

  // A card goes to its place: the shape is selected, and the chat is still there.
  await sources.locator('[data-source="2"]').click();
  await expect(page.locator('[data-selection-grips] [data-grips-for="queue"]')).toHaveCount(1);
  await expect(tool).toBeVisible();
  await shot(page, info, 'source-on-canvas');
  expectNoPageErrors(pageErrors);
});

test('Answer With names the key in use and switches to built-in AI', async ({
  page,
  pageErrors,
}, info) => {
  let sent: { ai?: string } | null = null;
  await page.route('**/api/workspace/account/ai-key', (route) =>
    route.fulfill({
      json: {
        available: true,
        key: {
          provider: 'anthropic',
          model: 'claude-fable-5-2',
          hint: '4f2a',
          setAt: 1_763_000_000_000,
        },
        teams: [],
        providers: [
          {
            id: 'anthropic',
            label: 'Anthropic (Claude)',
            keyPrefix: 'sk-ant-',
            defaultModel: 'claude-fable-5-2',
            models: [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }],
          },
        ],
      },
    }),
  );
  await page.route('**/api/ask', async (route) => {
    sent = route.request().postDataJSON() as { ai?: string };
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: sse({
        type: 'done',
        text: 'Three steps.',
        sources: [],
        provider: 'built-in',
        model: 'stand-in',
      }),
    });
  });
  await canvas(page);
  await (await openAskAi(page)).click();
  const tool = page.locator('[data-ask-tool]');
  const pill = tool.locator('[data-ask-ai]');
  await expect(pill).toContainText('Claude Fable 5.2 (Your Key)');
  await pill.click();
  const menu = page.getByRole('dialog', { name: 'Answer With' });
  await expect(menu.getByText('Anthropic · Claude Fable 5.2 · No daily limits')).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Manage Keys' })).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '1');
  await shot(page, info, 'answer-with');
  await menu.getByRole('radio', { name: /Built-In AI/ }).click();
  await expect(pill).toContainText('Built-In AI');
  await tool.getByRole('textbox').fill('How many steps are there?');
  await tool.getByRole('textbox').press('Enter');
  await expect(tool.getByRole('article', { name: 'Answer' })).toContainText('Three steps.');
  expect(sent!.ai).toBe('built-in');
  expectNoPageErrors(pageErrors);
});

test('the route is there: a signed-in question is answered as a stream, and a guest is refused', async ({
  page,
}) => {
  const token = await canvas(page);
  const res = await page.request.post('/api/ask', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      question: 'What is here?',
      passages: [
        {
          id: 'a',
          tabId: TAB,
          tabName: 'Checkout Flow',
          elementId: 'payment',
          kind: 'Shape',
          title: 'Payment Service',
          text: 'Payment Service',
        },
      ],
      ai: 'built-in',
    },
  });
  // Whatever the stack's built-in AI says, the route answers in its own shape: a stream ending in `done` or
  // `error`, or (where the stack has no `AI` binding) its refusal in words.
  if (res.status() === 200) {
    expect(res.headers()['content-type']).toContain('text/event-stream');
    const last = (await res.text())
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .at(-1)!;
    expect(['done', 'error']).toContain((JSON.parse(last.slice(6)) as { type: string }).type);
  } else {
    expect(res.status()).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'ask_unavailable' });
  }
  const guest = await page.request.post('/api/ask', { data: { question: 'x', passages: [] } });
  expect(guest.status()).toBe(403);
  expect(await guest.json()).toMatchObject({ error: 'ask_needs_account' });
});
