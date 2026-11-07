import type { Page } from '@playwright/test';
import {
  expect,
  expectNoPageErrors,
  pageOwnerHeaders,
  seedTab,
  startBlankDocument,
  test,
} from './fixtures';
import type { StoredTab } from './stored';

// Retired elements (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a Space that already
// holds an element whose kind Work Tracker #423 part 4 deleted opens, draws each as a labelled placeholder, and
// saves every one back exactly as stored, its own fields included, while the board around it is edited.

const box = (i: number) => ({
  x: 80 + (i % 5) * 260,
  y: 80 + Math.floor(i / 5) * 200,
  width: 220,
  height: 150,
});

// One of each deleted kind, each carrying the fields an older livehuddle (or livediagram) stored on it.
const RETIRED: Record<string, unknown>[] = [
  {
    shape: 'session-button',
    label: 'Start the poll',
    session: { tool: 'poll', style: 'yes-no', question: 'Ship it?', options: [] },
  },
  { shape: 'reveal', label: 'Answers', revealed: false },
  { shape: 'picker', label: 'Who goes next', pickerOptions: ['Ana', 'Ben'] },
  { shape: 'comment-pin', label: '' },
  { shape: 'action-card', label: '' },
  { shape: 'done-check', label: 'Finished reading?', responses: { u1: 'done' } },
  { shape: 'estimate', label: 'Story 12', estimateScale: 'fibonacci', responses: { u1: '5' } },
  { shape: 'temperature', label: 'How was the week?', responses: { u1: '4' } },
  { shape: 'idea-box', label: 'Ideas', ideaCards: [{ id: 'i1', text: 'Fewer meetings' }] },
  {
    shape: 'qa-board',
    label: 'Questions for Sam',
    qaNotes: [{ id: 'q1', text: 'When is the offsite?', votes: ['u1'] }],
  },
  { shape: 'agenda', label: 'Monday', agendaItems: [{ id: 'a1', title: 'Intros', minutes: 5 }] },
  { shape: 'decision', label: 'Move to weekly releases', decisionStatus: 'accepted' },
  { shape: 'roll-call', label: 'Who was here', rollCall: [{ name: 'Ana', color: '#0ea5e9' }] },
  { shape: 'quiz', label: 'Capital of France?', quizOptions: ['Paris', 'Rome'], quizAnswer: 0 },
].map((el, i) => ({ id: `r${i}`, type: 'shape', ...box(i), ...el }));

const NOTE = {
  id: 'note',
  type: 'sticky',
  x: 80,
  y: 760,
  width: 160,
  height: 160,
  label: 'Kept',
  color: 'yellow',
};

async function storedElements(page: Page): Promise<Record<string, unknown>[]> {
  const documentId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
  const headers = await pageOwnerHeaders(page, {}, documentId);
  return page.evaluate(
    async ({ id, headers }) => {
      const doc = (await (await fetch(`/api/documents/${id}`, { headers })).json()) as {
        document?: { tabs?: { id: string }[] };
      };
      const tabId = doc.document?.tabs?.[0]?.id ?? '';
      const got = (await (
        await fetch(`/api/documents/${id}/tabs/${tabId}`, { headers })
      ).json()) as StoredTab<Record<string, unknown>>;
      return got.tab?.elements ?? [];
    },
    { id: documentId, headers },
  );
}

test.describe('Retired elements', () => {
  test('draw as placeholders and save back untouched', async ({ page, pageErrors }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await startBlankDocument(page);
    await seedTab(page, [...RETIRED, NOTE]);

    for (const el of RETIRED) {
      const face = page.locator(`[data-element-id="${String(el.id)}"] [data-retired-element]`);
      await expect(face).toHaveAttribute('data-retired-element', String(el.shape));
      await expect(face).toContainText('No longer supported in livehuddle');
    }
    await expect(page.locator('[data-element-id="r9"]')).toContainText('Q&A Board');
    await expect(page.locator('[data-element-id="r0"]')).toContainText('Poll');

    // Edit the board around them: move the note, then let the autosave run.
    const note = page.locator('[data-element-id="note"]');
    const at = (await note.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x + at.width / 2 + 120, at.y + at.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => (await storedElements(page)).find((el) => el.id === 'note')?.x)
      .not.toBe(NOTE.x);

    const stored = await storedElements(page);
    for (const el of RETIRED) {
      expect(stored.find((s) => s.id === el.id)).toEqual(el);
    }

    // A reload draws them again.
    await page.reload();
    await expect(page.locator('[data-retired-element]')).toHaveCount(RETIRED.length);
    expectNoPageErrors(pageErrors);
  });

  test('an Editor deletes one like any element', async ({ page, pageErrors }) => {
    await startBlankDocument(page);
    await seedTab(page, [RETIRED[9]!, NOTE]);
    await page.locator('[data-element-id="r9"]').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-element-id="r9"]')).toHaveCount(0);
    await expect
      .poll(async () => (await storedElements(page)).some((el) => el.id === 'r9'))
      .toBe(false);
    expectNoPageErrors(pageErrors);
  });
});
